import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";

const router = Router();

router.use(requireAuth, requireRoles(Role.ADMIN, Role.HR, Role.ACCOUNTANT));

router.get("/dashboard", async (_req, res) => {
  const [employees, pendingLeaves, latestPayroll, unexportedPayroll, absences] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.payrollRun.findFirst({ orderBy: [{ year: "desc" }, { month: "desc" }] }),
    prisma.payrollRun.count({ where: { status: { in: ["DRAFT", "APPROVED"] } } }),
    prisma.attendance.count({ where: { status: "ABSENT" } })
  ]);

  res.json({
    activeEmployees: employees,
    pendingLeaveApprovals: pendingLeaves,
    latestPayrollStatus: latestPayroll?.status ?? "NONE",
    payrollRunsAwaitingMudadWpsExport: unexportedPayroll,
    recordedAbsences: absences,
    checks: [
      { name: "GOSI payroll deduction", status: latestPayroll ? "TRACKED" : "PENDING_PAYROLL" },
      { name: "Mudad/WPS payroll export", status: unexportedPayroll === 0 ? "CLEAR" : "ACTION_REQUIRED" },
      { name: "Qiwa employee records", status: "CONNECTOR_PLACEHOLDER" }
    ]
  });
});

export default router;
