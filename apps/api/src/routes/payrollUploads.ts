import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";
import { csvTemplate, numberValue, rowsFromUpload } from "../utils/uploadParsers.js";
import { renderPayslipPdf, type PayslipComponent, type PayslipInput } from "../utils/payslipRenderer.js";
import { companyPrintHeader, getCurrentCompanyProfile, payslipCompanyFromProfile } from "../utils/companyProfile.js";

const router = Router();

const uploadRoles = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR, Role.PAYROLL_OFFICER, Role.ACCOUNTANT, Role.FINANCE];

const headers = [
  "Employee ID",
  "Employee Name",
  "Department",
  "Job Title",
  "Payroll Period",
  "Basic Salary",
  "Housing Allowance",
  "Transportation Allowance",
  "Other Allowances",
  "Overtime",
  "Bonus",
  "Commission",
  "Leave Deduction",
  "Unpaid Leave Deduction",
  "Loan Deduction",
  "Advance Deduction",
  "GOSI Deduction",
  "Other Deduction",
  "Gross Salary",
  "Total Deduction",
  "Net Salary",
  "Bank Name",
  "IBAN",
  "Payment Date",
  "Payroll Remarks"
];

const batchSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  company: z.string().min(2),
  branch: z.string().optional(),
  departmentId: z.string().optional(),
  payrollType: z.string().min(2),
  paymentDate: z.coerce.date(),
  fileName: z.string().optional(),
  content: z.string().optional(),
  contentBase64: z.string().optional()
});

const decisionSchema = z.object({
  status: z.enum(["SUBMITTED", "UNDER_REVIEW", "FINANCE_APPROVED", "FINAL_APPROVED", "APPROVED", "PUBLISHED", "REJECTED", "RETURNED_FOR_CORRECTION"]),
  comments: z.string().min(3).optional()
});

router.use(requireAuth, requireRoles(...uploadRoles));

function uploadedPayslipInput(item: Awaited<ReturnType<typeof prisma.payrollUploadItem.findUnique>> & { batch: { month: number; year: number; company: string; branch: string | null; paymentDate: Date; status: string; id: string }; employee: { firstName: string; lastName: string; employeeCode: string; nationalId: string; gosiNumber: string | null; branch: string | null; bankName: string | null; iban: string | null; joiningDate: Date; status: string; department?: { name: string } | null } }, company: PayslipInput["company"], printedBy?: string): PayslipInput {
  const earnings: PayslipComponent[] = [
    { name: "Basic Salary", value: item.basicSalary },
    { name: "Housing Allowance", value: item.housingAllowance },
    { name: "Transportation Allowance", value: item.transportAllowance },
    { name: "Other Allowance", value: item.otherAllowance },
    { name: "Overtime", value: item.overtime },
    { name: "Bonus", value: item.bonus },
    { name: "Commission", value: item.commission }
  ].filter((component) => Number(component.value) !== 0);
  const knownEarnings = earnings.reduce((sum, component) => sum + Number(component.value), 0);
  const otherEarnings = Number(item.grossSalary) - knownEarnings;
  if (Math.abs(otherEarnings) > 0.01) earnings.push({ name: "Other Earnings", value: otherEarnings.toFixed(2) });

  const deductions = [
    { name: "GOSI Employee Contribution", value: item.gosiDeduction },
    { name: "Loan Deduction", value: item.loanDeduction },
    { name: "Salary Advance Deduction", value: item.advanceDeduction },
    { name: "Unpaid Leave Deduction", value: item.unpaidLeaveDeduction },
    { name: "Absence / Leave Deduction", value: item.leaveDeduction },
    { name: "Other Deduction", value: item.otherDeduction }
  ].filter((component) => Number(component.value) !== 0);

  return {
    company,
    employee: {
      name: item.employeeName,
      code: item.employeeCode,
      department: item.department ?? item.employee.department?.name,
      designation: item.jobTitle ?? undefined,
      nationalId: item.employee.nationalId,
      gosiNumber: item.employee.gosiNumber ?? undefined,
      branch: item.employee.branch ?? item.batch.branch ?? undefined,
      bankName: item.bankName ?? item.employee.bankName ?? undefined,
      iban: item.iban ?? item.employee.iban ?? undefined,
      joiningDate: item.employee.joiningDate,
      status: item.employee.status
    },
    payroll: {
      month: item.batch.month,
      year: item.batch.year,
      period: item.payrollPeriod,
      reference: item.documentReference,
      batchNumber: item.batch.id,
      currency: "SAR",
      paymentDate: item.paymentDate,
      paymentMethod: "Bank Transfer",
      status: item.batch.status,
      printedBy
    },
    attendance: { payrollDays: 30, presentDays: 30, absentDays: 0, weeklyOffDays: 0, publicHolidays: 0, normalOvertimeHours: 0, holidayOvertimeHours: 0 },
    earnings,
    deductions,
    netSalary: item.netSalary,
    remarks: item.remarks ?? undefined
  };
}

