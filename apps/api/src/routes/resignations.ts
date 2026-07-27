import { Prisma, Role, WorkflowStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { AppError } from "../middleware/error.js";
import { audit } from "../utils/audit.js";
import { companyPrintHeader, getCurrentCompanyProfile } from "../utils/companyProfile.js";
import { csvFile, xlsxFile } from "../utils/uploadParsers.js";
import { generateDocumentNumber } from "../utils/numberSeries.js";

const router = Router();
const adminRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR, Role.FINANCE, Role.ACCOUNTANT];
const approvalRoles: Role[] = [...adminRoles, Role.DEPARTMENT_MANAGER, Role.OPERATIONS_MANAGER];

const resignationSchema = z.object({
  employeeId: z.string().optional(),
  proposedLastWorkingDate: z.coerce.date(),
  noticePeriodRequired: z.coerce.number().int().min(0).default(30),
  noticePeriodServed: z.coerce.number().int().min(0).default(0),
  resignationReason: z.string().min(3),
  detailedRemarks: z.string().optional(),
  attachmentName: z.string().optional(),
  employeeContactNumber: z.string().optional(),
  personalEmail: z.string().email().optional().or(z.literal("")),
  forwardingAddress: z.string().optional(),
  employeeConfirmed: z.coerce.boolean().default(false),
  changeReason: z.string().optional()
});

const decisionSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "REJECT", "RETURN_FOR_CORRECTION", "CANCEL", "ADMIN_OVERRIDE", "COMPLETE_EXIT"]),
  comments: z.string().optional(),
  overrideReason: z.string().optional()
});

const clearanceSchema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "WAIVED", "BLOCKED"]).default("COMPLETED"),
  remarks: z.string().min(2),
  attachmentName: z.string().optional(),
  overrideReason: z.string().optional()
});

const settlementSchema = z.object({
  resignationId: z.string(),
  lastWorkingDate: z.coerce.date().optional(),
  leaveEncashment: z.coerce.number().default(0),
  pendingSalary: z.coerce.number().default(0),
  overtime: z.coerce.number().default(0),
  bonus: z.coerce.number().default(0),
  otherEarnings: z.coerce.number().default(0),
  loanDeduction: z.coerce.number().default(0),
  salaryAdvanceDeduction: z.coerce.number().default(0),
  absenceDeduction: z.coerce.number().default(0),
  otherDeductions: z.coerce.number().default(0),
  paymentDate: z.coerce.date().optional(),
  paymentMethod: z.string().optional(),
  bankName: z.string().optional(),
  iban: z.string().optional()
});

router.use(requireAuth);

function timeline(previous: unknown, entry: object) {
  return [...(Array.isArray(previous) ? previous : []), entry] as Prisma.InputJsonValue;
}

function nextStatus(current: WorkflowStatus, action: z.infer<typeof decisionSchema>["action"], role?: Role) {
  if (action === "SUBMIT") return WorkflowStatus.PENDING_MANAGER;
  if (action === "CANCEL") return WorkflowStatus.CANCELLED;
  if (action === "REJECT") return WorkflowStatus.REJECTED;
  if (action === "RETURN_FOR_CORRECTION") return WorkflowStatus.RETURNED_FOR_CORRECTION;
  if (action === "ADMIN_OVERRIDE") return WorkflowStatus.EXIT_CLEARANCE_IN_PROGRESS;
  if (action === "COMPLETE_EXIT") return WorkflowStatus.EXIT_COMPLETED;
  if (current === WorkflowStatus.PENDING_MANAGER) return WorkflowStatus.PENDING_OM;
  if (current === WorkflowStatus.PENDING_OM) return WorkflowStatus.PENDING_HR_MANAGER;
  if (current === WorkflowStatus.PENDING_HR_MANAGER) return WorkflowStatus.PENDING_FINANCE;
  if (current === WorkflowStatus.PENDING_FINANCE) return WorkflowStatus.PENDING_ADMIN;
  if (current === WorkflowStatus.PENDING_ADMIN || role === Role.ADMIN || role === Role.SUPER_ADMIN) return WorkflowStatus.EXIT_CLEARANCE_IN_PROGRESS;
  return WorkflowStatus.PENDING_MANAGER;
}

