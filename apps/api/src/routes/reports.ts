import { Router } from "express";
import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { audit } from "../utils/audit.js";
import { companyPrintHeader, getCurrentCompanyProfile } from "../utils/companyProfile.js";
import { csvFile, xlsxFile } from "../utils/uploadParsers.js";

const router = Router();

const allReportRoles = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.HR_MANAGER,
  Role.HR_OFFICER,
  Role.HR,
  Role.PAYROLL_OFFICER,
  Role.ACCOUNTANT,
  Role.FINANCE,
  Role.DEPARTMENT_MANAGER,
  Role.OPERATIONS_MANAGER,
  Role.EMPLOYEE,
  Role.AUDITOR
];

const sensitiveRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR, Role.PAYROLL_OFFICER, Role.ACCOUNTANT, Role.FINANCE];
const auditRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.AUDITOR];
const managerRoles: Role[] = [Role.DEPARTMENT_MANAGER, Role.OPERATIONS_MANAGER];

type ReportColumn = { key: string; label: string; sensitive?: boolean };
type ReportRow = Record<string, unknown>;
type ReportDefinition = {
  id: string;
  title: string;
  category: string;
  description: string;
  base: ReportBase;
  allowedRoles?: Role[];
  sensitive?: boolean;
};
type ReportBase =
  | "employee-master"
  | "leave-balance"
  | "leave-requests"
  | "attendance-daily"
  | "payroll-register"
  | "payslip-report"
  | "pending-approvals"
  | "petty-cash"
  | "business-trips"
  | "appraisals"
  | "resignations"
  | "audit-log"
  | "loans"
  | "tickets"
  | "government"
  | "master-data";

const reportDefinitions: ReportDefinition[] = [
  { id: "employee-master", title: "Employee Master Report", category: "Employee Reports", description: "All employees with department, branch, job, and reporting manager.", base: "employee-master" },
  { id: "active-employees", title: "Active Employee Report", category: "Employee Reports", description: "Employees currently active.", base: "employee-master" },
  { id: "inactive-employees", title: "Inactive Employee Report", category: "Employee Reports", description: "Employees marked inactive.", base: "employee-master" },
  { id: "new-joiners", title: "New Joiners Report", category: "Employee Reports", description: "Employees joined in the selected period.", base: "employee-master" },
  { id: "resigned-employees", title: "Resigned Employees Report", category: "Employee Reports", description: "Employees with resigned status.", base: "employee-master" },
  { id: "terminated-employees", title: "Terminated Employees Report", category: "Employee Reports", description: "Employees with terminated status.", base: "employee-master" },
  { id: "employee-document-expiry", title: "Employee Document Expiry Report", category: "Employee Reports", description: "Iqama, passport, contract, and probation expiry tracking.", base: "employee-master" },
  { id: "iqama-expiry", title: "Iqama Expiry Report", category: "Employee Reports", description: "Employees with iqama expiry dates.", base: "employee-master" },
  { id: "passport-expiry", title: "Passport Expiry Report", category: "Employee Reports", description: "Employees with passport expiry dates.", base: "employee-master" },
  { id: "employee-salary", title: "Employee Salary Report", category: "Employee Reports", description: "Salary and allowance report for authorized roles.", base: "employee-master", sensitive: true, allowedRoles: sensitiveRoles },

  { id: "leave-requests", title: "Leave Request Report", category: "Leave & Vacation Reports", description: "Leave requests with workflow status and current approver.", base: "leave-requests" },
  { id: "approved-leaves", title: "Approved Leave Report", category: "Leave & Vacation Reports", description: "Approved leave requests.", base: "leave-requests" },
  { id: "pending-leaves", title: "Pending Leave Approval Report", category: "Leave & Vacation Reports", description: "Leave requests waiting for approval.", base: "leave-requests" },
  { id: "rejected-leaves", title: "Rejected Leave Report", category: "Leave & Vacation Reports", description: "Rejected leave requests.", base: "leave-requests" },
  { id: "leave-balance", title: "Leave Balance Report", category: "Leave & Vacation Reports", description: "Uploaded leave and vacation balances.", base: "leave-balance" },
  { id: "vacation-balance", title: "Vacation Balance Report", category: "Leave & Vacation Reports", description: "Annual vacation balances.", base: "leave-balance" },

  { id: "attendance-daily", title: "Daily Attendance Report", category: "Attendance Reports", description: "Daily check-in/out, late, overtime, and attendance status.", base: "attendance-daily" },
  { id: "monthly-attendance", title: "Monthly Attendance Report", category: "Attendance Reports", description: "Attendance records for the selected period.", base: "attendance-daily" },
  { id: "late-arrival", title: "Late Arrival Report", category: "Attendance Reports", description: "Employees with late minutes.", base: "attendance-daily" },
  { id: "absent-employees", title: "Absent Employees Report", category: "Attendance Reports", description: "Absence records.", base: "attendance-daily" },
  { id: "overtime", title: "Overtime Report", category: "Attendance Reports", description: "Overtime hours by employee.", base: "attendance-daily" },
  { id: "biometric-raw-log", title: "Biometric Raw Log Report", category: "Attendance Reports", description: "Raw biometric device logs.", base: "attendance-daily" },

  { id: "payroll-register", title: "Payroll Register", category: "Payroll Reports", description: "Payroll earnings, deductions, net salary, and status.", base: "payroll-register", sensitive: true, allowedRoles: sensitiveRoles },
  { id: "payroll-summary", title: "Payroll Summary Report", category: "Payroll Reports", description: "Payroll totals by run and employee.", base: "payroll-register", sensitive: true, allowedRoles: sensitiveRoles },
  { id: "payslip-report", title: "Payslip Report", category: "Payroll Reports", description: "Published payslip data for authorized users.", base: "payslip-report", sensitive: true, allowedRoles: sensitiveRoles },
  { id: "bank-transfer", title: "Bank Transfer Report", category: "Payroll Reports", description: "Payroll bank transfer data.", base: "payroll-register", sensitive: true, allowedRoles: sensitiveRoles },
  { id: "gosi-deduction", title: "GOSI Deduction Report", category: "Payroll Reports", description: "GOSI deductions from payroll.", base: "payroll-register", sensitive: true, allowedRoles: sensitiveRoles },

  { id: "loan-requests", title: "Loan Request Report", category: "Loan & Advance Reports", description: "Employee loan and advance requests.", base: "loans", sensitive: true, allowedRoles: sensitiveRoles },
  { id: "salary-advance", title: "Salary Advance Report", category: "Loan & Advance Reports", description: "Salary advance requests and balances.", base: "loans", sensitive: true, allowedRoles: sensitiveRoles },
  { id: "business-trips", title: "Business Trip Request Report", category: "Business Trip Reports", description: "Business trip approvals and estimated cost.", base: "business-trips" },
  { id: "ticket-requests", title: "Ticket Request Report", category: "Ticket Request Reports", description: "Ticket requests linked to vacation or travel.", base: "tickets" },
  { id: "petty-cash", title: "Petty Cash Request Report", category: "Petty Cash Reports", description: "Petty cash requests, payments, and settlement status.", base: "petty-cash", sensitive: true, allowedRoles: sensitiveRoles },
  { id: "appraisal-report", title: "Manual Appraisal Report", category: "Appraisal Reports", description: "Manual salary appraisal and approval status.", base: "appraisals", sensitive: true, allowedRoles: sensitiveRoles },
  { id: "resignation-report", title: "Resignation Request Report", category: "Resignation & Exit Reports", description: "Resignation, exit clearance, and final settlement status.", base: "resignations" },
  { id: "government-integration-log", title: "Government Integration Log Report", category: "Government Reports", description: "GOSI, Mudad, and Qiwa connector log status.", base: "government", allowedRoles: sensitiveRoles },
  { id: "master-data", title: "Master Data Report", category: "Master Data Reports", description: "Company, department, branch, and master records.", base: "master-data" },
  { id: "pending-approvals", title: "Pending Approval Report", category: "Workflow & Approval Reports", description: "All requests waiting for approval.", base: "pending-approvals" },
  { id: "audit-log", title: "Audit Log Report", category: "Audit & Security Reports", description: "System audit trail for create, edit, approve, export, and print.", base: "audit-log", allowedRoles: auditRoles },
  { id: "export-history", title: "Export History Report", category: "Audit & Security Reports", description: "Report and module export audit history.", base: "audit-log", allowedRoles: auditRoles },
  { id: "print-history", title: "Print History Report", category: "Audit & Security Reports", description: "Print and PDF download audit history.", base: "audit-log", allowedRoles: auditRoles }
];

