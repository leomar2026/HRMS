import { Router } from "express";
import { ApprovalStatus, LeaveType, Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { AppError } from "../middleware/error.js";
import { audit } from "../utils/audit.js";
import { renderPayslipPdf, type PayslipComponent } from "../utils/payslipRenderer.js";
import { getCurrentCompanyProfile, payslipCompanyFromProfile } from "../utils/companyProfile.js";

const router = Router();

const contactSchema = z.object({
  phone: z.string().min(7).max(30).optional(),
  email: z.string().email().optional(),
  emergencyContact: z.string().min(7).max(80).optional(),
  address: z.string().min(3).max(300).optional()
});

const leaveRequestSchema = z.object({
  type: z.nativeEnum(LeaveType),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().max(500).optional(),
  contactNumber: z.string().max(40).optional(),
  leaveAddress: z.string().max(300).optional(),
  emergencyContact: z.string().max(80).optional(),
  attachmentName: z.string().max(180).optional()
});

function daysBetween(start: Date, end: Date) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
}

function requireEmployeeId(employeeId?: string | null) {
  if (!employeeId) throw new AppError(403, "Employee profile is not linked to this user");
  return employeeId;
}

router.use(requireAuth, requireRoles(Role.EMPLOYEE));

router.get("/me/dashboard", async (req, res, next) => {
  try {
    const employeeId = requireEmployeeId(req.user?.employeeId);
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true, manager: true, documents: { where: { archivedAt: null }, orderBy: { expiryDate: "asc" }, take: 5 } }
    });
    if (!employee) throw new AppError(404, "Employee profile not found");

    const [pendingLeaves, latestPayslip, notifications] = await Promise.all([
      prisma.leaveRequest.count({ where: { employeeId, status: ApprovalStatus.PENDING } }),
      prisma.payrollUploadItem.findFirst({
        where: { employeeId, batch: { status: "PUBLISHED" } },
        include: { batch: true },
        orderBy: [{ batch: { year: "desc" } }, { batch: { month: "desc" } }]
      }),
      prisma.notification.findMany({ where: { OR: [{ employeeId }, { userId: req.user?.id }] }, orderBy: { createdAt: "desc" }, take: 5 })
    ]);

    res.json({ employee, pendingLeaves, latestPayslip, notifications });
  } catch (error) {
    next(error);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    const employeeId = requireEmployeeId(req.user?.employeeId);
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true }
    });
    if (!employee) throw new AppError(404, "Employee profile not found");

    res.json(employee);
  } catch (error) {
    next(error);
  }
});

router.patch("/me/contact", async (req, res, next) => {
  try {
    const employeeId = requireEmployeeId(req.user?.employeeId);
    const data = contactSchema.parse(req.body);

    const employee = await prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: {
          phone: data.phone,
          email: data.email,
          emergencyContact: data.emergencyContact,
          address: data.address
        },
        include: { department: true }
      });

      if (data.email) {
        await tx.user.update({
          where: { id: req.user?.id },
          data: { email: data.email }
        });
      }

      return updated;
    });

    await audit(req, "UPDATE_CONTACT", "Employee", employeeId, {
      fields: Object.keys(data)
    });
    res.json(employee);
  } catch (error) {
    next(error);
  }
});

router.get("/me/attendance", async (req, res, next) => {
  try {
    const employeeId = requireEmployeeId(req.user?.employeeId);
    const attendance = await prisma.attendance.findMany({
      where: { employeeId },
      orderBy: { workDate: "desc" },
      take: 120
    });
    res.json(attendance);
  } catch (error) {
    next(error);
  }
});