router.get("/template.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.attachment("payroll-upload-template.csv");
  res.send(csvTemplate(headers));
});

async function validateRows(rows: Awaited<ReturnType<typeof rowsFromUpload>>) {
  const errors: Array<{ row: number; column: string; message: string }> = [];
  const employeeCodes = rows.map((row) => row["Employee ID"]).filter(Boolean);
  const employees = await prisma.employee.findMany({ where: { employeeCode: { in: employeeCodes } } });
  const employeeMap = new Map(employees.map((employee) => [employee.employeeCode, employee]));
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    for (const header of headers) {
      if (["Employee ID", "Payroll Period", "Net Salary", "Payment Date"].includes(header) && !row[header]) {
        errors.push({ row: rowNumber, column: header, message: "Required value is missing" });
      }
    }
    const employeeCode = row["Employee ID"];
    if (employeeCode && !employeeMap.has(employeeCode)) errors.push({ row: rowNumber, column: "Employee ID", message: "Employee ID not found" });
    if (employeeCode && seen.has(employeeCode)) errors.push({ row: rowNumber, column: "Employee ID", message: "Duplicate employee in upload" });
    if (employeeCode) seen.add(employeeCode);

    const gross = numberValue(row["Gross Salary"]);
    const deduction = numberValue(row["Total Deduction"]);
    const net = numberValue(row["Net Salary"]);
    if (Math.abs(gross - deduction - net) > 0.01) {
      errors.push({ row: rowNumber, column: "Net Salary", message: "Net salary must equal gross salary minus total deduction" });
    }
  });

  return { errors, employeeMap };
}