const definitionsById = new Map(reportDefinitions.map((report) => [report.id, report]));

const employeeColumns: ReportColumn[] = [
  { key: "employeeId", label: "Employee ID" },
  { key: "employeeName", label: "Employee Name" },
  { key: "nationality", label: "Nationality" },
  { key: "department", label: "Department" },
  { key: "designation", label: "Designation" },
  { key: "branch", label: "Branch" },
  { key: "location", label: "Location" },
  { key: "joiningDate", label: "Joining Date" },
  { key: "status", label: "Employee Status" },
  { key: "mobile", label: "Mobile" },
  { key: "companyEmail", label: "Company Email" },
  { key: "reportingManager", label: "Reporting Manager" }
];

const salaryColumns: ReportColumn[] = [
  ...employeeColumns,
  { key: "basicSalary", label: "Basic Salary", sensitive: true },
  { key: "housingAllowance", label: "Housing", sensitive: true },
  { key: "transportAllowance", label: "Transport", sensitive: true },
  { key: "otherAllowance", label: "Other Allowance", sensitive: true }
];

function canAccessReport(req: Request, definition: ReportDefinition) {
  const role = String(req.user?.role ?? "");
  if (!role || !allReportRoles.map(String).includes(role)) return false;
  if (definition.allowedRoles && !definition.allowedRoles.map(String).includes(role)) return false;
  return true;
}

function canSeeSensitive(req: Request) {
  const role = String(req.user?.role ?? "");
  return !!role && sensitiveRoles.map(String).includes(role);
}

function isManager(req: Request) {
  const role = String(req.user?.role ?? "");
  return !!role && managerRoles.map(String).includes(role);
}

function queryString(req: Request, name: string) {
  const value = req.query[name];
  return Array.isArray(value) ? String(value[0] ?? "") : value === undefined ? "" : String(value);
}