router.get("/me/leaves", async (req, res, next) => {
  try {
    const employeeId = requireEmployeeId(req.user?.employeeId);
    const leaves = await prisma.leaveRequest.findMany({
      where: { employeeId },
      include: { manager: true, approvalHistory: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" }
    });
    res.json(leaves);
  } catch (error) {
    next(error);
  }
});

router.post("/me/leaves", async (req, res, next) => {
  try {
    const employeeId = requireEmployeeId(req.user?.employeeId);
    const body = leaveRequestSchema.parse(req.body);
    if (body.endDate < body.startDate) throw new AppError(400, "End date must be on or after start date");

    const days = daysBetween(body.startDate, body.endDate);
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { manager: true } });
    if (!employee) throw new AppError(404, "Employee profile not found");
    if (body.type !== LeaveType.UNPAID && employee.leaveBalance < days) throw new AppError(400, "Insufficient leave balance");

    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { notIn: [ApprovalStatus.REJECTED, ApprovalStatus.CANCELLED] },
        startDate: { lte: body.endDate },
        endDate: { gte: body.startDate }
      }
    });
    if (overlapping) throw new AppError(409, "An overlapping leave request already exists");

    const leave = await prisma.$transaction(async (tx) => {
      const created = await tx.leaveRequest.create({
        data: {
          requestNumber: `LR-${Date.now()}`,
          employeeId,
          managerId: employee.managerId,
          type: body.type,
          startDate: body.startDate,
          endDate: body.endDate,
          days,
          reason: body.reason,
          contactNumber: body.contactNumber,
          leaveAddress: body.leaveAddress,
          emergencyContact: body.emergencyContact,
          attachmentName: body.attachmentName,
          availableBalanceAtRequest: employee.leaveBalance,
          workflowStage: "PENDING_MANAGER_APPROVAL"
        }
      });
      await tx.approvalHistory.create({
        data: {
          leaveRequestId: created.id,
          module: "Leave",
          entityId: created.id,
          status: ApprovalStatus.PENDING,
          actedBy: req.user?.id,
          comments: "Submitted by employee"
        }
      });
      if (employee.managerId) {
        const managerUser = await tx.user.findUnique({ where: { employeeId: employee.managerId } });
        await tx.notification.create({
          data: {
            userId: managerUser?.id,
            employeeId: employee.managerId,
            title: "Leave approval pending",
            message: `${employee.firstName} ${employee.lastName} submitted leave request ${created.requestNumber}.`,
            category: "LEAVE_MANAGER_PENDING",
            metadata: { leaveRequestId: created.id }
          }
        });
      }
      return created;
    });

    await audit(req, "SUBMIT_LEAVE", "LeaveRequest", leave.id, { days, type: body.type, previousStatus: null, newStatus: leave.workflowStage });
    res.status(201).json(leave);
  } catch (error) {
    next(error);
  }
});

router.get("/me/leave-balance", async (req, res, next) => {
  try {
    const employeeId = requireEmployeeId(req.user?.employeeId);
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { leaveBalance: true } });
    if (!employee) throw new AppError(404, "Employee profile not found");
    const balances = await prisma.leaveBalanceUploadItem.findMany({ where: { employeeId }, orderBy: [{ leaveYear: "desc" }, { leaveType: "asc" }] });
    res.json({ leaveBalance: employee.leaveBalance, balances });
  } catch (error) {
    next(error);
  }
});

router.get("/me/vacation-balance", async (req, res, next) => {
  try {
    const employeeId = requireEmployeeId(req.user?.employeeId);
    const year = typeof req.query.year === "string" ? Number(req.query.year) : undefined;
    const balances = await prisma.leaveBalanceUploadItem.findMany({
      where: { employeeId, ...(year ? { leaveYear: year } : {}) },
      orderBy: [{ leaveYear: "desc" }, { leaveType: "asc" }]
    });
    res.json(balances);
  } catch (error) {
    next(error);
  }
});

router.get("/me/approval-history", async (req, res, next) => {
  try {
    const employeeId = requireEmployeeId(req.user?.employeeId);
    const history = await prisma.approvalHistory.findMany({
      where: { leaveRequest: { employeeId } },
      include: { leaveRequest: true },
      orderBy: { createdAt: "desc" }
    });
    res.json(history);
  } catch (error) {
    next(error);
  }
});

