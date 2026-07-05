import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";

const router = Router();

const reportRoles = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR, Role.ACCOUNTANT, Role.PAYROLL_OFFICER, Role.FINANCE, Role.AUDITOR];

router.use(requireAuth, requireRoles(...reportRoles));

router.get("/catalog", async (_req, res) => {
  res.json([
    { category: "Employee Reports", reports: ["Employee master list", "Employee status report", "New joiners", "Expired documents", "Probation completion"] },
    { category: "Leave Reports", reports: ["Leave balance", "Leave history", "Leave liability"] },
    { category: "Attendance Reports", reports: ["Attendance summary", "Absence", "Overtime", "Missing punch"] },
    { category: "Payroll Reports", reports: ["Payroll register", "Payslip batch", "Salary cost by department", "GOSI report", "MUDAD report"] },
    { category: "Government Reports", reports: ["GOSI contribution", "MUDAD WPS", "QIWA contracts"] },
    { category: "Audit Reports", reports: ["Audit trail"] }
  ]);
});

router.get("/dashboard", async (_req, res) => {
  const today = new Date();
  const in60Days = new Date(today.getTime() + 60 * 86400000);
  const [totalEmployees, activeEmployees, pendingLeaves, pendingPayroll, expiringIqama, expiringPassport, expiringContracts, payrollRuns] = await Promise.all([
    prisma.employee.count({ where: { archivedAt: null } }),
    prisma.employee.count({ where: { status: "ACTIVE", archivedAt: null } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.payrollRun.count({ where: { status: "DRAFT" } }),
    prisma.employee.count({ where: { iqamaExpiryDate: { gte: today, lte: in60Days }, archivedAt: null } }),
    prisma.employee.count({ where: { passportExpiryDate: { gte: today, lte: in60Days }, archivedAt: null } }),
    prisma.employee.count({ where: { contractExpiryDate: { gte: today, lte: in60Days }, archivedAt: null } }),
    prisma.payrollItem.aggregate({ _sum: { netSalary: true, gosiDeduction: true } })
  ]);

  res.json({
    totalEmployees,
    activeEmployees,
    pendingLeaves,
    pendingPayroll,
    expiringIqama,
    expiringPassport,
    expiringContracts,
    monthlyPayrollCost: payrollRuns._sum.netSalary ?? 0,
    gosiEstimatedContribution: payrollRuns._sum.gosiDeduction ?? 0
  });
});

router.get("/audit-trail.csv", async (_req, res) => {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 1000 });
  const header = "createdAt,userId,module,action,entityId,ipAddress,device";
  const rows = logs.map((log) => [log.createdAt.toISOString(), log.userId ?? "", log.entity, log.action, log.entityId ?? "", log.ipAddress ?? "", log.device ?? ""].join(","));
  res.header("Content-Type", "text/csv");
  res.attachment("audit-trail.csv");
  res.send([header, ...rows].join("\n"));
});

export default router;
