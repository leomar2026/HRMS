import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getGosiStatus } from "../services/gosiService.js";
import { getMudadStatus } from "../services/mudadService.js";
import { getQiwaStatus } from "../services/qiwaService.js";
import { getCurrentCompanyProfile, payslipCompanyFromProfile } from "../utils/companyProfile.js";
import { renderPayslipPdf } from "../utils/payslipRenderer.js";

export const previewRouter = Router();

const employee = {
  id: "preview-employee-1",
  employeeCode: "EMP-001",
  nationalId: "1000000001",
  firstName: "Admin",
  lastName: "User",
  email: "admin@company.sa",
  phone: "+966500000000",
  jobTitle: "HRMS Administrator",
  status: "ACTIVE",
  leaveBalance: 21,
  department: { id: "preview-dept-1", name: "Human Resources", code: "HR" },
  user: { id: "preview-admin", role: "ADMIN", portalStatus: "ACTIVE" }
};

const selfServiceEmployee = {
  id: "preview-employee-2",
  employeeCode: "EMP-002",
  nationalId: "1000000002",
  firstName: "Employee",
  lastName: "User",
  email: "employee@company.com",
  phone: "+966511111111",
  emergencyContact: "+966522222222",
  address: "Riyadh, Saudi Arabia",
  jobTitle: "Operations Specialist",
  status: "ACTIVE",
  leaveBalance: 21,
  department: { id: "preview-dept-3", name: "Operations", code: "OPS" }
};

const managerEmployee = {
  id: "preview-manager-1",
  employeeCode: "EMP-010",
  nationalId: "1000000010",
  firstName: "Manager",
  lastName: "User",
  email: "manager@company.com",
  phone: "+966533333333",
  jobTitle: "Operations Manager",
  status: "ACTIVE",
  leaveBalance: 21,
  department: { id: "preview-dept-3", name: "Operations", code: "OPS" }
};

const omEmployee = {
  id: "preview-om-1",
  employeeCode: "EMP-020",
  nationalId: "1000000020",
  firstName: "Operations",
  lastName: "Manager",
  email: "om@company.com",
  phone: "+966544444444",
  jobTitle: "Operations Manager",
  status: "ACTIVE",
  leaveBalance: 21,
  department: { id: "preview-dept-3", name: "Operations", code: "OPS" }
};

previewRouter.use(requireAuth);

previewRouter.get("/employees", (_req, res) => res.json({ items: [employee, { ...selfServiceEmployee, user: { id: "preview-employee-user", role: "EMPLOYEE", portalStatus: "ACTIVE" } }, { ...managerEmployee, user: { id: "preview-manager-user", role: "DEPARTMENT_MANAGER", portalStatus: "ACTIVE" } }, { ...omEmployee, user: { id: "preview-om-user", role: "OPERATIONS_MANAGER", portalStatus: "ACTIVE" } }], total: 4, page: 1, pageSize: 25 }));
previewRouter.post("/employees", (req, res) => res.status(201).json({
  id: `preview-employee-${Date.now()}`,
  status: "ACTIVE",
  leaveBalance: Number(req.body.leaveBalance ?? 21),
  department: { id: req.body.departmentId, name: "Preview Department" },
  user: { role: req.body.role ?? "EMPLOYEE", portalStatus: req.body.role === "EMPLOYEE" ? "PENDING_FIRST_LOGIN" : "ACTIVE" },
  ...req.body
}));
previewRouter.get("/employees/me", (_req, res) => res.json(employee));
previewRouter.patch("/employees/:id/user-role", (req, res) => res.json({ id: req.params.id, user: { role: req.body.role, portalStatus: req.body.portalStatus ?? "ACTIVE" } }));

