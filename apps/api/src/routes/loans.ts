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

const router = Router();
const adminRoles = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR, Role.FINANCE, Role.ACCOUNTANT, Role.PAYROLL_OFFICER];
const approvalRoles = [...adminRoles, Role.DEPARTMENT_MANAGER, Role.OPERATIONS_MANAGER];

const loanSchema = z.object({
  employeeId: z.string().optional(),
  loanType: z.string().min(2),
  requestedAmount: z.coerce.number().positive(),
  approvedAmount: z.coerce.number().optional(),
  reason: z.string().min(3),
  requestedDisbursementDate: z.coerce.date().optional(),
  numberOfInstallments: z.coerce.number().int().min(1).max(120),
  monthlyInstallmentAmount: z.coerce.number().positive(),
  firstDeductionDate: z.coerce.date().optional(),
  lastDeductionDate: z.coerce.date().optional(),
  existingLoanBalance: z.coerce.number().default(0),
  salaryAdvanceDeductionOption: z.string().optional(),
  bankName: z.string().optional(),
  iban: z.string().optional(),
  attachmentName: z.string().optional(),
  remarks: z.string().optional(),
  changeReason: z.string().optional()
});

const decisionSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "REJECT", "RETURN_FOR_CORRECTION", "DISBURSE", "CANCEL", "CLOSE", "EARLY_SETTLEMENT"]),
  comments: z.string().optional(),
  approvedAmount: z.coerce.number().optional(),
  monthlyInstallmentAmount: z.coerce.number().optional()
});

router.use(requireAuth);

function timeline(previous: unknown, entry: object) {
  return [...(Array.isArray(previous) ? previous : []), entry] as Prisma.InputJsonValue;
}

function nextStatus(current: WorkflowStatus, action: z.infer<typeof decisionSchema>["action"], role?: Role) {
  if (action === "SUBMIT") return WorkflowStatus.PENDING_MANAGER;
  if (["CANCEL", "CLOSE", "EARLY_SETTLEMENT"].includes(action)) return WorkflowStatus.CLOSED;
  if (action === "REJECT") return WorkflowStatus.REJECTED;
  if (action === "RETURN_FOR_CORRECTION") return WorkflowStatus.RETURNED_FOR_CORRECTION;
  if (action === "DISBURSE") return WorkflowStatus.FINAL_APPROVED;
  if (current === WorkflowStatus.PENDING_MANAGER) return WorkflowStatus.PENDING_OM;
  if (current === WorkflowStatus.PENDING_OM) return WorkflowStatus.PENDING_HR_MANAGER;
  if (current === WorkflowStatus.PENDING_HR_MANAGER) return WorkflowStatus.PENDING_FINANCE;
  if (current === WorkflowStatus.PENDING_FINANCE || role === Role.FINANCE || role === Role.ACCOUNTANT) return WorkflowStatus.FINAL_APPROVED;
  return WorkflowStatus.PENDING_MANAGER;
}

async function createSchedule(loanId: string, firstDate: Date | null, count: number, amount: number) {
  const start = firstDate ?? new Date();
  for (let index = 1; index <= count; index += 1) {
    const dueDate = new Date(start);
    dueDate.setMonth(start.getMonth() + index - 1);
    await prisma.loanRepaymentSchedule.upsert({
      where: { loanRequestId_installmentNo: { loanRequestId: loanId, installmentNo: index } },
      update: { dueDate, amount },
      create: { loanRequestId: loanId, installmentNo: index, dueDate, amount, payrollPeriod: `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}` }
    });
  }
}

