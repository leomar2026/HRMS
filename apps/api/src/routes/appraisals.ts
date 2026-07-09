import { Prisma, Role, WorkflowStatus } from "@prisma/client";
import PDFDocument from "pdfkit";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { AppError } from "../middleware/error.js";
import { audit } from "../utils/audit.js";
import { companyPrintHeader, getCurrentCompanyProfile } from "../utils/companyProfile.js";
import { csvFile, numberValue, rowsFromUpload, xlsxFile, xlsxTemplate } from "../utils/uploadParsers.js";

const router = Router();
const adminRoles = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR];
const reviewRoles = [...adminRoles, Role.DEPARTMENT_MANAGER, Role.OPERATIONS_MANAGER];
const salaryAppraisalRoles = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR, Role.FINANCE, Role.ACCOUNTANT, Role.DEPARTMENT_MANAGER, Role.OPERATIONS_MANAGER];
const finalApprovalRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];
const managerAppraisalRoles: Role[] = [Role.DEPARTMENT_MANAGER, Role.OPERATIONS_MANAGER];

const periodSchema = z.object({
  code: z.string().min(2),
  year: z.coerce.number().int(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reviewDueDate: z.coerce.date().optional(),
  status: z.string().default("DRAFT"),
  company: z.string().optional(),
  branch: z.string().optional(),
  department: z.string().optional(),
  employeeGroup: z.string().optional(),
  templateId: z.string().optional(),
  weightingMethod: z.string().optional()
});

const templateSchema = z.object({
  name: z.string().min(2),
  applicability: z.record(z.unknown()).optional(),
  ratingScale: z.record(z.unknown()).optional(),
  sections: z.record(z.unknown()).optional(),
  active: z.boolean().default(true)
});

const appraisalSchema = z.object({
  employeeId: z.string().optional(),
  periodCode: z.string().min(2),
  templateId: z.string().optional(),
  selfAssessment: z.record(z.unknown()).optional(),
  managerEvaluation: z.record(z.unknown()).optional(),
  omReview: z.record(z.unknown()).optional(),
  hrFinalization: z.record(z.unknown()).optional(),
  goalsNextPeriod: z.record(z.unknown()).optional(),
  finalScore: z.coerce.number().default(0),
  finalRating: z.string().optional(),
  recommendation: z.string().optional(),
  changeReason: z.string().optional()
});

const decisionSchema = z.object({
  action: z.enum(["SUBMIT_SELF_ASSESSMENT", "MANAGER_EVALUATE", "OM_REVIEW", "HR_FINALIZE", "PUBLISH", "RETURN_FOR_CORRECTION", "ADMIN_AMEND"]),
  comments: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
  finalScore: z.coerce.number().optional(),
  finalRating: z.string().optional(),
  recommendation: z.string().optional()
});

const manualAppraisalBaseSchema = z.object({
  employeeId: z.string().min(1),
  referenceNumber: z.string().optional(),
  appraisalType: z.string().min(1),
  effectiveDate: z.coerce.date(),
  appraisalMethod: z.enum(["Percentage", "Fixed Amount"]),
  salaryBase: z.string().default("Basic Salary"),
  applyToComponent: z.string().default("Basic Salary"),
  appraisalPercentage: z.coerce.number().min(0).default(0),
  appraisalAmount: z.coerce.number().min(0).default(0),
  newBasicSalary: z.coerce.number().min(0),
  newHousingAllowance: z.coerce.number().min(0),
  newTransportAllowance: z.coerce.number().min(0),
  newOtherAllowance: z.coerce.number().min(0),
  reason: z.string().min(1, "Reason for appraisal is mandatory."),
  customReason: z.string().optional(),
  performanceRating: z.string().optional(),
  managerRecommendation: z.string().optional(),
  hrRemarks: z.string().optional(),
  attachmentName: z.string().optional(),
  status: z.string().default("DRAFT")
});

const manualAppraisalSchema = manualAppraisalBaseSchema.superRefine((value, ctx) => {
  if (value.reason === "Other" && !value.customReason?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["customReason"], message: "Custom reason is required when reason is Other." });
  if (value.appraisalMethod === "Percentage" && value.appraisalPercentage <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["appraisalPercentage"], message: "Appraisal percentage is required." });
  if (value.appraisalMethod === "Fixed Amount" && value.appraisalAmount <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["appraisalAmount"], message: "Appraisal amount is required." });
});

const manualDecisionSchema = z.object({
  action: z.enum(["SUBMIT", "HR_MANAGER_APPROVE", "FINANCE_APPROVE", "ADMIN_FINAL_APPROVE", "REJECT", "RETURN_FOR_CORRECTION", "CANCEL", "APPLY"]),
  comments: z.string().optional()
});

const bulkUploadSchema = z.object({
  fileName: z.string().default("bulk-appraisal.csv"),
  content: z.string().optional(),
  contentBase64: z.string().optional(),
  saveAsDraft: z.boolean().default(true)
});

const bulkHeaders = ["Employee ID", "Employee Name", "Department", "Current Basic Salary", "Current Gross Salary", "Appraisal Type", "Effective Date", "Appraisal Method", "Appraisal Percentage", "Appraisal Amount", "Apply To Component", "New Basic Salary", "New Housing Allowance", "New Transportation Allowance", "New Other Allowance", "New Gross Salary", "Reason for Appraisal", "Performance Rating", "Remarks"];

router.use(requireAuth);

function timeline(previous: unknown, entry: object) {
  return [...(Array.isArray(previous) ? previous : []), entry] as Prisma.InputJsonValue;
}