previewRouter.get("/employee/me", (_req, res) => res.json(selfServiceEmployee));
previewRouter.get("/employee/me/dashboard", (_req, res) => res.json({
  employee: { ...selfServiceEmployee, manager: managerEmployee, documents: [{ id: "doc-1", documentType: "IQAMA", expiryDate: "2026-08-15T00:00:00.000Z" }] },
  pendingLeaves: 1,
  latestPayslip: { id: "preview-payroll-item-employee-1", netSalary: "9825.00", paymentDate: "2026-06-30T00:00:00.000Z", batch: { month: 6, year: 2026, status: "PUBLISHED" } },
  notifications: [
    { id: "notif-1", title: "Payslip published", message: "June 2026 payslip is available.", category: "PAYSLIP_PUBLISHED", createdAt: new Date().toISOString() },
    { id: "notif-2", title: "Leave pending", message: "Your annual leave is pending manager approval.", category: "LEAVE_SUBMITTED", createdAt: new Date().toISOString() }
  ]
}));
previewRouter.patch("/employee/me/contact", (req, res) => res.json({ ...selfServiceEmployee, ...req.body }));
previewRouter.get("/employee/me/attendance", (_req, res) => res.json([
  {
    id: "preview-employee-attendance-1",
    workDate: "2026-06-01T00:00:00.000Z",
    checkIn: "2026-06-01T05:02:00.000Z",
    checkOut: "2026-06-01T14:15:00.000Z",
    lateMinutes: 2,
    overtimeHours: "0.25",
    status: "PRESENT",
    source: "BIOMETRIC"
  },
  {
    id: "preview-employee-attendance-2",
    workDate: "2026-06-02T00:00:00.000Z",
    checkIn: "2026-06-02T04:55:00.000Z",
    checkOut: "2026-06-02T14:00:00.000Z",
    lateMinutes: 0,
    overtimeHours: "0.00",
    status: "PRESENT",
    source: "BIOMETRIC"
  }
]));
previewRouter.get("/employee/me/leaves", (_req, res) => res.json([
  {
    id: "preview-employee-leave-1",
    requestNumber: "LR-PREVIEW-001",
    type: "ANNUAL",
    startDate: "2026-06-15T00:00:00.000Z",
    endDate: "2026-06-16T00:00:00.000Z",
    days: 2,
    status: "PENDING",
    workflowStage: "PENDING_MANAGER_APPROVAL",
    availableBalanceAtRequest: 21,
    contactNumber: "+966511111111",
    leaveAddress: "Jeddah, Saudi Arabia",
    emergencyContact: "+966522222222",
    reason: "Family commitment",
    manager: managerEmployee,
    approvalHistory: [{ id: "hist-1", status: "PENDING", comments: "Submitted by employee", actedBy: "preview-employee-user", createdAt: new Date().toISOString() }]
  }
]));
previewRouter.post("/employee/me/leaves", (req, res) => res.status(201).json({
  id: "preview-employee-leave-new",
  requestNumber: "LR-PREVIEW-NEW",
  status: "PENDING",
  workflowStage: "PENDING_MANAGER_APPROVAL",
  days: 1,
  ...req.body
}));
const vacationBalances = [
  { id: "bal-1", leaveType: "ANNUAL", leaveYear: 2026, openingBalance: "15.00", accruedLeave: "6.00", carriedForwardBalance: "3.00", usedLeave: "0.00", pendingLeave: "2.00", adjustmentBalance: "0.00", encashmentBalance: "0.00", finalAvailableBalance: "22.00", carryForwardExpiryDate: "2026-12-31T00:00:00.000Z", updatedAt: new Date().toISOString() },
  { id: "bal-2", leaveType: "SICK", leaveYear: 2026, openingBalance: "30.00", accruedLeave: "0.00", carriedForwardBalance: "0.00", usedLeave: "0.00", pendingLeave: "0.00", adjustmentBalance: "0.00", encashmentBalance: "0.00", finalAvailableBalance: "30.00", carryForwardExpiryDate: null, updatedAt: new Date().toISOString() }
];
previewRouter.get("/employee/me/leave-balance", (_req, res) => res.json({ leaveBalance: 21, balances: vacationBalances }));
previewRouter.get("/employee/me/vacation-balance", (_req, res) => res.json(vacationBalances));
previewRouter.get("/employee/me/approval-history", (_req, res) => res.json([
  { id: "hist-1", module: "Leave", entityId: "preview-employee-leave-1", status: "PENDING", comments: "Submitted by employee", actedBy: "preview-employee-user", createdAt: new Date().toISOString(), leaveRequest: { requestNumber: "LR-PREVIEW-001", type: "ANNUAL" } }
]));
previewRouter.get("/employee/me/notifications", (_req, res) => res.json([
  { id: "notif-1", title: "Payslip published", message: "June 2026 payslip is available.", category: "PAYSLIP_PUBLISHED", createdAt: new Date().toISOString() },
  { id: "notif-2", title: "Leave submitted", message: "Your request LR-PREVIEW-001 was submitted.", category: "LEAVE_SUBMITTED", createdAt: new Date().toISOString() }
]));
previewRouter.get("/employee/me/payslips", (_req, res) => res.json([
  {
    id: "preview-payroll-item-employee-1",
    basicSalary: "8000.00",
    housingAllowance: "2000.00",
    transportAllowance: "800.00",
    otherAllowance: "0.00",
    overtime: "0.00",
    absenceDeduction: "0.00",
    loanDeduction: "0.00",
    gosiDeduction: "975.00",
    netSalary: "9825.00",
    payrollRun: { id: "preview-payroll-employee-1", month: 6, year: 2026, status: "APPROVED" }
  }
]));
previewRouter.get("/employee/me/payslips/:id/download", async (req, res) => {
  const company = payslipCompanyFromProfile(await getCurrentCompanyProfile());
  renderPayslipPdf(res, {
    company,
    employee: { name: "Employee User", code: "EMP-002", department: "Operations", designation: "Operations Specialist", nationalId: "1000000002", bankName: "Al Rajhi Bank", iban: "SA0380000000608010167519", joiningDate: "2026-02-01", status: "ACTIVE" },
    payroll: { month: 6, year: 2026, period: "June 2026", reference: "PAY-2026-06-EMP-002-PREVIEW", batchNumber: "preview-payroll-upload-1", paymentDate: "2026-06-30", paymentMethod: "Bank Transfer", printedBy: req.user?.email },
    attendance: { payrollDays: 30, presentDays: 30, absentDays: 0, weeklyOffDays: 0, publicHolidays: 0, normalOvertimeHours: 0, holidayOvertimeHours: 0 },
    earnings: [
      { name: "Basic Salary", value: 8000 },
      { name: "Housing Allowance", value: 2000 },
      { name: "Transportation Allowance", value: 800 }
    ],
    deductions: [{ name: "GOSI Employee Contribution", value: 975 }],
    netSalary: 9825,
    remarks: "Preview payslip"
  });
});
previewRouter.get("/employee/me/announcements", (_req, res) => res.json([
  {
    id: "preview-announcement-1",
    title: "Employee Self-Service Portal",
    body: "You can now manage contact details, submit leave, and download payslips from the employee portal.",
    publishedAt: "2026-06-10T09:00:00.000Z"
  },
  {
    id: "preview-announcement-2",
    title: "Payroll Cutoff",
    body: "Please submit attendance corrections and leave requests before the monthly payroll cutoff.",
    publishedAt: "2026-06-08T09:00:00.000Z"
  }
]));

