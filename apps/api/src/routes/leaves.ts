import { Router } from "express";
import { LeaveType, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { AppError } from "../middleware/error.js";
import { audit } from "../utils/audit.js";

const router = Router();

const requestSchema = z.object({
  employeeId: z.string().optional(),
  type: z.nativeEnum(LeaveType),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().optional()
});

const decisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "RETURN_FOR_CORRECTION"]),
  comments: z.string().max(500).optional()
});

function daysBetween(start: Date, end: Date) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
}

router.use(requireAuth);

router.get("/", async (req, res) => {
  const where = req.user?.role === Role.EMPLOYEE ? { employeeId: req.user.employeeId ?? "" } : {};
  const leaves = await prisma.leaveRequest.findMany({ where, include: { employee: true }, orderBy: { createdAt: "desc" } });
  res.json(leaves);
});

router.post("/", async (req, res, next) => {
  try {
    const body = requestSchema.parse(req.body);
    const employeeId = req.user?.role === Role.EMPLOYEE ? req.user.employeeId : body.employeeId;
    if (!employeeId) throw new AppError(400, "employeeId is required");

    const days = daysBetween(body.startDate, body.endDate);
    const leave = await prisma.leaveRequest.create({
      data: {
        employeeId,
        type: body.type,
        startDate: body.startDate,
        endDate: body.endDate,
        days,
        reason: body.reason
      }
    });

    await audit(req, "CREATE", "LeaveRequest", leave.id, { days, type: body.type });
    res.status(201).json(leave);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/decision", requireRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.HR, Role.HR_MANAGER, Role.HR_OFFICER), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const { decision, comments } = decisionSchema.parse(req.body);
    if (decision !== "APPROVE" && !comments) throw new AppError(400, "Comments are required for rejection or return");
    const leave = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) throw new AppError(404, "Leave request not found");
    if (leave.employeeId === req.user?.employeeId) throw new AppError(403, "You cannot approve your own leave request");
    if (!["PENDING_HR_APPROVAL", "PENDING_MANAGER_APPROVAL"].includes(leave.workflowStage)) throw new AppError(400, "Leave is not pending HR approval");

    const nextStage = decision === "APPROVE" ? "FINAL_APPROVED" : decision === "REJECT" ? "HR_REJECTED" : "RETURNED_FOR_CORRECTION";
    const nextStatus = decision === "APPROVE" ? "APPROVED" : decision === "REJECT" ? "REJECTED" : "RETURNED_FOR_CORRECTION";

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id: leave.id },
        data: { status: nextStatus, workflowStage: nextStage, comments, approvedBy: req.user?.id, decidedAt: new Date() }
      });
      await tx.approvalHistory.create({
        data: {
          leaveRequestId: id,
          module: "Leave",
          entityId: id,
          status: nextStatus,
          comments: comments ?? "HR approved",
          actedBy: req.user?.id
        }
      });
      if (decision === "APPROVE" && leave.type === "ANNUAL") {
        await tx.employee.update({ where: { id: leave.employeeId }, data: { leaveBalance: { decrement: leave.days } } });
      }
      await tx.notification.create({
        data: {
          employeeId: leave.employeeId,
          title: `Leave ${decision.toLowerCase().replace(/_/g, " ")}`,
          message: `HR decision recorded for ${leave.requestNumber}.`,
          category: `LEAVE_HR_${decision}`,
          metadata: { leaveRequestId: id }
        }
      });
      return result;
    });

    await audit(req, `HR_${decision}`, "LeaveRequest", updated.id, { previousStatus: leave.workflowStage, newStatus: nextStage, comments });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