function nextStatus(action: z.infer<typeof decisionSchema>["action"]) {
  if (action === "SUBMIT_SELF_ASSESSMENT") return WorkflowStatus.PENDING_MANAGER;
  if (action === "MANAGER_EVALUATE") return WorkflowStatus.PENDING_OM;
  if (action === "OM_REVIEW") return WorkflowStatus.PENDING_HR_MANAGER;
  if (action === "HR_FINALIZE") return WorkflowStatus.FINAL_APPROVED;
  if (action === "PUBLISH") return WorkflowStatus.PUBLISHED;
  if (action === "RETURN_FOR_CORRECTION") return WorkflowStatus.RETURNED_FOR_CORRECTION;
  return WorkflowStatus.DRAFT;
}

function validateKpiWeights(section?: Record<string, unknown>) {
  const kpis = Array.isArray(section?.kpis) ? section.kpis as Array<{ weight?: number }> : [];
  if (!kpis.length) return;
  const total = kpis.reduce((sum, item) => sum + Number(item.weight ?? 0), 0);
  if (Math.round(total) !== 100) throw new AppError(400, "KPI weights must total 100%.");
}

function isManagerScoped(role?: Role) {
  return Boolean(role && managerAppraisalRoles.includes(role));
}

function employeeAccessWhere(role?: Role, employeeId?: string) {
  return isManagerScoped(role) ? { managerId: employeeId ?? "__none__" } : {};
}

function manualAppraisalAccessWhere(role?: Role, employeeId?: string) {
  return isManagerScoped(role) ? { employee: { managerId: employeeId ?? "__none__" } } : {};
}

function grossSalary(employee: { basicSalary: unknown; housingAllowance: unknown; transportAllowance: unknown; otherAllowance: unknown }) {
  return numberValue(employee.basicSalary) + numberValue(employee.housingAllowance) + numberValue(employee.transportAllowance) + numberValue(employee.otherAllowance);
}

function manualGross(input: { newBasicSalary: number; newHousingAllowance: number; newTransportAllowance: number; newOtherAllowance: number }) {
  return input.newBasicSalary + input.newHousingAllowance + input.newTransportAllowance + input.newOtherAllowance;
}

function reference(prefix: string) {
  return `${prefix}-${new Date().getFullYear()}-${Date.now()}`;
}

function nextManualStatus(action: z.infer<typeof manualDecisionSchema>["action"]) {
  if (action === "SUBMIT") return { status: "SUBMITTED", approver: "HR Manager" };
  if (action === "HR_MANAGER_APPROVE") return { status: "PENDING_FINANCE_APPROVAL", approver: "Finance" };
  if (action === "FINANCE_APPROVE") return { status: "PENDING_ADMIN_FINAL_APPROVAL", approver: "Admin" };
  if (action === "ADMIN_FINAL_APPROVE") return { status: "FINAL_APPROVED", approver: undefined };
  if (action === "REJECT") return { status: "REJECTED", approver: undefined };
  if (action === "RETURN_FOR_CORRECTION") return { status: "RETURNED_FOR_CORRECTION", approver: "HR Officer" };
  if (action === "CANCEL") return { status: "CANCELLED", approver: undefined };
  return { status: "APPLIED_TO_EMPLOYEE_SALARY", approver: undefined };
}

async function notifyEmployee(employeeId: string, title: string, message: string, category: string, metadata: Prisma.InputJsonValue) {
  await prisma.notification.create({ data: { employeeId, title, message, category, metadata } }).catch(() => undefined);
}

async function applyManualAppraisal(appraisalId: string, req: Parameters<typeof audit>[0]) {
  const appraisal = await prisma.manualAppraisal.findUnique({ where: { id: appraisalId }, include: { employee: true } });
  if (!appraisal) throw new AppError(404, "Manual appraisal not found");
  if (!["FINAL_APPROVED", "APPLIED_TO_EMPLOYEE_SALARY"].includes(appraisal.status)) throw new AppError(400, "Only final approved appraisals can be applied.");
  if (appraisal.effectiveDate > new Date()) return appraisal;
  if (appraisal.appliedAt) return appraisal;
  const previousGross = grossSalary(appraisal.employee);
  const updated = await prisma.$transaction(async (tx) => {
    await tx.employeeSalaryHistory.create({
      data: {
        employeeId: appraisal.employeeId,
        appraisalId: appraisal.id,
        referenceNumber: appraisal.referenceNumber,
        effectiveDate: appraisal.effectiveDate,
        oldBasicSalary: appraisal.employee.basicSalary,
        oldGrossSalary: previousGross,
        increaseAmount: appraisal.salaryDifference,
        increasePercentage: appraisal.appraisalPercentage,
        newBasicSalary: appraisal.newBasicSalary,
        newGrossSalary: appraisal.newGrossSalary,
        reason: appraisal.customReason || appraisal.reason,
        approvedBy: req.user?.id,
        approvalDate: new Date(),
        status: "APPLIED",
        attachmentName: appraisal.attachmentName,
        remarks: appraisal.hrRemarks
      }
    });
    await tx.employee.update({
      where: { id: appraisal.employeeId },
      data: {
        basicSalary: appraisal.newBasicSalary,
        housingAllowance: appraisal.newHousingAllowance,
        transportAllowance: appraisal.newTransportAllowance,
        otherAllowance: appraisal.newOtherAllowance
      }
    });
    return tx.manualAppraisal.update({ where: { id: appraisal.id }, data: { status: "APPLIED_TO_EMPLOYEE_SALARY", appliedAt: new Date() }, include: { employee: { include: { department: true, manager: true } } } });
  });
  await audit(req, "APPLIED_TO_SALARY", "ManualAppraisal", updated.id, { employeeId: updated.employeeId, referenceNumber: updated.referenceNumber, previousGross, newGrossSalary: updated.newGrossSalary }, appraisal, updated);
  await notifyEmployee(updated.employeeId, "Salary appraisal applied", `Appraisal ${updated.referenceNumber} has been applied to employee salary.`, "APPRAISAL_APPLIED", { appraisalId: updated.id });
  return updated;
}

