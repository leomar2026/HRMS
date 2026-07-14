import { Router } from "express";
import { LeaveType, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { AppError } from "../middleware/error.js";
import { audit } from "../utils/audit.js";
import { applyFinalLeaveApproval, approvalStatusForDecision, leaveStages, notifyLeaveAction } from "../utils/leaveWorkflow.js";
import { generateDocumentNumber } from "../utils/numberSeries.js";

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

const cancelSchema = z.object({
  comments: z.string().max(500).optional()
});

const adminLeaveEditSchema = z.object({
  type: z.nativeEnum(LeaveType).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  days: z.coerce.number().int().min(1).optional(),
  reason: z.string().optional(),
  workflowStage: z.string().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "RETURNED_FOR_CORRECTION", "CANCELLED"]).optional(),
  managerId: z.string().optional(),
  omApproverId: z.string().optional(),
  hrApproverId: z.string().optional(),
  comments: z.string().optional(),
  changeReason: z.string().min(3)
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
        requestNumber: await generateDocumentNumber("LEAVE_REQUEST"),
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

router.patch("/:id/cancel", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const { comments } = cancelSchema.parse(req.body);
    const leave = await prisma.leaveRequest.findUnique({ where: { id }, include: { employee: true } });
    if (!leave) throw new AppError(404, "Leave request not found");
    const cancelRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.HR_MANAGER, Role.HR_OFFICER];
    const privileged = cancelRoles.includes(req.user?.role as Role);
    if (!privileged && leave.employeeId !== req.user?.employeeId) throw new AppError(403, "You can only cancel your own leave request");
    if (["REJECTED", "CANCELLED"].includes(leave.status)) throw new AppError(400, "Leave request is already closed");

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: "CANCELLED",
          workflowStage: "CANCELLED",
          comments: comments ?? leave.comments,
          decidedAt: new Date()
        }
      });
      await tx.approvalHistory.create({
        data: {
          leaveRequestId: id,
          module: "Leave",
          entityId: id,
          status: "CANCELLED",
          comments: comments ?? "Leave cancelled",
          actedBy: req.user?.id
        }
      });
      if (leave.status === "APPROVED" && leave.type === "ANNUAL") {
        await tx.employee.update({ where: { id: leave.employeeId }, data: { leaveBalance: { increment: leave.days } } });
      }
      return result;
    });
    await audit(req, "CANCEL", "LeaveRequest", id, { comments }, leave, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = adminLeaveEditSchema.parse(req.body);
    const { changeReason, ...leaveBody } = body;
    const previous = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!previous) throw new AppError(404, "Leave request not found");
    const updated = await prisma.leaveRequest.update({ where: { id }, data: leaveBody });
    await prisma.approvalHistory.create({
      data: {
        leaveRequestId: id,
        module: "Leave",
        entityId: id,
        status: updated.status,
        comments: `Admin edit: ${changeReason}`,
        actedBy: req.user?.id
      }
    });
    await audit(req, "ADMIN_EDIT", "LeaveRequest", id, { fields: Object.keys(leaveBody), reason: changeReason }, previous, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/decision", requireRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.HR, Role.HR_MANAGER, Role.HR_OFFICER), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const { decision, comments } = decisionSchema.parse(req.body);
    if (decision !== "APPROVE" && !comments) throw new AppError(400, "Comments are required for rejection or return");
    const leave = await prisma.leaveRequest.findUnique({ where: { id }, include: { employee: { include: { department: true } } } });
    if (!leave) throw new AppError(404, "Leave request not found");
    if (leave.employeeId === req.user?.employeeId) throw new AppError(403, "You cannot approve your own leave request");
    if (leave.workflowStage !== leaveStages.pendingHr) throw new AppError(400, "Leave is not pending HR Manager approval");

    const nextStage = decision === "APPROVE" ? leaveStages.finalApproved : decision === "REJECT" ? leaveStages.rejected : leaveStages.returned;
    const nextStatus = approvalStatusForDecision(decision, decision === "APPROVE");

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
      if (decision === "APPROVE") await applyFinalLeaveApproval(tx, leave);
      const refreshedEmployee = await tx.employee.findUnique({ where: { id: leave.employeeId }, include: { department: true } });
      const managerUser = leave.managerId ? await tx.user.findUnique({ where: { employeeId: leave.managerId } }) : null;
      const omUser = leave.omApproverId ? await tx.user.findUnique({ where: { employeeId: leave.omApproverId } }) : null;
      await notifyLeaveAction(tx, {
        leave: { ...result, employee: refreshedEmployee ?? leave.employee },
        action: `HR_MANAGER_${decision}`,
        actorName: req.user?.email ?? "HR Manager",
        actorRole: "HR Manager",
        comments,
        recipients: [
          {
            keySuffix: "employee",
            employeeId: leave.employeeId,
            email: leave.employee.email,
            title: decision === "APPROVE" ? "Leave Final Approved" : `Leave ${decision.toLowerCase().replace(/_/g, " ")}`,
            message: decision === "APPROVE" ? `Your leave request ${leave.requestNumber} has been Final Approved.` : `HR Manager decision recorded for ${leave.requestNumber}.`,
            link: "/employee/leaves"
          },
          ...(decision === "APPROVE"
            ? [
                {
                  keySuffix: "manager-info",
                  userId: managerUser?.id,
                  employeeId: leave.managerId,
                  email: managerUser?.email,
                  title: "Leave Final Approved",
                  message: `${leave.requestNumber} has been Final Approved by HR Manager.`,
                  link: "/manager/leave-approvals"
                },
                {
                  keySuffix: "om-info",
                  userId: omUser?.id,
                  employeeId: leave.omApproverId,
                  email: omUser?.email,
                  title: "Leave Final Approved",
                  message: `${leave.requestNumber} has been Final Approved by HR Manager.`,
                  link: "/om/leave-approvals"
                }
              ].filter((recipient) => recipient.userId || recipient.employeeId)
            : [])
        ]
      });
      if (decision === "APPROVE" && leave.type === "ANNUAL") {
        await tx.auditLog.create({
          data: {
            userId: req.user?.id,
            action: "LEAVE_BALANCE_DEDUCTION",
            entity: "LeaveRequest",
            entityId: id,
            metadata: { leaveRequestNumber: leave.requestNumber, employeeId: leave.employee.employeeCode, days: leave.days }
          }
        });
      }
      return result;
    });

    await audit(req, `HR_${decision}`, "LeaveRequest", updated.id, { previousStatus: leave.workflowStage, newStatus: nextStage, comments });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
