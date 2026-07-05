import { ApprovalStatus, AttendanceStatus, LeaveType, Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { Request } from "express";
import { audit } from "./audit.js";

type Tx = Prisma.TransactionClient;

export const leaveStages = {
  draft: "DRAFT",
  pendingManager: "PENDING_MANAGER_APPROVAL",
  pendingOm: "PENDING_OM_APPROVAL",
  pendingHr: "PENDING_HR_MANAGER_APPROVAL",
  finalApproved: "FINAL_APPROVED",
  rejected: "REJECTED",
  returned: "RETURNED_FOR_CORRECTION",
  cancelled: "CANCELLED"
} as const;

export type WorkflowDecision = "APPROVE" | "REJECT" | "RETURN_FOR_CORRECTION";
export type LeaveApprovalRole = "DEPARTMENT_MANAGER" | "OPERATIONS_MANAGER" | "HR_MANAGER";

export type LeaveWorkflowStep = {
  stage: string;
  role: LeaveApprovalRole;
  label: string;
  active: boolean;
};

export const defaultLeaveWorkflowSteps: LeaveWorkflowStep[] = [
  { stage: leaveStages.pendingManager, role: "DEPARTMENT_MANAGER", label: "Direct Manager", active: true },
  { stage: leaveStages.pendingOm, role: "OPERATIONS_MANAGER", label: "Operations Manager", active: true },
  { stage: leaveStages.pendingHr, role: "HR_MANAGER", label: "HR Manager", active: true }
];

function normalizeLeaveWorkflowSteps(steps: unknown): LeaveWorkflowStep[] {
  if (!Array.isArray(steps)) return defaultLeaveWorkflowSteps;
  const byStage = new Map(defaultLeaveWorkflowSteps.map((step) => [step.stage, step]));
  return steps
    .map((step) => {
      if (!step || typeof step !== "object") return null;
      const value = step as Partial<LeaveWorkflowStep>;
      const fallback = value.stage ? byStage.get(value.stage) : undefined;
      if (!fallback) return null;
      return { ...fallback, active: value.active !== false };
    })
    .filter((step): step is LeaveWorkflowStep => Boolean(step));
}

export async function getLeaveApprovalWorkflow(tx: Tx, departmentId?: string | null) {
  const workflow = departmentId
    ? await tx.approvalWorkflow.findFirst({
        where: { module: "LEAVE", departmentId, active: true },
        include: { department: true },
        orderBy: { updatedAt: "desc" }
      })
    : null;

  return {
    id: workflow?.id,
    name: workflow?.name ?? "Default Leave Approval",
    departmentId: workflow?.departmentId ?? departmentId ?? null,
    departmentName: workflow?.department?.name,
    steps: normalizeLeaveWorkflowSteps(workflow?.steps).filter((step) => step.active)
  };
}

export function initialStageForWorkflow(workflow: Awaited<ReturnType<typeof getLeaveApprovalWorkflow>>) {
  return workflow.steps[0]?.stage ?? leaveStages.finalApproved;
}

export function workflowStatusLabel(stage: string) {
  return stage.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function nextStageForApproval(currentStage: string, workflow?: Awaited<ReturnType<typeof getLeaveApprovalWorkflow>>) {
  const steps = workflow?.steps?.length ? workflow.steps : defaultLeaveWorkflowSteps;
  const currentIndex = steps.findIndex((step) => step.stage === currentStage);
  if (currentIndex === -1) return currentStage;
  return steps[currentIndex + 1]?.stage ?? leaveStages.finalApproved;
}

export function workflowStepForStage(stage: string, workflow?: Awaited<ReturnType<typeof getLeaveApprovalWorkflow>>) {
  const steps = workflow?.steps?.length ? workflow.steps : defaultLeaveWorkflowSteps;
  return steps.find((step) => step.stage === stage);
}

export async function applyFinalLeaveApproval(
  tx: Tx,
  leave: { employeeId: string; startDate: Date; days: number; type: LeaveType }
) {
  if (leave.type === LeaveType.ANNUAL) {
    await tx.employee.update({ where: { id: leave.employeeId }, data: { leaveBalance: { decrement: leave.days } } });
  }
  await tx.attendance.createMany({
    data: Array.from({ length: leave.days }).map((_, index) => {
      const workDate = new Date(leave.startDate);
      workDate.setDate(workDate.getDate() + index);
      return { employeeId: leave.employeeId, workDate, status: AttendanceStatus.LEAVE, source: "LEAVE_APPROVAL" };
    }),
    skipDuplicates: true
  });
}

export async function findOmUsers(tx: Tx, departmentId?: string) {
  const users = await tx.user.findMany({
    where: { role: Role.OPERATIONS_MANAGER },
    include: { employee: { include: { department: true } } }
  });
  const scoped = departmentId ? users.filter((user) => !user.employee?.departmentId || user.employee.departmentId === departmentId) : users;
  return scoped.length ? scoped : users;
}

export async function findHrManagerUsers(tx: Tx) {
  return tx.user.findMany({ where: { role: { in: [Role.HR_MANAGER, Role.ADMIN, Role.SUPER_ADMIN] } }, include: { employee: true } });
}

export async function createWorkflowNotification(
  tx: Tx,
  input: {
    key: string;
    userId?: string | null;
    employeeId?: string | null;
    title: string;
    message: string;
    category: string;
    leaveRequestId: string;
    leaveRequestNumber: string;
    link?: string;
    comments?: string;
  }
) {
  await tx.notification.upsert({
    where: { notificationKey: input.key },
    update: {
      title: input.title,
      message: input.message,
      metadata: {
        leaveRequestId: input.leaveRequestId,
        leaveRequestNumber: input.leaveRequestNumber,
        link: input.link ?? "/employee/leaves",
        comments: input.comments
      }
    },
    create: {
      notificationKey: input.key,
      userId: input.userId ?? undefined,
      employeeId: input.employeeId ?? undefined,
      title: input.title,
      message: input.message,
      category: input.category,
      metadata: {
        leaveRequestId: input.leaveRequestId,
        leaveRequestNumber: input.leaveRequestNumber,
        link: input.link ?? "/employee/leaves",
        comments: input.comments
      }
    }
  });
}

export async function queueEmailLog(
  tx: Tx,
  input: {
    key: string;
    recipient?: string | null;
    subject: string;
    templateCode: string;
    leaveRequestNumber: string;
    payload: Record<string, unknown>;
  }
) {
  if (!input.recipient) return;
  await tx.emailLog.upsert({
    where: { notificationKey: input.key },
    update: { recipient: input.recipient, subject: input.subject, payload: input.payload as Prisma.InputJsonObject },
    create: {
      notificationKey: input.key,
      recipient: input.recipient,
      subject: input.subject,
      templateCode: input.templateCode,
      leaveRequestNumber: input.leaveRequestNumber,
      status: "PENDING",
      payload: input.payload as Prisma.InputJsonObject
    }
  });
}

export async function notifyLeaveAction(
  tx: Tx,
  input: {
    leave: {
      id: string;
      requestNumber: string;
      type: string;
      startDate: Date;
      endDate: Date;
      days: number;
      availableBalanceAtRequest: number | null;
      workflowStage: string;
      employee: { id: string; employeeCode: string; firstName: string; lastName: string; email: string; jobTitle: string; leaveBalance: number; department?: { name: string } | null };
    };
    action: string;
    actorName: string;
    actorRole: string;
    comments?: string;
    recipients: Array<{ keySuffix: string; userId?: string | null; employeeId?: string | null; email?: string | null; title: string; message: string; link?: string }>;
  }
) {
  const employeeName = `${input.leave.employee.firstName} ${input.leave.employee.lastName}`;
  const payload = {
    employee_name: employeeName,
    employee_id: input.leave.employee.employeeCode,
    department: input.leave.employee.department?.name ?? "",
    designation: input.leave.employee.jobTitle,
    leave_request_number: input.leave.requestNumber,
    leave_type: input.leave.type,
    start_date: input.leave.startDate.toISOString().slice(0, 10),
    end_date: input.leave.endDate.toISOString().slice(0, 10),
    requested_days: input.leave.days,
    approved_days: input.leave.workflowStage === leaveStages.finalApproved ? input.leave.days : "",
    available_balance: input.leave.availableBalanceAtRequest ?? input.leave.employee.leaveBalance,
    updated_balance: input.leave.employee.leaveBalance,
    request_status: workflowStatusLabel(input.leave.workflowStage),
    approver_name: input.actorName,
    approver_role: input.actorRole,
    approval_comments: input.comments ?? "",
    approval_date: new Date().toISOString()
  };

  for (const recipient of input.recipients) {
    const key = `${input.leave.id}:${input.action}:${recipient.keySuffix}`;
    await createWorkflowNotification(tx, {
      key,
      userId: recipient.userId,
      employeeId: recipient.employeeId,
      title: recipient.title,
      message: recipient.message,
      category: `LEAVE_${input.action}`,
      leaveRequestId: input.leave.id,
      leaveRequestNumber: input.leave.requestNumber,
      link: recipient.link,
      comments: input.comments
    });
    await queueEmailLog(tx, {
      key,
      recipient: recipient.email,
      subject: recipient.title,
      templateCode: `LEAVE_${input.action}`,
      leaveRequestNumber: input.leave.requestNumber,
      payload
    });
  }
}

export async function auditLeaveWorkflow(
  req: Request,
  action: string,
  leaveId: string,
  details: Record<string, unknown>
) {
  await audit(req, action, "LeaveRequest", leaveId, details);
}

export async function resendFailedEmailLog(id: string) {
  return prisma.emailLog.update({
    where: { id },
    data: { status: "PENDING", retryCount: { increment: 1 }, failureReason: null }
  });
}

export function approvalStatusForDecision(decision: WorkflowDecision, finalApproval = false) {
  if (decision === "REJECT") return ApprovalStatus.REJECTED;
  if (decision === "RETURN_FOR_CORRECTION") return ApprovalStatus.RETURNED_FOR_CORRECTION;
  return finalApproval ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING;
}