async function salaryProfile(employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { department: true, manager: true } });
  if (!employee) throw new AppError(404, "Employee not found");
  const lastHistory = await prisma.employeeSalaryHistory.findFirst({ where: { employeeId }, orderBy: { effectiveDate: "desc" } });
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    department: employee.department.name,
    designation: employee.jobTitle,
    branch: employee.branch,
    location: employee.location,
    reportingManager: employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "",
    joiningDate: employee.joiningDate,
    currentBasicSalary: Number(employee.basicSalary),
    currentHousingAllowance: Number(employee.housingAllowance),
    currentTransportAllowance: Number(employee.transportAllowance),
    currentOtherAllowance: Number(employee.otherAllowance),
    currentGrossSalary: grossSalary(employee),
    currentPayrollGroup: "",
    lastAppraisalDate: lastHistory?.effectiveDate,
    lastAppraisalAmount: lastHistory ? Number(lastHistory.increaseAmount) : 0,
    lastAppraisalPercentage: lastHistory ? Number(lastHistory.increasePercentage) : 0
  };
}

router.get("/eligible-employees", requireRoles(...salaryAppraisalRoles), async (req, res) => {
  const employees = await prisma.employee.findMany({
    where: { archivedAt: null, ...employeeAccessWhere(req.user?.role as Role | undefined, req.user?.employeeId ?? undefined) },
    include: { department: true, manager: true },
    orderBy: { employeeCode: "asc" }
  });
  res.json(await Promise.all(employees.map((employee) => salaryProfile(employee.id))));
});

router.get("/employees/:id/salary-profile", requireRoles(...salaryAppraisalRoles), async (req, res, next) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: String(req.params.id) } });
    if (!employee) throw new AppError(404, "Employee not found");
    if (isManagerScoped(req.user?.role as Role | undefined) && employee.managerId !== req.user?.employeeId) throw new AppError(403, "Managers can view only direct-report employees.");
    res.json(await salaryProfile(String(req.params.id)));
  } catch (error) {
    next(error);
  }
});

router.get("/manual", requireRoles(...salaryAppraisalRoles), async (req, res) => {
  res.json(await prisma.manualAppraisal.findMany({ where: { archivedAt: null, ...manualAppraisalAccessWhere(req.user?.role as Role | undefined, req.user?.employeeId ?? undefined) }, include: { employee: { include: { department: true, manager: true } } }, orderBy: { createdAt: "desc" } }));
});