router.get("/", async (req, res) => {
  const ownOnly = req.user?.role === Role.EMPLOYEE;
  const loans = await prisma.employeeLoanRequest.findMany({
    where: { archivedAt: null, ...(ownOnly ? { employeeId: req.user?.employeeId ?? "" } : {}) },
    include: { employee: { include: { department: true } }, repaymentSchedule: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(loans);
});

router.post("/", async (req, res, next) => {
  try {
    const body = loanSchema.parse(req.body);
    const employeeId = req.user?.role === Role.EMPLOYEE ? req.user.employeeId : body.employeeId;
    if (!employeeId) throw new AppError(400, "employeeId is required");
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new AppError(404, "Employee not found");
    const maxAllowed = Number(employee.basicSalary) * 3;
    if (body.requestedAmount > maxAllowed) throw new AppError(400, "Requested loan exceeds allowed policy limit.");
    const loan = await prisma.employeeLoanRequest.create({
      data: {
        requestNumber: `LOAN-${Date.now()}`,
        employeeId,
        loanType: body.loanType,
        requestedAmount: body.requestedAmount,
        approvedAmount: body.approvedAmount ?? body.requestedAmount,
        reason: body.reason,
        requestedDisbursementDate: body.requestedDisbursementDate,
        numberOfInstallments: body.numberOfInstallments,
        monthlyInstallmentAmount: body.monthlyInstallmentAmount,
        firstDeductionDate: body.firstDeductionDate,
        lastDeductionDate: body.lastDeductionDate,
        existingLoanBalance: body.existingLoanBalance,
        outstandingBalance: body.approvedAmount ?? body.requestedAmount,
        salaryAdvanceDeductionOption: body.salaryAdvanceDeductionOption,
        bankName: body.bankName,
        iban: body.iban,
        attachmentName: body.attachmentName,
        remarks: body.remarks,
        createdBy: req.user?.id,
        approvalTimeline: timeline([], { action: "CREATE_DRAFT", by: req.user?.email, at: new Date().toISOString() })
      },
      include: { employee: { include: { department: true } } }
    });
    await createSchedule(loan.id, body.firstDeductionDate ?? null, body.numberOfInstallments, body.monthlyInstallmentAmount);
    await audit(req, "CREATE", "EmployeeLoanRequest", loan.id, { requestNumber: loan.requestNumber }, undefined, loan);
    res.status(201).json(await prisma.employeeLoanRequest.findUnique({ where: { id: loan.id }, include: { employee: { include: { department: true } }, repaymentSchedule: true } }));
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireRoles(...adminRoles), async (req, res, next) => {
  try {
    const body = loanSchema.partial().parse(req.body);
    if (!body.changeReason) throw new AppError(400, "Reason is required for loan override.");
    const previous = await prisma.employeeLoanRequest.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) throw new AppError(404, "Loan request not found");
    const { changeReason, ...data } = body;
    const updated = await prisma.employeeLoanRequest.update({ where: { id: previous.id }, data: { ...data, approvalTimeline: timeline(previous.approvalTimeline, { action: "ADMIN_EDIT", by: req.user?.email, reason: changeReason, at: new Date().toISOString() }) } });
    await audit(req, "ADMIN_EDIT", "EmployeeLoanRequest", updated.id, { reason: changeReason, fields: Object.keys(data) }, previous, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/decision", requireRoles(...approvalRoles), async (req, res, next) => {
  try {
    const body = decisionSchema.parse(req.body);
    if (["REJECT", "RETURN_FOR_CORRECTION"].includes(body.action) && !body.comments) throw new AppError(400, "Comments are required.");
    if ((body.monthlyInstallmentAmount || body.approvedAmount) && !body.comments) throw new AppError(400, "Finance amount changes require reason/comments.");
    const previous = await prisma.employeeLoanRequest.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) throw new AppError(404, "Loan request not found");
    const status = nextStatus(previous.status, body.action, req.user?.role);
    const approvedAmount = body.approvedAmount ?? previous.approvedAmount;
    const monthlyInstallmentAmount = body.monthlyInstallmentAmount ?? previous.monthlyInstallmentAmount;
    const updated = await prisma.employeeLoanRequest.update({
      where: { id: previous.id },
      data: {
        status,
        approvedAmount,
        monthlyInstallmentAmount,
        outstandingBalance: status === WorkflowStatus.FINAL_APPROVED ? approvedAmount : previous.outstandingBalance,
        disbursementDate: body.action === "DISBURSE" ? new Date() : previous.disbursementDate,
        loanStatus: body.action === "DISBURSE" ? "DISBURSED" : body.action === "CLOSE" ? "CLOSED" : previous.loanStatus,
        approvalTimeline: timeline(previous.approvalTimeline, { action: body.action, previousStatus: previous.status, newStatus: status, by: req.user?.email, role: req.user?.role, comments: body.comments, at: new Date().toISOString() })
      },
      include: { repaymentSchedule: true }
    });
    if (status === WorkflowStatus.FINAL_APPROVED) await createSchedule(updated.id, updated.firstDeductionDate, updated.numberOfInstallments, Number(monthlyInstallmentAmount));
    await audit(req, body.action, "EmployeeLoanRequest", updated.id, { comments: body.comments, status }, previous, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get("/export.csv", requireRoles(...adminRoles, Role.AUDITOR), async (req, res) => {
  const loans = await prisma.employeeLoanRequest.findMany({ include: { employee: true }, orderBy: { createdAt: "desc" } });
  const headers = ["Request Number", "Employee ID", "Employee Name", "Loan Type", "Requested Amount", "Approved Amount", "Installments", "Monthly Deduction", "Outstanding Balance", "Request Date", "Disbursement Date", "Approval Status", "Loan Status"];
  await audit(req, "EXPORT", "EmployeeLoanRequest", undefined, { format: "CSV", count: loans.length });
  csvFile(res, "employee-loans.csv", headers, loans.map((loan) => [loan.requestNumber, loan.employee.employeeCode, `${loan.employee.firstName} ${loan.employee.lastName}`, loan.loanType, loan.requestedAmount, loan.approvedAmount, loan.numberOfInstallments, loan.monthlyInstallmentAmount, loan.outstandingBalance, loan.createdAt.toISOString(), loan.disbursementDate?.toISOString() ?? "", loan.status, loan.loanStatus]));
});

router.get("/export.xlsx", requireRoles(...adminRoles, Role.AUDITOR), async (req, res) => {
  const loans = await prisma.employeeLoanRequest.findMany({ include: { employee: true }, orderBy: { createdAt: "desc" } });
  const headers = ["Request Number", "Employee ID", "Employee Name", "Loan Type", "Requested Amount", "Approved Amount", "Installments", "Monthly Deduction", "Outstanding Balance", "Request Date", "Disbursement Date", "Approval Status", "Loan Status"];
  await audit(req, "EXPORT", "EmployeeLoanRequest", undefined, { format: "XLSX", count: loans.length });
  await xlsxFile(res, "employee-loans.xlsx", headers, loans.map((loan) => [loan.requestNumber, loan.employee.employeeCode, `${loan.employee.firstName} ${loan.employee.lastName}`, loan.loanType, String(loan.requestedAmount), String(loan.approvedAmount), loan.numberOfInstallments, String(loan.monthlyInstallmentAmount), String(loan.outstandingBalance), loan.createdAt.toISOString(), loan.disbursementDate?.toISOString() ?? "", loan.status, loan.loanStatus]), "Loans");
});

router.get("/:id/print", async (req, res, next) => {
  try {
    const loan = await prisma.employeeLoanRequest.findUnique({ where: { id: String(req.params.id) }, include: { employee: { include: { department: true } }, repaymentSchedule: true } });
    if (!loan) return res.status(404).send("Loan request not found");
    if (req.user?.role === Role.EMPLOYEE && loan.employeeId !== req.user.employeeId) return res.status(403).send("Forbidden");
    const company = await getCurrentCompanyProfile();
    await audit(req, "PRINT", "EmployeeLoanRequest", loan.id, { requestNumber: loan.requestNumber });
    res.header("Content-Type", "text/html");
    res.send(`<!doctype html><html><head><title>${loan.requestNumber}</title><style>body{font-family:Arial;margin:32px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}.head{border-bottom:2px solid #0f766e;margin-bottom:20px;padding-bottom:12px}.brand-line{display:flex;gap:16px;align-items:center}</style></head><body>${companyPrintHeader(company, "Loan Agreement")}<table><tbody><tr><td>Request</td><td>${loan.requestNumber}</td><td>Status</td><td>${loan.status}</td></tr><tr><td>Employee</td><td>${loan.employee.employeeCode} - ${loan.employee.firstName} ${loan.employee.lastName}</td><td>Department</td><td>${loan.employee.department.name}</td></tr><tr><td>Loan Type</td><td>${loan.loanType}</td><td>Approved Amount</td><td>${loan.approvedAmount}</td></tr><tr><td>Installments</td><td>${loan.numberOfInstallments}</td><td>Monthly Deduction</td><td>${loan.monthlyInstallmentAmount}</td></tr></tbody></table><script>window.print()</script></body></html>`);
  } catch (error) {
    next(error);
  }
});

export default router;