function currentApprover(status: WorkflowStatus) {
  const map: Partial<Record<WorkflowStatus, string>> = {
    PENDING_MANAGER: "Manager",
    PENDING_OM: "OM",
    PENDING_HR_MANAGER: "HR Manager",
    PENDING_FINANCE: "Finance",
    PENDING_ADMIN: "Admin",
    EXIT_CLEARANCE_IN_PROGRESS: "Clearance Departments",
    FINAL_SETTLEMENT_PENDING: "Finance / HR / Admin"
  };
  return map[status] ?? undefined;
}

const defaultClearance = [
  ["Manager / Department", "Work handover completed"],
  ["Manager / Department", "Project handover completed"],
  ["IT Department", "Laptop, email, VPN, ERP and biometric access closed"],
  ["Finance", "Loans, advances, claims and bank account verified"],
  ["HR", "Exit interview, leave balance and certificates completed"],
  ["Security / Access Control", "Access card, gate and parking access removed"],
  ["Admin", "Company property, keys and ID card returned"],
  ["Payroll", "Final payroll and deductions reviewed"]
];

async function createClearanceItems(resignationId: string, employeeId: string) {
  const existing = await prisma.exitClearanceItem.count({ where: { resignationId } });
  if (existing > 0) return;
  for (const [assignedDepartment, clearanceItem] of defaultClearance) {
    await prisma.exitClearanceItem.create({
      data: {
      clearanceNumber: await generateDocumentNumber("EXIT_CLEARANCE"),
      resignationId,
      employeeId,
      assignedDepartment,
      clearanceItem,
      mandatory: true
      }
    });
  }
}

function employeeScopedWhere(role?: Role, employeeId?: string | null) {
  if (role === Role.EMPLOYEE) return { employeeId: employeeId ?? "__none__" };
  if (role === Role.DEPARTMENT_MANAGER || role === Role.OPERATIONS_MANAGER) return { employee: { managerId: employeeId ?? "__none__" } };
  return {};
}

