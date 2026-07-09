import { Prisma, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { AppError } from "../middleware/error.js";
import { audit } from "../utils/audit.js";
import { csvFile, xlsxFile } from "../utils/uploadParsers.js";

const router = Router();
const adminRoles = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR] as const;

const stepSchema = z.object({
  stepNumber: z.coerce.number().int().min(1),
  approverType: z.string().min(2),
  approverUserOrRole: z.string().optional(),
  required: z.coerce.boolean().default(true),
  approvalMode: z.enum(["SEQUENTIAL", "PARALLEL"]).default("SEQUENTIAL"),
  slaDays: z.coerce.number().int().min(0).default(2),
  reminderDays: z.coerce.number().int().min(0).default(1),
  escalationApprover: z.string().optional(),
  approveAllowed: z.coerce.boolean().default(true),
  rejectAllowed: z.coerce.boolean().default(true),
  returnAllowed: z.coerce.boolean().default(true),
  allowDelegation: z.coerce.boolean().default(false),
  allowReassignment: z.coerce.boolean().default(false),
  commentsRequiredForRejection: z.coerce.boolean().default(true),
  commentsRequiredForReturn: z.coerce.boolean().default(true),
  finalApprovalStep: z.coerce.boolean().default(false)
});

const workflowSchema = z.object({
  workflowCode: z.string().min(2),
  workflowName: z.string().min(2),
  processType: z.string().min(2),
  company: z.string().optional(),
  branch: z.string().optional(),
  department: z.string().optional(),
  employeeGroup: z.string().optional(),
  leaveType: z.string().optional(),
  amountThreshold: z.coerce.number().optional(),
  effectiveStartDate: z.coerce.date().optional(),
  effectiveEndDate: z.coerce.date().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]).default("DRAFT"),
  description: z.string().optional(),
  steps: z.array(stepSchema).min(1)
});

router.use(requireAuth);

router.get("/", requireRoles(...adminRoles, Role.AUDITOR), async (_req, res) => {
  const workflows = await prisma.workflowDefinition.findMany({ orderBy: { updatedAt: "desc" } });
  res.json(workflows);
});

router.post("/", requireRoles(...adminRoles), async (req, res, next) => {
  try {
    const body = workflowSchema.parse(req.body);
    const workflow = await prisma.workflowDefinition.create({
      data: { ...body, createdBy: req.user?.id, updatedBy: req.user?.id }
    });
    await audit(req, "CREATE", "WorkflowDefinition", workflow.id, { workflowCode: workflow.workflowCode }, undefined, workflow);
    res.status(201).json(workflow);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireRoles(...adminRoles), async (req, res, next) => {
  try {
    const body = workflowSchema.partial().parse(req.body);
    const previous = await prisma.workflowDefinition.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) throw new AppError(404, "Workflow not found");
    const updated = await prisma.workflowDefinition.update({
      where: { id: previous.id },
      data: { ...body, updatedBy: req.user?.id }
    });
    await audit(req, "UPDATE", "WorkflowDefinition", updated.id, { fields: Object.keys(body) }, previous, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireRoles(...adminRoles), async (req, res, next) => {
  try {
    const previous = await prisma.workflowDefinition.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) throw new AppError(404, "Workflow not found");
    const updated = await prisma.workflowDefinition.update({ where: { id: previous.id }, data: { status: "INACTIVE", updatedBy: req.user?.id } });
    await audit(req, "DEACTIVATE", "WorkflowDefinition", updated.id, undefined, previous, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/copy", requireRoles(...adminRoles), async (req, res, next) => {
  try {
    const previous = await prisma.workflowDefinition.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) throw new AppError(404, "Workflow not found");
    const workflow = await prisma.workflowDefinition.create({
      data: {
        workflowCode: `${previous.workflowCode}-COPY-${Date.now()}`,
        workflowName: `${previous.workflowName} Copy`,
        processType: previous.processType,
        company: previous.company,
        branch: previous.branch,
        department: previous.department,
        employeeGroup: previous.employeeGroup,
        leaveType: previous.leaveType,
        amountThreshold: previous.amountThreshold,
        effectiveStartDate: previous.effectiveStartDate,
        effectiveEndDate: previous.effectiveEndDate,
        status: "DRAFT",
        description: previous.description,
        steps: previous.steps as Prisma.InputJsonValue,
        createdBy: req.user?.id,
        updatedBy: req.user?.id
      }
    });
    await audit(req, "COPY", "WorkflowDefinition", workflow.id, { sourceId: previous.id }, previous, workflow);
    res.status(201).json(workflow);
  } catch (error) {
    next(error);
  }
});

router.get("/export.csv", requireRoles(...adminRoles, Role.AUDITOR), async (req, res) => {
  const rows = await prisma.workflowDefinition.findMany({ orderBy: { updatedAt: "desc" } });
  await audit(req, "EXPORT", "WorkflowDefinition", undefined, { format: "CSV", count: rows.length });
  csvFile(res, "approval-workflows.csv", ["Workflow Code", "Workflow Name", "Process", "Company", "Branch", "Department", "Steps", "Status", "Effective Start", "Effective End"], rows.map((row) => [row.workflowCode, row.workflowName, row.processType, row.company ?? "", row.branch ?? "", row.department ?? "", Array.isArray(row.steps) ? row.steps.length : 0, row.status, row.effectiveStartDate?.toISOString().slice(0, 10) ?? "", row.effectiveEndDate?.toISOString().slice(0, 10) ?? ""]));
});

router.get("/export.xlsx", requireRoles(...adminRoles, Role.AUDITOR), async (req, res) => {
  const rows = await prisma.workflowDefinition.findMany({ orderBy: { updatedAt: "desc" } });
  await audit(req, "EXPORT", "WorkflowDefinition", undefined, { format: "XLSX", count: rows.length });
  await xlsxFile(res, "approval-workflows.xlsx", ["Workflow Code", "Workflow Name", "Process", "Company", "Branch", "Department", "Steps", "Status", "Effective Start", "Effective End"], rows.map((row) => [row.workflowCode, row.workflowName, row.processType, row.company ?? "", row.branch ?? "", row.department ?? "", Array.isArray(row.steps) ? row.steps.length : 0, row.status, row.effectiveStartDate?.toISOString().slice(0, 10) ?? "", row.effectiveEndDate?.toISOString().slice(0, 10) ?? ""]), "Approval Workflows");
});

export default router;