previewRouter.get("/departments", (_req, res) => res.json([
  { id: "preview-dept-1", code: "HR", name: "Human Resources", _count: { employees: 1 } },
  { id: "preview-dept-2", code: "FIN", name: "Finance", _count: { employees: 0 } },
  { id: "preview-dept-3", code: "OPS", name: "Operations", _count: { employees: 0 } },
  { id: "preview-dept-4", code: "PPS", name: "Power Protection - Pre Sales", _count: { employees: 0 } },
  { id: "preview-dept-5", code: "PAS", name: "Power Protection - After Sales", _count: { employees: 0 } },
  { id: "preview-dept-6", code: "LC", name: "Low Current", _count: { employees: 0 } },
  { id: "preview-dept-7", code: "SAL", name: "Sales", _count: { employees: 0 } },
  { id: "preview-dept-8", code: "IT", name: "IT", _count: { employees: 0 } },
  { id: "preview-dept-9", code: "ADM", name: "Administrative", _count: { employees: 0 } }
]));

previewRouter.get("/attendance", (_req, res) => res.json([
  {
    id: "preview-attendance-1",
    workDate: "2026-06-01T00:00:00.000Z",
    checkIn: "2026-06-01T05:07:00.000Z",
    checkOut: "2026-06-01T14:45:00.000Z",
    lateMinutes: 7,
    overtimeHours: "0.75",
    status: "PRESENT",
    source: "BIOMETRIC",
    employee
  }
]));

previewRouter.post("/attendance/import", (_req, res) => res.json({
  imported: 1,
  results: [{ employeeCode: "EMP-001", status: "IMPORTED", id: "preview-attendance-1" }]
}));

previewRouter.post("/attendance/detect-absences", (_req, res) => res.json({ created: 0 }));

previewRouter.get("/drafts", (_req, res) => res.json([]));
previewRouter.put("/drafts", (req, res) => res.json({
  id: "preview-draft-1",
  userId: req.user?.id,
  module: req.body.module,
  draftKey: req.body.draftKey,
  data: req.body.data,
  status: "DRAFT",
  updatedAt: new Date().toISOString()
}));
previewRouter.delete("/drafts/:id", (req, res) => res.json({ ok: true, id: req.params.id }));

previewRouter.get("/leaves", (_req, res) => res.json([
  {
    id: "preview-leave-1",
    type: "ANNUAL",
    startDate: "2026-06-15T00:00:00.000Z",
    endDate: "2026-06-16T00:00:00.000Z",
    days: 2,
    status: "PENDING",
    employee
  }
]));
previewRouter.patch("/leaves/:id/decision", (req, res) => res.json({
  ...managerLeave,
  id: req.params.id,
  workflowStage: req.body.decision === "APPROVE" ? "FINAL_APPROVED" : req.body.decision === "RETURN_FOR_CORRECTION" ? "RETURNED_FOR_CORRECTION" : "REJECTED",
  status: req.body.decision === "APPROVE" ? "APPROVED" : req.body.decision,
  comments: req.body.comments
}));