router.get("/", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const resignations = await prisma.resignationRequest.findMany({
    where: {
      archivedAt: null,
      ...employeeScopedWhere(req.user?.role as Role | undefined, req.user?.employeeId),
      ...(search ? { OR: [{ requestNumber: { contains: search, mode: "insensitive" } }, { resignationReason: { contains: search, mode: "insensitive" } }] } : {})
    },
    include: { employee: { include: { department: true, manager: true } }, clearanceItems: true, finalSettlement: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(resignations);
});

router.post("/", async (req, res, next) => {
  try {
    const body = resignationSchema.parse(req.body);
    const employeeId = req.user?.role === Role.EMPLOYEE ? req.user.employeeId : body.employeeId;
    if (!employeeId) throw new AppError(400, "employeeId is required");
    const resignation = await prisma.resignationRequest.create({
      data: {
        requestNumber: await generateDocumentNumber("RESIGNATION"),
        employeeId,
        proposedLastWorkingDate: body.proposedLastWorkingDate,
        noticePeriodRequired: body.noticePeriodRequired,
        noticePeriodServed: body.noticePeriodServed,
        resignationReason: body.resignationReason,
        detailedRemarks: body.detailedRemarks,
        attachmentName: body.attachmentName,
        employeeContactNumber: body.employeeContactNumber,
        personalEmail: body.personalEmail || undefined,
        forwardingAddress: body.forwardingAddress,
        employeeConfirmed: body.employeeConfirmed,
        createdBy: req.user?.id,
        approvalTimeline: timeline([], { action: "CREATE_DRAFT", by: req.user?.email, at: new Date().toISOString() })
      },
      include: { employee: { include: { department: true, manager: true } }, clearanceItems: true, finalSettlement: true }
    });
    await audit(req, "CREATE", "ResignationRequest", resignation.id, { requestNumber: resignation.requestNumber }, undefined, resignation);
    res.status(201).json(resignation);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireRoles(...adminRoles), async (req, res, next) => {
  try {
    const body = resignationSchema.partial().parse(req.body);
    if (!body.changeReason) throw new AppError(400, "Reason is required for admin resignation edit.");
    const previous = await prisma.resignationRequest.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) throw new AppError(404, "Resignation request not found");
    const { changeReason, personalEmail, ...data } = body;
    const updated = await prisma.resignationRequest.update({
      where: { id: previous.id },
      data: {
        ...data,
        personalEmail: personalEmail || undefined,
        approvalTimeline: timeline(previous.approvalTimeline, { action: "ADMIN_EDIT", by: req.user?.email, role: req.user?.role, reason: changeReason, at: new Date().toISOString() })
      }
    });
    await audit(req, "ADMIN_EDIT", "ResignationRequest", updated.id, { reason: changeReason, fields: Object.keys(data) }, previous, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/decision", requireRoles(...approvalRoles, Role.EMPLOYEE), async (req, res, next) => {
  try {
    const body = decisionSchema.parse(req.body);
    if (["REJECT", "RETURN_FOR_CORRECTION"].includes(body.action) && !body.comments) throw new AppError(400, "Comments are required.");
    if (body.action === "ADMIN_OVERRIDE" && !body.overrideReason) throw new AppError(400, "Override reason is required.");
    const previous = await prisma.resignationRequest.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) throw new AppError(404, "Resignation request not found");
    if (req.user?.role === Role.EMPLOYEE && (previous.employeeId !== req.user.employeeId || !["SUBMIT", "CANCEL"].includes(body.action))) throw new AppError(403, "Employees can only submit or cancel their own resignation draft.");
    const status = nextStatus(previous.status, body.action, req.user?.role);
    const updated = await prisma.resignationRequest.update({
      where: { id: previous.id },
      data: {
        status,
        currentApprover: currentApprover(status),
        approvalTimeline: timeline(previous.approvalTimeline, { action: body.action, previousStatus: previous.status, newStatus: status, by: req.user?.email, role: req.user?.role, comments: body.comments, overrideReason: body.overrideReason, at: new Date().toISOString() })
      }
    });
    if (status === WorkflowStatus.EXIT_CLEARANCE_IN_PROGRESS) await createClearanceItems(updated.id, updated.employeeId);
    await audit(req, body.action, "ResignationRequest", updated.id, { comments: body.comments, status, overrideReason: body.overrideReason }, previous, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get("/clearance", async (req, res) => {
  const ownOnly = req.user?.role === Role.EMPLOYEE;
  const items = await prisma.exitClearanceItem.findMany({
    where: ownOnly ? { employeeId: req.user?.employeeId ?? "" } : {},
    include: { employee: { include: { department: true } }, resignation: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(items);
});

router.patch("/clearance/:id", requireRoles(...approvalRoles), async (req, res, next) => {
  try {
    const body = clearanceSchema.parse(req.body);
    if (body.status === "WAIVED" && !body.overrideReason) throw new AppError(400, "Override reason is required to waive clearance.");
    const previous = await prisma.exitClearanceItem.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) throw new AppError(404, "Clearance item not found");
    const updated = await prisma.exitClearanceItem.update({
      where: { id: previous.id },
      data: { status: body.status, remarks: body.remarks, attachmentName: body.attachmentName, completedBy: req.user?.email, completedDate: new Date() }
    });
    await audit(req, body.status === "WAIVED" ? "CLEARANCE_OVERRIDE" : "CLEARANCE_COMPLETE", "ExitClearanceItem", updated.id, { remarks: body.remarks, overrideReason: body.overrideReason }, previous, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/final-settlement", requireRoles(...adminRoles), async (req, res, next) => {
  try {
    const body = settlementSchema.parse({ ...req.body, resignationId: req.params.id });
    const resignation = await prisma.resignationRequest.findUnique({ where: { id: body.resignationId }, include: { employee: true, clearanceItems: true } });
    if (!resignation) throw new AppError(404, "Resignation request not found");
    const incompleteMandatory = resignation.clearanceItems.some((item) => item.mandatory && !["COMPLETED", "WAIVED"].includes(item.status));
    if (incompleteMandatory && !req.body.overrideReason) throw new AppError(400, "Final settlement requires completed clearance or admin override reason.");
    const joiningDate = resignation.employee.joiningDate;
    const lastWorkingDate = body.lastWorkingDate ?? resignation.proposedLastWorkingDate;
    const yearsOfService = Math.max(0, (lastWorkingDate.getTime() - joiningDate.getTime()) / 31536000000);
    const basicSalary = Number(resignation.employee.basicSalary);
    const endOfServiceBenefit = yearsOfService <= 5 ? (basicSalary / 2) * yearsOfService : basicSalary * yearsOfService;
    const totalEarnings = body.leaveEncashment + body.pendingSalary + body.overtime + body.bonus + body.otherEarnings + endOfServiceBenefit;
    const totalDeductions = body.loanDeduction + body.salaryAdvanceDeduction + body.absenceDeduction + body.otherDeductions;
    const settlement = await prisma.finalSettlement.upsert({
      where: { resignationId: resignation.id },
      create: {
        settlementNumber: await generateDocumentNumber("FINAL_SETTLEMENT"),
        resignationId: resignation.id,
        employeeId: resignation.employeeId,
        lastWorkingDate,
        yearsOfService,
        basicSalary,
        leaveEncashment: body.leaveEncashment,
        pendingSalary: body.pendingSalary,
        overtime: body.overtime,
        bonus: body.bonus,
        otherEarnings: body.otherEarnings,
        loanDeduction: body.loanDeduction,
        salaryAdvanceDeduction: body.salaryAdvanceDeduction,
        absenceDeduction: body.absenceDeduction,
        otherDeductions: body.otherDeductions,
        endOfServiceBenefit,
        totalEarnings,
        totalDeductions,
        netFinalSettlement: totalEarnings - totalDeductions,
        paymentDate: body.paymentDate,
        paymentMethod: body.paymentMethod,
        bankName: body.bankName,
        iban: body.iban,
        status: "PENDING_HR_APPROVAL",
        approvalTimeline: timeline([], { action: "CREATE", by: req.user?.email, at: new Date().toISOString(), overrideReason: req.body.overrideReason })
      },
      update: {
        lastWorkingDate,
        yearsOfService,
        basicSalary,
        leaveEncashment: body.leaveEncashment,
        pendingSalary: body.pendingSalary,
        overtime: body.overtime,
        bonus: body.bonus,
        otherEarnings: body.otherEarnings,
        loanDeduction: body.loanDeduction,
        salaryAdvanceDeduction: body.salaryAdvanceDeduction,
        absenceDeduction: body.absenceDeduction,
        otherDeductions: body.otherDeductions,
        endOfServiceBenefit,
        totalEarnings,
        totalDeductions,
        netFinalSettlement: totalEarnings - totalDeductions,
        paymentDate: body.paymentDate,
        paymentMethod: body.paymentMethod,
        bankName: body.bankName,
        iban: body.iban
      },
      include: { employee: { include: { department: true } }, resignation: true }
    });
    await prisma.resignationRequest.update({ where: { id: resignation.id }, data: { status: WorkflowStatus.FINAL_SETTLEMENT_PENDING, currentApprover: "HR / Finance / Admin" } });
    await audit(req, "CREATE_OR_UPDATE", "FinalSettlement", settlement.id, { settlementNumber: settlement.settlementNumber, overrideReason: req.body.overrideReason }, undefined, settlement);
    res.status(201).json(settlement);
  } catch (error) {
    next(error);
  }
});

router.patch("/final-settlements/:id/decision", requireRoles(...adminRoles), async (req, res, next) => {
  try {
    const body = z.object({ action: z.enum(["HR_APPROVE", "FINANCE_APPROVE", "ADMIN_APPROVE", "REJECT"]), comments: z.string().optional() }).parse(req.body);
    if (body.action === "REJECT" && !body.comments) throw new AppError(400, "Comments are required.");
    const previous = await prisma.finalSettlement.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) throw new AppError(404, "Final settlement not found");
    const data: Prisma.FinalSettlementUpdateInput = {
      status: body.action === "ADMIN_APPROVE" ? "FINAL_APPROVED" : body.action,
      approvalTimeline: timeline(previous.approvalTimeline, { action: body.action, by: req.user?.email, role: req.user?.role, comments: body.comments, at: new Date().toISOString() })
    };
    if (body.action === "HR_APPROVE") data.hrApproval = req.user?.email;
    if (body.action === "FINANCE_APPROVE") data.financeApproval = req.user?.email;
    if (body.action === "ADMIN_APPROVE") data.adminApproval = req.user?.email;
    const updated = await prisma.finalSettlement.update({ where: { id: previous.id }, data });
    if (body.action === "ADMIN_APPROVE") await prisma.resignationRequest.update({ where: { id: previous.resignationId }, data: { status: WorkflowStatus.EXIT_COMPLETED, currentApprover: undefined } });
    await audit(req, body.action, "FinalSettlement", updated.id, { comments: body.comments }, previous, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get("/export.csv", requireRoles(...adminRoles, Role.AUDITOR), async (req, res) => {
  const rows = await prisma.resignationRequest.findMany({ include: { employee: { include: { department: true } } }, orderBy: { createdAt: "desc" } });
  await audit(req, "EXPORT", "ResignationRequest", undefined, { format: "CSV", count: rows.length });
  csvFile(res, "resignations.csv", ["Request No", "Employee ID", "Employee Name", "Department", "Designation", "Last Working Date", "Notice Period", "Status", "Approver", "Request Date"], rows.map((row) => [row.requestNumber, row.employee.employeeCode, `${row.employee.firstName} ${row.employee.lastName}`, row.employee.department.name, row.employee.jobTitle, row.proposedLastWorkingDate.toISOString().slice(0, 10), row.noticePeriodRequired, row.status, row.currentApprover ?? "", row.createdAt.toISOString()]));
});

router.get("/export.xlsx", requireRoles(...adminRoles, Role.AUDITOR), async (req, res) => {
  const rows = await prisma.resignationRequest.findMany({ include: { employee: { include: { department: true } } }, orderBy: { createdAt: "desc" } });
  await audit(req, "EXPORT", "ResignationRequest", undefined, { format: "XLSX", count: rows.length });
  await xlsxFile(res, "resignations.xlsx", ["Request No", "Employee ID", "Employee Name", "Department", "Designation", "Last Working Date", "Notice Period", "Status", "Approver", "Request Date"], rows.map((row) => [row.requestNumber, row.employee.employeeCode, `${row.employee.firstName} ${row.employee.lastName}`, row.employee.department.name, row.employee.jobTitle, row.proposedLastWorkingDate.toISOString().slice(0, 10), row.noticePeriodRequired, row.status, row.currentApprover ?? "", row.createdAt.toISOString()]), "Resignations");
});

router.get("/final-settlements/export.xlsx", requireRoles(...adminRoles, Role.AUDITOR), async (req, res) => {
  const rows = await prisma.finalSettlement.findMany({ include: { employee: true }, orderBy: { createdAt: "desc" } });
  await xlsxFile(res, "final-settlements.xlsx", ["Settlement No", "Employee ID", "Employee Name", "Last Working Date", "EOSB", "Total Earnings", "Total Deductions", "Net Settlement", "Status", "Payment Date"], rows.map((row) => [row.settlementNumber, row.employee.employeeCode, `${row.employee.firstName} ${row.employee.lastName}`, row.lastWorkingDate.toISOString().slice(0, 10), String(row.endOfServiceBenefit), String(row.totalEarnings), String(row.totalDeductions), String(row.netFinalSettlement), row.status, row.paymentDate?.toISOString().slice(0, 10) ?? ""]), "Final Settlements");
});

router.get("/:id/print", async (req, res, next) => {
  try {
    const row = await prisma.resignationRequest.findUnique({ where: { id: String(req.params.id) }, include: { employee: { include: { department: true, manager: true } } } });
    if (!row) return res.status(404).send("Resignation not found");
    if (req.user?.role === Role.EMPLOYEE && row.employeeId !== req.user.employeeId) return res.status(403).send("Forbidden");
    const company = await getCurrentCompanyProfile();
    await audit(req, "PRINT", "ResignationRequest", row.id, { requestNumber: row.requestNumber });
    res.header("Content-Type", "text/html");
    res.send(`<!doctype html><html><head><title>${row.requestNumber}</title><style>body{font-family:Arial;margin:32px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}.head{border-bottom:2px solid #0f766e;margin-bottom:20px;padding-bottom:12px}.brand-line{display:flex;gap:16px;align-items:center}</style></head><body>${companyPrintHeader(company, "Resignation Acknowledgement")}<table><tbody><tr><td>Request</td><td>${row.requestNumber}</td><td>Status</td><td>${row.status}</td></tr><tr><td>Employee</td><td>${row.employee.employeeCode} - ${row.employee.firstName} ${row.employee.lastName}</td><td>Department</td><td>${row.employee.department.name}</td></tr><tr><td>Designation</td><td>${row.employee.jobTitle}</td><td>Reporting Manager</td><td>${row.employee.manager ? `${row.employee.manager.firstName} ${row.employee.manager.lastName}` : ""}</td></tr><tr><td>Proposed Last Working Date</td><td>${row.proposedLastWorkingDate.toISOString().slice(0, 10)}</td><td>Notice Period</td><td>${row.noticePeriodRequired} required / ${row.noticePeriodServed} served</td></tr><tr><td>Reason</td><td colspan="3">${row.resignationReason}</td></tr><tr><td>Remarks</td><td colspan="3">${row.detailedRemarks ?? ""}</td></tr></tbody></table><script>window.print()</script></body></html>`);
  } catch (error) {
    next(error);
  }
});

router.get("/final-settlements/:id/print", async (req, res, next) => {
  try {
    const row = await prisma.finalSettlement.findUnique({ where: { id: String(req.params.id) }, include: { employee: { include: { department: true } }, resignation: true } });
    if (!row) return res.status(404).send("Final settlement not found");
    if (req.user?.role === Role.EMPLOYEE && row.employeeId !== req.user.employeeId) return res.status(403).send("Forbidden");
    const company = await getCurrentCompanyProfile();
    await audit(req, "PRINT", "FinalSettlement", row.id, { settlementNumber: row.settlementNumber });
    res.header("Content-Type", "text/html");
    res.send(`<!doctype html><html><head><title>${row.settlementNumber}</title><style>body{font-family:Arial;margin:32px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}.head{border-bottom:2px solid #0f766e;margin-bottom:20px;padding-bottom:12px}.brand-line{display:flex;gap:16px;align-items:center}</style></head><body>${companyPrintHeader(company, "Final Settlement")}<table><tbody><tr><td>Settlement</td><td>${row.settlementNumber}</td><td>Status</td><td>${row.status}</td></tr><tr><td>Employee</td><td>${row.employee.employeeCode} - ${row.employee.firstName} ${row.employee.lastName}</td><td>Department</td><td>${row.employee.department.name}</td></tr><tr><td>Last Working Date</td><td>${row.lastWorkingDate.toISOString().slice(0, 10)}</td><td>Years of Service</td><td>${row.yearsOfService}</td></tr><tr><td>EOSB</td><td>${row.endOfServiceBenefit}</td><td>Total Earnings</td><td>${row.totalEarnings}</td></tr><tr><td>Total Deductions</td><td>${row.totalDeductions}</td><td>Net Settlement</td><td>${row.netFinalSettlement}</td></tr></tbody></table><script>window.print()</script></body></html>`);
  } catch (error) {
    next(error);
  }
});

export default router;
