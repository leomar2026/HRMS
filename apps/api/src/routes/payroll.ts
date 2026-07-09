import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { AppError } from "../middleware/error.js";
import { calculateNetSalary } from "../utils/payroll.js";
import { audit } from "../utils/audit.js";
import { renderPayslipPdf } from "../utils/payslipRenderer.js";
import { getCurrentCompanyProfile, payslipCompanyFromProfile } from "../utils/companyProfile.js";

const router = Router();

const generateSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100)
});

router.use(requireAuth);

function payrollItemWithoutGosi<T extends { gosiDeduction: unknown; netSalary: unknown }>(item: T) {
  const previousGosi = Number(item.gosiDeduction ?? 0);
  const adjustedNet = Number(item.netSalary ?? 0) + previousGosi;
  return { ...item, gosiDeduction: "0.00", netSalary: adjustedNet.toFixed(2) };
}

router.get("/", requireRoles(Role.ADMIN, Role.HR, Role.ACCOUNTANT), async (_req, res) => {
  const runs = await prisma.payrollRun.findMany({ include: { items: { include: { employee: true } } }, orderBy: [{ year: "desc" }, { month: "desc" }] });
  res.json(runs.map((run) => ({ ...run, items: run.items.map(payrollItemWithoutGosi) })));
});

router.post("/generate", requireRoles(Role.ADMIN, Role.HR, Role.ACCOUNTANT), async (req, res, next) => {
  try {
    const { month, year } = generateSchema.parse(req.body);
    const employees = await prisma.employee.findMany({ where: { status: "ACTIVE" } });

    const run = await prisma.payrollRun.upsert({
      where: { month_year: { month, year } },
      update: { status: "DRAFT", items: { deleteMany: {} } },
      create: { month, year }
    });

    for (const employee of employees) {
      const absenceCount = await prisma.attendance.count({
        where: {
          employeeId: employee.id,
          status: "ABSENT",
          workDate: { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) }
        }
      });
      const dailyRate = Number(employee.basicSalary) / 30;
      const absenceDeduction = Number((dailyRate * absenceCount).toFixed(2));
      const overtime = 0;
      const loanDeduction = 0;
      const totals = calculateNetSalary({
        basicSalary: employee.basicSalary,
        housingAllowance: employee.housingAllowance,
        transportAllowance: employee.transportAllowance,
        otherAllowance: employee.otherAllowance,
        overtime,
        absenceDeduction,
        loanDeduction
      });

      await prisma.payrollItem.create({
        data: {
          payrollRunId: run.id,
          employeeId: employee.id,
          basicSalary: employee.basicSalary,
          housingAllowance: employee.housingAllowance,
          transportAllowance: employee.transportAllowance,
          otherAllowance: employee.otherAllowance,
          overtime,
          absenceDeduction,
          loanDeduction,
          gosiDeduction: totals.gosiDeduction,
          netSalary: totals.netSalary
        }
      });
    }

    const populated = await prisma.payrollRun.findUniqueOrThrow({ where: { id: run.id }, include: { items: { include: { employee: true } } } });
    await audit(req, "GENERATE", "PayrollRun", run.id, { month, year, employees: employees.length });
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/approve", requireRoles(Role.ADMIN, Role.ACCOUNTANT), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const run = await prisma.payrollRun.update({
      where: { id },
      data: { status: "APPROVED", approvedBy: req.user?.id, approvedAt: new Date() },
      include: { items: true }
    });
    await audit(req, "APPROVE", "PayrollRun", run.id);
    res.json(run);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/mudad-wps.csv", requireRoles(Role.ADMIN, Role.ACCOUNTANT), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const run = await prisma.payrollRun.findUnique({ where: { id }, include: { items: { include: { employee: true } } } });
    if (!run) throw new AppError(404, "Payroll run not found");

    const header = "employeeCode,nationalId,employeeName,netSalary,payrollMonth,payrollYear";
    const lines = run.items.map((item) =>
      [item.employee.employeeCode, item.employee.nationalId, `${item.employee.firstName} ${item.employee.lastName}`, payrollItemWithoutGosi(item).netSalary, run.month, run.year].join(",")
    );

    await prisma.payrollRun.update({ where: { id: run.id }, data: { status: "EXPORTED" } });
    await audit(req, "EXPORT_MUDAD_WPS", "PayrollRun", run.id);
    res.header("Content-Type", "text/csv");
    res.attachment(`mudad-wps-${run.year}-${run.month}.csv`);
    res.send([header, ...lines].join("\n"));
  } catch (error) {
    next(error);
  }
});

router.get("/items/:id/payslip.pdf", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const item = await prisma.payrollItem.findUnique({
      where: { id },
      include: { employee: true, payrollRun: true }
    });
    if (!item) throw new AppError(404, "Payslip not found");
    if (req.user?.role === Role.EMPLOYEE && req.user.employeeId !== item.employeeId) throw new AppError(403, "Insufficient permissions");

    const company = payslipCompanyFromProfile(await getCurrentCompanyProfile());
    const adjustedItem = payrollItemWithoutGosi(item);
    renderPayslipPdf(res, {
      company,
      employee: {
        name: `${item.employee.firstName} ${item.employee.lastName}`,
        code: item.employee.employeeCode,
        designation: item.employee.jobTitle,
        nationalId: item.employee.nationalId,
        gosiNumber: item.employee.gosiNumber ?? undefined,
        bankName: item.employee.bankName ?? undefined,
        iban: item.employee.iban ?? undefined,
        joiningDate: item.employee.joiningDate,
        status: item.employee.status
      },
      payroll: {
        month: item.payrollRun.month,
        year: item.payrollRun.year,
        reference: `PAY-${item.payrollRun.year}-${item.payrollRun.month}-${item.employee.employeeCode}`,
        batchNumber: item.payrollRun.id,
        paymentDate: item.payrollRun.approvedAt ?? item.payrollRun.updatedAt,
        paymentMethod: "Bank Transfer",
        status: item.payrollRun.status,
        printedBy: req.user?.email
      },
      attendance: { payrollDays: 30, presentDays: 30, absentDays: 0, weeklyOffDays: 0, publicHolidays: 0, normalOvertimeHours: 0, holidayOvertimeHours: 0 },
      earnings: [
        { name: "Basic Salary", value: item.basicSalary },
        { name: "Housing Allowance", value: item.housingAllowance },
        { name: "Transportation Allowance", value: item.transportAllowance },
        { name: "Other Allowance", value: item.otherAllowance },
        { name: "Overtime", value: item.overtime }
      ],
      deductions: [
        { name: "Absence Deduction", value: item.absenceDeduction },
        { name: "Loan Deduction", value: item.loanDeduction }
      ],
      netSalary: adjustedItem.netSalary
    });
  } catch (error) {
    next(error);
  }
});

export default router;