const managerLeave = {
  id: "preview-employee-leave-1",
  requestNumber: "LR-PREVIEW-001",
  type: "ANNUAL",
  startDate: "2026-06-15T00:00:00.000Z",
  endDate: "2026-06-16T00:00:00.000Z",
  days: 2,
  availableBalanceAtRequest: 21,
  status: "PENDING",
  workflowStage: "PENDING_MANAGER_APPROVAL",
  reason: "Family commitment",
  contactNumber: "+966511111111",
  attachmentName: "leave-support.pdf",
  createdAt: new Date().toISOString(),
  employee: selfServiceEmployee,
  approvalHistory: [{ id: "hist-1", status: "PENDING", comments: "Submitted by employee", createdAt: new Date().toISOString() }]
};
const managerTeam = [
  {
    ...selfServiceEmployee,
    managerId: managerEmployee.id,
    branch: "Riyadh",
    user: { role: "EMPLOYEE", portalStatus: "ACTIVE" },
    leaves: [managerLeave]
  },
  {
    id: "preview-employee-3",
    employeeCode: "EMP-003",
    nationalId: "1000000003",
    firstName: "Team",
    lastName: "Member",
    email: "team.member@company.com",
    phone: "+966555555555",
    jobTitle: "Sales Engineer",
    status: "ACTIVE",
    leaveBalance: 18,
    branch: "Jeddah",
    managerId: managerEmployee.id,
    department: { id: "preview-dept-7", name: "Sales", code: "SAL" },
    user: { role: "EMPLOYEE", portalStatus: "ACTIVE" },
    leaves: [
      {
        ...managerLeave,
        id: "preview-employee-leave-2",
        requestNumber: "LR-PREVIEW-002",
        workflowStage: "FINAL_APPROVED",
        status: "APPROVED",
        employee: { id: "preview-employee-3", employeeCode: "EMP-003", firstName: "Team", lastName: "Member", department: { id: "preview-dept-7", name: "Sales", code: "SAL" } },
        approvalHistory: [
          { id: "hist-2", status: "PENDING", comments: "Submitted by employee", createdAt: new Date(Date.now() - 86400000).toISOString() },
          { id: "hist-3", status: "APPROVED", comments: "Manager approved", createdAt: new Date().toISOString() }
        ]
      }
    ]
  }
];
const managerTeamAttendance = [
  {
    id: "preview-team-attendance-1",
    workDate: "2026-06-01T00:00:00.000Z",
    checkIn: "2026-06-01T05:02:00.000Z",
    checkOut: "2026-06-01T14:15:00.000Z",
    lateMinutes: 2,
    overtimeHours: "0.25",
    status: "PRESENT",
    source: "BIOMETRIC",
    employee: { ...selfServiceEmployee, department: selfServiceEmployee.department }
  },
  {
    id: "preview-team-attendance-2",
    workDate: "2026-06-01T00:00:00.000Z",
    checkIn: "2026-06-01T05:20:00.000Z",
    checkOut: "2026-06-01T14:45:00.000Z",
    lateMinutes: 20,
    overtimeHours: "0.75",
    status: "PRESENT",
    source: "BIOMETRIC",
    employee: { id: "preview-employee-3", employeeCode: "EMP-003", firstName: "Team", lastName: "Member", department: { id: "preview-dept-7", name: "Sales", code: "SAL" } }
  },
  {
    id: "preview-team-attendance-3",
    workDate: "2026-06-02T00:00:00.000Z",
    checkIn: null,
    checkOut: null,
    lateMinutes: 0,
    overtimeHours: "0.00",
    status: "ABSENT",
    source: "SYSTEM",
    employee: { id: "preview-employee-3", employeeCode: "EMP-003", firstName: "Team", lastName: "Member", department: { id: "preview-dept-7", name: "Sales", code: "SAL" } }
  }
];
previewRouter.get("/manager/dashboard", (_req, res) => res.json({
  directReportsCount: managerTeam.length,
  directReports: managerTeam,
  pendingLeaves: [managerLeave],
  employeesCurrentlyOnLeave: 0,
  employeesScheduledForLeave: 1,
  recentApprovals: []
}));
previewRouter.get("/manager/team", (_req, res) => res.json(managerTeam));
previewRouter.get("/manager/leave-approvals", (_req, res) => res.json([managerLeave]));
previewRouter.get("/manager/approvals", (_req, res) => res.json(managerTeam.flatMap((employee) => employee.leaves)));
previewRouter.get("/manager/attendance", (_req, res) => res.json(managerTeamAttendance));
previewRouter.patch("/manager/leave-approvals/:id/decision", (req, res) => res.json({ ...managerLeave, id: req.params.id, workflowStage: req.body.decision === "APPROVE" ? "PENDING_OM_APPROVAL" : req.body.decision === "RETURN_FOR_CORRECTION" ? "RETURNED_FOR_CORRECTION" : req.body.decision, comments: req.body.comments }));
previewRouter.get("/om/leave-approvals", (_req, res) => res.json([{ ...managerLeave, workflowStage: "PENDING_OM_APPROVAL", omApproverId: omEmployee.id }]));
previewRouter.patch("/om/leave-approvals/:id/decision", (req, res) => res.json({ ...managerLeave, id: req.params.id, workflowStage: req.body.decision === "APPROVE" ? "PENDING_HR_MANAGER_APPROVAL" : req.body.decision === "RETURN_FOR_CORRECTION" ? "RETURNED_FOR_CORRECTION" : req.body.decision, comments: req.body.comments }));

previewRouter.get("/payroll", (_req, res) => res.json([
  {
    id: "preview-payroll-1",
    month: 6,
    year: 2026,
    status: "DRAFT",
    items: [
      {
        id: "preview-payroll-item-1",
        basicSalary: "12000.00",
        housingAllowance: "3000.00",
        transportAllowance: "1000.00",
        otherAllowance: "0.00",
        overtime: "0.00",
        absenceDeduction: "0.00",
        loanDeduction: "0.00",
        gosiDeduction: "1462.50",
        netSalary: "14537.50",
        employee
      }
    ]
  }
]));

previewRouter.post("/payroll/generate", (_req, res) => res.status(201).json({ ok: true }));
previewRouter.patch("/payroll/:id/approve", (_req, res) => res.json({ id: "preview-payroll-1", status: "APPROVED" }));

previewRouter.get("/compliance/dashboard", (_req, res) => res.json({
  activeEmployees: 1,
  pendingLeaveApprovals: 1,
  latestPayrollStatus: "DRAFT",
  payrollRunsAwaitingMudadWpsExport: 1,
  recordedAbsences: 0,
  checks: [
    { name: "GOSI payroll deduction", status: "TRACKED" },
    { name: "Mudad/WPS payroll export", status: "ACTION_REQUIRED" },
    { name: "Qiwa employee records", status: "CONNECTOR_PLACEHOLDER" }
  ]
}));