router.post("/validate", async (req, res, next) => {
  try {
    const body = batchSchema.partial().parse(req.body);
    const rows = await rowsFromUpload(body);
    const result = await validateRows(rows);
    res.json({ valid: result.errors.length === 0, rowCount: rows.length, errors: result.errors });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (_req, res) => {
  const batches = await prisma.payrollUploadBatch.findMany({ where: { archivedAt: null }, include: { items: true }, orderBy: { createdAt: "desc" } });
  res.json(batches);
});

router.post("/", async (req, res, next) => {
  try {
    const body = batchSchema.parse(req.body);
    const rows = await rowsFromUpload(body);
    const validation = await validateRows(rows);
    if (validation.errors.length) return res.status(400).json({ message: "Payroll upload validation failed", errors: validation.errors });

    const batch = await prisma.payrollUploadBatch.create({
      data: {
        month: body.month,
        year: body.year,
        company: body.company,
        branch: body.branch,
        departmentId: body.departmentId,
        payrollType: body.payrollType,
        paymentDate: body.paymentDate,
        originalFileName: body.fileName,
        createdBy: req.user?.id,
        approvalHistory: []
      }
    });

    for (const row of rows) {
      const employee = validation.employeeMap.get(row["Employee ID"]);
      if (!employee) continue;
      await prisma.payrollUploadItem.create({
        data: {
          batchId: batch.id,
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          employeeName: row["Employee Name"] || `${employee.firstName} ${employee.lastName}`,
          department: row.Department,
          jobTitle: row["Job Title"],
          payrollPeriod: row["Payroll Period"],
          basicSalary: numberValue(row["Basic Salary"]),
          housingAllowance: numberValue(row["Housing Allowance"]),
          transportAllowance: numberValue(row["Transportation Allowance"]),
          otherAllowance: numberValue(row["Other Allowances"]),
          overtime: numberValue(row.Overtime),
          bonus: numberValue(row.Bonus),
          commission: numberValue(row.Commission),
          leaveDeduction: numberValue(row["Leave Deduction"]),
          unpaidLeaveDeduction: numberValue(row["Unpaid Leave Deduction"]),
          loanDeduction: numberValue(row["Loan Deduction"]),
          advanceDeduction: numberValue(row["Advance Deduction"]),
          gosiDeduction: numberValue(row["GOSI Deduction"]),
          otherDeduction: numberValue(row["Other Deduction"]),
          grossSalary: numberValue(row["Gross Salary"]),
          totalDeduction: numberValue(row["Total Deduction"]),
          netSalary: numberValue(row["Net Salary"]),
          bankName: row["Bank Name"],
          iban: row.IBAN,
          paymentDate: new Date(row["Payment Date"]),
          remarks: row["Payroll Remarks"],
          documentReference: `PAY-${body.year}-${String(body.month).padStart(2, "0")}-${employee.employeeCode}-${batch.id.slice(-6)}`
        }
      });
    }

    const populated = await prisma.payrollUploadBatch.findUniqueOrThrow({ where: { id: batch.id }, include: { items: true } });
    await audit(req, "CREATE_DRAFT", "PayrollUploadBatch", batch.id, { rowCount: rows.length, fileName: body.fileName }, undefined, populated);
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const body = decisionSchema.parse(req.body);
    if (["REJECTED", "RETURNED_FOR_CORRECTION"].includes(body.status) && !body.comments) {
      return res.status(400).json({ message: "Comments are required for rejection or return" });
    }
    const previous = await prisma.payrollUploadBatch.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) return res.status(404).json({ message: "Payroll batch not found" });
    if (previous.lockedAt && !["PUBLISHED"].includes(body.status)) return res.status(409).json({ message: "Approved payroll is locked and requires reversal or adjustment" });

    const history = Array.isArray(previous.approvalHistory) ? previous.approvalHistory : [];
    history.push({ status: body.status, comments: body.comments, actedBy: req.user?.email, actedAt: new Date().toISOString() });
    const batch = await prisma.payrollUploadBatch.update({
      where: { id: previous.id },
      data: {
        status: body.status,
        approvalComments: body.comments,
        approvalHistory: history,
        submittedAt: body.status === "SUBMITTED" ? new Date() : previous.submittedAt,
        approvedAt: ["FINAL_APPROVED", "APPROVED", "PUBLISHED"].includes(body.status) ? new Date() : previous.approvedAt,
        publishedAt: body.status === "PUBLISHED" ? new Date() : previous.publishedAt,
        lockedAt: ["FINAL_APPROVED", "APPROVED", "PUBLISHED"].includes(body.status) ? new Date() : previous.lockedAt
      },
      include: { items: true }
    });
    await audit(req, "PAYROLL_STATUS", "PayrollUploadBatch", batch.id, { status: body.status, comments: body.comments }, previous, batch);
    res.json(batch);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const previous = await prisma.payrollUploadBatch.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) return res.status(404).json({ message: "Payroll batch not found" });
    if (previous.lockedAt) return res.status(409).json({ message: "Approved payroll is locked and cannot be deleted" });
    const batch = await prisma.payrollUploadBatch.update({ where: { id: previous.id }, data: { archivedAt: new Date() } });
    await audit(req, "ARCHIVE", "PayrollUploadBatch", batch.id, undefined, previous, batch);
    res.json(batch);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/export.csv", async (req, res, next) => {
  try {
    const batch = await prisma.payrollUploadBatch.findUnique({ where: { id: String(req.params.id) }, include: { items: true } });
    if (!batch) return res.status(404).json({ message: "Payroll batch not found" });
    const rows = batch.items.map((item) => [item.employeeCode, item.employeeName, item.grossSalary, item.totalDeduction, item.netSalary, item.bankName ?? "", item.iban ?? ""].join(","));
    res.header("Content-Type", "text/csv");
    res.attachment(`payroll-upload-${batch.year}-${batch.month}.csv`);
    res.send(["Employee ID,Employee Name,Gross Salary,Total Deduction,Net Salary,Bank Name,IBAN", ...rows].join("\n"));
  } catch (error) {
    next(error);
  }
});

router.get("/:id/print", async (req, res, next) => {
  try {
    const batch = await prisma.payrollUploadBatch.findUnique({ where: { id: String(req.params.id) }, include: { items: true } });
    if (!batch) return res.status(404).send("Payroll batch not found");
    const company = await getCurrentCompanyProfile();
    res.header("Content-Type", "text/html");
    res.send(`<!doctype html><html><head><title>Payroll Register</title><style>body{font-family:Arial;margin:32px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}.head{border-bottom:2px solid #0f766e;margin-bottom:20px;padding-bottom:12px}.brand-line{display:flex;gap:16px;align-items:center}.head h1{margin:0 0 6px;font-size:20px}.head p{margin:2px 0}</style></head><body>${companyPrintHeader(company, "Payroll Register")}<p>${batch.company} | ${batch.month}/${batch.year} | Printed by ${req.user?.email}</p><table><thead><tr><th>Employee</th><th>Gross</th><th>Deduction</th><th>Net</th></tr></thead><tbody>${batch.items.map((item) => `<tr><td>${item.employeeCode} - ${item.employeeName}</td><td>${item.grossSalary}</td><td>${item.totalDeduction}</td><td>${item.netSalary}</td></tr>`).join("")}</tbody></table><script>window.print()</script></body></html>`);
  } catch (error) {
    next(error);
  }
});

router.get("/items/:id/payslip.pdf", async (req, res, next) => {
  try {
    const item = await prisma.payrollUploadItem.findUnique({ where: { id: String(req.params.id) }, include: { batch: true, employee: { include: { department: true } } } });
    if (!item) return res.status(404).json({ message: "Payslip not found" });
    const company = payslipCompanyFromProfile(await getCurrentCompanyProfile());
    renderPayslipPdf(res, uploadedPayslipInput(item, company, req.user?.email));
  } catch (error) {
    next(error);
  }
});

export default router;