function dateFromQuery(req: Request, name: string) {
  const value = queryString(req, name);
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDate(value: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function decimal(value: unknown) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function money(value: unknown) {
  return decimal(value).toFixed(2);
}

function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function employeeName(employee: { firstName?: string | null; lastName?: string | null; employeeCode?: string | null }) {
  return `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim() || employee.employeeCode || "";
}

function baseEmployeeWhere(req: Request) {
  const search = queryString(req, "search");
  const department = queryString(req, "department");
  const branch = queryString(req, "branch");
  const location = queryString(req, "location");
  const employee = queryString(req, "employee");
  const where: Record<string, unknown> = { archivedAt: null };
  if (search) {
    where.OR = [
      { employeeCode: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { companyEmail: { contains: search, mode: "insensitive" } },
      { jobTitle: { contains: search, mode: "insensitive" } }
    ];
  }
  if (department) where.department = { name: { contains: department, mode: "insensitive" } };
  if (branch) where.branch = { contains: branch, mode: "insensitive" };
  if (location) where.location = { contains: location, mode: "insensitive" };
  if (employee) {
    where.OR = [
      { employeeCode: { contains: employee, mode: "insensitive" } },
      { firstName: { contains: employee, mode: "insensitive" } },
      { lastName: { contains: employee, mode: "insensitive" } }
    ];
  }
  if (req.user?.role === Role.EMPLOYEE) where.id = req.user.employeeId ?? "__none__";
  if (isManager(req)) where.managerId = req.user?.employeeId ?? "__none__";
  return where;
}

function applyStatusPreset(reportId: string, where: Record<string, unknown>, req: Request) {
  const status = queryString(req, "status");
  if (status) where.status = status;
  if (reportId === "active-employees") where.status = "ACTIVE";
  if (reportId === "inactive-employees") where.status = "INACTIVE";
  if (reportId === "resigned-employees") where.status = "RESIGNED";
  if (reportId === "terminated-employees") where.status = "TERMINATED";
}

function paginateAndSort(rows: ReportRow[], req: Request, columns: ReportColumn[]) {
  const sortBy = queryString(req, "sortBy");
  const sortDir = queryString(req, "sortDir") === "desc" ? -1 : 1;
  const page = Math.max(Number(queryString(req, "page")) || 1, 1);
  const pageSize = Math.min(Math.max(Number(queryString(req, "pageSize")) || 25, 5), 250);
  if (sortBy && columns.some((column) => column.key === sortBy)) {
    rows.sort((a, b) => String(a[sortBy] ?? "").localeCompare(String(b[sortBy] ?? ""), undefined, { numeric: true }) * sortDir);
  }
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, pageSize, total: rows.length, totalPages: Math.max(Math.ceil(rows.length / pageSize), 1) }
  };
}

function maskSensitiveRows(rows: ReportRow[], columns: ReportColumn[], req: Request) {
  if (canSeeSensitive(req)) return rows;
  const sensitiveKeys = new Set(columns.filter((column) => column.sensitive).map((column) => column.key));
  if (!sensitiveKeys.size) return rows;
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, sensitiveKeys.has(key) ? "Restricted" : value])));
}

async function buildEmployeeReport(req: Request, definition: ReportDefinition) {
  const where = baseEmployeeWhere(req);
  const from = dateFromQuery(req, "dateFrom");
  const to = dateFromQuery(req, "dateTo");
  applyStatusPreset(definition.id, where, req);
  if (definition.id === "new-joiners" && (from || to)) where.joiningDate = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

  const employees = await prisma.employee.findMany({
    where,
    include: { department: true, manager: true },
    orderBy: { employeeCode: "asc" },
    take: 5000
  });
  const columns = definition.sensitive ? salaryColumns : employeeColumns;
  const rows = employees.map((employee) => ({
    employeeId: employee.employeeCode,
    employeeName: employeeName(employee),
    nationality: employee.nationality ?? "",
    department: employee.department.name,
    designation: employee.jobTitle,
    branch: employee.branch ?? "",
    location: employee.location ?? "",
    joiningDate: formatDate(employee.joiningDate),
    status: employee.status,
    mobile: employee.phone ?? "",
    companyEmail: employee.companyEmail ?? employee.email,
    reportingManager: employee.manager ? employeeName(employee.manager) : "",
    basicSalary: money(employee.basicSalary),
    housingAllowance: money(employee.housingAllowance),
    transportAllowance: money(employee.transportAllowance),
    otherAllowance: money(employee.otherAllowance)
  }));
  return { columns, rows, summary: { totalEmployees: rows.length } };
}

async function buildLeaveBalanceReport(req: Request) {
  const where: Record<string, unknown> = {};
  const search = queryString(req, "search");
  const status = queryString(req, "status");
  if (status) where.batch = { status };
  if (req.user?.role === Role.EMPLOYEE) where.employeeId = req.user.employeeId ?? "__none__";
  if (isManager(req)) where.employee = { managerId: req.user?.employeeId ?? "__none__" };
  if (search) {
    where.OR = [
      { employeeCode: { contains: search, mode: "insensitive" } },
      { employeeName: { contains: search, mode: "insensitive" } },
      { department: { contains: search, mode: "insensitive" } }
    ];
  }
  const items = await prisma.leaveBalanceUploadItem.findMany({
    where,
    include: { employee: { include: { department: true } } },
    orderBy: { updatedAt: "desc" },
    take: 5000
  });
  const columns: ReportColumn[] = [
    { key: "employeeId", label: "Employee ID" },
    { key: "employeeName", label: "Employee Name" },
    { key: "department", label: "Department" },
    { key: "leaveType", label: "Leave Type" },
    { key: "openingBalance", label: "Opening Balance" },
    { key: "accrued", label: "Accrued" },
    { key: "used", label: "Used" },
    { key: "pending", label: "Pending" },
    { key: "adjustment", label: "Adjustment" },
    { key: "availableBalance", label: "Available Balance" },
    { key: "carryForward", label: "Carry Forward" },
    { key: "expiryDate", label: "Expiry Date" }
  ];
  const rows = items.map((item) => ({
    employeeId: item.employeeCode,
    employeeName: item.employeeName,
    department: item.department ?? item.employee.department.name,
    leaveType: item.leaveType,
    openingBalance: money(item.openingBalance),
    accrued: money(item.accruedLeave),
    used: money(item.usedLeave),
    pending: money(item.pendingLeave),
    adjustment: money(item.adjustmentBalance),
    availableBalance: money(item.finalAvailableBalance),
    carryForward: money(item.carriedForwardBalance),
    expiryDate: formatDate(item.carryForwardExpiryDate)
  }));
  return { columns, rows, summary: { totalEmployees: new Set(rows.map((row) => row.employeeId)).size, totalBalance: rows.reduce((sum, row) => sum + decimal(row.availableBalance), 0).toFixed(2) } };
}

async function buildLeaveRequestsReport(req: Request, definition: ReportDefinition) {
  const where: Record<string, unknown> = {};
  const search = queryString(req, "search");
  const status = queryString(req, "status");
  const from = dateFromQuery(req, "dateFrom");
  const to = dateFromQuery(req, "dateTo");
  if (status) where.status = status;
  if (definition.id === "approved-leaves") where.status = "APPROVED";
  if (definition.id === "pending-leaves") where.status = "PENDING";
  if (definition.id === "rejected-leaves") where.status = "REJECTED";
  if (from || to) where.startDate = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  if (req.user?.role === Role.EMPLOYEE) where.employeeId = req.user.employeeId ?? "__none__";
  if (isManager(req)) where.employee = { managerId: req.user?.employeeId ?? "__none__" };
  if (search) where.OR = [{ requestNumber: { contains: search, mode: "insensitive" } }, { employee: { employeeCode: { contains: search, mode: "insensitive" } } }];
  const leaves = await prisma.leaveRequest.findMany({ where, include: { employee: { include: { department: true } } }, orderBy: { createdAt: "desc" }, take: 5000 });
  const columns: ReportColumn[] = [
    { key: "requestNo", label: "Leave Request No." },
    { key: "employeeId", label: "Employee ID" },
    { key: "employeeName", label: "Employee Name" },
    { key: "department", label: "Department" },
    { key: "leaveType", label: "Leave Type" },
    { key: "startDate", label: "Start Date" },
    { key: "endDate", label: "End Date" },
    { key: "totalDays", label: "Total Days" },
    { key: "status", label: "Status" },
    { key: "currentApprover", label: "Current Approver" },
    { key: "requestDate", label: "Request Date" }
  ];
  const rows = leaves.map((leave) => ({
    requestNo: leave.requestNumber,
    employeeId: leave.employee.employeeCode,
    employeeName: employeeName(leave.employee),
    department: leave.employee.department.name,
    leaveType: leave.type,
    startDate: formatDate(leave.startDate),
    endDate: formatDate(leave.endDate),
    totalDays: leave.days,
    status: leave.status,
    currentApprover: leave.workflowStage,
    requestDate: formatDate(leave.createdAt)
  }));
  return { columns, rows, summary: { totalRequests: rows.length, totalDays: rows.reduce((sum, row) => sum + Number(row.totalDays ?? 0), 0) } };
}

async function buildAttendanceReport(req: Request, definition: ReportDefinition) {
  const where: Record<string, unknown> = {};
  const from = dateFromQuery(req, "dateFrom");
  const to = dateFromQuery(req, "dateTo");
  const status = queryString(req, "status");
  if (from || to) where.workDate = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  if (status) where.status = status;
  if (definition.id === "late-arrival") where.lateMinutes = { gt: 0 };
  if (definition.id === "absent-employees") where.status = "ABSENT";
  if (definition.id === "overtime") where.overtimeHours = { gt: 0 };
  if (req.user?.role === Role.EMPLOYEE) where.employeeId = req.user.employeeId ?? "__none__";
  if (isManager(req)) where.employee = { managerId: req.user?.employeeId ?? "__none__" };
  const records = await prisma.attendance.findMany({ where, include: { employee: { include: { department: true } } }, orderBy: [{ workDate: "desc" }, { employee: { employeeCode: "asc" } }], take: 5000 });
  const columns: ReportColumn[] = [
    { key: "employeeId", label: "Employee ID" },
    { key: "employeeName", label: "Employee Name" },
    { key: "department", label: "Department" },
    { key: "date", label: "Date" },
    { key: "shift", label: "Shift" },
    { key: "firstIn", label: "First In" },
    { key: "lastOut", label: "Last Out" },
    { key: "workingHours", label: "Working Hours" },
    { key: "lateMinutes", label: "Late Minutes" },
    { key: "earlyOutMinutes", label: "Early Out Minutes" },
    { key: "overtimeHours", label: "Overtime Hours" },
    { key: "status", label: "Status" },
    { key: "source", label: "Source" },
    { key: "deviceName", label: "Device Name" }
  ];
  const rows = records.map((record) => {
    const workingHours = record.checkIn && record.checkOut ? Math.max((record.checkOut.getTime() - record.checkIn.getTime()) / 3600000, 0).toFixed(2) : "";
    return {
      employeeId: record.employee.employeeCode,
      employeeName: employeeName(record.employee),
      department: record.employee.department.name,
      date: formatDate(record.workDate),
      shift: "Default",
      firstIn: record.checkIn ? record.checkIn.toISOString().slice(11, 16) : "",
      lastOut: record.checkOut ? record.checkOut.toISOString().slice(11, 16) : "",
      workingHours,
      lateMinutes: record.lateMinutes,
      earlyOutMinutes: 0,
      overtimeHours: money(record.overtimeHours),
      status: record.status,
      source: record.source,
      deviceName: record.source === "BIOMETRIC" ? "Biometric Device" : ""
    };
  });
  return { columns, rows, summary: { totalRecords: rows.length, lateMinutes: rows.reduce((sum, row) => sum + Number(row.lateMinutes ?? 0), 0), overtimeHours: rows.reduce((sum, row) => sum + decimal(row.overtimeHours), 0).toFixed(2) } };
}

async function buildPayrollReport(req: Request, definition: ReportDefinition) {
  const where: Record<string, unknown> = {};
  const status = queryString(req, "status");
  if (status) where.payrollRun = { status };
  const items = await prisma.payrollItem.findMany({ where, include: { payrollRun: true, employee: { include: { department: true } } }, orderBy: [{ payrollRun: { year: "desc" } }, { payrollRun: { month: "desc" } }], take: 5000 });
  const columns: ReportColumn[] = [
    { key: "payrollBatchNo", label: "Payroll Batch No." },
    { key: "payrollMonth", label: "Payroll Month" },
    { key: "employeeId", label: "Employee ID" },
    { key: "employeeName", label: "Employee Name" },
    { key: "department", label: "Department" },
    { key: "basicSalary", label: "Basic Salary", sensitive: true },
    { key: "housingAllowance", label: "Housing Allowance", sensitive: true },
    { key: "transportAllowance", label: "Transportation Allowance", sensitive: true },
    { key: "otherEarnings", label: "Other Earnings", sensitive: true },
    { key: "totalEarnings", label: "Total Earnings", sensitive: true },
    { key: "totalDeductions", label: "Total Deductions", sensitive: true },
    { key: "netSalary", label: "Net Salary", sensitive: true },
    { key: "paymentDate", label: "Payment Date" },
    { key: "payrollStatus", label: "Payroll Status" },
    { key: "erpPostingStatus", label: "ERP Posting Status" }
  ];
  const rows = items.map((item) => {
    const totalEarnings = decimal(item.basicSalary) + decimal(item.housingAllowance) + decimal(item.transportAllowance) + decimal(item.otherAllowance) + decimal(item.overtime);
    const totalDeductions = decimal(item.absenceDeduction) + decimal(item.loanDeduction);
    const netSalary = decimal(item.netSalary) + decimal(item.gosiDeduction);
    return {
      payrollBatchNo: item.payrollRun.id,
      payrollMonth: `${item.payrollRun.month}/${item.payrollRun.year}`,
      employeeId: item.employee.employeeCode,
      employeeName: employeeName(item.employee),
      department: item.employee.department.name,
      basicSalary: money(item.basicSalary),
      housingAllowance: money(item.housingAllowance),
      transportAllowance: money(item.transportAllowance),
      otherEarnings: money(decimal(item.otherAllowance) + decimal(item.overtime)),
      totalEarnings: totalEarnings.toFixed(2),
      totalDeductions: totalDeductions.toFixed(2),
      netSalary: money(netSalary),
      paymentDate: formatDate(item.payrollRun.approvedAt),
      payrollStatus: item.payrollRun.status,
      erpPostingStatus: definition.id === "payslip-report" ? "PUBLISHED" : "NOT_POSTED"
    };
  });
  return { columns, rows, summary: { totalEmployees: rows.length, totalNetSalary: rows.reduce((sum, row) => sum + decimal(row.netSalary), 0).toFixed(2) } };
}

async function buildWorkflowReport(req: Request) {
  const pendingStatuses = ["PENDING", "PENDING_MANAGER", "PENDING_OM", "PENDING_HR_MANAGER", "PENDING_FINANCE", "PENDING_ADMIN", "FINAL_SETTLEMENT_PENDING"];
  const [leaves, trips, pettyCash, resignations, appraisals] = await Promise.all([
    prisma.leaveRequest.findMany({ where: { status: "PENDING" }, include: { employee: { include: { department: true } } }, take: 1000 }),
    prisma.businessTripRequest.findMany({ where: { status: { in: pendingStatuses as never[] } }, include: { employee: { include: { department: true } } }, take: 1000 }),
    prisma.pettyCashRequest.findMany({ where: { status: { in: pendingStatuses as never[] } }, include: { employee: { include: { department: true } } }, take: 1000 }),
    prisma.resignationRequest.findMany({ where: { status: { in: pendingStatuses as never[] } }, include: { employee: { include: { department: true } } }, take: 1000 }),
    prisma.manualAppraisal.findMany({ where: { status: { contains: "PENDING", mode: "insensitive" } }, include: { employee: { include: { department: true } } }, take: 1000 })
  ]);
  const columns: ReportColumn[] = [
    { key: "processType", label: "Process Type" },
    { key: "requestNo", label: "Request No." },
    { key: "employeeId", label: "Employee ID" },
    { key: "employeeName", label: "Employee Name" },
    { key: "currentStatus", label: "Current Status" },
    { key: "currentApprover", label: "Current Approver" },
    { key: "pendingSince", label: "Pending Since" },
    { key: "agingDays", label: "Aging Days" },
    { key: "lastAction", label: "Last Action" },
    { key: "comments", label: "Comments" }
  ];
  const now = Date.now();
  const toWorkflowRow = (processType: string, requestNo: string, employee: { employeeCode: string; firstName: string; lastName: string }, status: unknown, approver: unknown, createdAt: Date, comments = "") => ({
    processType,
    requestNo,
    employeeId: employee.employeeCode,
    employeeName: employeeName(employee),
    currentStatus: String(status ?? ""),
    currentApprover: String(approver ?? ""),
    pendingSince: formatDate(createdAt),
    agingDays: Math.max(Math.floor((now - createdAt.getTime()) / 86400000), 0),
    lastAction: "Submitted",
    comments
  });
  const rows = [
    ...leaves.map((item) => toWorkflowRow("Leave", item.requestNumber, item.employee, item.status, item.workflowStage, item.createdAt, item.comments ?? "")),
    ...trips.map((item) => toWorkflowRow("Business Trip", item.requestNumber, item.employee, item.status, item.currentApprover, item.createdAt, item.remarks ?? "")),
    ...pettyCash.map((item) => toWorkflowRow("Petty Cash", item.requestNumber, item.employee, item.status, item.currentApprover, item.createdAt, item.remarks ?? "")),
    ...resignations.map((item) => toWorkflowRow("Resignation", item.requestNumber, item.employee, item.status, item.currentApprover, item.createdAt, item.detailedRemarks ?? "")),
    ...appraisals.map((item) => toWorkflowRow("Appraisal", item.referenceNumber, item.employee, item.status, item.currentApprover, item.createdAt, item.hrRemarks ?? ""))
  ];
  return { columns, rows, summary: { pendingApprovals: rows.length } };
}

async function buildPettyCashReport() {
  const rowsRaw = await prisma.pettyCashRequest.findMany({ include: { employee: { include: { department: true } } }, orderBy: { createdAt: "desc" }, take: 5000 });
  const columns: ReportColumn[] = [
    { key: "requestNo", label: "Request No." },
    { key: "employeeId", label: "Employee ID" },
    { key: "employeeName", label: "Employee Name" },
    { key: "department", label: "Department" },
    { key: "requestType", label: "Request Type" },
    { key: "requestedAmount", label: "Requested Amount", sensitive: true },
    { key: "approvedAmount", label: "Approved Amount", sensitive: true },
    { key: "paidAmount", label: "Paid Amount", sensitive: true },
    { key: "settledAmount", label: "Settled Amount", sensitive: true },
    { key: "outstandingAmount", label: "Outstanding Amount", sensitive: true },
    { key: "status", label: "Status" },
    { key: "currentApprover", label: "Current Approver" }
  ];
  const rows = rowsRaw.map((row) => ({
    requestNo: row.requestNumber,
    employeeId: row.employee.employeeCode,
    employeeName: employeeName(row.employee),
    department: row.employee.department.name,
    requestType: row.requestType,
    requestedAmount: money(row.requestedAmount),
    approvedAmount: money(row.approvedAmount),
    paidAmount: money(row.paidAmount),
    settledAmount: money(row.settledAmount),
    outstandingAmount: money(row.outstandingAmount),
    status: row.status,
    currentApprover: row.currentApprover ?? ""
  }));
  return { columns, rows, summary: { totalRequested: rows.reduce((sum, row) => sum + decimal(row.requestedAmount), 0).toFixed(2), outstanding: rows.reduce((sum, row) => sum + decimal(row.outstandingAmount), 0).toFixed(2) } };
}

async function buildBusinessTripReport() {
  const trips = await prisma.businessTripRequest.findMany({ include: { employee: { include: { department: true } } }, orderBy: { createdAt: "desc" }, take: 5000 });
  const columns: ReportColumn[] = [
    { key: "tripRequestNo", label: "Trip Request No." },
    { key: "employeeId", label: "Employee ID" },
    { key: "employeeName", label: "Employee Name" },
    { key: "department", label: "Department" },
    { key: "destination", label: "Destination" },
    { key: "startDate", label: "Start Date" },
    { key: "endDate", label: "End Date" },
    { key: "totalDays", label: "Total Days" },
    { key: "estimatedCost", label: "Estimated Cost" },
    { key: "approvedCost", label: "Approved Cost" },
    { key: "status", label: "Status" },
    { key: "currentApprover", label: "Current Approver" }
  ];
  const rows = trips.map((trip) => ({
    tripRequestNo: trip.requestNumber,
    employeeId: trip.employee.employeeCode,
    employeeName: employeeName(trip.employee),
    department: trip.employee.department.name,
    destination: [trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", "),
    startDate: formatDate(trip.startDate),
    endDate: formatDate(trip.endDate),
    totalDays: trip.totalDays,
    estimatedCost: money(trip.totalEstimatedCost),
    approvedCost: money(trip.totalEstimatedCost),
    status: trip.status,
    currentApprover: trip.currentApprover ?? ""
  }));
  return { columns, rows, summary: { totalTrips: rows.length, estimatedCost: rows.reduce((sum, row) => sum + decimal(row.estimatedCost), 0).toFixed(2) } };
}

async function buildLoanReport() {
  const loans = await prisma.employeeLoanRequest.findMany({ include: { employee: { include: { department: true } } }, orderBy: { createdAt: "desc" }, take: 5000 });
  const columns: ReportColumn[] = [
    { key: "requestNo", label: "Loan Request No." },
    { key: "employeeId", label: "Employee ID" },
    { key: "employeeName", label: "Employee Name" },
    { key: "loanType", label: "Loan Type" },
    { key: "requestedAmount", label: "Requested Amount", sensitive: true },
    { key: "approvedAmount", label: "Approved Amount", sensitive: true },
    { key: "monthlyDeduction", label: "Monthly Deduction", sensitive: true },
    { key: "outstandingBalance", label: "Outstanding Balance", sensitive: true },
    { key: "status", label: "Status" },
    { key: "currentApprover", label: "Current Approver" }
  ];
  const rows = loans.map((loan) => ({
    requestNo: loan.requestNumber,
    employeeId: loan.employee.employeeCode,
    employeeName: employeeName(loan.employee),
    loanType: loan.loanType,
    requestedAmount: money(loan.requestedAmount),
    approvedAmount: money(loan.approvedAmount),
    monthlyDeduction: money(loan.monthlyInstallmentAmount),
    outstandingBalance: money(loan.outstandingBalance),
    status: loan.status,
    currentApprover: loan.loanStatus
  }));
  return { columns, rows, summary: { totalRequested: rows.reduce((sum, row) => sum + decimal(row.requestedAmount), 0).toFixed(2) } };
}

async function buildTicketReport() {
  const tickets = await prisma.ticketRequest.findMany({ include: { employee: true, leaveRequest: true }, orderBy: { createdAt: "desc" }, take: 5000 });
  const columns: ReportColumn[] = [
    { key: "ticketRequestNo", label: "Ticket Request No." },
    { key: "linkedLeaveRequestNo", label: "Linked Leave Request No." },
    { key: "employeeId", label: "Employee ID" },
    { key: "employeeName", label: "Employee Name" },
    { key: "destination", label: "Destination" },
    { key: "departureDate", label: "Departure Date" },
    { key: "returnDate", label: "Return Date" },
    { key: "ticketType", label: "Ticket Type" },
    { key: "estimatedCost", label: "Estimated Cost" },
    { key: "bookingReference", label: "Booking Reference" },
    { key: "status", label: "Status" }
  ];
  const rows = tickets.map((ticket) => ({
    ticketRequestNo: ticket.requestNumber,
    linkedLeaveRequestNo: ticket.leaveRequest.requestNumber,
    employeeId: ticket.employee.employeeCode,
    employeeName: employeeName(ticket.employee),
    destination: [ticket.arrivalCity, ticket.arrivalCountry].filter(Boolean).join(", "),
    departureDate: formatDate(ticket.preferredDepartureDate),
    returnDate: formatDate(ticket.preferredReturnDate),
    ticketType: ticket.ticketType,
    estimatedCost: money(ticket.estimatedTicketCost),
    bookingReference: ticket.bookingReference ?? "",
    status: ticket.status
  }));
  return { columns, rows, summary: { totalTickets: rows.length } };
}

async function buildAppraisalReport() {
  const appraisals = await prisma.manualAppraisal.findMany({ include: { employee: { include: { department: true } } }, orderBy: { createdAt: "desc" }, take: 5000 });
  const columns: ReportColumn[] = [
    { key: "appraisalRefNo", label: "Appraisal Ref No." },
    { key: "employeeId", label: "Employee ID" },
    { key: "employeeName", label: "Employee Name" },
    { key: "department", label: "Department" },
    { key: "currentSalary", label: "Current Salary", sensitive: true },
    { key: "increasePercentage", label: "Increase Percentage", sensitive: true },
    { key: "increaseAmount", label: "Increase Amount", sensitive: true },
    { key: "newSalary", label: "New Salary", sensitive: true },
    { key: "effectiveDate", label: "Effective Date" },
    { key: "reason", label: "Reason" },
    { key: "status", label: "Status" },
    { key: "approvedBy", label: "Approved By" }
  ];
  const rows = appraisals.map((appraisal) => ({
    appraisalRefNo: appraisal.referenceNumber,
    employeeId: appraisal.employee.employeeCode,
    employeeName: employeeName(appraisal.employee),
    department: appraisal.employee.department.name,
    currentSalary: money(appraisal.currentGrossSalary),
    increasePercentage: money(appraisal.appraisalPercentage),
    increaseAmount: money(appraisal.appraisalAmount),
    newSalary: money(appraisal.newGrossSalary),
    effectiveDate: formatDate(appraisal.effectiveDate),
    reason: appraisal.reason,
    status: appraisal.status,
    approvedBy: appraisal.approvedBy ?? ""
  }));
  return { columns, rows, summary: { totalIncrease: rows.reduce((sum, row) => sum + decimal(row.increaseAmount), 0).toFixed(2) } };
}

async function buildResignationReport() {
  const resignations = await prisma.resignationRequest.findMany({ include: { employee: { include: { department: true } }, finalSettlement: true, clearanceItems: true }, orderBy: { createdAt: "desc" }, take: 5000 });
  const columns: ReportColumn[] = [
    { key: "resignationRequestNo", label: "Resignation Request No." },
    { key: "employeeId", label: "Employee ID" },
    { key: "employeeName", label: "Employee Name" },
    { key: "department", label: "Department" },
    { key: "proposedLastWorkingDate", label: "Proposed Last Working Date" },
    { key: "noticePeriod", label: "Notice Period" },
    { key: "status", label: "Status" },
    { key: "currentApprover", label: "Current Approver" },
    { key: "finalSettlementStatus", label: "Final Settlement Status" },
    { key: "exitClearanceStatus", label: "Exit Clearance Status" }
  ];
  const rows = resignations.map((resignation) => ({
    resignationRequestNo: resignation.requestNumber,
    employeeId: resignation.employee.employeeCode,
    employeeName: employeeName(resignation.employee),
    department: resignation.employee.department.name,
    proposedLastWorkingDate: formatDate(resignation.proposedLastWorkingDate),
    noticePeriod: `${resignation.noticePeriodServed}/${resignation.noticePeriodRequired}`,
    status: resignation.status,
    currentApprover: resignation.currentApprover ?? "",
    finalSettlementStatus: resignation.finalSettlement?.status ?? "NOT_STARTED",
    exitClearanceStatus: resignation.clearanceItems.every((item) => item.status === "COMPLETED") ? "COMPLETED" : "PENDING"
  }));
  return { columns, rows, summary: { totalResignations: rows.length } };
}

async function buildGovernmentReport() {
  const logs = await prisma.governmentIntegrationLog.findMany({ orderBy: { createdAt: "desc" }, take: 5000 });
  const columns: ReportColumn[] = [
    { key: "module", label: "Module" },
    { key: "recordNo", label: "Record No." },
    { key: "status", label: "Status" },
    { key: "syncDate", label: "Sync Date" },
    { key: "errorMessage", label: "Error Message" }
  ];
  const rows = logs.map((log) => ({ module: log.provider, recordNo: log.requestReference ?? log.id, status: log.status, syncDate: formatDate(log.createdAt), errorMessage: log.message ?? "" }));
  return { columns, rows, summary: { totalLogs: rows.length } };
}

async function buildMasterDataReport() {
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" }, take: 5000 });
  const company = await prisma.companyProfile.findUnique({ where: { id: "default" } });
  const columns: ReportColumn[] = [
    { key: "code", label: "Code" },
    { key: "nameEnglish", label: "Name English" },
    { key: "nameArabic", label: "Name Arabic" },
    { key: "relatedCompanyBranch", label: "Related Company/Branch" },
    { key: "status", label: "Status" },
    { key: "createdBy", label: "Created By" },
    { key: "createdDate", label: "Created Date" },
    { key: "lastUpdatedBy", label: "Last Updated By" },
    { key: "lastUpdatedDate", label: "Last Updated Date" }
  ];
  const rows: ReportRow[] = [
    ...(company
      ? [{
          code: "COMPANY",
          nameEnglish: company.companyName,
          nameArabic: company.companyNameArabic ?? "",
          relatedCompanyBranch: company.city ?? "",
          status: "ACTIVE",
          createdBy: "",
          createdDate: formatDate(company.createdAt),
          lastUpdatedBy: company.updatedBy ?? "",
          lastUpdatedDate: formatDate(company.updatedAt)
        }]
      : []),
    ...departments.map((department) => ({
      code: department.code,
      nameEnglish: department.name,
      nameArabic: "",
      relatedCompanyBranch: "",
      status: "ACTIVE",
      createdBy: "",
      createdDate: formatDate(department.createdAt),
      lastUpdatedBy: "",
      lastUpdatedDate: formatDate(department.updatedAt)
    }))
  ];
  return { columns, rows, summary: { totalRecords: rows.length } };
}

async function buildAuditReport(req: Request, definition: ReportDefinition) {
  const where: Record<string, unknown> = {};
  if (definition.id === "export-history") where.action = { contains: "EXPORT", mode: "insensitive" };
  if (definition.id === "print-history") where.OR = [{ action: { contains: "PRINT", mode: "insensitive" } }, { action: { contains: "DOWNLOAD", mode: "insensitive" } }];
  const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 5000 });
  const columns: ReportColumn[] = [
    { key: "user", label: "User" },
    { key: "role", label: "Role" },
    { key: "module", label: "Module" },
    { key: "action", label: "Action" },
    { key: "recordNo", label: "Record No." },
    { key: "previousValue", label: "Previous Value" },
    { key: "newValue", label: "New Value" },
    { key: "dateTime", label: "Date/Time" },
    { key: "ipDevice", label: "IP/Device" },
    { key: "status", label: "Status" }
  ];
  const rows = logs.map((log) => ({
    user: log.userId ?? "",
    role: "",
    module: log.entity,
    action: log.action,
    recordNo: log.entityId ?? "",
    previousValue: log.previousValue ? JSON.stringify(log.previousValue).slice(0, 120) : "",
    newValue: log.newValue ? JSON.stringify(log.newValue).slice(0, 120) : "",
    dateTime: log.createdAt instanceof Date ? log.createdAt.toISOString() : String(log.createdAt ?? ""),
    ipDevice: [log.ipAddress, log.device].filter(Boolean).join(" / "),
    status: "RECORDED"
  }));
  return { columns, rows, summary: { totalLogs: rows.length } };
}

async function buildReport(req: Request, definition: ReportDefinition) {
  let result: { columns: ReportColumn[]; rows: ReportRow[]; summary: Record<string, unknown> };
  switch (definition.base) {
    case "employee-master":
      result = await buildEmployeeReport(req, definition);
      break;
    case "leave-balance":
      result = await buildLeaveBalanceReport(req);
      break;
    case "leave-requests":
      result = await buildLeaveRequestsReport(req, definition);
      break;
    case "attendance-daily":
      result = await buildAttendanceReport(req, definition);
      break;
    case "payroll-register":
    case "payslip-report":
      result = await buildPayrollReport(req, definition);
      break;
    case "pending-approvals":
      result = await buildWorkflowReport(req);
      break;
    case "petty-cash":
      result = await buildPettyCashReport();
      break;
    case "business-trips":
      result = await buildBusinessTripReport();
      break;
    case "loans":
      result = await buildLoanReport();
      break;
    case "tickets":
      result = await buildTicketReport();
      break;
    case "appraisals":
      result = await buildAppraisalReport();
      break;
    case "resignations":
      result = await buildResignationReport();
      break;
    case "government":
      result = await buildGovernmentReport();
      break;
    case "master-data":
      result = await buildMasterDataReport();
      break;
    case "audit-log":
      result = await buildAuditReport(req, definition);
      break;
  }
  const filteredRows = maskSensitiveRows(result.rows, result.columns, req);
  const paged = paginateAndSort(filteredRows, req, result.columns);
  const company = await getCurrentCompanyProfile();
  return {
    report: definition,
    company: { name: company.companyName, logoDataUrl: company.logoDataUrl, logoVersion: company.logoVersion },
    generatedAt: new Date().toISOString(),
    generatedBy: req.user?.email ?? "",
    filters: {
      search: queryString(req, "search"),
      dateFrom: queryString(req, "dateFrom"),
      dateTo: queryString(req, "dateTo"),
      branch: queryString(req, "branch"),
      department: queryString(req, "department"),
      location: queryString(req, "location"),
      employee: queryString(req, "employee"),
      status: queryString(req, "status")
    },
    columns: result.columns,
    rows: paged.rows,
    summary: result.summary,
    pagination: paged.pagination
  };
}

function reportRowsForExport(payload: Awaited<ReturnType<typeof buildReport>>) {
  return payload.rows.map((row) => payload.columns.map((column) => row[column.key] ?? ""));
}

async function sendPdf(res: Response, payload: Awaited<ReturnType<typeof buildReport>>, fileName: string) {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28 });
  res.header("Content-Type", "application/pdf");
  res.attachment(fileName);
  doc.pipe(res);
  doc.fontSize(15).text(payload.report.title);
  doc.fontSize(9).text(`${payload.company.name} | Generated by ${payload.generatedBy} | ${new Date(payload.generatedAt).toLocaleString()}`);
  doc.moveDown();
  const headers = payload.columns.slice(0, 9);
  const width = (doc.page.width - 56) / headers.length;
  doc.fontSize(7).font("Helvetica-Bold");
  headers.forEach((column, index) => doc.text(column.label, 28 + index * width, doc.y, { width: width - 3 }));
  doc.moveDown();
  doc.font("Helvetica");
  payload.rows.slice(0, 45).forEach((row) => {
    const y = doc.y;
    headers.forEach((column, index) => doc.text(String(row[column.key] ?? ""), 28 + index * width, y, { width: width - 3, ellipsis: true }));
    doc.moveDown(1.2);
    if (doc.y > doc.page.height - 50) doc.addPage();
  });
  doc.moveDown();
  doc.fontSize(8).text(`Total records: ${payload.pagination.total}`);
  doc.end();
}

function sendPrintHtml(res: Response, payload: Awaited<ReturnType<typeof buildReport>>, companyHeader: string) {
  const filters = Object.entries(payload.filters).filter(([, value]) => value).map(([key, value]) => `<span><strong>${htmlEscape(key)}:</strong> ${htmlEscape(value)}</span>`).join(" ");
  const header = payload.columns.map((column) => `<th>${htmlEscape(column.label)}</th>`).join("");
  const rows = payload.rows.map((row) => `<tr>${payload.columns.map((column) => `<td>${htmlEscape(row[column.key])}</td>`).join("")}</tr>`).join("");
  res.send(`<!doctype html><html><head><title>${htmlEscape(payload.report.title)}</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#111}.head{border-bottom:2px solid #0f766e;margin-bottom:12px;padding-bottom:8px}.brand-line{display:flex;gap:12px;align-items:center}.brand-line img{max-width:110px;max-height:58px}h1{font-size:17px;margin:0 0 4px}.meta{display:flex;gap:14px;flex-wrap:wrap;margin:8px 0}.actions{margin:10px 0}.actions button{padding:6px 10px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d1d5db;padding:5px;text-align:left;white-space:nowrap}th{background:#f3f4f6}@media print{.actions{display:none}}</style></head><body>${companyHeader}<div class="actions"><button onclick="window.print()">Print</button></div><div class="meta"><span><strong>Generated by:</strong> ${htmlEscape(payload.generatedBy)}</span><span><strong>Date:</strong> ${htmlEscape(new Date(payload.generatedAt).toLocaleString())}</span><span><strong>Total:</strong> ${payload.pagination.total}</span>${filters}</div><table><thead><tr>${header}</tr></thead><tbody>${rows || `<tr><td colspan="${payload.columns.length}">No records found.</td></tr>`}</tbody></table></body></html>`);
}

router.use(requireAuth);

router.get("/catalog", async (req, res) => {
  const allowed = reportDefinitions.filter((definition) => canAccessReport(req, definition));
  const grouped = allowed.reduce<Record<string, Array<Omit<ReportDefinition, "base" | "allowedRoles">>>>((acc, definition) => {
    acc[definition.category] ??= [];
    acc[definition.category].push({ id: definition.id, title: definition.title, category: definition.category, description: definition.description, sensitive: definition.sensitive });
    return acc;
  }, {});
  res.json(Object.entries(grouped).map(([category, reports]) => ({ category, reports })));
});

router.get("/dashboard", async (_req, res) => {
  const today = new Date();
  const in60Days = new Date(today.getTime() + 60 * 86400000);
  const [totalEmployees, activeEmployees, pendingLeaves, pendingPayroll, expiringIqama, expiringPassport, pendingExitClearance, failedEmailNotifications] = await Promise.all([
    prisma.employee.count({ where: { archivedAt: null } }),
    prisma.employee.count({ where: { status: "ACTIVE", archivedAt: null } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.payrollRun.count({ where: { status: "DRAFT" } }),
    prisma.employee.count({ where: { iqamaExpiryDate: { gte: today, lte: in60Days }, archivedAt: null } }),
    prisma.employee.count({ where: { passportExpiryDate: { gte: today, lte: in60Days }, archivedAt: null } }),
    prisma.resignationRequest.count({ where: { status: "EXIT_CLEARANCE_IN_PROGRESS" } }),
    prisma.emailLog.count({ where: { status: "FAILED" } })
  ]);
  const employeesOnLeaveToday = await prisma.leaveRequest.count({ where: { status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } } });
  const pendingApprovals = pendingLeaves;
  res.json({
    totalEmployees,
    activeEmployees,
    employeesOnLeaveToday,
    pendingApprovals,
    pendingLeaves,
    pendingPayroll,
    expiringIqama,
    expiringPassport,
    pendingExitClearance,
    failedEmailNotifications,
    failedErpPostings: 0
  });
});

router.get("/dashboard.xlsx", async (req, res, next) => {
  try {
    const dashboardReq = { ...req, query: {} } as Request;
    const definition = definitionsById.get("employee-master");
    if (!definition) throw new AppError(404, "Report not found");
    const report = await buildReport(dashboardReq, definition);
    await xlsxFile(res, "employee-master-dashboard.xlsx", report.columns.map((column) => column.label), reportRowsForExport(report), "Dashboard");
  } catch (error) {
    next(error);
  }
});

router.get("/audit-trail.csv", async (req, res, next) => {
  try {
    const definition = definitionsById.get("audit-log");
    if (!definition) throw new AppError(404, "Report not found");
    const report = await buildReport(req, definition);
    await audit(req, "REPORT_EXPORT", "Report", "audit-log", { format: "CSV", count: report.pagination.total });
    csvFile(res, "audit-trail.csv", report.columns.map((column) => column.label), reportRowsForExport(report));
  } catch (error) {
    next(error);
  }
});

router.get("/audit-trail.xlsx", async (req, res, next) => {
  try {
    const definition = definitionsById.get("audit-log");
    if (!definition) throw new AppError(404, "Report not found");
    const report = await buildReport(req, definition);
    await audit(req, "REPORT_EXPORT", "Report", "audit-log", { format: "XLSX", count: report.pagination.total });
    await xlsxFile(res, "audit-trail.xlsx", report.columns.map((column) => column.label), reportRowsForExport(report), "Audit Trail");
  } catch (error) {
    next(error);
  }
});

router.get("/:id/export.csv", async (req, res, next) => {
  try {
    const definition = definitionsById.get(req.params.id);
    if (!definition || !canAccessReport(req, definition)) throw new AppError(403, "Report access denied");
    const report = await buildReport(req, definition);
    await audit(req, "REPORT_EXPORT", "Report", definition.id, { format: "CSV", count: report.pagination.total, filters: report.filters });
    csvFile(res, `${definition.id}.csv`, report.columns.map((column) => column.label), reportRowsForExport(report));
  } catch (error) {
    next(error);
  }
});

router.get("/:id/export.xlsx", async (req, res, next) => {
  try {
    const definition = definitionsById.get(req.params.id);
    if (!definition || !canAccessReport(req, definition)) throw new AppError(403, "Report access denied");
    const report = await buildReport(req, definition);
    await audit(req, "REPORT_EXPORT", "Report", definition.id, { format: "XLSX", count: report.pagination.total, filters: report.filters });
    await xlsxFile(res, `${definition.id}.xlsx`, report.columns.map((column) => column.label), reportRowsForExport(report), definition.title.slice(0, 31));
  } catch (error) {
    next(error);
  }
});

router.get("/:id/export.pdf", async (req, res, next) => {
  try {
    const definition = definitionsById.get(req.params.id);
    if (!definition || !canAccessReport(req, definition)) throw new AppError(403, "Report access denied");
    const report = await buildReport(req, definition);
    await audit(req, "REPORT_EXPORT", "Report", definition.id, { format: "PDF", count: report.pagination.total, filters: report.filters });
    await sendPdf(res, report, `${definition.id}.pdf`);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/print", async (req, res, next) => {
  try {
    const definition = definitionsById.get(req.params.id);
    if (!definition || !canAccessReport(req, definition)) throw new AppError(403, "Report access denied");
    const report = await buildReport(req, definition);
    const company = await getCurrentCompanyProfile();
    await audit(req, "REPORT_PRINT", "Report", definition.id, { count: report.pagination.total, filters: report.filters });
    sendPrintHtml(res, report, companyPrintHeader(company, definition.title));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const definition = definitionsById.get(req.params.id);
    if (!definition || !canAccessReport(req, definition)) throw new AppError(403, "Report access denied");
    res.json(await buildReport(req, definition));
  } catch (error) {
    next(error);
  }
});

export default router;