previewRouter.get("/government/status", (_req, res) => res.json({
  notice: "Official integration with GOSI, Mudad, and Qiwa requires approved API access, company authorization, and official credentials.",
  connectors: [getGosiStatus(), getMudadStatus(), getQiwaStatus()],
  settings: [
    { provider: "GOSI", environment: "SANDBOX", enabled: false },
    { provider: "MUDAD", environment: "SANDBOX", enabled: false },
    { provider: "QIWA", environment: "SANDBOX", enabled: false }
  ],
  logs: [
    { id: "preview-gov-log-1", provider: "MUDAD", action: "EXPORT", status: "READY_FOR_OFFICIAL_METHOD", message: "Preview export generated.", createdAt: new Date().toISOString() }
  ]
}));
previewRouter.post("/government/manual-sync", (req, res) => res.status(202).json({
  id: "preview-gov-sync-1",
  provider: req.body.provider,
  action: req.body.action ?? "MANUAL_SYNC",
  status: "QUEUED_FOR_APPROVED_CONNECTOR",
  message: "No scraping or bypass was attempted."
}));
previewRouter.get("/government/:provider/export.csv", (req, res) => {
  const provider = String(req.params.provider).toUpperCase();
  res.header("Content-Type", "text/csv");
  res.send(`provider,recordType,status\n${provider},VALIDATION,READY_FOR_OFFICIAL_METHOD`);
});

previewRouter.get("/reports/catalog", (_req, res) => res.json([
  { category: "Employee Reports", reports: ["Employee master list", "Expired documents", "Probation completion"] },
  { category: "Payroll Reports", reports: ["Payroll register", "GOSI report", "MUDAD report"] },
  { category: "Audit Reports", reports: ["Audit trail"] }
]));
previewRouter.get("/reports/dashboard", (_req, res) => res.json({
  totalEmployees: 2,
  activeEmployees: 2,
  pendingLeaves: 2,
  pendingPayroll: 1,
  expiringIqama: 1,
  expiringPassport: 1,
  expiringContracts: 1,
  monthlyPayrollCost: "24362.50",
  gosiEstimatedContribution: "2437.50"
}));
previewRouter.get("/reports/audit-trail.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("createdAt,userId,module,action,entityId,ipAddress,device\n2026-06-30T00:00:00Z,preview-admin,Employee,CREATE,EMP-001,127.0.0.1,Preview");
});

const previewMasterData = [
  { id: "md-branch-jed", type: "BRANCH", code: "JED", name: "Jeddah", active: true },
  { id: "md-branch-ruh", type: "BRANCH", code: "RUH", name: "Riyadh", active: true },
  { id: "md-branch-dmm", type: "BRANCH", code: "DMM", name: "Dammam", active: true },
  { id: "md-2", type: "LEAVE_TYPE", code: "ANNUAL", name: "Annual Leave", active: true },
  { id: "md-3", type: "SHIFT", code: "DAY", name: "Day Shift", active: true }
];
previewRouter.get("/master-data", (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  res.json(type ? previewMasterData.filter((record) => record.type === type) : previewMasterData);
});
previewRouter.post("/master-data", (req, res) => res.status(201).json({ id: "md-new", ...req.body }));
previewRouter.patch("/master-data/:id", (req, res) => res.json({ id: req.params.id, ...req.body }));
previewRouter.delete("/master-data/:id", (req, res) => res.json({ id: req.params.id, archivedAt: new Date().toISOString() }));

previewRouter.get("/permissions", (_req, res) => res.json([
  { id: "perm-1", role: "ADMIN", module: "Employees", canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canExportExcel: true, canExportPdf: true },
  { id: "perm-2", role: "EMPLOYEE", module: "Self Service", canView: true, canAdd: true, canEdit: true, canDelete: false }
]));
previewRouter.put("/permissions", (req, res) => res.json({ id: "perm-updated", ...req.body }));

previewRouter.get("/auth/admin/portal-accounts", (_req, res) => res.json([
  { id: "preview-employee-user", email: "employee@company.com", role: "EMPLOYEE", portalStatus: "ACTIVE", failedLoginAttempts: 0, lockedUntil: null, employee: { ...selfServiceEmployee, department: selfServiceEmployee.department } },
  { id: "preview-manager-user", email: "manager@company.com", role: "DEPARTMENT_MANAGER", portalStatus: "ACTIVE", failedLoginAttempts: 0, lockedUntil: null, employee: { ...managerEmployee, department: managerEmployee.department } }
]));
previewRouter.get("/auth/admin/portal-accounts/:id/history", (_req, res) => res.json({
  logins: [{ id: "login-1", username: "EMP-002", result: "SUCCESS", createdAt: new Date().toISOString(), device: "Preview Browser" }],
  resets: [{ id: "reset-1", action: "ADMIN_PASSWORD_RESET", createdAt: new Date().toISOString() }]
}));
previewRouter.post("/auth/admin/reset-password", (req, res) => res.json({ ok: true, userId: req.body.userId, portalStatus: "PASSWORD_RESET_REQUIRED" }));
previewRouter.post("/auth/admin/unlock-user", (req, res) => res.json({ ok: true, userId: req.body.userId }));
previewRouter.post("/auth/admin/portal-status", (req, res) => res.json({ id: req.body.userId, portalStatus: req.body.portalStatus }));