router.get("/me/notifications", async (req, res, next) => {
  try {
    const employeeId = requireEmployeeId(req.user?.employeeId);
    const notifications = await prisma.notification.findMany({
      where: { OR: [{ employeeId }, { userId: req.user?.id }] },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json(notifications);
  } catch (error) {
    next(error);
  }
});

router.get("/me/payslips", async (req, res, next) => {
  try {
    const employeeId = requireEmployeeId(req.user?.employeeId);
    const generatedPayslips = await prisma.payrollItem.findMany({
      where: { employeeId, payrollRun: { status: "APPROVED" } },
      include: { payrollRun: true },
      orderBy: [{ payrollRun: { year: "desc" } }, { payrollRun: { month: "desc" } }]
    });
    const uploadedPayslips = await prisma.payrollUploadItem.findMany({
      where: { employeeId, batch: { status: "PUBLISHED" } },
      include: { batch: true },
      orderBy: [{ batch: { year: "desc" } }, { batch: { month: "desc" } }]
    });
    res.json([
      ...uploadedPayslips.map((item) => ({
        id: item.id,
        source: "UPLOAD",
        basicSalary: item.basicSalary,
        housingAllowance: item.housingAllowance,
        transportAllowance: item.transportAllowance,
        gosiDeduction: item.gosiDeduction,
        netSalary: item.netSalary,
        paymentDate: item.paymentDate,
        remarks: item.remarks,
        documentReference: item.documentReference,
        payrollRun: { month: item.batch.month, year: item.batch.year, status: item.batch.status }
      })),
      ...generatedPayslips.map((item) => ({ ...item, source: "GENERATED" }))
    ]);
    await audit(req, "VIEW_PAYSLIPS", "Employee", employeeId);
  } catch (error) {
    next(error);
  }
});

router.get("/me/payslips/:id/download", async (req, res, next) => {
  try {
    const employeeId = requireEmployeeId(req.user?.employeeId);
    const uploaded = await prisma.payrollUploadItem.findFirst({
      where: { id: String(req.params.id), employeeId, batch: { status: "PUBLISHED" } },
      include: { employee: { include: { department: true } }, batch: true }
    });

    if (uploaded) {
      await audit(req, "DOWNLOAD_PAYSLIP", "PayrollUploadItem", uploaded.id, { documentReference: uploaded.documentReference });
      const company = payslipCompanyFromProfile(await getCurrentCompanyProfile());
      const earnings: PayslipComponent[] = [
        { name: "Basic Salary", value: uploaded.basicSalary },
        { name: "Housing Allowance", value: uploaded.housingAllowance },
        { name: "Transportation Allowance", value: uploaded.transportAllowance },
        { name: "Other Allowance", value: uploaded.otherAllowance },
        { name: "Overtime", value: uploaded.overtime },
        { name: "Bonus", value: uploaded.bonus },
        { name: "Commission", value: uploaded.commission }
      ].filter((component) => Number(component.value) !== 0);
      const knownEarnings = earnings.reduce((sum, component) => sum + Number(component.value), 0);
      const otherEarnings = Number(uploaded.grossSalary) - knownEarnings;
      if (Math.abs(otherEarnings) > 0.01) earnings.push({ name: "Other Earnings", value: otherEarnings.toFixed(2) });

      renderPayslipPdf(res, {
        company,
        employee: {
          name: uploaded.employeeName,
          code: uploaded.employeeCode,
          department: uploaded.department ?? uploaded.employee.department?.name,
          designation: uploaded.jobTitle ?? undefined,
          nationalId: uploaded.employee.nationalId,
          gosiNumber: uploaded.employee.gosiNumber ?? undefined,
          branch: uploaded.employee.branch ?? uploaded.batch.branch ?? undefined,
          bankName: uploaded.bankName ?? uploaded.employee.bankName ?? undefined,
          iban: uploaded.iban ?? uploaded.employee.iban ?? undefined,
          joiningDate: uploaded.employee.joiningDate,
          status: uploaded.employee.status
        },
        payroll: {
          month: uploaded.batch.month,
          year: uploaded.batch.year,
          period: uploaded.payrollPeriod,
          reference: uploaded.documentReference,
          batchNumber: uploaded.batch.id,
          paymentDate: uploaded.paymentDate,
          paymentMethod: "Bank Transfer",
          status: uploaded.batch.status,
          printedBy: req.user?.email
        },
        attendance: { payrollDays: 30, presentDays: 30, absentDays: 0, weeklyOffDays: 0, publicHolidays: 0, normalOvertimeHours: 0, holidayOvertimeHours: 0 },
        earnings,
        deductions: [
          { name: "GOSI Employee Contribution", value: uploaded.gosiDeduction },
          { name: "Loan Deduction", value: uploaded.loanDeduction },
          { name: "Salary Advance Deduction", value: uploaded.advanceDeduction },
          { name: "Unpaid Leave Deduction", value: uploaded.unpaidLeaveDeduction },
          { name: "Absence / Leave Deduction", value: uploaded.leaveDeduction },
          { name: "Other Deduction", value: uploaded.otherDeduction }
        ].filter((component) => Number(component.value) !== 0),
        netSalary: uploaded.netSalary,
        remarks: uploaded.remarks ?? undefined
      });
      return;
    }

    const item = await prisma.payrollItem.findFirst({ where: { id: String(req.params.id), employeeId }, include: { employee: true, payrollRun: true } });
    if (!item) throw new AppError(404, "Payslip not found");
    if (item.payrollRun.status !== "APPROVED") throw new AppError(404, "Payslip not found");
    await audit(req, "DOWNLOAD_PAYSLIP", "PayrollItem", item.id);
    const company = payslipCompanyFromProfile(await getCurrentCompanyProfile());

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
        { name: "Loan Deduction", value: item.loanDeduction },
        { name: "GOSI Employee Contribution", value: item.gosiDeduction }
      ],
      netSalary: item.netSalary
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me/announcements", async (_req, res) => {
  const announcements = await prisma.announcement.findMany({
    orderBy: { publishedAt: "desc" },
    take: 50
  });
  res.json(announcements);
});

export default router;
