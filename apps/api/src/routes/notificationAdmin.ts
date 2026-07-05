import { Prisma, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { resendFailedEmailLog } from "../utils/leaveWorkflow.js";
import { audit } from "../utils/audit.js";
import { defaultLeaveWorkflowSteps } from "../utils/leaveWorkflow.js";

const router = Router();

const templateSchema = z.object({
  code: z.string().min(2).max(80),
  subject: z.string().min(2).max(200),
  body: z.string().min(2),
  active: z.boolean().optional()
});

const leaveWorkflowStepSchema = z.object({
  stage: z.enum(["PENDING_MANAGER_APPROVAL", "PENDING_OM_APPROVAL", "PENDING_HR_MANAGER_APPROVAL"]),
  active: z.boolean()
});

const leaveWorkflowSchema = z.object({
  steps: z.array(leaveWorkflowStepSchema).min(1)
}).refine((value) => value.steps.some((step) => step.active), "Select at least one approval step");

router.use(requireAuth, requireRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.HR_MANAGER));

router.get("/email-templates", async (_req, res) => {
  const templates = await prisma.emailTemplate.findMany({ orderBy: { code: "asc" } });
  res.json(templates);
});

router.put("/email-templates/:code", async (req, res, next) => {
  try {
    const body = templateSchema.parse({ ...req.body, code: req.params.code });
    const template = await prisma.emailTemplate.upsert({
      where: { code: body.code },
      update: { subject: body.subject, body: body.body, active: body.active ?? true },
      create: { code: body.code, subject: body.subject, body: body.body, active: body.active ?? true }
    });
    await audit(req, "UPSERT_EMAIL_TEMPLATE", "EmailTemplate", template.id, { code: template.code });
    res.json(template);
  } catch (error) {
    next(error);
  }
});

router.post("/email-templates/:code/test", async (req, res, next) => {
  try {
    const recipient = z.string().email().parse(req.body.recipient);
    const template = await prisma.emailTemplate.findUnique({ where: { code: req.params.code } });
    const log = await prisma.emailLog.create({
      data: {
        notificationKey: `TEST:${req.params.code}:${Date.now()}`,
        recipient,
        subject: template?.subject ?? `Test ${req.params.code}`,
        templateCode: req.params.code,
        status: "PENDING",
        payload: { test: true }
      }
    });
    await audit(req, "SEND_TEST_EMAIL", "EmailLog", log.id, { recipient, templateCode: req.params.code });
    res.status(202).json(log);
  } catch (error) {
    next(error);
  }
});

router.get("/email-logs", async (_req, res) => {
  const logs = await prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  res.json(logs);
});

router.get("/leave-workflows", async (_req, res) => {
  const [departments, workflows] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.approvalWorkflow.findMany({ where: { module: "LEAVE" }, include: { department: true }, orderBy: { updatedAt: "desc" } })
  ]);

  res.json({
    defaultSteps: defaultLeaveWorkflowSteps,
    departments: departments.map((department) => {
      const workflow = workflows.find((item) => item.departmentId === department.id);
      return {
        department,
        workflow: workflow ?? {
          id: null,
          module: "LEAVE",
          name: `${department.name} Leave Approval`,
          departmentId: department.id,
          active: true,
          steps: defaultLeaveWorkflowSteps
        }
      };
    })
  });
});

router.put("/leave-workflows/:departmentId", async (req, res, next) => {
  try {
    const departmentId = String(req.params.departmentId);
    const body = leaveWorkflowSchema.parse(req.body);
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) return res.status(404).json({ message: "Department not found" });

    const steps = defaultLeaveWorkflowSteps.map((step) => ({
      ...step,
      active: body.steps.find((item) => item.stage === step.stage)?.active ?? false
    }));

    const existing = await prisma.approvalWorkflow.findFirst({ where: { module: "LEAVE", departmentId } });
    const workflow = existing
      ? await prisma.approvalWorkflow.update({
          where: { id: existing.id },
          data: { name: `${department.name} Leave Approval`, active: true, steps: steps as Prisma.InputJsonValue }
        })
      : await prisma.approvalWorkflow.create({
          data: { module: "LEAVE", name: `${department.name} Leave Approval`, departmentId, active: true, steps: steps as Prisma.InputJsonValue }
        });

    await audit(req, "UPSERT_LEAVE_APPROVAL_WORKFLOW", "ApprovalWorkflow", workflow.id, { departmentId, departmentName: department.name, steps });
    res.json(workflow);
  } catch (error) {
    next(error);
  }
});

router.post("/email-logs/:id/resend", async (req, res, next) => {
  try {
    const log = await resendFailedEmailLog(String(req.params.id));
    await audit(req, "RESEND_EMAIL_NOTIFICATION", "EmailLog", log.id, { recipient: log.recipient, templateCode: log.templateCode });
    res.json(log);
  } catch (error) {
    next(error);
  }
});

export default router;