previewRouter.get("/announcements", (_req, res) => res.json([
  { id: "ann-1", title: "Employee Self-Service Portal", body: "Self-service is live.", publishedAt: new Date().toISOString() }
]));
previewRouter.post("/announcements", (req, res) => res.status(201).json({ id: "ann-new", ...req.body }));
previewRouter.get("/notification-admin/email-templates", (_req, res) => res.json([
  { id: "tpl-1", code: "LEAVE_SUBMITTED", subject: "Leave request submitted", body: "Your leave request {{leave_request_number}} is pending Manager approval.", active: true }
]));
previewRouter.put("/notification-admin/email-templates/:code", (req, res) => res.json({ id: `tpl-${req.params.code}`, code: req.params.code, ...req.body }));
previewRouter.post("/notification-admin/email-templates/:code/test", (req, res) => res.status(202).json({ id: "email-test-preview", templateCode: req.params.code, recipient: req.body.recipient, status: "PENDING" }));
previewRouter.get("/notification-admin/email-logs", (_req, res) => res.json([
  { id: "email-log-1", notificationKey: "preview-email", recipient: "employee@company.com", subject: "Leave request submitted", templateCode: "LEAVE_SUBMITTED", leaveRequestNumber: "LR-PREVIEW-001", status: "PENDING", createdAt: new Date().toISOString() }
]));
previewRouter.post("/notification-admin/email-logs/:id/resend", (req, res) => res.json({ id: req.params.id, status: "PENDING", retryCount: 1 }));
const previewLeaveWorkflowSteps = [
  { stage: "PENDING_MANAGER_APPROVAL", role: "DEPARTMENT_MANAGER", label: "Direct Manager", active: true },
  { stage: "PENDING_OM_APPROVAL", role: "OPERATIONS_MANAGER", label: "Operations Manager", active: true },
  { stage: "PENDING_HR_MANAGER_APPROVAL", role: "HR_MANAGER", label: "HR Manager", active: true }
];
const previewWorkflowDepartments = [
  { id: "preview-dept-1", code: "HR", name: "Human Resources" },
  { id: "preview-dept-2", code: "FIN", name: "Finance" },
  { id: "preview-dept-3", code: "OPS", name: "Operations" },
  { id: "preview-dept-4", code: "PPS", name: "Power Protection - Pre Sales" },
  { id: "preview-dept-5", code: "PAS", name: "Power Protection - After Sales" },
  { id: "preview-dept-6", code: "LC", name: "Low Current" },
  { id: "preview-dept-7", code: "SAL", name: "Sales" },
  { id: "preview-dept-8", code: "IT", name: "IT" },
  { id: "preview-dept-9", code: "ADM", name: "Administrative" }
];
const previewLeaveWorkflowState = new Map(previewWorkflowDepartments.map((department) => [
  department.id,
  previewLeaveWorkflowSteps.map((step) => ({ ...step }))
]));
previewRouter.get("/notification-admin/leave-workflows", (_req, res) => res.json({
  defaultSteps: previewLeaveWorkflowSteps,
  departments: previewWorkflowDepartments.map((department) => ({
    department,
    workflow: {
      id: `preview-workflow-${department.id}`,
      module: "LEAVE",
      name: `${department.name} Leave Approval`,
      departmentId: department.id,
      active: true,
      steps: previewLeaveWorkflowState.get(department.id) ?? previewLeaveWorkflowSteps
    }
  }))
}));
previewRouter.put("/notification-admin/leave-workflows/:departmentId", (req, res) => {
  const departmentId = String(req.params.departmentId);
  const steps = previewLeaveWorkflowSteps.map((step) => ({
    ...step,
    active: Boolean(req.body.steps?.find((item: { stage: string; active: boolean }) => item.stage === step.stage)?.active)
  }));
  previewLeaveWorkflowState.set(departmentId, steps);
  res.json({ id: `preview-workflow-${departmentId}`, module: "LEAVE", departmentId, active: true, steps });
});

const payrollUploadBatch = {
  id: "preview-payroll-upload-1",
  month: 6,
  year: 2026,
  company: "Demo Company",
  branch: "Riyadh",
  payrollType: "MONTHLY",
  paymentDate: "2026-06-30T00:00:00.000Z",
  status: "DRAFT",
  items: [
    {
      id: "preview-payroll-upload-item-1",
      employeeCode: "EMP-002",
      employeeName: "Employee User",
      department: "Operations",
      jobTitle: "Operations Specialist",
      grossSalary: "10800.00",
      totalDeduction: "975.00",
      netSalary: "9825.00",
      paymentDate: "2026-06-30T00:00:00.000Z",
      documentReference: "PAY-2026-06-EMP-002-PREVIEW"
    }
  ]
};

