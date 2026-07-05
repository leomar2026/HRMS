import { ApprovalStatus, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { AppError } from "../middleware/error.js";
import { audit } from "../utils/audit.js";
import { applyFinalLeaveApproval, approvalStatusForDecision, findHrManagerUsers, getLeaveApprovalWorkflow, leaveStages, notifyLeaveAction, nextStageForApproval, workflowStepForStage } from "../utils/leaveWorkflow.js";

const router = Router();

const decisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "RETURN_FOR_CORRECTION"]),
  comments: z.string().max(500).optional()
});

router.use(requireAuth, requireRoles(Role.OPERATIONS_MANAGER, Role.ADMIN, Role.SUPER_ADMIN));

router.get("/leave-approvals", async (req, res, next) => {
  try {
    const leaves = await prisma.leaveRequest.findMany({
      where: {
        workflowStage: leaveStages.pendingOm,
        status: ApprovalStatus.PENDING,
        ...(req.user?.role === Role.OPERATIONS_MANAGER && req.user.employeeId ? { OR: [{ omApproverId: req.user.employeeId }, { omApproverId: null }] } : {})
      },
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
    const id = String(req.params.id);
    const body = decisionSchema.parse(req.body);
    if (body.decision !== "APPROVE" && !body.comments) throw new AppError(400, "Comments are required for rejection or return");

    const leave = await prisma.leaveRequest.findUnique({ where: { id }, include: { employee: { include: { department: true } } } });
    if (!leave) throw new AppError(404, "Leave request not found");
    if (leave.employeeId === req.user?.employeeId) throw new AppError(403, "OM cannot approve their own leave");
    if (leave.workflowStage !== leaveStages.pendingOm) throw new AppError(400, "Leave is not pending OM approval");
    if (req.user?.role === Role.OPERATIONS_MANAGER && leave.omApproverId && leave.omApproverId !== req.user.employeeId) {
      throw new AppError(403, "Leave request is outside your OM approval scope");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const workflow = await getLeaveApprovalWorkflow(tx, leave.employee.departmentId);
      const nextStage = body.decision === "APPROVE" ? nextStageForApproval(leave.workflowStage, workflow) : body.decision === "REJECT" ? leaveStages.rejected : leaveStages.returned;
      const nextStep = workflowStepForStage(nextStage, workflow);
      const nextStatus = approvalStatusForDecision(body.decision, nextStage === leaveStages.finalApproved);
      const hrUsers = body.decision === "APPROVE" && nextStep?.role === "HR_MANAGER" ? await findHrManagerUsers(tx) : [];
      const result = await tx.leaveRequest.update({
        where: { id },
        data: { workflowStage: nextStage, status: nextStatus, comments: body.comments, approvedBy: req.user?.id, decidedAt: new Date(), hrApproverId: hrUsers[0]?.employeeId }
      });
      if (body.decision === "APPROVE" && nextStage === leaveStages.finalApproved) await applyFinalLeaveApproval(tx, leave);
      await tx.approvalHistory.create({
        data: { leaveRequestId: id, module: "Leave", entityId: id, status: nextStatus, comments: body.comments ?? "OM approved", actedBy: req.user?.id }
      });
      await notifyLeaveAction(tx, {
        leave: { ...result, employee: leave.employee },
        action: `OM_${body.decision}`,
        actorName: req.user?.email ?? "OM",
        actorRole: "OM",
        comments: body.comments,
        recipients: [
          {
            keySuffix: "employee",
            employeeId: leave.employeeId,
            email: leave.employee.email,
            title: body.decision === "APPROVE" ? "Leave approved by OM" : `Leave ${body.decision.toLowerCase().replace(/_/g, " ")}`,
            message: body.decision === "APPROVE" ? `Your leave request ${leave.requestNumber} has been approved by OM${nextStep ? ` and is pending ${nextStep.label} approval` : " and is Final Approved"}.` : `OM decision recorded for ${leave.requestNumber}.`,
            link: "/employee/leaves"
          }
        ]
      });
      if (body.decision === "APPROVE" && hrUsers.length) {
        await notifyLeaveAction(tx, {
          leave: { ...result, employee: leave.employee },
          action: "PENDING_HR_MANAGER",
          actorName: req.user?.email ?? "OM",
          actorRole: "OM",
          recipients: hrUsers.map((user) => ({
            keySuffix: `hr-${user.id}`,
            userId: user.id,
            employeeId: user.employeeId,
            email: user.email,
            title: "HR Manager leave approval pending",
            message: `${leave.requestNumber} is pending HR Manager approval.`,
            link: "/leave"
          }))
        });
      }
      return result;
    });

    await audit(req, `OM_${body.decision}`, "LeaveRequest", id, { previousStatus: leave.workflowStage, newStatus: updated.workflowStage, comments: body.comments });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
