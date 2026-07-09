import { ApprovalStatus, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";
import { applyFinalLeaveApproval, approvalStatusForDecision, findHrManagerUsers, findOmUsers, getLeaveApprovalWorkflow, leaveStages, notifyLeaveAction, nextStageForApproval, workflowStepForStage } from "../utils/leaveWorkflow.js";

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
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const [manager, directReports, pendingLeaves, onLeave, scheduledLeaves, recentApprovals] = await Promise.all([
      prisma.employee.findUnique({ where: { id: managerId }, include: { department: true } }),
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
    const directReportIds = directReports.map((employee) => employee.id);
    const [presentToday, pendingLoans, pendingBusinessTrips, pendingPettyCash, pendingResignations, teamAttendanceToday] = directReportIds.length
      ? await Promise.all([
          prisma.attendance.count({ where: { employeeId: { in: directReportIds }, status: "PRESENT", workDate: { gte: todayStart, lt: todayEnd } } }),
          prisma.employeeLoanRequest.count({ where: { employeeId: { in: directReportIds }, status: { in: ["PENDING_MANAGER", "PENDING_HR_MANAGER", "PENDING_FINANCE", "PENDING_ADMIN"] as never[] } } }),
          prisma.businessTripRequest.count({ where: { employeeId: { in: directReportIds }, status: { in: ["PENDING_MANAGER", "PENDING_HR_MANAGER", "PENDING_FINANCE", "PENDING_ADMIN"] as never[] } } }),
          prisma.pettyCashRequest.count({ where: { employeeId: { in: directReportIds }, status: { in: ["PENDING_MANAGER", "PENDING_HR_MANAGER", "PENDING_FINANCE", "PENDING_ADMIN"] as never[] } } }),
          prisma.resignationRequest.count({ where: { employeeId: { in: directReportIds }, status: { in: ["PENDING_MANAGER", "PENDING_HR_MANAGER", "PENDING_FINANCE", "PENDING_ADMIN"] as never[] } } }),
          prisma.attendance.findMany({ where: { employeeId: { in: directReportIds }, workDate: { gte: todayStart, lt: todayEnd } }, include: { employee: { include: { department: true } } }, orderBy: { checkIn: "asc" } })
        ])
      : [0, 0, 0, 0, 0, []];
    const pendingApprovals = pendingLeaves.map((leave) => ({
      id: leave.id,
      requestType: "Leave",
      requestNumber: leave.requestNumber,
      employee: leave.employee,
      department: leave.employee.department,
      submittedDate: leave.createdAt,
      currentStatus: leave.workflowStage,
      agingDays: Math.max(0, Math.floor((now.getTime() - leave.createdAt.getTime()) / 86400000)),
      actionUrl: "/manager/leave-approvals"
    }));

    res.json({
      manager,
      directReportsCount: directReports.length,
      directReports,
      pendingLeaves,
      pendingApprovals,
      employeesCurrentlyOnLeave: onLeave,
      employeesScheduledForLeave: scheduledLeaves,
      employeesPresentToday: presentToday,
      employeesOnLeaveToday: onLeave,
      pendingLoans,
      pendingBusinessTrips,
      pendingPettyCash,
      pendingResignations,
      pendingAttendanceAdjustments: 0,
      upcomingTeamLeaves: scheduledLeaves,
      teamDocumentExpiryAlerts: directReports.filter((employee) => employee.medicalInsuranceExpiryDate || employee.contractExpiryDate).length,
      teamAttendanceToday,
      recentApprovals
    });
  } catch (error) {
    next(error);
  }
});

router.get("/team", async (req, res, next) => {
  try {
    const managerId = requireManagerEmployeeId(req.user?.employeeId);
    const directReports = await prisma.employee.findMany({
      where: { managerId, archivedAt: null },
      include: {
        department: true,
        user: { select: { role: true, portalStatus: true } },
        leaves: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            requestNumber: true,
            type: true,
            startDate: true,
            endDate: true,
            days: true,
            status: true,
            workflowStage: true,
            createdAt: true
          }
        }
      },
      orderBy: { employeeCode: "asc" }
    });
    res.json(directReports);
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

router.get("/approvals", async (req, res, next) => {
  try {
    const managerId = requireManagerEmployeeId(req.user?.employeeId);
    const leaves = await prisma.leaveRequest.findMany({
      where: { managerId },
      include: {
        employee: { include: { department: true } },
        approvalHistory: { orderBy: { createdAt: "asc" } }
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }]
    });
    res.json(leaves);
  } catch (error) {
    next(error);
  }
});

