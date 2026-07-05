import { ApprovalStatus, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";

const router = Router();

const decisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "RETURN_FOR_CORRECTION"]),
  comments: z.string().max(500).optional()
});

function requireManagerEmployeeId(employeeId?: string | null) {
  if (!employeeId) throw new AppError(403, "Manager profile is not linked to this user");
  return employeeId;
}

router.use(requireAuth, requireRoles(Role.DEPARTMENT_MANAGER, Role.HR_MANAGER, Role.ADMIN, Role.SUPER_ADMIN));

router.get("/dashboard", async (req, res, next) => {
  try {
    const managerId = requireManagerEmployeeId(req.user?.employeeId);
    const now = new Date();
    const [directReports, pendingLeaves, onLeave, scheduledLeaves, recentApprovals] = await Promise.all([
      prisma.employee.findMany({ where: { managerId }, include: { department: true }, orderBy: { employeeCode: "asc" } }),
      prisma.leaveRequest.findMany({
        where: { managerId, workflowStage: "PENDING_MANAGER_APPROVAL", status: ApprovalStatus.PENDING },
        include: { employee: { include: { department: true } } },
        orderBy: { createdAt: "desc" }
      }),
      prisma.leaveRequest.count({ where: { managerId, workflowStage: "FINAL_APPROVED", startDate: { lte: now }, endDate: { gte: now } } }),
      prisma.leaveRequest.count({ where: { managerId, workflowStage: "FINAL_APPROVED", startDate: { gt: now } } }),
      prisma.approvalHistory.findMany({ where: { actedBy: req.user?.id, module: "Leave" }, orderBy: { createdAt: "desc" }, take: 10 })
    ]);

    res.json({
      directReportsCount: directReports.length,
      directReports,
      pendingLeaves,
      employeesCurrentlyOnLeave: onLeave,
      employeesScheduledForLeave: scheduledLeaves,
      recentApprovals
    });
  } catch (error) {
    next(error);
  }
});

router.get("/leave-approvals", async (req, res, next) => {
  try {
    const managerId = requireManagerEmployeeId(req.user?.employeeId);
    const leaves = await prisma.leaveRequest.findMany({
      where: { managerId },
      include: { employee: { include: { department: true } }, approvalHistory: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" }
    });
    res.json(leaves);
  } catch (error) {
    next(error);
  }
});

router.patch("/leave-approvals/:id/decision", async (req, res, next) => {
  try {
    const managerId = requireManagerEmployeeId(req.user?.employeeId);
    const id = String(req.params.id);
    const body = decisionSchema.parse(req.body);
    if (body.decision !== "APPROVE" && !body.comments) throw new AppError(400, "Comments are required for rejection or return");

    const leave = await prisma.leaveRequest.findUnique({ where: { id }, include: { employee: true } });
    if (!leave) throw new AppError(404, "Leave request not found");
    if (leave.employeeId === managerId) throw new AppError(403, "Managers cannot approve their own leave");
    if (leave.managerId !== managerId) throw new AppError(403, "Leave request is outside your reporting structure");
    if (leave.workflowStage !== "PENDING_MANAGER_APPROVAL") throw new AppError(400, "Leave is not pending manager approval");

    const nextStage = body.decision === "APPROVE" ? "PENDING_HR_APPROVAL" : body.decision === "REJECT" ? "MANAGER_REJECTED" : "RETURNED_FOR_CORRECTION";
    const nextStatus = body.decision === "REJECT" ? ApprovalStatus.REJECTED : body.decision === "RETURN_FOR_CORRECTION" ? ApprovalStatus.RETURNED_FOR_CORRECTION : ApprovalStatus.PENDING;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: { workflowStage: nextStage, status: nextStatus, comments: body.comments, approvedBy: req.user?.id, decidedAt: new Date() }
      });
      await tx.approvalHistory.create({
        data: {
          leaveRequestId: id,
          module: "Leave",
          entityId: id,
          status: nextStatus,
          comments: body.comments ?? "Manager approved",
          actedBy: req.user?.id
        }
      });
      await tx.notification.create({
        data: {
          employeeId: leave.employeeId,
          title: `Leave ${body.decision.toLowerCase().replace(/_/g, " ")}`,
          message: `Manager decision recorded for ${leave.requestNumber}.`,
          category: `LEAVE_MANAGER_${body.decision}`,
          metadata: { leaveRequestId: id }
        }
      });
      if (body.decision === "APPROVE") {
        const hrUsers = await tx.user.findMany({ where: { role: { in: [Role.HR, Role.HR_MANAGER, Role.HR_OFFICER] } } });
        await tx.notification.createMany({
          data: hrUsers.map((user) => ({
            userId: user.id,
            employeeId: user.employeeId,
            title: "HR leave approval pending",
            message: `${leave.requestNumber} is pending HR approval.`,
            category: "LEAVE_HR_PENDING",
            metadata: { leaveRequestId: id }
          }))
        });
      }
      return result;
    });

    await audit(req, `MANAGER_${body.decision}`, "LeaveRequest", id, { previousStatus: leave.workflowStage, newStatus: nextStage, comments: body.comments });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
