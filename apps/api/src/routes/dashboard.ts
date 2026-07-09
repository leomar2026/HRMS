import PDFDocument from "pdfkit";
import { Role } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { audit } from "../utils/audit.js";
import { xlsxFile } from "../utils/uploadParsers.js";

const router = Router();

router.use(requireAuth);

const payrollRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.PAYROLL_OFFICER, Role.ACCOUNTANT, Role.FINANCE];
const financeQuickActionRoles: Role[] = [Role.FINANCE, Role.ACCOUNTANT, Role.PAYROLL_OFFICER];

function canSeePayroll(role?: Role) {
  return Boolean(role && payrollRoles.includes(role));
}

function scopeForUser(role?: Role, employeeId?: string) {
  if (role === Role.EMPLOYEE && employeeId) return { id: employeeId };
  if (role === Role.DEPARTMENT_MANAGER && employeeId) return { managerId: employeeId };
  return {};
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function last12Months() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, label: date.toLocaleString("en", { month: "short", year: "2-digit" }) };
  });
}

function countBy<T extends string | null | undefined>(values: T[]) {
  const map = new Map<string, number>();
  values.forEach((value) => {
    const key = value || "Not specified";
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function groupSmall(items: Array<{ label: string; value: number }>, max = 8) {
  if (items.length <= max) return items;
  const visible = items.slice(0, max - 1);
  const others = items.slice(max - 1).reduce((sum, item) => sum + item.value, 0);
  return [...visible, { label: "Others", value: others }];
}

async function buildDashboard(req: Request) {
  const role = req.user?.role as Role | undefined;
  const employeeScope = scopeForUser(role, req.user?.employeeId ?? undefined);
  const baseEmployeeWhere = { archivedAt: null, ...employeeScope };
  const today = new Date();
  const monthStart = startOfMonth(today);
  const in30 = new Date(today.getTime() + 30 * 86400000);
  const in60 = new Date(today.getTime() + 60 * 86400000);
  const in90 = new Date(today.getTime() + 90 * 86400000);
  const months = last12Months();
  const twelveStart = new Date(today.getFullYear(), today.getMonth() - 11, 1);

  const [
    employees,
    departments,
    leaveRequests,
    payrollRuns,
    payrollItems,
    businessTrips,
    loans,
    pettyCash,
    tickets,
    resignations,
    appraisals,
    attendanceToday,
    auditLogs,
    documentCount
  ] = await Promise.all([
    prisma.employee.findMany({ where: baseEmployeeWhere, include: { department: true, documents: true } }),
    prisma.department.findMany(),
    prisma.leaveRequest.findMany({ where: { createdAt: { gte: twelveStart } }, include: { employee: true }, orderBy: { createdAt: "desc" }, take: 500 }),
    canSeePayroll(role) ? prisma.payrollRun.findMany({ include: { items: true }, orderBy: [{ year: "asc" }, { month: "asc" }] }) : Promise.resolve([]),
    canSeePayroll(role) ? prisma.payrollItem.aggregate({ _sum: { netSalary: true } }) : Promise.resolve({ _sum: { netSalary: 0 } }),
    prisma.businessTripRequest.findMany({ where: { archivedAt: null }, include: { employee: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.employeeLoanRequest.findMany({ where: { archivedAt: null }, include: { employee: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.pettyCashRequest.findMany({ where: { archivedAt: null }, include: { employee: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.ticketRequest.findMany({ where: { archivedAt: null }, include: { employee: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.resignationRequest.findMany({ where: { archivedAt: null }, include: { employee: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.performanceAppraisal.findMany({ where: { archivedAt: null }, include: { employee: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.attendance.findMany({ where: { workDate: { gte: new Date(today.toDateString()), lt: new Date(new Date(today.toDateString()).getTime() + 86400000) } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.employeeDocument.count()
  ]);

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((employee) => employee.status === "ACTIVE").length;
  const pendingLeaves = leaveRequests.filter((request) => request.status === "PENDING").length;
  const pendingWorkflow = <T extends { status: unknown }>(records: T[]) => records.filter((record) => !["APPROVED", "REJECTED", "CANCELLED", "PUBLISHED", "COMPLETED"].includes(String(record.status))).length;
  const expiringIqama = employees.filter((employee) => employee.iqamaExpiryDate && employee.iqamaExpiryDate >= today && employee.iqamaExpiryDate <= in60).length;
  const expiringPassport = employees.filter((employee) => employee.passportExpiryDate && employee.passportExpiryDate >= today && employee.passportExpiryDate <= in60).length;
  const expiringContract = employees.filter((employee) => employee.contractExpiryDate && employee.contractExpiryDate >= today && employee.contractExpiryDate <= in60).length;

  const leaveTrend = months.map((month) => ({
    label: month.label,
    value: leaveRequests.filter((leave) => `${leave.startDate.getFullYear()}-${String(leave.startDate.getMonth() + 1).padStart(2, "0")}` === month.key && String(leave.status) === "APPROVED").reduce((sum, leave) => sum + leave.days, 0)
  }));
  const payrollTrend = months.map((month) => {
    const [year, monthNumber] = month.key.split("-").map(Number);
    const run = payrollRuns.find((payroll) => payroll.year === year && payroll.month === monthNumber);
    return { label: month.label, value: run?.items.reduce((sum, item) => sum + Number(item.netSalary), 0) ?? 0 };
  });

  const departmentHeadcount = departments.map((department) => ({ label: department.name, value: employees.filter((employee) => employee.departmentId === department.id).length })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const pendingApprovals = [
    ...leaveRequests.filter((row) => row.status === "PENDING").slice(0, 6).map((row) => ({ type: "Leave", number: row.requestNumber, employeeName: `${row.employee.firstName} ${row.employee.lastName}`, status: row.workflowStage, submittedDate: row.createdAt, href: "/leave" })),
    ...businessTrips.filter((row) => !["APPROVED", "REJECTED"].includes(String(row.status))).slice(0, 4).map((row) => ({ type: "Business Trip", number: row.requestNumber, employeeName: `${row.employee.firstName} ${row.employee.lastName}`, status: String(row.status), submittedDate: row.createdAt, href: "/business-trips" })),
    ...loans.filter((row) => !["APPROVED", "REJECTED"].includes(String(row.status))).slice(0, 4).map((row) => ({ type: "Loan", number: row.requestNumber, employeeName: `${row.employee.firstName} ${row.employee.lastName}`, status: String(row.status), submittedDate: row.createdAt, href: "/loans" })),
    ...resignations.filter((row) => !["APPROVED", "REJECTED"].includes(String(row.status))).slice(0, 4).map((row) => ({ type: "Resignation", number: row.requestNumber, employeeName: `${row.employee.firstName} ${row.employee.lastName}`, status: String(row.status), submittedDate: row.createdAt, href: "/resignations" }))
  ].slice(0, 12);

  return {
    role: role ?? "ADMIN",
    canSeePayroll: canSeePayroll(role),
    filters: { company: "Current Company", branch: "All", department: "All", dateRange: "Last 12 months", status: "Active/Inactive" },
    summaryCards: [
      { label: "Total Employees", value: totalEmployees, href: "/employees", icon: "users" },
      { label: "Active Employees", value: activeEmployees, href: "/employees?status=ACTIVE", icon: "check" },
      { label: "Inactive Employees", value: totalEmployees - activeEmployees, href: "/employees?status=INACTIVE", icon: "minus" },
      { label: "New Joiners This Month", value: employees.filter((employee) => employee.joiningDate >= monthStart).length, href: "/employees", icon: "plus" },
      { label: "Employees on Leave Today", value: leaveRequests.filter((leave) => leave.startDate <= today && leave.endDate >= today && String(leave.status) === "APPROVED").length, href: "/leave", icon: "calendar" },
      { label: "Pending Leave Approvals", value: pendingLeaves, href: "/leave", icon: "clock" },
      { label: "Pending Payroll Approval", value: canSeePayroll(role) ? payrollRuns.filter((run) => String(run.status) === "DRAFT").length : "Hidden", href: "/payroll", icon: "money" },
      { label: "Pending Business Trip Requests", value: pendingWorkflow(businessTrips), href: "/business-trips", icon: "plane" },
      { label: "Pending Loan Requests", value: pendingWorkflow(loans), href: "/loans", icon: "money" },
      { label: "Pending Resignation Requests", value: pendingWorkflow(resignations), href: "/resignations", icon: "exit" },
      { label: "Expiring Iqama", value: expiringIqama, href: "/reports", icon: "alert" },
      { label: "Expiring Passport", value: expiringPassport, href: "/reports", icon: "alert" },
      { label: "Expiring Contract", value: expiringContract, href: "/reports", icon: "alert" },
      { label: "Monthly Payroll Cost", value: canSeePayroll(role) ? Number(payrollItems._sum.netSalary ?? 0).toFixed(2) : "Hidden", href: "/payroll", icon: "money" },
      { label: "Open Exit Clearance", value: pendingWorkflow(resignations), href: "/exit-clearance", icon: "exit" },
      { label: "Pending Appraisals", value: pendingWorkflow(appraisals), href: "/performance-appraisals", icon: "star" }
    ],
    charts: {
      nationality: groupSmall(countBy(employees.map((employee) => employee.nationality))),
      employeeStatus: countBy(employees.map((employee) => String(employee.status))),
      departmentHeadcount,
      branchHeadcount: countBy(employees.map((employee) => employee.branch)),
      leaveTrend,
      payrollTrend: canSeePayroll(role) ? payrollTrend : [],
      gender: countBy(employees.map((employee) => employee.gender)),
      employeeType: countBy(employees.map((employee) => employee.employeeType)),
      attendanceToday: countBy(attendanceToday.map((record) => String(record.status))),
      requestStatus: [
        { label: "Leave", value: pendingLeaves },
        { label: "Loan", value: pendingWorkflow(loans) },
        { label: "Business Trip", value: pendingWorkflow(businessTrips) },
        { label: "Petty Cash", value: pendingWorkflow(pettyCash) },
        { label: "Ticket", value: pendingWorkflow(tickets) },
        { label: "Resignation", value: pendingWorkflow(resignations) },
        { label: "Appraisal", value: pendingWorkflow(appraisals) }
      ]
    },
    alerts: [
      { label: "Iqama expiring within 60 days", count: expiringIqama, href: "/reports" },
      { label: "Passport expiring within 60 days", count: expiringPassport, href: "/reports" },
      { label: "Contract expiring within 60 days", count: expiringContract, href: "/reports" },
      { label: "Medical insurance expiring within 90 days", count: employees.filter((employee) => employee.medicalInsuranceExpiryDate && employee.medicalInsuranceExpiryDate <= in90).length, href: "/reports" },
      { label: "Probation ending soon", count: employees.filter((employee) => employee.probationEndDate && employee.probationEndDate <= in30).length, href: "/reports" },
      { label: "Employees with missing documents", count: Math.max(totalEmployees - documentCount, 0), href: "/employee-document-expiry" },
      { label: "Negative leave balance", count: employees.filter((employee) => employee.leaveBalance < 0).length, href: "/leave-balance-upload" },
      { label: "Pending payroll publish", count: canSeePayroll(role) ? payrollRuns.filter((run) => String(run.status) !== "PUBLISHED").length : 0, href: "/payroll" },
      { label: "Unmatched biometric logs", count: 0, href: "/biometric-logs" }
    ],
    recentActivities: auditLogs.map((log) => ({ action: log.action, user: log.userId ?? "System", target: `${log.entity}${log.entityId ? ` ${log.entityId}` : ""}`, createdAt: log.createdAt })),
    pendingApprovals: pendingApprovals.map((approval) => ({ ...approval, agingDays: Math.max(0, Math.floor((Date.now() - approval.submittedDate.getTime()) / 86400000)) })),
    quickActions: quickActionsForRole(role)
  };
}

function quickActionsForRole(role?: Role) {
  if (role === Role.EMPLOYEE) return [
    { label: "Apply Leave", href: "/employee/leaves" },
    { label: "Apply Loan", href: "/employee/loans" },
    { label: "Apply Business Trip", href: "/employee/business-trips" },
    { label: "View Payslip", href: "/employee/payslips" },
    { label: "Vacation Balance", href: "/employee/vacation-balance" }
  ];
  if (role === Role.DEPARTMENT_MANAGER) return [
    { label: "Approve Leave", href: "/manager/leave-approvals" },
    { label: "Team Calendar", href: "/manager/team-calendar" },
    { label: "Team Requests", href: "/manager/my-approvals" },
    { label: "Team Attendance", href: "/manager/team-attendance" }
  ];
  if (role && financeQuickActionRoles.includes(role)) return [
    { label: "Review Payroll", href: "/payroll" },
    { label: "Loan Requests", href: "/loans" },
    { label: "Petty Cash", href: "/petty-cash" },
    { label: "Final Settlement", href: "/final-settlements" }
  ];
  return [
    { label: "Add Employee", href: "/employees/new" },
    { label: "Import Employees", href: "/employee-import" },
    { label: "Upload Payroll", href: "/payroll-upload" },
    { label: "Upload Vacation Balance", href: "/leave-balance-upload" },
    { label: "Create Leave Policy", href: "/leave-policy-master" },
    { label: "Create Workflow", href: "/workflow-setup" },
    { label: "View Expiry Report", href: "/reports" },
    { label: "View Audit Logs", href: "/audit-logs" }
  ];
}

router.get("/", async (req, res, next) => {
  try {
    res.json(await buildDashboard(req));
  } catch (error) {
    next(error);
  }
});

router.get("/summary.xlsx", async (req, res, next) => {
  try {
    const dashboard = await buildDashboard(req);
    await audit(req, "DASHBOARD_EXPORT", "Dashboard", undefined, { exportType: "XLSX", filters: dashboard.filters });
    await xlsxFile(res, "hrms-dashboard-summary.xlsx", ["Metric", "Value"], dashboard.summaryCards.map((card) => [card.label, card.value]), "Dashboard");
  } catch (error) {
    next(error);
  }
});

function dashboardPdf(res: Response, dashboard: Awaited<ReturnType<typeof buildDashboard>>, generatedBy?: string) {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  res.header("Content-Type", "application/pdf");
  res.attachment("hrms-dashboard.pdf");
  doc.pipe(res);
  doc.fontSize(16).text("HRMS Dashboard");
  doc.fontSize(9).text(`Generated by: ${generatedBy ?? "-"} | ${new Date().toLocaleString()}`);
  doc.moveDown();
  dashboard.summaryCards.forEach((card) => doc.fontSize(9).text(`${card.label}: ${card.value}`));
  doc.moveDown().fontSize(12).text("Alerts");
  dashboard.alerts.forEach((alert) => doc.fontSize(9).text(`${alert.label}: ${alert.count}`));
  doc.end();
}

router.get("/export.pdf", async (req, res, next) => {
  try {
    const dashboard = await buildDashboard(req);
    await audit(req, "DASHBOARD_EXPORT", "Dashboard", undefined, { exportType: "PDF", filters: dashboard.filters });
    dashboardPdf(res, dashboard, req.user?.email);
  } catch (error) {
    next(error);
  }
});

router.get("/print", async (req, res, next) => {
  try {
    const dashboard = await buildDashboard(req);
    await audit(req, "DASHBOARD_PRINT", "Dashboard", undefined, { filters: dashboard.filters });
    const rows = dashboard.summaryCards.map((card) => `<tr><td>${card.label}</td><td>${card.value}</td></tr>`).join("");
    res.header("Content-Type", "text/html");
    res.send(`<!doctype html><html><head><title>HRMS Dashboard</title><style>body{font-family:Arial;margin:24px;font-size:12px}table{width:100%;border-collapse:collapse}td{border:1px solid #ddd;padding:6px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Print</button><h1>HRMS Dashboard</h1><p>Generated by ${req.user?.email ?? "-"} on ${new Date().toLocaleString()}</p><table>${rows}</table></body></html>`);
  } catch (error) {
    next(error);
  }
});

export default router;