router.get("/attendance", async (req, res, next) => {
  try {
    const managerId = requireManagerEmployeeId(req.user?.employeeId);
    const directReports = await prisma.employee.findMany({
      where: { managerId, archivedAt: null },
      select: { id: true }
    });
    const employeeIds = directReports.map((employee) => employee.id);
    if (!employeeIds.length) return res.json([]);

    const records = await prisma.attendance.findMany({
      where: { employeeId: { in: employeeIds } },
      include: { employee: { include: { department: true } } },
      orderBy: [{ workDate: "desc" }, { employee: { employeeCode: "asc" } }],
      take: 200
    });
    res.json(records);
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

    const leave = await prisma.leaveRequest.findUnique({ where: { id }, include: { employee: { include: { department: true } } } });
    if (!leave) throw new AppError(404, "Leave request not found");
    if (leave.employeeId === managerId) throw new AppError(403, "Managers cannot approve their own leave");
    if (leave.managerId !== managerId) throw new AppError(403, "Leave request is outside your reporting structure");
    if (leave.workflowStage !== leaveStages.pendingManager) throw new AppError(400, "Leave is not pending manager approval");

    const updated = await prisma.$transaction(async (tx) => {
      const workflow = await getLeaveApprovalWorkflow(tx, leave.employee.departmentId);
      const nextStage = body.decision === "APPROVE" ? nextStageForApproval(leave.workflowStage, workflow) : body.decision === "REJECT" ? leaveStages.rejected : leaveStages.returned;
      const nextStep = workflowStepForStage(nextStage, workflow);
      const nextStatus = approvalStatusForDecision(body.decision, nextStage === leaveStages.finalApproved);
      const omUsers = body.decision === "APPROVE" && nextStep?.role === "OPERATIONS_MANAGER" ? await findOmUsers(tx, leave.employee.departmentId) : [];
      const hrUsers = body.decision === "APPROVE" && nextStep?.role === "HR_MANAGER" ? await findHrManagerUsers(tx) : [];
      const result = await tx.leaveRequest.update({
        where: { id },
        data: { workflowStage: nextStage, status: nextStatus, comments: body.comments, approvedBy: req.user?.id, decidedAt: new Date(), omApproverId: omUsers[0]?.employeeId, hrApproverId: hrUsers[0]?.employeeId }
      });
      if (body.decision === "APPROVE" && nextStage === leaveStages.finalApproved) await applyFinalLeaveApproval(tx, leave);
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
      await notifyLeaveAction(tx, {
        leave: { ...result, employee: leave.employee },
        action: `MANAGER_${body.decision}`,
        actorName: req.user?.email ?? "Manager",
        actorRole: "Manager",
        comments: body.comments,
        recipients: [
          {
            keySuffix: "employee",
            employeeId: leave.employeeId,
            email: leave.employee.email,
            title: body.decision === "APPROVE" ? "Leave approved by Manager" : `Leave ${body.decision.toLowerCase().replace(/_/g, " ")}`,
            message: body.decision === "APPROVE" ? `Your leave request ${leave.requestNumber} has been approved by your Manager${nextStep ? ` and is pending ${nextStep.label} approval` : " and is Final Approved"}.` : `Manager decision recorded for ${leave.requestNumber}.`,
            link: "/employee/leaves"
          }
        ]
      });
      if (body.decision === "APPROVE" && omUsers.length) {
        await notifyLeaveAction(tx, {
          leave: { ...result, employee: leave.employee },
          action: "PENDING_OM",
          actorName: req.user?.email ?? "Manager",
          actorRole: "Manager",
          recipients: omUsers.map((user) => ({
            keySuffix: `om-${user.id}`,
            userId: user.id,
            employeeId: user.employeeId,
            email: user.email,
            title: "OM leave approval pending",
            message: `${leave.requestNumber} is pending OM approval.`,
            link: "/om/leave-approvals"
          }))
        });
      }
      if (body.decision === "APPROVE" && hrUsers.length) {
        await notifyLeaveAction(tx, {
          leave: { ...result, employee: leave.employee },
          action: "PENDING_HR_MANAGER",
          actorName: req.user?.email ?? "Manager",
          actorRole: "Manager",
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

    await audit(req, `MANAGER_${body.decision}`, "LeaveRequest", id, { previousStatus: leave.workflowStage, newStatus: updated.workflowStage, comments: body.comments });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