previewRouter.get("/payroll-uploads/template.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Employee ID,Employee Name,Department,Job Title,Payroll Period,Basic Salary,Housing Allowance,Transportation Allowance,Other Allowances,Overtime,Bonus,Commission,Leave Deduction,Unpaid Leave Deduction,Loan Deduction,Advance Deduction,GOSI Deduction,Other Deduction,Gross Salary,Total Deduction,Net Salary,Bank Name,IBAN,Payment Date,Payroll Remarks\n");
});
previewRouter.post("/payroll-uploads/validate", (_req, res) => res.json({ valid: true, rowCount: 1, errors: [] }));
previewRouter.get("/payroll-uploads", (_req, res) => res.json([payrollUploadBatch]));
previewRouter.post("/payroll-uploads", (_req, res) => res.status(201).json(payrollUploadBatch));
previewRouter.patch("/payroll-uploads/:id/status", (req, res) => res.json({ ...payrollUploadBatch, id: req.params.id, status: req.body.status, approvalComments: req.body.comments }));
previewRouter.delete("/payroll-uploads/:id", (req, res) => res.json({ id: req.params.id, archivedAt: new Date().toISOString() }));
previewRouter.get("/payroll-uploads/:id/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Employee ID,Employee Name,Gross Salary,Total Deduction,Net Salary\nEMP-002,Employee User,10800.00,975.00,9825.00");
});
previewRouter.get("/payroll-uploads/:id/print", (_req, res) => res.send("<html><body><h1>Payroll Register</h1><script>window.print()</script></body></html>"));
previewRouter.get("/payroll-uploads/items/:id/payslip.pdf", async (req, res) => {
  const company = payslipCompanyFromProfile(await getCurrentCompanyProfile());
  renderPayslipPdf(res, {
    company,
    employee: { name: "Employee User", code: "EMP-002", department: "Operations", designation: "Operations Specialist", nationalId: "1000000002", bankName: "Al Rajhi Bank", iban: "SA0380000000608010167519", joiningDate: "2026-02-01", status: "ACTIVE" },
    payroll: { month: 6, year: 2026, period: "June 2026", reference: "PAY-2026-06-EMP-002-PREVIEW", batchNumber: "preview-payroll-upload-1", paymentDate: "2026-06-30", paymentMethod: "Bank Transfer", printedBy: req.user?.email },
    attendance: { payrollDays: 30, presentDays: 30, absentDays: 0, weeklyOffDays: 0, publicHolidays: 0, normalOvertimeHours: 0, holidayOvertimeHours: 0 },
    earnings: [
      { name: "Basic Salary", value: 8000 },
      { name: "Housing Allowance", value: 2000 },
      { name: "Transportation Allowance", value: 800 }
    ],
    deductions: [{ name: "GOSI Employee Contribution", value: 975 }],
    netSalary: 9825,
    remarks: "Preview uploaded payslip"
  });
});

const leaveBalanceBatch = {
  id: "preview-leave-balance-1",
  company: "Demo Company",
  branch: "Riyadh",
  leaveYear: 2026,
  leaveType: "ANNUAL",
  status: "DRAFT",
  items: [
    {
      id: "preview-leave-balance-item-1",
      employeeCode: "EMP-002",
      employeeName: "Employee User",
      department: "Operations",
      leaveType: "ANNUAL",
      leaveYear: 2026,
      openingBalance: "15.00",
      accruedLeave: "6.00",
      usedLeave: "0.00",
      pendingLeave: "2.00",
      carriedForwardBalance: "3.00",
      encashmentBalance: "0.00",
      adjustmentBalance: "0.00",
      finalAvailableBalance: "22.00"
    }
  ]
};
previewRouter.get("/leave-balance-uploads/template.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Employee ID,Employee Name,Department,Leave Type,Leave Year,Opening Balance,Accrued Leave,Used Leave,Pending Leave,Carried Forward Balance,Encashment Balance,Adjustment Balance,Final Available Balance,Expiry Date of Carry-Forward Balance,Remarks\n");
});
previewRouter.post("/leave-balance-uploads/validate", (_req, res) => res.json({ valid: true, rowCount: 1, errors: [] }));
previewRouter.get("/leave-balance-uploads", (_req, res) => res.json([leaveBalanceBatch]));
previewRouter.post("/leave-balance-uploads", (_req, res) => res.status(201).json(leaveBalanceBatch));
previewRouter.patch("/leave-balance-uploads/:id/status", (req, res) => res.json({ ...leaveBalanceBatch, id: req.params.id, status: req.body.status, approvalComments: req.body.comments }));
previewRouter.delete("/leave-balance-uploads/:id", (req, res) => res.json({ id: req.params.id, archivedAt: new Date().toISOString() }));
previewRouter.get("/leave-balance-uploads/:id/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Employee ID,Employee Name,Leave Type,Leave Year,Final Available Balance\nEMP-002,Employee User,ANNUAL,2026,22.00");
});