router.post("/manual", requireRoles(...salaryAppraisalRoles), async (req, res, next) => {
  try {
    const body = manualAppraisalSchema.parse(req.body);
    const employee = await prisma.employee.findUnique({ where: { id: body.employeeId }, include: { department: true, manager: true } });
    if (!employee || employee.status !== "ACTIVE") throw new AppError(400, "Employee must exist and be active.");
    if (isManagerScoped(req.user?.role as Role | undefined) && employee.managerId !== req.user?.employeeId) throw new AppError(403, "Managers can create appraisals only for direct-report employees.");
    const currentGrossSalary = grossSalary(employee);
    const newGrossSalary = manualGross(body);
    if (newGrossSalary < currentGrossSalary && !finalApprovalRoles.includes(req.user?.role as Role)) throw new AppError(403, "Salary reduction requires Admin permission.");
    const duplicate = await prisma.manualAppraisal.findFirst({ where: { employeeId: employee.id, effectiveDate: body.effectiveDate, archivedAt: null, status: { notIn: ["REJECTED", "CANCELLED"] } } });
    if (duplicate) throw new AppError(409, "Duplicate appraisal for the same employee and effective date already exists.");
    const record = await prisma.manualAppraisal.create({
      data: {
        referenceNumber: body.referenceNumber || reference("MAPP"),
        employeeId: employee.id,
        appraisalType: body.appraisalType,
        effectiveDate: body.effectiveDate,
        currentBasicSalary: employee.basicSalary,
        currentHousingAllowance: employee.housingAllowance,
        currentTransportAllowance: employee.transportAllowance,
        currentOtherAllowance: employee.otherAllowance,
        currentGrossSalary,
        appraisalMethod: body.appraisalMethod,
        salaryBase: body.salaryBase,
        applyToComponent: body.applyToComponent,
        appraisalPercentage: body.appraisalPercentage,
        appraisalAmount: body.appraisalAmount,
        newBasicSalary: body.newBasicSalary,
        newHousingAllowance: body.newHousingAllowance,
        newTransportAllowance: body.newTransportAllowance,
        newOtherAllowance: body.newOtherAllowance,
        newGrossSalary,
        salaryDifference: newGrossSalary - currentGrossSalary,
        reason: body.reason,
        customReason: body.customReason,
        performanceRating: body.performanceRating,
        managerRecommendation: body.managerRecommendation,
        hrRemarks: body.hrRemarks,
        attachmentName: body.attachmentName,
        status: body.status,
        currentApprover: body.status === "DRAFT" ? undefined : "HR Manager",
        createdBy: req.user?.id,
        approvalTimeline: timeline([], { action: "CREATED", by: req.user?.email, role: req.user?.role, at: new Date().toISOString() })
      },
      include: { employee: { include: { department: true, manager: true } } }
    });
    await audit(req, "CREATED", "ManualAppraisal", record.id, { employeeId: record.employeeId, referenceNumber: record.referenceNumber, previousSalary: currentGrossSalary, newSalary: newGrossSalary, reason: body.reason });
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
});

router.patch("/manual/:id", requireRoles(...salaryAppraisalRoles), async (req, res, next) => {
  try {
    const body = manualAppraisalBaseSchema.partial().parse(req.body);
    const previous = await prisma.manualAppraisal.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) throw new AppError(404, "Manual appraisal not found");
    if (!["DRAFT", "RETURNED_FOR_CORRECTION"].includes(previous.status)) throw new AppError(400, "Only draft or returned appraisals can be edited.");
    const newGrossSalary = manualGross({
      newBasicSalary: body.newBasicSalary ?? Number(previous.newBasicSalary),
      newHousingAllowance: body.newHousingAllowance ?? Number(previous.newHousingAllowance),
      newTransportAllowance: body.newTransportAllowance ?? Number(previous.newTransportAllowance),
      newOtherAllowance: body.newOtherAllowance ?? Number(previous.newOtherAllowance)
    });
    const updated = await prisma.manualAppraisal.update({ where: { id: previous.id }, data: { ...body, newGrossSalary, salaryDifference: newGrossSalary - Number(previous.currentGrossSalary), approvalTimeline: timeline(previous.approvalTimeline, { action: "EDITED", by: req.user?.email, at: new Date().toISOString() }) }, include: { employee: { include: { department: true, manager: true } } } });
    await audit(req, "EDITED", "ManualAppraisal", updated.id, { referenceNumber: updated.referenceNumber }, previous, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.patch("/manual/:id/decision", requireRoles(...salaryAppraisalRoles), async (req, res, next) => {
  try {
    const body = manualDecisionSchema.parse(req.body);
    if (["REJECT", "RETURN_FOR_CORRECTION"].includes(body.action) && !body.comments?.trim()) throw new AppError(400, "Comments are required.");
    if (body.action === "ADMIN_FINAL_APPROVE" && !finalApprovalRoles.includes(req.user?.role as Role)) throw new AppError(403, "Final approval requires Admin.");
    const previous = await prisma.manualAppraisal.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) throw new AppError(404, "Manual appraisal not found");
    const next = nextManualStatus(body.action);
    let updated = await prisma.manualAppraisal.update({
      where: { id: previous.id },
      data: {
        status: next.status,
        currentApprover: next.approver,
        approvedBy: body.action === "ADMIN_FINAL_APPROVE" ? req.user?.id : previous.approvedBy,
        approvedAt: body.action === "ADMIN_FINAL_APPROVE" ? new Date() : previous.approvedAt,
        approvalTimeline: timeline(previous.approvalTimeline, { action: body.action, previousStatus: previous.status, newStatus: next.status, by: req.user?.email, role: req.user?.role, comments: body.comments, at: new Date().toISOString() }),
        approvalHistory: { create: { action: body.action, previousStatus: previous.status, newStatus: next.status, comments: body.comments, actedBy: req.user?.id, actedRole: req.user?.role } }
      },
      include: { employee: { include: { department: true, manager: true } } }
    });
    await audit(req, body.action, "ManualAppraisal", updated.id, { referenceNumber: updated.referenceNumber, comments: body.comments }, previous, updated);
    await notifyEmployee(updated.employeeId, "Appraisal status updated", `Appraisal ${updated.referenceNumber} status is ${updated.status}.`, `APPRAISAL_${body.action}`, { appraisalId: updated.id });
    if (body.action === "ADMIN_FINAL_APPROVE" || body.action === "APPLY") updated = await applyManualAppraisal(updated.id, req) as typeof updated;
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get("/manual/history/:employeeId", requireRoles(...salaryAppraisalRoles), async (req, res) => {
  res.json(await prisma.employeeSalaryHistory.findMany({ where: { employeeId: String(req.params.employeeId) }, orderBy: { effectiveDate: "desc" } }));
});

router.get("/manual/export.csv", requireRoles(...salaryAppraisalRoles), async (req, res) => {
  const rows = await prisma.manualAppraisal.findMany({ where: manualAppraisalAccessWhere(req.user?.role as Role | undefined, req.user?.employeeId ?? undefined), include: { employee: { include: { department: true } } }, orderBy: { createdAt: "desc" } });
  await audit(req, "EXPORTED", "ManualAppraisal", undefined, { format: "CSV", count: rows.length });
  csvFile(res, "manual-appraisals.csv", ["Reference", "Employee ID", "Employee Name", "Department", "Effective Date", "Current Salary", "Increase", "New Salary", "Reason", "Status"], rows.map((row) => [row.referenceNumber, row.employee.employeeCode, `${row.employee.firstName} ${row.employee.lastName}`, row.employee.department.name, row.effectiveDate.toISOString().slice(0, 10), row.currentGrossSalary, row.salaryDifference, row.newGrossSalary, row.customReason || row.reason, row.status]));
});

router.get("/manual/export.xlsx", requireRoles(...salaryAppraisalRoles), async (req, res) => {
  const rows = await prisma.manualAppraisal.findMany({ where: manualAppraisalAccessWhere(req.user?.role as Role | undefined, req.user?.employeeId ?? undefined), include: { employee: { include: { department: true } } }, orderBy: { createdAt: "desc" } });
  await audit(req, "EXPORTED", "ManualAppraisal", undefined, { format: "XLSX", count: rows.length });
  await xlsxFile(res, "manual-appraisals.xlsx", ["Reference", "Employee ID", "Employee Name", "Department", "Effective Date", "Current Salary", "Increase", "New Salary", "Reason", "Status"], rows.map((row) => [row.referenceNumber, row.employee.employeeCode, `${row.employee.firstName} ${row.employee.lastName}`, row.employee.department.name, row.effectiveDate.toISOString().slice(0, 10), String(row.currentGrossSalary), String(row.salaryDifference), String(row.newGrossSalary), row.customReason || row.reason, row.status]), "Manual Appraisals");
});

router.get("/manual/:id/print", requireRoles(...salaryAppraisalRoles), async (req, res, next) => {
  try {
    const appraisal = await prisma.manualAppraisal.findUnique({ where: { id: String(req.params.id) }, include: { employee: { include: { department: true, manager: true } }, approvalHistory: true } });
    if (!appraisal) return res.status(404).send("Manual appraisal not found");
    const company = await getCurrentCompanyProfile();
    await audit(req, "PRINTED", "ManualAppraisal", appraisal.id, { referenceNumber: appraisal.referenceNumber });
    const rows = [["Reference", appraisal.referenceNumber], ["Employee", `${appraisal.employee.employeeCode} - ${appraisal.employee.firstName} ${appraisal.employee.lastName}`], ["Department", appraisal.employee.department.name], ["Current Gross Salary", appraisal.currentGrossSalary], ["New Gross Salary", appraisal.newGrossSalary], ["Increase", appraisal.salaryDifference], ["Reason", appraisal.customReason || appraisal.reason], ["Status", appraisal.status], ["Printed By", req.user?.email ?? "-"], ["Printed Date", new Date().toLocaleString()]].map(([label, value]) => `<tr><td>${label}</td><td>${value ?? ""}</td></tr>`).join("");
    res.header("Content-Type", "text/html");
    res.send(`<!doctype html><html><head><title>${appraisal.referenceNumber}</title><style>body{font-family:Arial;margin:32px;font-size:12px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:7px}.head{border-bottom:2px solid #0f766e;margin-bottom:20px;padding-bottom:12px}.brand-line{display:flex;gap:16px;align-items:center}.sign{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:40px}.sig{border-top:1px solid #111;padding-top:6px;text-align:center}</style></head><body>${companyPrintHeader(company, "Manual Salary Appraisal Form")}<table><tbody>${rows}</tbody></table><h3>Approval Timeline</h3><ul>${appraisal.approvalHistory.map((item) => `<li>${item.action} - ${item.actedRole ?? ""} - ${item.createdAt.toLocaleString()}</li>`).join("")}</ul><div class="sign"><div class="sig">HR Officer</div><div class="sig">HR Manager</div><div class="sig">Finance</div><div class="sig">Admin Final Approval</div></div><script>window.print()</script></body></html>`);
  } catch (error) {
    next(error);
  }
});

router.get("/manual/:id/pdf", requireRoles(...salaryAppraisalRoles), async (req, res, next) => {
  try {
    const appraisal = await prisma.manualAppraisal.findUnique({ where: { id: String(req.params.id) }, include: { employee: { include: { department: true } } } });
    if (!appraisal) throw new AppError(404, "Manual appraisal not found");
    await audit(req, "DOWNLOADED", "ManualAppraisal", appraisal.id, { format: "PDF", referenceNumber: appraisal.referenceNumber });
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    res.header("Content-Type", "application/pdf");
    res.attachment(`${appraisal.referenceNumber}.pdf`);
    doc.pipe(res);
    doc.fontSize(16).text("Manual Salary Appraisal Form");
    doc.fontSize(9).text(`Reference: ${appraisal.referenceNumber}`);
    doc.text(`Employee: ${appraisal.employee.employeeCode} - ${appraisal.employee.firstName} ${appraisal.employee.lastName}`);
    doc.text(`Department: ${appraisal.employee.department.name}`);
    doc.text(`Current Gross Salary: ${appraisal.currentGrossSalary}`);
    doc.text(`New Gross Salary: ${appraisal.newGrossSalary}`);
    doc.text(`Increase: ${appraisal.salaryDifference}`);
    doc.text(`Reason: ${appraisal.customReason || appraisal.reason}`);
    doc.text(`Status: ${appraisal.status}`);
    doc.moveDown().text(`Printed by: ${req.user?.email ?? "-"}`);
    doc.end();
  } catch (error) {
    next(error);
  }
});

router.get("/bulk/template.csv", requireRoles(...salaryAppraisalRoles), (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.attachment("bulk-appraisal-template.csv");
  res.send(`${bulkHeaders.join(",")}\n`);
});

router.get("/bulk/template.xlsx", requireRoles(...salaryAppraisalRoles), async (_req, res) => {
  await xlsxTemplate(res, "bulk-appraisal-template.xlsx", bulkHeaders, "Bulk Appraisal");
});

async function validateBulkRows(input: z.infer<typeof bulkUploadSchema>) {
  const rows = await rowsFromUpload(input);
  const seen = new Set<string>();
  const employees = await prisma.employee.findMany({ where: { archivedAt: null }, include: { department: true } });
  return rows.map((row, index) => {
    const employeeCode = row["Employee ID"] || row["Employee Code"] || "";
    const employee = employees.find((item) => item.employeeCode === employeeCode || item.id === employeeCode);
    const errors: string[] = [];
    if (!employeeCode) errors.push("Employee ID is mandatory.");
    if (!employee || employee.status !== "ACTIVE") errors.push("Employee must exist and be active.");
    if (employeeCode && seen.has(employeeCode)) errors.push("Duplicate employee in same appraisal batch.");
    if (employeeCode) seen.add(employeeCode);
    if (!row["Effective Date"]) errors.push("Effective Date is mandatory.");
    if (!row["Appraisal Method"]) errors.push("Appraisal Method is mandatory.");
    if (!row["Appraisal Percentage"] && !row["Appraisal Amount"]) errors.push("Either Appraisal Percentage or Appraisal Amount must be provided.");
    if (!row["Reason for Appraisal"]) errors.push("Reason for Appraisal is mandatory.");
    const currentGross = employee ? grossSalary(employee) : numberValue(row["Current Gross Salary"]);
    if (employee && row["Current Gross Salary"] && Math.abs(numberValue(row["Current Gross Salary"]) - currentGross) > 0.01) errors.push("Current salary in upload does not match database salary.");
    return { rowNumber: index + 2, row, employee, errors, valid: errors.length === 0 };
  });
}

router.post("/bulk/validate", requireRoles(...salaryAppraisalRoles), async (req, res, next) => {
  try {
    const input = bulkUploadSchema.parse(req.body);
    const rows = await validateBulkRows(input);
    res.json({ valid: rows.every((row) => row.valid), totalRows: rows.length, errors: rows.filter((row) => !row.valid).map((row) => ({ row: row.rowNumber, employeeId: row.row["Employee ID"], errors: row.errors })), preview: rows.slice(0, 25).map((row) => row.row) });
  } catch (error) {
    next(error);
  }
});

router.get("/bulk", requireRoles(...salaryAppraisalRoles), async (_req, res) => {
  res.json(await prisma.appraisalBatch.findMany({ include: { details: true }, orderBy: { createdAt: "desc" } }));
});

router.post("/bulk", requireRoles(...salaryAppraisalRoles), async (req, res, next) => {
  try {
    const input = bulkUploadSchema.parse(req.body);
    const rows = await validateBulkRows(input);
    if (!rows.some((row) => row.valid)) throw new AppError(400, "No valid records found to import.");
    const validRows = rows.filter((row) => row.valid);
    const batch = await prisma.appraisalBatch.create({
      data: {
        batchNumber: reference("BAPP"),
        uploadFileName: input.fileName,
        uploadedBy: req.user?.id,
        numberOfEmployees: validRows.length,
        totalCurrentSalary: validRows.reduce((sum, item) => sum + (item.employee ? grossSalary(item.employee) : numberValue(item.row["Current Gross Salary"])), 0),
        totalIncreaseAmount: validRows.reduce((sum, item) => sum + numberValue(item.row["Appraisal Amount"]), 0),
        totalNewSalary: validRows.reduce((sum, item) => sum + numberValue(item.row["New Gross Salary"]), 0),
        status: "DRAFT",
        errorReport: rows.filter((row) => !row.valid).map((row) => ({ row: row.rowNumber, errors: row.errors })) as Prisma.InputJsonValue,
        details: {
          create: validRows.map((item) => ({
            employeeId: item.employee?.id,
            employeeCode: item.employee?.employeeCode ?? item.row["Employee ID"],
            employeeName: item.row["Employee Name"] || `${item.employee?.firstName ?? ""} ${item.employee?.lastName ?? ""}`.trim(),
            department: item.employee?.department.name ?? item.row.Department,
            currentBasicSalary: item.employee?.basicSalary ?? numberValue(item.row["Current Basic Salary"]),
            currentGrossSalary: item.employee ? grossSalary(item.employee) : numberValue(item.row["Current Gross Salary"]),
            appraisalType: item.row["Appraisal Type"] || "Salary Increase",
            effectiveDate: new Date(item.row["Effective Date"]),
            appraisalMethod: item.row["Appraisal Method"] || "Fixed Amount",
            appraisalPercentage: numberValue(item.row["Appraisal Percentage"]),
            appraisalAmount: numberValue(item.row["Appraisal Amount"]),
            applyToComponent: item.row["Apply To Component"] || "Basic Salary",
            newBasicSalary: numberValue(item.row["New Basic Salary"]),
            newHousingAllowance: numberValue(item.row["New Housing Allowance"]),
            newTransportAllowance: numberValue(item.row["New Transportation Allowance"]),
            newOtherAllowance: numberValue(item.row["New Other Allowance"]),
            newGrossSalary: numberValue(item.row["New Gross Salary"]),
            reason: item.row["Reason for Appraisal"],
            performanceRating: item.row["Performance Rating"],
            remarks: item.row.Remarks,
            validationStatus: "VALID",
            approvalStatus: "DRAFT"
          }))
        }
      },
      include: { details: true }
    });
    await audit(req, "IMPORTED", "AppraisalBatch", batch.id, { batchNumber: batch.batchNumber, count: validRows.length, errors: rows.length - validRows.length });
    res.status(201).json(batch);
  } catch (error) {
    next(error);
  }
});

router.patch("/bulk/:id/submit", requireRoles(...salaryAppraisalRoles), async (req, res, next) => {
  try {
    const batch = await prisma.appraisalBatch.update({ where: { id: String(req.params.id) }, data: { status: "SUBMITTED", currentApprover: "HR Manager" }, include: { details: true } });
    await audit(req, "SUBMITTED", "AppraisalBatch", batch.id, { batchNumber: batch.batchNumber });
    res.json(batch);
  } catch (error) {
    next(error);
  }
});

router.patch("/bulk/:id/decision", requireRoles(...salaryAppraisalRoles), async (req, res, next) => {
  try {
    const body = manualDecisionSchema.parse(req.body);
    const next = nextManualStatus(body.action);
    const batch = await prisma.appraisalBatch.update({ where: { id: String(req.params.id) }, data: { status: next.status, currentApprover: next.approver }, include: { details: true } });
    await audit(req, body.action, "AppraisalBatch", batch.id, { batchNumber: batch.batchNumber, comments: body.comments });
    res.json(batch);
  } catch (error) {
    next(error);
  }
});

router.get("/bulk/export.csv", requireRoles(...salaryAppraisalRoles), async (req, res) => {
  const batches = await prisma.appraisalBatch.findMany({ orderBy: { createdAt: "desc" } });
  await audit(req, "EXPORTED", "AppraisalBatch", undefined, { format: "CSV", count: batches.length });
  csvFile(res, "bulk-appraisal-batches.csv", ["Batch Number", "Upload File Name", "Employees", "Total Current Salary", "Total Increase", "Total New Salary", "Status", "Current Approver"], batches.map((batch) => [batch.batchNumber, batch.uploadFileName, batch.numberOfEmployees, batch.totalCurrentSalary, batch.totalIncreaseAmount, batch.totalNewSalary, batch.status, batch.currentApprover ?? ""]));
});

router.get("/bulk/export.xlsx", requireRoles(...salaryAppraisalRoles), async (req, res) => {
  const batches = await prisma.appraisalBatch.findMany({ orderBy: { createdAt: "desc" } });
  await audit(req, "EXPORTED", "AppraisalBatch", undefined, { format: "XLSX", count: batches.length });
  await xlsxFile(res, "bulk-appraisal-batches.xlsx", ["Batch Number", "Upload File Name", "Employees", "Total Current Salary", "Total Increase", "Total New Salary", "Status", "Current Approver"], batches.map((batch) => [batch.batchNumber, batch.uploadFileName, batch.numberOfEmployees, String(batch.totalCurrentSalary), String(batch.totalIncreaseAmount), String(batch.totalNewSalary), batch.status, batch.currentApprover ?? ""]), "Bulk Appraisals");
});

router.get("/periods", requireRoles(...adminRoles), async (_req, res) => {
  res.json(await prisma.appraisalPeriod.findMany({ orderBy: { createdAt: "desc" } }));
});

router.post("/periods", requireRoles(...adminRoles), async (req, res, next) => {
  try {
    const body = periodSchema.parse(req.body);
    const period = await prisma.appraisalPeriod.upsert({ where: { code: body.code }, update: body, create: { ...body, createdBy: req.user?.id } });
    await audit(req, "SAVE", "AppraisalPeriod", period.id, { code: period.code });
    res.status(201).json(period);
  } catch (error) {
    next(error);
  }
});

router.get("/templates", requireRoles(...adminRoles), async (_req, res) => {
  res.json(await prisma.appraisalTemplate.findMany({ orderBy: { createdAt: "desc" } }));
});

router.post("/templates", requireRoles(...adminRoles), async (req, res, next) => {
  try {
    const body = templateSchema.parse(req.body);
    const template = await prisma.appraisalTemplate.create({ data: { ...body, applicability: body.applicability as Prisma.InputJsonValue | undefined, ratingScale: body.ratingScale as Prisma.InputJsonValue | undefined, sections: body.sections as Prisma.InputJsonValue | undefined, createdBy: req.user?.id } });
    await audit(req, "CREATE", "AppraisalTemplate", template.id, { name: template.name });
    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res) => {
  const ownOnly = req.user?.role === Role.EMPLOYEE;
  const appraisals = await prisma.performanceAppraisal.findMany({
    where: { archivedAt: null, ...(ownOnly ? { employeeId: req.user?.employeeId ?? "", status: WorkflowStatus.PUBLISHED } : {}) },
    include: { employee: { include: { department: true, manager: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json(appraisals);
});

router.post("/", requireRoles(...adminRoles), async (req, res, next) => {
  try {
    const body = appraisalSchema.parse(req.body);
    if (!body.employeeId) throw new AppError(400, "employeeId is required");
    const appraisal = await prisma.performanceAppraisal.create({
      data: {
        referenceNumber: `APP-${Date.now()}`,
        employeeId: body.employeeId,
        periodCode: body.periodCode,
        templateId: body.templateId,
        selfAssessment: body.selfAssessment as Prisma.InputJsonValue | undefined,
        goalsNextPeriod: body.goalsNextPeriod as Prisma.InputJsonValue | undefined,
        createdBy: req.user?.id,
        approvalTimeline: timeline([], { action: "ASSIGNED", by: req.user?.email, at: new Date().toISOString() })
      },
      include: { employee: { include: { department: true } } }
    });
    await audit(req, "CREATE", "PerformanceAppraisal", appraisal.id, { referenceNumber: appraisal.referenceNumber });
    res.status(201).json(appraisal);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireRoles(...adminRoles), async (req, res, next) => {
  try {
    const body = appraisalSchema.partial().parse(req.body);
    if (!body.changeReason) throw new AppError(400, "Reason is required for appraisal amendment.");
    validateKpiWeights(body.selfAssessment);
    const previous = await prisma.performanceAppraisal.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) throw new AppError(404, "Appraisal not found");
    const publishAmendRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER];
    if (previous.status === WorkflowStatus.PUBLISHED && !publishAmendRoles.includes(req.user?.role as Role)) throw new AppError(403, "Published appraisal amendment requires Admin or HR Manager.");
    const { changeReason, ...data } = body;
    const updated = await prisma.performanceAppraisal.update({ where: { id: previous.id }, data: { ...data, selfAssessment: data.selfAssessment as Prisma.InputJsonValue | undefined, managerEvaluation: data.managerEvaluation as Prisma.InputJsonValue | undefined, omReview: data.omReview as Prisma.InputJsonValue | undefined, hrFinalization: data.hrFinalization as Prisma.InputJsonValue | undefined, goalsNextPeriod: data.goalsNextPeriod as Prisma.InputJsonValue | undefined, approvalTimeline: timeline(previous.approvalTimeline, { action: "ADMIN_AMEND", by: req.user?.email, reason: changeReason, at: new Date().toISOString() }) } });
    await audit(req, "ADMIN_AMEND", "PerformanceAppraisal", updated.id, { reason: changeReason, fields: Object.keys(data) }, previous, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/decision", requireRoles(...reviewRoles), async (req, res, next) => {
  try {
    const body = decisionSchema.parse(req.body);
    if (body.action === "RETURN_FOR_CORRECTION" && !body.comments) throw new AppError(400, "Comments are required.");
    if (body.payload) validateKpiWeights(body.payload);
    const previous = await prisma.performanceAppraisal.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) throw new AppError(404, "Appraisal not found");
    const status = nextStatus(body.action);
    const data: Prisma.PerformanceAppraisalUpdateInput = {
      status,
      finalScore: body.finalScore ?? previous.finalScore,
      finalRating: body.finalRating ?? previous.finalRating,
      recommendation: body.recommendation ?? previous.recommendation,
      publishedAt: body.action === "PUBLISH" ? new Date() : previous.publishedAt,
      approvalTimeline: timeline(previous.approvalTimeline, { action: body.action, previousStatus: previous.status, newStatus: status, by: req.user?.email, role: req.user?.role, comments: body.comments, at: new Date().toISOString() })
    };
    if (body.action === "SUBMIT_SELF_ASSESSMENT") data.selfAssessment = body.payload as Prisma.InputJsonValue;
    if (body.action === "MANAGER_EVALUATE") data.managerEvaluation = body.payload as Prisma.InputJsonValue;
    if (body.action === "OM_REVIEW") data.omReview = body.payload as Prisma.InputJsonValue;
    if (body.action === "HR_FINALIZE") data.hrFinalization = body.payload as Prisma.InputJsonValue;
    const updated = await prisma.performanceAppraisal.update({ where: { id: previous.id }, data });
    await audit(req, body.action, "PerformanceAppraisal", updated.id, { comments: body.comments, status }, previous, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get("/export.csv", requireRoles(...adminRoles, Role.AUDITOR), async (req, res) => {
  const appraisals = await prisma.performanceAppraisal.findMany({ include: { employee: { include: { department: true, manager: true } } }, orderBy: { createdAt: "desc" } });
  const headers = ["Reference", "Employee ID", "Employee Name", "Department", "Designation", "Period", "Manager", "Status", "Final Score", "Final Rating", "Published Date"];
  await audit(req, "EXPORT", "PerformanceAppraisal", undefined, { format: "CSV", count: appraisals.length });
  csvFile(res, "performance-appraisals.csv", headers, appraisals.map((item) => [item.referenceNumber, item.employee.employeeCode, `${item.employee.firstName} ${item.employee.lastName}`, item.employee.department.name, item.employee.jobTitle, item.periodCode, item.employee.manager ? `${item.employee.manager.firstName} ${item.employee.manager.lastName}` : "", item.status, item.finalScore, item.finalRating ?? "", item.publishedAt?.toISOString() ?? ""]));
});

router.get("/export.xlsx", requireRoles(...adminRoles, Role.AUDITOR), async (req, res) => {
  const appraisals = await prisma.performanceAppraisal.findMany({ include: { employee: { include: { department: true, manager: true } } }, orderBy: { createdAt: "desc" } });
  const headers = ["Reference", "Employee ID", "Employee Name", "Department", "Designation", "Period", "Manager", "Status", "Final Score", "Final Rating", "Published Date"];
  await audit(req, "EXPORT", "PerformanceAppraisal", undefined, { format: "XLSX", count: appraisals.length });
  await xlsxFile(res, "performance-appraisals.xlsx", headers, appraisals.map((item) => [item.referenceNumber, item.employee.employeeCode, `${item.employee.firstName} ${item.employee.lastName}`, item.employee.department.name, item.employee.jobTitle, item.periodCode, item.employee.manager ? `${item.employee.manager.firstName} ${item.employee.manager.lastName}` : "", item.status, String(item.finalScore), item.finalRating ?? "", item.publishedAt?.toISOString() ?? ""]), "Appraisals");
});

router.get("/:id/print", async (req, res, next) => {
  try {
    const appraisal = await prisma.performanceAppraisal.findUnique({ where: { id: String(req.params.id) }, include: { employee: { include: { department: true, manager: true } } } });
    if (!appraisal) return res.status(404).send("Appraisal not found");
    if (req.user?.role === Role.EMPLOYEE && (appraisal.employeeId !== req.user.employeeId || appraisal.status !== WorkflowStatus.PUBLISHED)) return res.status(403).send("Forbidden");
    const company = await getCurrentCompanyProfile();
    await audit(req, "PRINT", "PerformanceAppraisal", appraisal.id, { referenceNumber: appraisal.referenceNumber });
    res.header("Content-Type", "text/html");
    res.send(`<!doctype html><html><head><title>${appraisal.referenceNumber}</title><style>body{font-family:Arial;margin:32px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}.head{border-bottom:2px solid #0f766e;margin-bottom:20px;padding-bottom:12px}.brand-line{display:flex;gap:16px;align-items:center}</style></head><body>${companyPrintHeader(company, "Performance Appraisal")}<table><tbody><tr><td>Reference</td><td>${appraisal.referenceNumber}</td><td>Status</td><td>${appraisal.status}</td></tr><tr><td>Employee</td><td>${appraisal.employee.employeeCode} - ${appraisal.employee.firstName} ${appraisal.employee.lastName}</td><td>Department</td><td>${appraisal.employee.department.name}</td></tr><tr><td>Period</td><td>${appraisal.periodCode}</td><td>Final Rating</td><td>${appraisal.finalRating ?? "-"}</td></tr><tr><td>Final Score</td><td>${appraisal.finalScore}</td><td>Recommendation</td><td>${appraisal.recommendation ?? "-"}</td></tr></tbody></table><script>window.print()</script></body></html>`);
  } catch (error) {
    next(error);
  }
});

export default router;