previewRouter.get("/employee-imports/template.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Employee Code,Employee Name English,Employee Name Arabic,First Name,Middle Name,Last Name,Nationality,Gender,Date of Birth,Marital Status,Religion,Mobile Number,Personal Email,Company Email,Address,Emergency Contact Name,Emergency Contact Number,Iqama Number,Iqama Expiry Date,National ID Number,Passport Number,Passport Expiry Date,Visa Number,Visa Expiry Date,GOSI Number,QIWA Employee Reference,Joining Date,Probation Start Date,Probation End Date,Employee Status,Employee Type,Contract Type,Contract Start Date,Contract End Date,Department,Designation,Job Grade,Branch,Location,Cost Center,Reporting Manager,Shift,Weekly Off Days,Basic Salary,Housing Allowance,Transportation Allowance,Other Allowance,Gross Salary,Bank Name,IBAN,Payment Method,User Login Email,Employee Portal Access,Document Reference,Notes,Remarks\n");
});
previewRouter.get("/employee-imports/template.xlsx", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Employee Code,Employee Name English,Department,Designation,Joining Date,Basic Salary\n");
});
previewRouter.post("/employee-imports/validate", (_req, res) => res.json({
  valid: true,
  totalRows: 1,
  errors: [],
  preview: [{ "Employee Code": "EMP-003", "Employee Name English": "New Employee", Department: "Human Resources", Designation: "HR Officer" }]
}));
previewRouter.post("/employee-imports", (_req, res) => res.status(201).json({
  id: "preview-import-1",
  batchNumber: "EMP-IMP-PREVIEW",
  fileName: "preview.csv",
  mode: "CREATE_AND_UPDATE",
  status: "IMPORTED",
  totalRows: 1,
  createdCount: 1,
  updatedCount: 0,
  failedCount: 0,
  duplicateCount: 0,
  createdAt: new Date().toISOString(),
  rows: []
}));
previewRouter.get("/employee-imports/history", (_req, res) => res.json([
  { id: "preview-import-1", batchNumber: "EMP-IMP-PREVIEW", fileName: "preview.csv", mode: "CREATE_AND_UPDATE", status: "IMPORTED", totalRows: 1, createdCount: 1, updatedCount: 0, failedCount: 0, duplicateCount: 0, createdAt: new Date().toISOString(), rows: [] }
]));
previewRouter.get("/employee-imports/exports/employees.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Employee Code,Name English,Department,Designation,Status\nEMP-001,Admin User,Human Resources,HRMS Administrator,ACTIVE\nEMP-002,Employee User,Operations,Operations Specialist,ACTIVE");
});

previewRouter.get("/groups", (req, res) => {
  const groups = [
  { id: "grp-1", groupCode: "HEAD-OFFICE", groupName: "Head Office Employees", groupType: "EMPLOYEE", company: "Demo Company", branch: "Riyadh", department: "All", status: "ACTIVE", groupOwner: "HR Manager", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { members: 2 } },
  { id: "grp-2", groupCode: "MONTHLY-PAY", groupName: "Monthly Salaried Employees", groupType: "PAYROLL", company: "Demo Company", branch: "Riyadh", department: "All", status: "ACTIVE", groupOwner: "Payroll Officer", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { members: 2 } },
  { id: "grp-3", groupCode: "ANNUAL-LEAVE", groupName: "Annual Leave Group", groupType: "LEAVE", company: "Demo Company", branch: "Riyadh", department: "Operations", status: "ACTIVE", groupOwner: "HR Officer", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { members: 1 } }
  ];
  const groupType = typeof req.query.groupType === "string" ? req.query.groupType : undefined;
  res.json(groupType ? groups.filter((group) => group.groupType === groupType) : groups);
});
previewRouter.post("/groups", (req, res) => res.status(201).json({ id: "grp-new", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { members: 0 }, ...req.body }));
previewRouter.patch("/groups/:id", (req, res) => res.json({ id: req.params.id, updatedAt: new Date().toISOString(), ...req.body }));
previewRouter.delete("/groups/:id", (req, res) => res.json({ id: req.params.id, status: "ARCHIVED", archivedAt: new Date().toISOString() }));
previewRouter.get("/groups/export-members.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Group Code,Group Name,Employee Code,Employee Name,Department,Designation,Status\nHEAD-OFFICE,Head Office Employees,EMP-001,Admin User,Human Resources,HRMS Administrator,ACTIVE\nMONTHLY-PAY,Monthly Salaried Employees,EMP-002,Employee User,Operations,Operations Specialist,ACTIVE");
});
previewRouter.get("/groups/:id/members", (_req, res) => res.json([
  { id: "gm-1", employee: { employeeCode: "EMP-001", firstName: "Admin", lastName: "User", jobTitle: "HRMS Administrator", status: "ACTIVE", department: { name: "Human Resources" } } },
  { id: "gm-2", employee: { employeeCode: "EMP-002", firstName: "Employee", lastName: "User", jobTitle: "Operations Specialist", status: "ACTIVE", department: { name: "Operations" } } }
]));
previewRouter.post("/groups/:id/members", (req, res) => res.json({ id: req.params.id, _count: { members: req.body.employeeIds?.length ?? 0 } }));
previewRouter.get("/groups/:id/export-members.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Employee Code,Employee Name,Department,Designation,Status\nEMP-001,Admin User,Human Resources,HRMS Administrator,ACTIVE\nEMP-002,Employee User,Operations,Operations Specialist,ACTIVE");
});

previewRouter.get("/audit-logs", (_req, res) => res.json([
  { id: "preview-audit-1", userId: "preview-admin", action: "LOGIN", entity: "User", entityId: "preview-admin", createdAt: new Date().toISOString() }
]));
