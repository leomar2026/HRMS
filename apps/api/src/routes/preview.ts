import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getGosiStatus } from "../services/gosiService.js";
import { getMudadStatus } from "../services/mudadService.js";
import { getQiwaStatus } from "../services/qiwaService.js";
import { companyPrintHeader, getCurrentCompanyProfile, payslipCompanyFromProfile } from "../utils/companyProfile.js";
import { renderPayslipPdf } from "../utils/payslipRenderer.js";
import { getPreviewCompanyProfile, updatePreviewCompanyProfile } from "../utils/previewCompanyProfile.js";
import { defaultNumberSeries } from "../utils/numberSeries.js";
import { rowsFromUpload, xlsxFile, xlsxTemplate, type UploadRow } from "../utils/uploadParsers.js";

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

const previewImportedEmployeesPath = path.join(process.cwd(), ".preview", "imported-employees.json");
const previewEmployeeStatusPath = path.join(process.cwd(), ".preview", "employee-status-overrides.json");

function readPreviewImportedEmployees() {
  try {
    if (!fs.existsSync(previewImportedEmployeesPath)) return [];
    const parsed = JSON.parse(fs.readFileSync(previewImportedEmployeesPath, "utf8"));
    if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>;
    if (parsed && typeof parsed === "object") return [parsed as Record<string, unknown>];
    return [];
  } catch {
    return [];
  }
}

function writePreviewImportedEmployees(records: Array<Record<string, unknown>>) {
  fs.mkdirSync(path.dirname(previewImportedEmployeesPath), { recursive: true });
  fs.writeFileSync(previewImportedEmployeesPath, JSON.stringify(records, null, 2), "utf8");
}

const previewImportedEmployees: Array<Record<string, unknown>> = readPreviewImportedEmployees();
const previewPrimaryEmployeeCode = "10075";

function readPreviewEmployeeStatusOverrides() {
  try {
    if (!fs.existsSync(previewEmployeeStatusPath)) return {};
    const parsed = JSON.parse(fs.readFileSync(previewEmployeeStatusPath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed as Record<string, { role?: string; portalStatus?: string }> : {};
  } catch {
    return {};
  }
}

function writePreviewEmployeeStatusOverrides(records: Record<string, { role?: string; portalStatus?: string }>) {
  fs.mkdirSync(path.dirname(previewEmployeeStatusPath), { recursive: true });
  fs.writeFileSync(previewEmployeeStatusPath, JSON.stringify(records, null, 2), "utf8");
}

const previewEmployeeStatusOverrides = readPreviewEmployeeStatusOverrides();

function withPreviewUserStatus<T extends Record<string, unknown>>(record: T) {
  const id = String(record.id ?? "");
  const code = String(record.employeeCode ?? "");
  const latestOverrides = readPreviewEmployeeStatusOverrides();
  const override = latestOverrides[id] ?? latestOverrides[code] ?? previewEmployeeStatusOverrides[id] ?? previewEmployeeStatusOverrides[code];
  if (!override) return record;
  const user = (record.user as Record<string, unknown> | undefined) ?? {};
  return {
    ...record,
    user: {
      ...user,
      role: override.role ?? user.role ?? "EMPLOYEE",
      portalStatus: override.portalStatus ?? user.portalStatus ?? "ACTIVE"
    }
  };
}

function previewEmployeeRecords() {
  const visibleImported = previewImportedEmployees.filter((record) => {
    const code = String(record.employeeCode ?? "");
    return (code === previewPrimaryEmployeeCode || String(record.previewCreated ?? "") === "true") && !record.archivedAt && String(record.status ?? "ACTIVE") !== "ARCHIVED";
  });
  return visibleImported.length ? visibleImported as Array<Record<string, unknown>> : [selfServiceEmployee] as Array<Record<string, unknown>>;
}

function previewArchivedEmployeeRecords() {
  return previewImportedEmployees.filter((record) => record.archivedAt || String(record.status ?? "") === "ARCHIVED");
}

function previewPrimaryEmployee() {
  return previewEmployeeRecords()[0] ?? selfServiceEmployee;
}

const previewDepartments = [
  { id: "preview-dept-1", code: "HR", name: "Human Resources", _count: { employees: 1 } },
  { id: "preview-dept-2", code: "FIN", name: "Finance", _count: { employees: 0 } },
  { id: "preview-dept-3", code: "OPS", name: "Operations", _count: { employees: 0 } },
  { id: "preview-dept-4", code: "PPS", name: "Power Protection - Pre Sales", _count: { employees: 0 } },
  { id: "preview-dept-5", code: "PAS", name: "Power Protection - After Sales", _count: { employees: 0 } },
  { id: "preview-dept-6", code: "LC", name: "Low Current", _count: { employees: 0 } },
  { id: "preview-dept-7", code: "SAL", name: "Sales", _count: { employees: 0 } },
  { id: "preview-dept-8", code: "IT", name: "IT", _count: { employees: 0 } },
  { id: "preview-dept-9", code: "ADM", name: "Administrative", _count: { employees: 0 } }
];

function previewDepartmentForId(departmentId: unknown, previousDepartment?: Record<string, unknown>) {
  const id = String(departmentId ?? "").trim();
  const knownDepartment = previewDepartments.find((department) => department.id === id || department.code === id || department.name === id);
  if (knownDepartment) return knownDepartment;
  if (previousDepartment && String(previousDepartment.id ?? "") === id) {
    return {
      id,
      name: String(previousDepartment.name ?? "Preview Department"),
      code: String(previousDepartment.code ?? id)
    };
  }
  const name = id.replace(/^preview-dept-/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Preview Department";
  return { id, name, code: String(previousDepartment?.code ?? (id || "DEPT")) };
}

function previewDepartmentFrom(record: Record<string, unknown>) {
  const value = record.department;
  if (value && typeof value === "object") {
    const department = value as Record<string, unknown>;
    return {
      id: String(department.id ?? "preview-dept"),
      name: String(department.name ?? "Operations"),
      code: String(department.code ?? "OPS")
    };
  }
  const name = String(value ?? record.departmentName ?? "Operations");
  return {
    id: `preview-dept-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "operations"}`,
    name,
    code: String(record.departmentCode ?? (name.slice(0, 6) || "OPS")).toUpperCase()
  };
}

function previewEmployeeName(record: Record<string, unknown>) {
  const explicit = String(record.employeeName ?? record.fullName ?? "").trim();
  if (explicit) return explicit;
  return `${String(record.firstName ?? "").trim()} ${String(record.lastName ?? "").trim()}`.trim() || "Employee User";
}

function normalizePreviewEmployee(record: Record<string, unknown>) {
  const current = withPreviewUserStatus(record);
  const name = previewEmployeeName(current);
  const [firstName, ...lastNameParts] = name.split(/\s+/);
  const department = previewDepartmentFrom(current);
  return {
    id: String(current.id ?? `preview-${String(current.employeeCode ?? "employee")}`),
    employeeCode: String(current.employeeCode ?? ""),
    nationalId: String(current.nationalId ?? current.iqamaNumber ?? current.employeeCode ?? ""),
    firstName: String(current.firstName ?? firstName ?? "Employee"),
    lastName: String(current.lastName ?? lastNameParts.join(" ") ?? "User"),
    fullName: name,
    email: String(current.email ?? current.companyEmail ?? ""),
    companyEmail: String(current.companyEmail ?? current.email ?? ""),
    phone: String(current.phone ?? current.mobileNumber ?? ""),
    emergencyContact: String(current.emergencyContact ?? ""),
    address: String(current.address ?? ""),
    jobTitle: String(current.jobTitle ?? current.designation ?? "Employee"),
    status: String(current.status ?? "ACTIVE"),
    leaveBalance: Number(current.leaveBalance ?? 21),
    branch: String(current.branch ?? ""),
    location: String(current.location ?? ""),
    nationality: String(current.nationality ?? ""),
    gender: String(current.gender ?? ""),
    joiningDate: String(current.joiningDate ?? "2026-01-01"),
    basicSalary: String(current.basicSalary ?? "8000.00"),
    housingAllowance: String(current.housingAllowance ?? "2000.00"),
    transportAllowance: String(current.transportAllowance ?? "800.00"),
    otherAllowance: String(current.otherAllowance ?? "0.00"),
    bankName: String(current.bankName ?? "Al Rajhi Bank"),
    iban: String(current.iban ?? ""),
    biometricId: String(current.biometricId ?? ""),
    deviceUserId: String(current.deviceUserId ?? current.employeeCode ?? ""),
    photoUrl: String(current.photoUrl ?? current.profilePhotoPath ?? ""),
    profilePhotoPath: String(current.profilePhotoPath ?? current.photoUrl ?? ""),
    profilePhotoFileName: current.profilePhotoFileName,
    profilePhotoMimeType: current.profilePhotoMimeType,
    profilePhotoSize: current.profilePhotoSize,
    profilePhotoUploadedBy: current.profilePhotoUploadedBy,
    profilePhotoUploadedAt: current.profilePhotoUploadedAt,
    profilePhotoStatus: String(current.profilePhotoStatus ?? "ACTIVE"),
    departmentId: String(current.departmentId ?? department.id),
    managerId: String(current.managerId ?? ""),
    departmentHeadId: String(current.departmentHeadId ?? ""),
    omId: String(current.omId ?? ""),
    hrManagerId: String(current.hrManagerId ?? ""),
    alternateManagerId: String(current.alternateManagerId ?? ""),
    department,
    user: current.user,
    documents: current.documents ?? []
  };
}

function previewEmployeeForUser(user?: { employeeId?: string | null; email?: string }) {
  const employeeId = String(user?.employeeId ?? "");
  const email = String(user?.email ?? "");
  const fallbackCode = employeeId.replace(/^preview-/, "");
  const match = previewEmployeeRecords().find((record) => {
    const id = String(record.id ?? "");
    const code = String(record.employeeCode ?? "");
    const recordEmail = String(record.email ?? record.companyEmail ?? "");
    return id === employeeId || code === employeeId || code === fallbackCode || recordEmail === email;
  });
  return normalizePreviewEmployee(match ?? previewPrimaryEmployee());
}

function previewPayrollNumbersForEmployee(record: ReturnType<typeof normalizePreviewEmployee>) {
  const basicSalary = Number(record.basicSalary || 8000);
  const housingAllowance = Number(record.housingAllowance || 0);
  const transportAllowance = Number(record.transportAllowance || 0);
  const otherAllowance = Number(record.otherAllowance || 0);
  const overtime = 0;
  const absenceDeduction = 0;
  const loanDeduction = 0;
  const gosiDeduction = 0;
  const netSalary = Number((basicSalary + housingAllowance + transportAllowance + otherAllowance + overtime - absenceDeduction - loanDeduction).toFixed(2));
  return { basicSalary, housingAllowance, transportAllowance, otherAllowance, overtime, absenceDeduction, loanDeduction, gosiDeduction, netSalary };
}

function previewPayrollItemForEmployee(record: ReturnType<typeof normalizePreviewEmployee>) {
  const salary = previewPayrollNumbersForEmployee(record);
  return {
    id: `preview-payroll-item-${record.employeeCode}-2026-06`,
    employeeId: record.id,
    employeeCode: record.employeeCode,
    employeeName: record.fullName,
    basicSalary: salary.basicSalary.toFixed(2),
    housingAllowance: salary.housingAllowance.toFixed(2),
    transportAllowance: salary.transportAllowance.toFixed(2),
    otherAllowance: salary.otherAllowance.toFixed(2),
    overtime: salary.overtime.toFixed(2),
    absenceDeduction: salary.absenceDeduction.toFixed(2),
    loanDeduction: salary.loanDeduction.toFixed(2),
    gosiDeduction: salary.gosiDeduction.toFixed(2),
    netSalary: salary.netSalary.toFixed(2),
    employee: record
  };
}

function previewSamplePayrollRun(status = "APPROVED") {
  const items = previewEmployeeRecords()
    .map((record) => normalizePreviewEmployee(record))
    .filter((record) => record.employeeCode && record.status !== "ARCHIVED" && record.status !== "TERMINATED")
    .map(previewPayrollItemForEmployee);
  return {
    id: "preview-payroll-2026-06-all-employees",
    month: 6,
    year: 2026,
    status,
    approvedAt: "2026-06-30T00:00:00.000Z",
    items
  };
}

function updatePreviewEmployeePhoto(id: string, data: Record<string, unknown>) {
  const importedIndex = previewImportedEmployees.findIndex((record) => record.id === id || record.employeeCode === id);
  if (importedIndex >= 0) {
    previewImportedEmployees[importedIndex] = { ...previewImportedEmployees[importedIndex], ...data };
    writePreviewImportedEmployees(previewImportedEmployees);
    return previewImportedEmployees[importedIndex];
  }
  return { ...previewEmployeeById(id), ...data };
}

previewRouter.use(requireAuth);

const previewAttachments: Array<Record<string, unknown>> = [];
previewRouter.post("/attachments", (req, res) => {
  const attachment = {
    id: `preview-attachment-${Date.now()}`,
    relatedModule: "Preview",
    relatedRecordId: "",
    relatedRecordNumber: "",
    originalFileName: "preview-upload.pdf",
    storedFileName: "preview-upload.pdf",
    filePath: "preview",
    fileUrl: `/api/backend/attachments/preview-attachment/download`,
    mimeType: "application/pdf",
    sizeBytes: 1024,
    uploadedBy: req.user?.id,
    status: "ACTIVE",
    confidential: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    message: "File uploaded successfully."
  };
  previewAttachments.unshift(attachment);
  res.status(201).json(attachment);
});
previewRouter.get("/attachments", (_req, res) => res.json(previewAttachments));
previewRouter.get("/attachments/:id/preview", (_req, res) => {
  res.header("Content-Type", "application/pdf");
  res.send(Buffer.from("%PDF-1.1\n% Preview attachment\n"));
});
previewRouter.get("/attachments/:id/download", (req, res) => {
  res.header("Content-Type", "application/pdf");
  res.attachment(`${req.params.id}.pdf`);
  res.send(Buffer.from("%PDF-1.1\n% Preview attachment\n"));
});
previewRouter.delete("/attachments/:id", (req, res) => {
  const index = previewAttachments.findIndex((attachment) => attachment.id === req.params.id);
  if (index >= 0) previewAttachments.splice(index, 1);
  res.json({ id: req.params.id, status: "DELETED" });
});

function previewDocumentTitle(module: string) {
  const titles: Record<string, string> = {
    employees: "Employee Profile",
    leaves: "Annual Vacation Leave Form",
    "ticket-requests": "Ticket Request Form",
    "business-trips": "Business Trip Request Form",
    loans: "Loan Agreement",
    "petty-cash": "Petty Cash Request Form",
    resignations: "Resignation Acknowledgement Letter",
    appraisals: "Performance Appraisal",
    departments: "Department Master Details"
  };
  return titles[module] ?? "HRMS Document";
}

function previewDocumentHtml(module: string, id: string, userEmail?: string) {
  const title = previewDocumentTitle(module);
  const company = getPreviewCompanyProfile();
  const number = `${module.toUpperCase()}-${id}`;
  const fields = [
    ["Document No.", number],
    ["Employee", `${selfServiceEmployee.employeeCode} - ${selfServiceEmployee.firstName} ${selfServiceEmployee.lastName}`],
    ["Department", selfServiceEmployee.department.name],
    ["Designation", selfServiceEmployee.jobTitle],
    ["Status", "PREVIEW"],
    ["Printed By", userEmail ?? "-"],
    ["Print Date", new Date().toLocaleString()]
  ];
  const rows = fields.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join("");
  const logo = company.logoDataUrl ? `<img src="${company.logoDataUrl}" alt="Company logo" />` : "";
  const header = `<div class="head"><div class="brand-line">${logo}<div><h1>${company.companyName ?? "Company"}</h1><div>${company.address ?? ""} ${company.city ?? ""} ${company.country ?? ""}</div><div>${company.email ?? ""} ${company.phone ?? ""}</div></div></div><h2>${title}</h2></div>`;
  return `<!doctype html><html><head><title>${title}</title><style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;font-size:12px;margin:24px;color:#111}.head{border-bottom:2px solid #0f766e;margin-bottom:16px;padding-bottom:10px}.brand-line{display:flex;gap:14px;align-items:center}.brand-line img{max-width:110px;max-height:60px}h1{font-size:18px;margin:0 0 4px}h2{font-size:14px}.screen-actions{display:flex;gap:8px;margin:12px 0}.screen-actions a,.screen-actions button{border:1px solid #aaa;background:#f8fafc;padding:6px 10px;text-decoration:none;color:#111;border-radius:4px}table{width:100%;border-collapse:collapse}td{border:1px solid #d1d5db;padding:6px}.signature{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:32px}.sig{border-top:1px solid #111;padding-top:6px;text-align:center}@media print{.screen-actions{display:none}}</style></head><body>${header}<div class="screen-actions"><button onclick="window.print()">Print</button><a href="./pdf">Download PDF</a><a href="./email">Email Document</a><a href="./history">Reprint History</a></div><table><tbody>${rows}</tbody></table><h2>Approval Timeline</h2><p>Preview approval timeline and signature chain.</p><div class="signature"><div class="sig">Employee Signature</div><div class="sig">Manager Signature</div><div class="sig">HR / Finance Signature</div><div class="sig">Authorized Signatory / Stamp</div></div></body></html>`;
}

previewRouter.get("/print-documents/:module/:id/preview", (req, res) => {
  res.header("Content-Type", "text/html");
  res.send(previewDocumentHtml(String(req.params.module), String(req.params.id), req.user?.email));
});

previewRouter.get("/print-documents/:module/:id/pdf", (req, res) => {
  res.header("Content-Type", "application/pdf");
  res.attachment(`${req.params.module}-${req.params.id}.pdf`);
  res.send(Buffer.from(`%PDF-1.1\n% ${previewDocumentTitle(String(req.params.module))}\n`));
});

previewRouter.get("/print-documents/:module/:id/email", (req, res) => {
  res.json({ ok: true, message: "Document email queued.", module: req.params.module, id: req.params.id });
});

previewRouter.get("/print-documents/:module/:id/history", (req, res) => {
  res.json([
    {
      id: `preview-print-${req.params.id}`,
      action: "PRINT_PREVIEW",
      entity: "PrintDocument",
      entityId: req.params.id,
      createdAt: new Date().toISOString(),
      userEmail: req.user?.email
    }
  ]);
});

function blockEmployeePreviewExport(req: { user?: { role?: string } }, res: { status: (status: number) => { json: (body: unknown) => void } }) {
  if (req.user?.role === "EMPLOYEE") {
    res.status(403).json({ message: "You do not have permission to export confidential data." });
    return true;
  }
  return false;
}

previewRouter.get("/employees", (_req, res) => {
  const items = previewEmployeeRecords().map((record) => withPreviewUserStatus(record));
  res.json({ items, total: items.length, page: 1, pageSize: 25 });
});
previewRouter.get("/employees/archived", (_req, res) => {
  const items = previewArchivedEmployeeRecords().map((record) => withPreviewUserStatus(record));
  res.json({ items, total: items.length, page: 1, pageSize: 25 });
});
function previewEmployeeById(id: string) {
  const records = [...previewEmployeeRecords(), ...previewArchivedEmployeeRecords()];
  return withPreviewUserStatus(records.find((record) => record.id === id || record.employeeCode === id) ?? previewPrimaryEmployee());
}
previewRouter.get("/employees/export.csv", (req, res) => {
  if (blockEmployeePreviewExport(req, res)) return;
  res.header("Content-Type", "text/csv");
  res.attachment("employee-master.csv");
  const rows = previewEmployeeRecords().map((record) => {
    const item = normalizePreviewEmployee(record);
    return [item.employeeCode, item.fullName, item.email, item.nationalId, item.department.name, item.jobTitle, item.status, String(item.joiningDate).slice(0, 10)];
  });
  res.send(["employeeCode,fullName,email,nationalId,department,jobTitle,status,joiningDate", ...rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`).join(","))].join("\n"));
});
previewRouter.get("/employees/export.xlsx", async (req, res) => {
  if (blockEmployeePreviewExport(req, res)) return;
  const rows = previewEmployeeRecords().map((record) => {
    const item = normalizePreviewEmployee(record);
    return [item.employeeCode, item.fullName, item.email, item.nationalId, item.department.name, item.jobTitle, item.status, String(item.joiningDate).slice(0, 10)];
  });
  await xlsxFile(res, "employee-master.xlsx", ["employeeCode", "fullName", "email", "nationalId", "department", "jobTitle", "status", "joiningDate"], rows, "Employees");
});
previewRouter.get("/employees/archived/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.attachment("archived-employees.csv");
  const rows = previewArchivedEmployeeRecords().map((record) => {
    const item = normalizePreviewEmployee(record);
    return [item.employeeCode, item.fullName, item.email, item.department.name, item.jobTitle, item.status, String(record.archivedAt ?? "")];
  });
  res.send(["employeeCode,fullName,email,department,jobTitle,status,archivedAt", ...rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`).join(","))].join("\n"));
});
previewRouter.get("/employees/archived/print", (_req, res) => {
  const rows = previewArchivedEmployeeRecords().map((record) => {
    const item = normalizePreviewEmployee(record);
    return `<tr><td>${item.employeeCode}</td><td>${item.fullName}</td><td>${item.email}</td><td>${item.department.name}</td><td>${item.jobTitle}</td><td>${item.status}</td><td>${String(record.archivedAt ?? "").slice(0, 10)}</td></tr>`;
  }).join("");
  res.header("Content-Type", "text/html");
  res.send(`<!doctype html><html><head><title>Archived Employees</title><style>body{font-family:Arial;margin:24px;color:#172033}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #dfe4ec;padding:7px;text-align:left}th{background:#f3f5f8}</style></head><body><h1>Archived Employees</h1><table><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Department</th><th>Job Title</th><th>Status</th><th>Archived</th></tr></thead><tbody>${rows}</tbody></table><script>window.print()</script></body></html>`);
});
previewRouter.post("/employees/portal-users/provision-missing", (req, res) => {
  const records = previewEmployeeRecords();
  let createdCount = 0;
  for (const record of records) {
    const id = String(record.id ?? "");
    const code = String(record.employeeCode ?? "");
    const existingUser = record.user as Record<string, unknown> | undefined;
    if (existingUser?.role || previewEmployeeStatusOverrides[id]?.role || previewEmployeeStatusOverrides[code]?.role) continue;
    previewEmployeeStatusOverrides[id] = { role: "EMPLOYEE", portalStatus: String(req.body.portalStatus ?? "PENDING_FIRST_LOGIN") };
    if (code) previewEmployeeStatusOverrides[code] = previewEmployeeStatusOverrides[id];
    createdCount += 1;
  }
  writePreviewEmployeeStatusOverrides(previewEmployeeStatusOverrides);
  res.json({ message: `Created ${createdCount} portal account(s).`, createdCount, skippedCount: records.length - createdCount });
});
previewRouter.post("/employees", (req, res) => {
  if (!["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "HR_OFFICER", "HR"].includes(String(req.user?.role))) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  const requiredFields = ["employeeCode", "nationalId", "firstName", "lastName", "email", "jobTitle", "joiningDate", "departmentId", "basicSalary"];
  const missingFields = requiredFields.filter((field) => !String(req.body[field] ?? "").trim());
  if (missingFields.length) {
    return res.status(400).json({ message: `Missing required fields: ${missingFields.join(", ")}` });
  }
  const employeeCode = String(req.body.employeeCode).trim();
  const duplicate = previewImportedEmployees.some((record) => String(record.employeeCode ?? "").toLowerCase() === employeeCode.toLowerCase());
  if (duplicate) {
    return res.status(409).json({ message: `Employee code ${employeeCode} already exists.` });
  }
  const role = String(req.body.role ?? "EMPLOYEE");
  const department = previewDepartmentForId(req.body.departmentId);
  const employeeRecord = {
    id: `preview-imported-${employeeCode}`,
    status: "ACTIVE",
    leaveBalance: Number(req.body.leaveBalance ?? 21),
    departmentId: department.id,
    department,
    user: {
      id: `preview-user-${employeeCode}`,
      role,
      portalStatus: "PENDING_FIRST_LOGIN"
    },
    previewCreated: "true",
    createdAt: new Date().toISOString(),
    ...req.body,
    employeeCode
  };
  previewImportedEmployees.push(employeeRecord);
  writePreviewImportedEmployees(previewImportedEmployees);
  previewEmployeeStatusOverrides[employeeRecord.id] = { role, portalStatus: employeeRecord.user.portalStatus };
  previewEmployeeStatusOverrides[employeeCode] = previewEmployeeStatusOverrides[employeeRecord.id];
  writePreviewEmployeeStatusOverrides(previewEmployeeStatusOverrides);
  res.status(201).json(employeeRecord);
});
previewRouter.get("/employees/me", (req, res) => res.json(previewEmployeeForUser(req.user)));
previewRouter.get("/employees/:id", (req, res) => res.json(previewEmployeeById(String(req.params.id))));
previewRouter.patch("/employees/:id", (req, res) => {
  if (!["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "HR_OFFICER", "HR"].includes(String(req.user?.role))) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  const importedIndex = previewImportedEmployees.findIndex((record) => record.id === req.params.id || record.employeeCode === req.params.id);
  if (importedIndex < 0) {
    return res.status(404).json({ message: "Employee not found" });
  }
  const previous = previewImportedEmployees[importedIndex];
  const { changeReason: _changeReason, role, portalStatus, ...updates } = req.body;
  const previousDepartment = typeof previous.department === "object" && previous.department ? previous.department as Record<string, unknown> : undefined;
  const nextDepartment = Object.prototype.hasOwnProperty.call(updates, "departmentId")
    ? previewDepartmentForId(updates.departmentId, previousDepartment)
    : previous.department;
  const updated = {
    ...previous,
    ...updates,
    user: role || portalStatus ? {
      ...((previous.user as Record<string, unknown> | undefined) ?? {}),
      role: String(role ?? ((previous.user as Record<string, unknown> | undefined)?.role ?? "EMPLOYEE")),
      portalStatus: String(portalStatus ?? ((previous.user as Record<string, unknown> | undefined)?.portalStatus ?? "ACTIVE"))
    } : previous.user,
    id: previous.id ?? req.params.id,
    employeeCode: previous.employeeCode ?? updates.employeeCode,
    departmentId: Object.prototype.hasOwnProperty.call(updates, "departmentId") ? updates.departmentId : previous.departmentId,
    department: nextDepartment,
    updatedAt: new Date().toISOString()
  };
  previewImportedEmployees[importedIndex] = updated;
  writePreviewImportedEmployees(previewImportedEmployees);
  if (role || portalStatus) {
    const employeeId = String(updated.id ?? "");
    const employeeCode = String(updated.employeeCode ?? "");
    previewEmployeeStatusOverrides[employeeId] = {
      role: String(role ?? ((updated.user as Record<string, unknown> | undefined)?.role ?? "EMPLOYEE")),
      portalStatus: String(portalStatus ?? ((updated.user as Record<string, unknown> | undefined)?.portalStatus ?? "ACTIVE"))
    };
    if (employeeCode) previewEmployeeStatusOverrides[employeeCode] = previewEmployeeStatusOverrides[employeeId];
    writePreviewEmployeeStatusOverrides(previewEmployeeStatusOverrides);
  }
  res.json(normalizePreviewEmployee(updated));
});
previewRouter.patch("/employees/:id/restore", (req, res) => {
  if (!["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "HR_OFFICER", "HR"].includes(String(req.user?.role))) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  const importedIndex = previewImportedEmployees.findIndex((record) => record.id === req.params.id || record.employeeCode === req.params.id);
  if (importedIndex < 0) return res.status(404).json({ message: "Employee not found" });
  previewImportedEmployees[importedIndex] = {
    ...previewImportedEmployees[importedIndex],
    status: "ACTIVE",
    isActive: true,
    archivedAt: null,
    archivedBy: null,
    updatedAt: new Date().toISOString()
  };
  writePreviewImportedEmployees(previewImportedEmployees);
  res.json({ message: "Employee restored successfully.", employee: normalizePreviewEmployee(previewImportedEmployees[importedIndex]) });
});
previewRouter.delete("/employees/:id", (req, res) => {
  if (!["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "HR_OFFICER", "HR"].includes(String(req.user?.role))) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  const permanent = String(req.query.permanent ?? "false") === "true";
  if (permanent && req.user?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ message: "You do not have permission to delete this record." });
  }
  const archivedAt = new Date().toISOString();
  const importedIndex = previewImportedEmployees.findIndex((record) => record.id === req.params.id || record.employeeCode === req.params.id);
  if (importedIndex >= 0) {
    if (permanent && String(previewImportedEmployees[importedIndex].previewCreated ?? "") === "true") {
      const [removed] = previewImportedEmployees.splice(importedIndex, 1);
      writePreviewImportedEmployees(previewImportedEmployees);
      return res.json({ message: "Employee permanently deleted.", deleted: true, employeeId: removed.id });
    }
    previewImportedEmployees[importedIndex] = { ...previewImportedEmployees[importedIndex], status: "ARCHIVED", isActive: false, archivedAt, archivedBy: req.user?.id };
    writePreviewImportedEmployees(previewImportedEmployees);
    return res.json({ message: "Employee archived successfully.", archived: true, employee: normalizePreviewEmployee(previewImportedEmployees[importedIndex]) });
  }
  res.status(409).json({
    message: "Employee cannot be deleted because related records exist. Employee has been archived instead.",
    archived: true,
    employee: { ...previewEmployeeById(String(req.params.id)), id: req.params.id, status: "ARCHIVED", archivedAt }
  });
});
previewRouter.patch("/employees/:id/user-role", (req, res) => {
  const role = String(req.body.role ?? "EMPLOYEE");
  const portalStatus = String(req.body.portalStatus ?? "ACTIVE");
  const importedIndex = previewImportedEmployees.findIndex((record) => record.id === req.params.id || record.employeeCode === req.params.id);
  if (importedIndex >= 0) {
    const previous = previewImportedEmployees[importedIndex];
    previewImportedEmployees[importedIndex] = {
      ...previous,
      user: {
        ...((previous.user as Record<string, unknown> | undefined) ?? {}),
        role,
        portalStatus
      }
    };
    writePreviewImportedEmployees(previewImportedEmployees);
    return res.json(previewImportedEmployees[importedIndex]);
  }
  previewEmployeeStatusOverrides[String(req.params.id)] = { role, portalStatus };
  const employeeRecord = previewEmployeeById(String(req.params.id));
  if (employeeRecord.employeeCode) previewEmployeeStatusOverrides[String(employeeRecord.employeeCode)] = { role, portalStatus };
  writePreviewEmployeeStatusOverrides(previewEmployeeStatusOverrides);
  const existingUser = (employeeRecord as Record<string, unknown>).user as Record<string, unknown> | undefined;
  res.json({ ...employeeRecord, id: req.params.id, user: { ...(existingUser ?? {}), role, portalStatus } });
});
previewRouter.post("/employees/:id/documents", (req, res) => res.status(201).json({ id: `preview-doc-${Date.now()}`, employeeId: req.params.id, documentType: req.body.documentType, fileName: req.body.fileName, fileUrl: req.body.fileDataUrl, expiryDate: req.body.expiryDate, notes: req.body.notes, createdAt: new Date().toISOString() }));
previewRouter.get("/employees/:id/documents/:documentId/download", (_req, res) => res.status(404).json({ message: "Employee document not found" }));
previewRouter.put("/employees/:id/profile-photo", (req, res) => {
  const photo = {
    photoUrl: req.body.dataUrl,
    profilePhotoPath: req.body.dataUrl,
    profilePhotoFileName: req.body.fileName,
    profilePhotoMimeType: req.body.mimeType,
    profilePhotoSize: req.body.size,
    profilePhotoUploadedBy: req.user?.id,
    profilePhotoUploadedAt: new Date().toISOString(),
    profilePhotoStatus: req.body.status ?? "ACTIVE"
  };
  res.json(updatePreviewEmployeePhoto(String(req.params.id), photo));
});
previewRouter.delete("/employees/:id/profile-photo", (req, res) => {
  res.json(updatePreviewEmployeePhoto(String(req.params.id), { photoUrl: "", profilePhotoPath: "", profilePhotoFileName: null, profilePhotoMimeType: null, profilePhotoSize: null, profilePhotoUploadedBy: null, profilePhotoUploadedAt: null, profilePhotoStatus: "ACTIVE" }));
});

previewRouter.get("/employee/me", (req, res) => res.json(previewEmployeeForUser(req.user)));
previewRouter.put("/employee/me/profile-photo", (req, res) => {
  const currentEmployee = previewEmployeeForUser(req.user);
  const photo = {
    photoUrl: req.body.dataUrl,
    profilePhotoPath: req.body.dataUrl,
    profilePhotoFileName: req.body.fileName,
    profilePhotoMimeType: req.body.mimeType,
    profilePhotoSize: req.body.size,
    profilePhotoUploadedBy: req.user?.id,
    profilePhotoUploadedAt: new Date().toISOString(),
    profilePhotoStatus: "ACTIVE"
  };
  res.json(updatePreviewEmployeePhoto(currentEmployee.id, photo));
});
previewRouter.delete("/employee/me/profile-photo", (req, res) => {
  const currentEmployee = previewEmployeeForUser(req.user);
  res.json(updatePreviewEmployeePhoto(currentEmployee.id, { photoUrl: "", profilePhotoPath: "", profilePhotoFileName: null, profilePhotoMimeType: null, profilePhotoSize: null, profilePhotoUploadedBy: null, profilePhotoUploadedAt: null, profilePhotoStatus: "ACTIVE" }));
});
previewRouter.get("/employee/me/dashboard", (req, res) => {
  const currentEmployee = previewEmployeeForUser(req.user);
  const leaves = previewLeaveRequestsForEmployee(currentEmployee.id);
  const attendance = previewAttendanceForEmployee(currentEmployee.id);
  const vacationBalances = previewVacationBalancesForEmployee(currentEmployee.id);
  res.json({
  employee: { ...currentEmployee, manager: managerEmployee, documents: currentEmployee.documents ?? [] },
  pendingLeaves: leaves.filter((leave) => String(leave.status ?? "") === "PENDING").length,
  pendingLoans: 0,
  pendingBusinessTrips: 0,
  pendingPettyCash: 0,
  pendingResignation: null,
  latestPayslip: null,
  recentPayslips: [],
  documentExpiryAlerts: currentEmployee.documents ?? [],
  attendanceSummary: attendance.length ? [{ status: "PRESENT", _count: { status: attendance.length } }] : [],
  vacationBalances,
  notifications: []
});
});
previewRouter.patch("/employee/me/contact", (req, res) => res.json({ ...previewEmployeeForUser(req.user), ...req.body }));
const previewEmployeeLeaves = new Map<string, Array<Record<string, unknown>>>();
const previewEmployeeAttendance = new Map<string, Array<Record<string, unknown>>>();
const previewEmployeeVacationBalances = new Map<string, Array<Record<string, unknown>>>();
const previewEmployeePayslips = new Map<string, Array<Record<string, unknown>>>();
const previewEmployeeModuleRecords = new Map<string, Array<Record<string, unknown>>>();
function previewLeaveRequestsForEmployee(employeeId: string) {
  return previewEmployeeLeaves.get(employeeId) ?? [];
}
function previewAttendanceForEmployee(employeeId: string) {
  return previewEmployeeAttendance.get(employeeId) ?? [];
}
function previewVacationBalancesForEmployee(employeeId: string) {
  return previewEmployeeVacationBalances.get(employeeId) ?? [];
}
function previewPayslipsForEmployee(employeeId: string) {
  return previewEmployeePayslips.get(employeeId) ?? [];
}
function previewModuleKey(module: string, employeeId: string) {
  return `${module}:${employeeId}`;
}
function previewModuleRecordsForEmployee(module: string, employeeId: string) {
  return previewEmployeeModuleRecords.get(previewModuleKey(module, employeeId)) ?? [];
}
function previewStoreEmployeeModuleRecord(module: string, employeeId: string, record: Record<string, unknown>) {
  const key = previewModuleKey(module, employeeId);
  previewEmployeeModuleRecords.set(key, [record, ...(previewEmployeeModuleRecords.get(key) ?? [])]);
}
function previewScopedModuleList(req: { user?: { role?: string; employeeId?: string | null; email?: string } }, module: string, adminRecords: Array<Record<string, unknown>>) {
  if (req.user?.role === "EMPLOYEE") {
    const currentEmployee = previewEmployeeForUser(req.user);
    return previewModuleRecordsForEmployee(module, currentEmployee.id);
  }
  if (["DEPARTMENT_MANAGER", "OPERATIONS_MANAGER"].includes(String(req.user?.role ?? ""))) return [];
  return adminRecords;
}
previewRouter.get("/employee/me/attendance", (req, res) => {
  const currentEmployee = previewEmployeeForUser(req.user);
  res.json(previewAttendanceForEmployee(currentEmployee.id));
});
previewRouter.get("/employee/me/leaves", (req, res) => {
  const currentEmployee = previewEmployeeForUser(req.user);
  res.json(previewLeaveRequestsForEmployee(currentEmployee.id));
});
previewRouter.post("/employee/me/leaves", (req, res) => {
  const currentEmployee = previewEmployeeForUser(req.user);
  const created = {
    id: `preview-employee-leave-${currentEmployee.employeeCode}-${Date.now()}`,
    requestNumber: `LR-${currentEmployee.employeeCode}-${Date.now()}`,
    employeeId: currentEmployee.id,
    employeeCode: currentEmployee.employeeCode,
    employeeName: currentEmployee.fullName,
    status: "PENDING",
    workflowStage: "PENDING_MANAGER_APPROVAL",
    days: 1,
    availableBalanceAtRequest: 0,
    manager: managerEmployee,
    approvalHistory: [{ id: `hist-${Date.now()}`, status: "PENDING", comments: "Submitted by employee", actedBy: req.user?.id, createdAt: new Date().toISOString() }],
    ...req.body
  };
  const employeeLeaves = previewLeaveRequestsForEmployee(currentEmployee.id);
  previewEmployeeLeaves.set(currentEmployee.id, [created, ...employeeLeaves]);
  res.status(201).json(created);
});
previewRouter.get("/employee/me/relievers", (_req, res) => res.json([
  { ...managerEmployee, jobTitle: "Operations Manager", branch: "Riyadh", location: "Operations", department: managerEmployee.department, manager: omEmployee },
  { ...omEmployee, jobTitle: "Operations Manager", branch: "Riyadh", location: "Head Office", department: omEmployee.department, manager: null }
]));
previewRouter.patch("/employee/me/leaves/:id/cancel", (req, res) => res.json({
  id: req.params.id,
  status: "CANCELLED",
  workflowStage: "CANCELLED",
  comments: req.body.comments ?? "Cancelled in preview"
}));
previewRouter.patch("/leaves/:id/cancel", (req, res) => res.json({
  id: req.params.id,
  status: "CANCELLED",
  workflowStage: "CANCELLED",
  comments: req.body.comments ?? "Cancelled in preview"
}));
previewRouter.patch("/leaves/:id", (req, res) => res.json({
  id: req.params.id,
  requestNumber: "LR-PREVIEW-001",
  employeeId: selfServiceEmployee.id,
  ...req.body,
  updatedAt: new Date().toISOString()
}));
previewRouter.get("/employee/me/leave-balance", (req, res) => {
  const currentEmployee = previewEmployeeForUser(req.user);
  const balances = previewVacationBalancesForEmployee(currentEmployee.id);
  const leaveBalance = balances.reduce((total, balance) => total + Number(balance.finalAvailableBalance ?? 0), 0);
  res.json({ leaveBalance, balances });
});
previewRouter.get("/employee/me/vacation-balance", (req, res) => {
  const currentEmployee = previewEmployeeForUser(req.user);
  res.json(previewVacationBalancesForEmployee(currentEmployee.id));
});
previewRouter.get("/employee/me/approval-history", (req, res) => {
  const currentEmployee = previewEmployeeForUser(req.user);
  const history = previewLeaveRequestsForEmployee(currentEmployee.id).flatMap((leave) => Array.isArray(leave.approvalHistory) ? leave.approvalHistory.map((entry) => ({ ...entry as Record<string, unknown>, leaveRequest: { requestNumber: leave.requestNumber, type: leave.type } })) : []);
  res.json(history);
});
previewRouter.get("/employee/me/notifications", (_req, res) => res.json([]));
previewRouter.get("/employee/me/payslips", (req, res) => {
  const currentEmployee = previewEmployeeForUser(req.user);
  res.json(previewPayslipsForEmployee(currentEmployee.id));
});
previewRouter.get("/employee/me/payslips/:id/download", async (req, res) => {
  const currentEmployee = previewEmployeeForUser(req.user);
  const payslip = previewPayslipsForEmployee(currentEmployee.id).find((item) => String(item.id) === String(req.params.id));
  if (!payslip) return res.status(404).json({ message: "Payslip not found" });
  const company = payslipCompanyFromProfile(await getCurrentCompanyProfile());
  const salary = previewPayrollNumbersForEmployee(currentEmployee);
  renderPayslipPdf(res, {
    company,
    employee: { name: currentEmployee.fullName, code: currentEmployee.employeeCode, department: currentEmployee.department.name, designation: currentEmployee.jobTitle, nationalId: currentEmployee.nationalId, bankName: currentEmployee.bankName, iban: currentEmployee.iban, joiningDate: currentEmployee.joiningDate, status: currentEmployee.status },
    payroll: { month: 6, year: 2026, period: "June 2026", reference: `PAY-2026-06-${currentEmployee.employeeCode}-PREVIEW`, batchNumber: "preview-payroll-upload-1", paymentDate: "2026-06-30", paymentMethod: "Bank Transfer", printedBy: req.user?.email },
    attendance: { payrollDays: 30, presentDays: 30, absentDays: 0, weeklyOffDays: 0, publicHolidays: 0, normalOvertimeHours: 0, holidayOvertimeHours: 0 },
    earnings: [
      { name: "Basic Salary", value: salary.basicSalary },
      { name: "Housing Allowance", value: salary.housingAllowance },
      { name: "Transportation Allowance", value: salary.transportAllowance },
      { name: "Other Allowance", value: salary.otherAllowance }
    ],
    deductions: [],
    netSalary: salary.netSalary,
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

previewRouter.get("/departments", (_req, res) => res.json(previewDepartments));
previewRouter.get("/departments/template.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("code,name\n");
});
previewRouter.get("/departments/template.xlsx", async (_req, res) => {
  await xlsxTemplate(res, "department-template.xlsx", ["code", "name"], "Departments");
});
previewRouter.get("/departments/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("code,name,employeeCount\nHR,Human Resources,1\nOPS,Operations,2\nSAL,Sales,1");
});
previewRouter.get("/departments/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "departments-export.xlsx", ["code", "name", "employeeCount"], [["HR", "Human Resources", 1], ["OPS", "Operations", 2], ["SAL", "Sales", 1]], "Departments");
});
previewRouter.post("/departments/import", (_req, res) => res.status(201).json({ message: "Import completed successfully.", createdCount: 1, updatedCount: 0, failedCount: 0, errors: [] }));
function previewDepartmentReportingSetups() {
  const manager = normalizePreviewEmployee(managerEmployee);
  const om = normalizePreviewEmployee(omEmployee);
  const hr = normalizePreviewEmployee(managerEmployee);
  return previewDepartments.map((department) => ({
    id: `preview-reporting-${department.id}`,
    company: previewCompanyProfile.companyName,
    branch: "",
    departmentId: department.id,
    department,
    departmentHeadId: manager.id,
    reportingManagerId: manager.id,
    omId: om.id,
    hrManagerId: hr.id,
    backupManagerId: "",
    departmentHead: manager,
    reportingManager: manager,
    operationsManager: om,
    hrManager: hr,
    backupManager: null,
    effectiveStartDate: "2026-01-01T00:00:00.000Z",
    effectiveEndDate: null,
    status: "ACTIVE",
    defaultReportingManager: true,
    remarks: "Preview department reporting setup",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString()
  }));
}
previewRouter.get("/departments/reporting-setups", (_req, res) => res.json(previewDepartmentReportingSetups()));
previewRouter.get("/departments/reporting-tree", (_req, res) => {
  const setups = previewDepartmentReportingSetups();
  res.json(previewDepartments.map((department) => ({
    ...department,
    reportingSetups: setups.filter((setup) => setup.departmentId === department.id).slice(0, 1),
    employees: previewEmployeeRecords().map((record) => normalizePreviewEmployee(record)).filter((employee) => employee.departmentId === department.id)
  })));
});
previewRouter.get("/departments/:id/reporting-setup/active", (req, res) => {
  const setup = previewDepartmentReportingSetups().find((item) => item.departmentId === req.params.id || item.department.code === req.params.id);
  if (!setup) return res.status(404).json({ message: "No reporting setup found for this department." });
  res.json(setup);
});
previewRouter.post("/departments/reporting-setups", (req, res) => res.status(201).json({ ...req.body, id: `preview-reporting-${Date.now()}`, department: previewDepartmentForId(req.body.departmentId), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
previewRouter.patch("/departments/reporting-setups/:id", (req, res) => res.json({ ...req.body, id: req.params.id, department: previewDepartmentForId(req.body.departmentId), updatedAt: new Date().toISOString() }));
previewRouter.post("/departments/reporting-setups/bulk-assign", (_req, res) => res.json({ message: "Department reporting setup applied.", count: previewEmployeeRecords().length }));
previewRouter.post("/departments", (req, res) => res.status(201).json({ id: `preview-dept-${Date.now()}`, code: req.body.code, name: req.body.name, _count: { employees: 0 } }));
previewRouter.patch("/departments/:id", (req, res) => res.json({ id: req.params.id, code: req.body.code, name: req.body.name, _count: { employees: 0 } }));
previewRouter.delete("/departments/:id", (req, res) => res.json({ id: req.params.id, archivedAt: new Date().toISOString() }));

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
previewRouter.get("/attendance/template.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("employeeCode,checkIn,checkOut\n");
});
previewRouter.get("/attendance/template.xlsx", async (_req, res) => {
  await xlsxTemplate(res, "attendance-import-template.xlsx", ["employeeCode", "checkIn", "checkOut"], "Attendance");
});
previewRouter.get("/attendance/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Employee Code,Employee Name,Department,Date,Check In,Check Out,Late Minutes,Overtime Hours,Source,Status\nEMP-001,Admin User,Human Resources,2026-06-01,2026-06-01T05:07:00.000Z,2026-06-01T14:45:00.000Z,7,0.75,BIOMETRIC,PRESENT");
});
previewRouter.get("/attendance/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "attendance-export.xlsx", ["Employee Code", "Employee Name", "Department", "Date", "Check In", "Check Out", "Late Minutes", "Overtime Hours", "Source", "Status"], [["EMP-001", "Admin User", "Human Resources", "2026-06-01", "2026-06-01T05:07:00.000Z", "2026-06-01T14:45:00.000Z", 7, 0.75, "BIOMETRIC", "PRESENT"]], "Attendance");
});

previewRouter.post("/attendance/import", (_req, res) => res.json({
  imported: 1,
  results: [{ employeeCode: "EMP-001", status: "IMPORTED", id: "preview-attendance-1" }]
}));

previewRouter.post("/attendance/detect-absences", (_req, res) => res.json({ created: 0 }));

const makeBiometricDevice = (id: string, deviceCode: string, deviceName: string, branch: string, deviceLocation: string, ipAddress: string) => ({
  id,
  deviceName,
  deviceCode,
  brand: "ZKTeco",
  model: "K40",
  serialNumber: deviceCode,
  ipAddress,
  port: 4370,
  connectionType: "MANUAL_IMPORT",
  deviceLocation,
  branch,
  department: { id: "preview-dept-3", name: "Operations", code: "OPS" },
  timezone: "Asia/Riyadh",
  status: "ACTIVE",
  lastSyncAt: new Date().toISOString(),
  connectionStatus: "NOT_TESTED",
  syncIntervalMinutes: 15,
  mobileEnabled: true,
  siteLatitude: branch === "Riyadh" ? 24.7136 : branch === "Jeddah" ? 21.4858 : branch === "Dammam" ? 26.4207 : 24.4672,
  siteLongitude: branch === "Riyadh" ? 46.6753 : branch === "Jeddah" ? 39.1925 : branch === "Dammam" ? 50.0888 : 46.7112,
  siteRadiusMeters: 250,
  remarks: "Configure IP/port, ADMS, or BioTime settings before live sync.",
  _count: { logs: id === "preview-zkteco-ruh" ? 3 : 0, mappings: id === "preview-zkteco-ruh" ? 2 : 0 }
});
const biometricDevices = [
  makeBiometricDevice("preview-zkteco-ruh", "ZK-RUH-01", "Riyadh ZKTeco Device", "Riyadh", "Riyadh Office", "192.168.1.201"),
  makeBiometricDevice("preview-zkteco-jed", "ZK-JED-01", "Jeddah ZKTeco Device", "Jeddah", "Jeddah Office", "192.168.2.201"),
  makeBiometricDevice("preview-zkteco-dmm", "ZK-DMM-01", "Dammam ZKTeco Device", "Dammam", "Dammam Office", "192.168.3.201"),
  makeBiometricDevice("preview-zkteco-fac", "ZK-FAC-01", "Factory ZKTeco Device", "Factory", "Factory", "192.168.4.201")
];
const biometricDevice = biometricDevices[0];
const previewBiometricEmployee = normalizePreviewEmployee(previewPrimaryEmployee());
const biometricMappings = [
  { id: "preview-map-10075", biometricId: "BIO-10075", deviceUserId: "10075", cardNumber: "10075", syncStatus: "SYNCED", lastPunchAt: "2026-06-01T05:02:00.000Z", active: true, employee: { ...previewBiometricEmployee, department: previewBiometricEmployee.department }, device: biometricDevice }
];
const biometricRawLogs: Array<Record<string, any>> = [
  { id: "preview-raw-10075", deviceId: biometricDevice.id, device: biometricDevice, deviceName: biometricDevice.deviceName, deviceUserId: "10075", employee: { ...previewBiometricEmployee, department: previewBiometricEmployee.department }, employeeName: previewBiometricEmployee.fullName, punchDate: "2026-06-01T00:00:00.000Z", punchTime: "2026-06-01T05:02:00.000Z", punchType: "CHECK_IN", verificationType: "Fingerprint", workCode: "", deviceSerialNumber: biometricDevice.serialNumber, deviceIp: biometricDevice.ipAddress, syncAt: new Date().toISOString(), rawLogReference: "preview-raw-10075", processingStatus: "PROCESSED", rawPayload: { latitude: 24.7136, longitude: 46.6753, capturedLocationName: "Riyadh" } }
];
const biometricAttendanceRecords: Array<Record<string, any>> = [
  { id: "preview-att-record-10075", employee: { ...previewBiometricEmployee, department: previewBiometricEmployee.department }, workDate: "2026-06-01T00:00:00.000Z", shift: "Day Shift", firstIn: "2026-06-01T05:02:00.000Z", timeInLocationName: "Riyadh", lastOut: "2026-06-01T14:15:00.000Z", timeOutLocationName: "Riyadh", workingHours: "9.22", lateMinutes: 2, earlyOutMinutes: 0, overtimeHours: "0.25", attendanceStatus: "LATE", source: "BIOMETRIC", approvalStatus: "DRAFT" }
];
function previewDistanceMeters(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const earthRadius = 6371000;
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const previewKnownAttendanceLocations = [
  { name: "Riyadh", latitude: 24.7136, longitude: 46.6753 },
  { name: "Jeddah", latitude: 21.4858, longitude: 39.1925 },
  { name: "Makkah", latitude: 21.3891, longitude: 39.8579 }
];
function previewCapturedLocationName(latitude: unknown, longitude: unknown) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
  return previewKnownAttendanceLocations
    .map((location) => ({ name: location.name, distance: previewDistanceMeters({ latitude: lat, longitude: lon }, { latitude: location.latitude, longitude: location.longitude }) }))
    .sort((a, b) => a.distance - b.distance)[0]?.name ?? "";
}
previewRouter.get("/biometrics/devices", (_req, res) => res.json(biometricDevices));
previewRouter.post("/biometrics/devices", (req, res) => res.status(201).json({ id: `preview-device-${Date.now()}`, connectionStatus: "NOT_TESTED", lastSyncAt: null, _count: { logs: 0, mappings: 0 }, ...req.body }));
previewRouter.patch("/biometrics/devices/:id", (req, res) => res.json({ ...biometricDevice, id: req.params.id, ...req.body }));
previewRouter.delete("/biometrics/devices/:id", (req, res) => res.json({ ...biometricDevice, id: req.params.id, status: "INACTIVE" }));
previewRouter.post("/biometrics/devices/:id/test-connection", (req, res) => res.json({ ok: true, message: "Preview connection test completed. Configure a real device before production sync.", device: { ...biometricDevice, id: req.params.id } }));
previewRouter.post("/biometrics/devices/:id/sync", (req, res) => res.status(400).json({ id: "preview-sync-failed", deviceId: req.params.id, status: "FAILED", errorMessage: "Preview mode does not connect to a live biometric machine." }));
previewRouter.post("/biometrics/import", (_req, res) => res.status(201).json({ id: "preview-import-1", status: "COMPLETED", pulledCount: 2, processedCount: 1, unmatchedCount: 1, duplicateCount: 0 }));
previewRouter.get("/biometrics/mobile-config", (_req, res) => res.json({
  timezone: "Asia/Riyadh",
  sites: biometricDevices.filter((device) => device.mobileEnabled).map((device) => ({
    id: device.id,
    name: device.deviceName,
    branch: device.branch,
    location: device.deviceLocation,
    timezone: device.timezone,
    latitude: device.siteLatitude,
    longitude: device.siteLongitude,
    radiusMeters: device.siteRadiusMeters
  }))
}));
previewRouter.post("/biometrics/mobile-punch", (req, res) => {
  const device = biometricDevices.find((item) => item.mobileEnabled && item.siteLatitude && item.siteLongitude) ?? biometricDevice;
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return res.status(400).json({ message: "GPS location is required." });
  const distance = previewDistanceMeters({ latitude, longitude }, { latitude: Number(device.siteLatitude), longitude: Number(device.siteLongitude) });
  const allowed = Number(device.siteRadiusMeters ?? 150) + Number(req.body.accuracyMeters ?? 0);
  const outsideAllowedRadius = distance > allowed;
  const employeeIdentifier = String(req.body.employeeIdentifier ?? "");
  const previewEmployeeRecord = previewEmployeeRecords().find((item) => String(item.id) === String(req.user?.employeeId)) ??
    previewEmployeeRecords().find((item) => [
      item.employeeCode,
      item.email,
      item.companyEmail,
      item.biometricId,
      item.deviceUserId,
      item.nationalId
    ].filter(Boolean).map(String).includes(employeeIdentifier)) ??
    selfServiceEmployee;
  const previewEmployee = normalizePreviewEmployee(previewEmployeeRecord);
  const punchType = req.body.punchType === "CHECK_OUT" ? "CHECK_OUT" : "CHECK_IN";
  const punchTime = new Date(req.body.clientTime ?? Date.now()).toISOString();
  const log = {
    id: `preview-mobile-log-${Date.now()}`,
    deviceId: device.id,
    device,
    deviceName: device.deviceName,
    deviceUserId: previewEmployee.deviceUserId ?? previewEmployee.biometricId ?? previewEmployee.employeeCode,
    employee: { ...previewEmployee, department: previewEmployee.department },
    employeeName: `${previewEmployee.firstName} ${previewEmployee.lastName}`,
    punchDate: punchTime,
    punchTime,
    punchType,
    verificationType: req.body.verificationMethod ?? "EMPLOYEE_ID",
    workCode: "",
    deviceSerialNumber: device.serialNumber,
    deviceIp: device.ipAddress,
    syncAt: new Date().toISOString(),
    rawLogReference: `preview-mobile-${Date.now()}`,
    processingStatus: "PROCESSED",
    errorMessage: undefined,
    rawPayload: { latitude, longitude, accuracyMeters: req.body.accuracyMeters, distanceMeters: Math.round(distance), capturedLocationName: previewCapturedLocationName(latitude, longitude), allowedRadiusMeters: device.siteRadiusMeters, outsideAllowedRadius, timezone: req.body.timezone ?? "Asia/Riyadh" }
  };
  biometricRawLogs.unshift(log);
  const existing = biometricAttendanceRecords.find((record) => record.employee.employeeCode === previewEmployee.employeeCode && String(record.workDate).slice(0, 10) === punchTime.slice(0, 10));
  const record = existing ?? {
    id: `preview-mobile-attendance-${Date.now()}`,
    employee: { ...previewEmployee, department: previewEmployee.department },
    workDate: punchTime,
    shift: "Mobile Shift",
    firstIn: null,
    lastOut: null,
    workingHours: "0.00",
    lateMinutes: 0,
    earlyOutMinutes: 0,
    overtimeHours: "0.00",
    attendanceStatus: "INCOMPLETE_ATTENDANCE",
    source: "MOBILE",
    approvalStatus: "DRAFT"
  };
  if (punchType === "CHECK_IN" && !record.firstIn) record.firstIn = punchTime;
  if (punchType === "CHECK_IN") record.timeInLocationName = previewCapturedLocationName(latitude, longitude);
  if (punchType === "CHECK_OUT") record.lastOut = punchTime;
  if (punchType === "CHECK_OUT") record.timeOutLocationName = previewCapturedLocationName(latitude, longitude);
  if (!existing) biometricAttendanceRecords.unshift(record);
  res.status(201).json({ ok: true, message: `${punchType === "CHECK_IN" ? "Time in" : "Time out"} recorded.`, employeeCode: previewEmployee.employeeCode, employeeName: `${previewEmployee.firstName} ${previewEmployee.lastName}`, siteName: device.deviceName, punchTime, timezone: req.body.timezone ?? "Asia/Riyadh", distanceMeters: Math.round(distance), warning: outsideAllowedRadius ? `GPS is outside the allowed site radius. Nearest site is ${Math.round(distance)}m away.` : undefined, attendanceRecord: record });
});
previewRouter.get("/biometrics/mappings", (_req, res) => res.json(biometricMappings));
previewRouter.post("/biometrics/mappings", (req, res) => res.status(201).json({ id: `preview-map-${Date.now()}`, syncStatus: "PENDING", active: true, ...req.body }));
previewRouter.patch("/biometrics/mappings/:id", (req, res) => res.json({ ...biometricMappings[0], id: req.params.id, ...req.body }));
previewRouter.delete("/biometrics/mappings/:id", (req, res) => res.json({ id: req.params.id, active: false }));
previewRouter.get("/biometrics/raw-logs", (_req, res) => res.json(biometricRawLogs));
const previewRawLogHeaders = ["Device", "Device User ID", "Employee ID", "Employee Name", "Department", "Punch Date", "Punch Time", "Punch Type", "Verification Type", "GPS Latitude", "GPS Longitude", "GPS Accuracy Meters", "Site Distance Meters", "Work Code", "Serial", "IP", "Sync Time", "Raw Reference", "Processing Status", "Error"];
function previewLogGps(log: Record<string, any>) {
  const payload = typeof log.rawPayload === "object" && log.rawPayload ? log.rawPayload : {};
  return {
    latitude: payload.latitude ?? "",
    longitude: payload.longitude ?? "",
    accuracyMeters: payload.accuracyMeters ?? "",
    distanceMeters: payload.distanceMeters ?? ""
  };
}
function previewRawLogRows() {
  return biometricRawLogs.map((log) => {
    const gps = previewLogGps(log);
    return [log.deviceName, log.deviceUserId, log.employee?.employeeCode ?? "", log.employeeName ?? "", log.employee?.department?.name ?? "", String(log.punchDate).slice(0, 10), log.punchTime, log.punchType, log.verificationType ?? "", gps.latitude, gps.longitude, gps.accuracyMeters, gps.distanceMeters, log.workCode ?? "", log.deviceSerialNumber ?? "", log.deviceIp ?? "", log.syncAt, log.rawLogReference, log.processingStatus, log.errorMessage ?? ""];
  });
}
previewRouter.get("/biometrics/raw-logs/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  const lines = [previewRawLogHeaders, ...previewRawLogRows()].map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`).join(","));
  res.send(lines.join("\n"));
});
previewRouter.get("/biometrics/raw-logs/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "biometric-raw-logs.xlsx", previewRawLogHeaders, previewRawLogRows(), "Raw Logs");
});
previewRouter.get("/biometrics/attendance-records", (_req, res) => res.json(biometricAttendanceRecords));
const previewAttendanceHeaders = ["Employee ID", "Employee Name", "Department", "Date", "Shift", "First In", "Time In Location", "Last Out", "Time Out Location", "Working Hours", "Late Minutes", "Early Out Minutes", "Overtime Hours", "Status", "Source", "Approval"];
function previewAttendanceRows() {
  return biometricAttendanceRecords.map((record) => [record.employee?.employeeCode ?? "", `${record.employee?.firstName ?? ""} ${record.employee?.lastName ?? ""}`.trim(), record.employee?.department?.name ?? "", String(record.workDate).slice(0, 10), record.shift ?? "", record.firstIn ?? "", record.timeInLocationName ?? "", record.lastOut ?? "", record.timeOutLocationName ?? "", record.workingHours ?? "", record.lateMinutes ?? 0, record.earlyOutMinutes ?? 0, record.overtimeHours ?? "", record.attendanceStatus ?? "", record.source ?? "", record.approvalStatus ?? ""]);
}
previewRouter.get("/biometrics/attendance-records/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  const lines = [previewAttendanceHeaders, ...previewAttendanceRows()].map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`).join(","));
  res.send(lines.join("\n"));
});
previewRouter.get("/biometrics/attendance-records/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "biometric-attendance-records.xlsx", previewAttendanceHeaders, previewAttendanceRows(), "Attendance");
});
previewRouter.get("/biometrics/sync-history", (_req, res) => res.json([{ id: "preview-sync-1", device: biometricDevice, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), status: "COMPLETED", pulledCount: 2, processedCount: 1, unmatchedCount: 1, duplicateCount: 0, triggeredBy: "admin@company.sa" }]));
previewRouter.get("/biometrics/error-logs", (_req, res) => res.json([{ id: "preview-error-1", device: biometricDevice, action: "PROCESS_PUNCH", message: "No employee mapping found for EMP-999", createdAt: new Date().toISOString() }]));

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
    requestNumber: "LR-PREVIEW-001",
    returnToWorkDate: "2026-06-17T00:00:00.000Z",
    destinationCountry: "Saudi Arabia",
    destinationCity: "Jeddah",
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
  manager: managerEmployee,
  directReportsCount: managerTeam.length,
  directReports: managerTeam,
  pendingLeaves: [managerLeave],
  pendingApprovals: [{
    id: managerLeave.id,
    requestType: "Leave",
    requestNumber: managerLeave.requestNumber,
    employee: managerLeave.employee,
    department: managerLeave.employee.department,
    submittedDate: managerLeave.createdAt,
    currentStatus: managerLeave.workflowStage,
    agingDays: 0,
    actionUrl: "/manager/leave-approvals"
  }],
  employeesCurrentlyOnLeave: 0,
  employeesOnLeaveToday: 0,
  employeesPresentToday: 2,
  employeesScheduledForLeave: 1,
  pendingLoans: 0,
  pendingBusinessTrips: 0,
  pendingPettyCash: 0,
  pendingResignations: 0,
  pendingAttendanceAdjustments: 0,
  upcomingTeamLeaves: 1,
  teamDocumentExpiryAlerts: 0,
  teamAttendanceToday: managerTeamAttendance,
  recentApprovals: []
}));
previewRouter.get("/manager/team", (_req, res) => res.json(managerTeam));
previewRouter.get("/manager/leave-approvals", (_req, res) => res.json([managerLeave]));
previewRouter.get("/manager/approvals", (_req, res) => res.json(managerTeam.flatMap((employee) => employee.leaves)));
previewRouter.get("/manager/attendance", (_req, res) => res.json(managerTeamAttendance));
previewRouter.patch("/manager/leave-approvals/:id/decision", (req, res) => res.json({ ...managerLeave, id: req.params.id, workflowStage: req.body.decision === "APPROVE" ? "PENDING_OM_APPROVAL" : req.body.decision === "RETURN_FOR_CORRECTION" ? "RETURNED_FOR_CORRECTION" : req.body.decision, comments: req.body.comments }));
previewRouter.get("/om/leave-approvals", (_req, res) => res.json([{ ...managerLeave, workflowStage: "PENDING_OM_APPROVAL", omApproverId: omEmployee.id }]));
previewRouter.patch("/om/leave-approvals/:id/decision", (req, res) => res.json({ ...managerLeave, id: req.params.id, workflowStage: req.body.decision === "APPROVE" ? "PENDING_HR_MANAGER_APPROVAL" : req.body.decision === "RETURN_FOR_CORRECTION" ? "RETURNED_FOR_CORRECTION" : req.body.decision, comments: req.body.comments }));

previewRouter.get("/payroll", (req, res) => {
  if (req.user?.role === "EMPLOYEE") return res.status(403).json({ message: "Insufficient permissions" });
  return res.json([previewSamplePayrollRun()]);
});

previewRouter.post("/payroll/generate", (req, res) => {
  if (req.user?.role === "EMPLOYEE") return res.status(403).json({ message: "Insufficient permissions" });
  res.status(201).json(previewSamplePayrollRun("DRAFT"));
});
previewRouter.patch("/payroll/:id/approve", (req, res) => {
  if (req.user?.role === "EMPLOYEE") return res.status(403).json({ message: "Insufficient permissions" });
  res.json({ ...previewSamplePayrollRun("APPROVED"), id: req.params.id, approvedBy: req.user?.id, approvedAt: new Date().toISOString() });
});
previewRouter.get("/payroll/:id/mudad-wps.csv", (req, res) => {
  if (req.user?.role === "EMPLOYEE") return res.status(403).json({ message: "Insufficient permissions" });
  const run = previewSamplePayrollRun("APPROVED");
  res.header("Content-Type", "text/csv");
  res.attachment("mudad-wps-sample-payroll-2026-06.csv");
  res.send([
    "employeeCode,nationalId,employeeName,netSalary,payrollMonth,payrollYear",
    ...run.items.map((item) => `${item.employeeCode},${item.employee.nationalId},${item.employeeName},${item.netSalary},${run.month},${run.year}`)
  ].join("\n"));
});
previewRouter.get("/payroll/items/:id/payslip.pdf", async (req, res) => {
  const run = previewSamplePayrollRun("APPROVED");
  const item = run.items.find((payrollItem) => payrollItem.id === req.params.id) ?? run.items[0];
  const company = payslipCompanyFromProfile(await getCurrentCompanyProfile());
  const salary = previewPayrollNumbersForEmployee(item.employee);
  renderPayslipPdf(res, {
    company,
    employee: { name: item.employeeName, code: item.employeeCode, department: item.employee.department.name, designation: item.employee.jobTitle, nationalId: item.employee.nationalId, bankName: item.employee.bankName, iban: item.employee.iban, joiningDate: item.employee.joiningDate, status: item.employee.status },
    payroll: { month: run.month, year: run.year, period: "June 2026", reference: `PAY-2026-06-${item.employeeCode}-PREVIEW`, batchNumber: run.id, paymentDate: "2026-06-30", paymentMethod: "Bank Transfer", printedBy: req.user?.email, status: run.status },
    attendance: { payrollDays: 30, presentDays: 30, absentDays: 0, weeklyOffDays: 0, publicHolidays: 0, normalOvertimeHours: 0, holidayOvertimeHours: 0 },
    earnings: [
      { name: "Basic Salary", value: salary.basicSalary },
      { name: "Housing Allowance", value: salary.housingAllowance },
      { name: "Transportation Allowance", value: salary.transportAllowance },
      { name: "Other Allowance", value: salary.otherAllowance }
    ],
    deductions: [],
    netSalary: salary.netSalary,
    remarks: "Sample payroll payslip"
  });
});

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

const previewCompanyProfile = {
  id: "default",
  companyName: "Demo Company",
  companyNameArabic: "شركة تجريبية",
  registrationNumber: "1010000000",
  vatNumber: "300000000000003",
  address: "Riyadh, Saudi Arabia",
  city: "Riyadh",
  country: "Saudi Arabia",
  phone: "+966500000000",
  email: "info@example.com",
  website: "https://example.com",
  gosiNumber: "GOSI-PREVIEW",
  qiwaReference: "QIWA-PREVIEW",
  bankDetails: "Preview Bank",
  authorizedSignatory: "Authorized Signatory",
  logoDataUrl: null,
  logoVersion: 1,
  documentCompanyMode: "CURRENT",
  updatedAt: new Date().toISOString()
};

previewRouter.get("/company-profile", (_req, res) => res.json(getPreviewCompanyProfile()));
previewRouter.get("/company-profile/template.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("companyName,companyNameArabic,registrationNumber,vatNumber,address,city,country,phone,fax,email,website,gosiNumber,qiwaReference,bankDetails,authorizedSignatory,documentCompanyMode\n");
});
previewRouter.get("/company-profile/template.xlsx", async (_req, res) => {
  await xlsxTemplate(res, "company-profile-template.xlsx", ["companyName", "companyNameArabic", "registrationNumber", "vatNumber", "address", "city", "country", "phone", "fax", "email", "website", "gosiNumber", "qiwaReference", "bankDetails", "authorizedSignatory", "documentCompanyMode"], "Company Profile");
});
previewRouter.get("/company-profile/export.csv", (_req, res) => {
  const profile = getPreviewCompanyProfile();
  res.header("Content-Type", "text/csv");
  res.send(`companyName,companyNameArabic,registrationNumber,vatNumber,address,city,country,phone,email,website,gosiNumber,qiwaReference\n${profile.companyName},${profile.companyNameArabic ?? ""},${profile.registrationNumber ?? ""},${profile.vatNumber ?? ""},${profile.address ?? ""},${profile.city ?? ""},${profile.country ?? ""},${profile.phone ?? ""},${profile.email ?? ""},${profile.website ?? ""},${profile.gosiNumber ?? ""},${profile.qiwaReference ?? ""}`);
});
previewRouter.get("/company-profile/export.xlsx", async (_req, res) => {
  const profile = getPreviewCompanyProfile();
  await xlsxFile(res, "company-profile.xlsx", ["companyName", "companyNameArabic", "registrationNumber", "vatNumber", "address", "city", "country", "phone", "email", "website", "gosiNumber", "qiwaReference"], [[profile.companyName, profile.companyNameArabic ?? "", profile.registrationNumber ?? "", profile.vatNumber ?? "", profile.address ?? "", profile.city ?? "", profile.country ?? "", profile.phone ?? "", profile.email ?? "", profile.website ?? "", profile.gosiNumber ?? "", profile.qiwaReference ?? ""]], "Company Profile");
});
previewRouter.put("/company-profile", (req, res) => {
  const currentProfile = getPreviewCompanyProfile();
  const deleteLogo = Boolean(req.body.deleteLogo);
  const profile = updatePreviewCompanyProfile({
    ...currentProfile,
    ...req.body,
    logoDataUrl: deleteLogo ? "" : req.body.logoDataUrl ?? currentProfile.logoDataUrl,
    logoVersion: req.body.logoDataUrl || deleteLogo ? currentProfile.logoVersion + 1 : currentProfile.logoVersion,
    updatedBy: req.user?.id,
    updatedAt: new Date().toISOString()
  });
  res.json(profile);
});
previewRouter.post("/company-profile/import", (req, res) => {
  const profile = updatePreviewCompanyProfile({ ...getPreviewCompanyProfile(), ...req.body, updatedBy: req.user?.id, updatedAt: new Date().toISOString() });
  res.json({ message: "Import completed successfully.", record: profile });
});

const previewReportCatalog = [
  { category: "Employee Reports", reports: [{ id: "employee-master", title: "Employee Master Report", description: "All employees with department, branch, job, and reporting manager." }, { id: "employee-document-expiry", title: "Employee Document Expiry Report", description: "Iqama, passport, contract, and probation expiry tracking." }] },
  { category: "Leave & Vacation Reports", reports: [{ id: "leave-balance", title: "Leave Balance Report", description: "Uploaded leave and vacation balances." }, { id: "leave-requests", title: "Leave Request Report", description: "Leave request workflow status." }] },
  { category: "Attendance Reports", reports: [{ id: "attendance-daily", title: "Daily Attendance Report", description: "Daily attendance, late minutes, and overtime." }] },
  { category: "Payroll Reports", reports: [{ id: "payroll-register", title: "Payroll Register", description: "Payroll earnings, deductions, and net salary.", sensitive: true }, { id: "payslip-report", title: "Payslip Report", description: "Payslip report.", sensitive: true }] },
  { category: "Loan & Advance Reports", reports: [{ id: "loan-requests", title: "Loan Request Report", description: "Employee loan and advance requests.", sensitive: true }] },
  { category: "Business Trip Reports", reports: [{ id: "business-trips", title: "Business Trip Request Report", description: "Business trip requests and estimated cost." }] },
  { category: "Ticket Request Reports", reports: [{ id: "ticket-requests", title: "Ticket Request Report", description: "Ticket requests linked to leave." }] },
  { category: "Petty Cash Reports", reports: [{ id: "petty-cash", title: "Petty Cash Request Report", description: "Petty cash requests and settlement.", sensitive: true }] },
  { category: "Appraisal Reports", reports: [{ id: "appraisal-report", title: "Manual Appraisal Report", description: "Manual salary appraisal status.", sensitive: true }] },
  { category: "Resignation & Exit Reports", reports: [{ id: "resignation-report", title: "Resignation Request Report", description: "Resignation and exit clearance status." }] },
  { category: "Government Reports", reports: [{ id: "government-integration-log", title: "Government Integration Log Report", description: "GOSI, Mudad, and Qiwa connector logs." }] },
  { category: "Master Data Reports", reports: [{ id: "master-data", title: "Master Data Report", description: "Company and master data records." }] },
  { category: "Workflow & Approval Reports", reports: [{ id: "pending-approvals", title: "Pending Approval Report", description: "All pending approval workflow items." }] },
  { category: "Audit & Security Reports", reports: [{ id: "audit-log", title: "Audit Log Report", description: "System audit trail." }, { id: "employee-mapping-audit", title: "Employee Mapping Audit Report", description: "Employee-linked records with missing or invalid employee mappings." }] }
];

previewRouter.get("/reports/catalog", (_req, res) => res.json(previewReportCatalog));
previewRouter.get("/reports/dashboard", (_req, res) => res.json({
  totalEmployees: 4 + previewImportedEmployees.length,
  activeEmployees: 4 + previewImportedEmployees.filter((row) => String(row.status ?? "ACTIVE") === "ACTIVE").length,
  employeesOnLeaveToday: 1,
  pendingApprovals: 6,
  pendingLeaves: 2,
  pendingPayroll: 1,
  expiringIqama: 1,
  expiringPassport: 1,
  pendingExitClearance: 1,
  failedEmailNotifications: 0,
  failedErpPostings: 0
}));
previewRouter.get("/reports/dashboard.xlsx", async (_req, res) => {
  await xlsxFile(res, "hrms-dashboard-report.xlsx", ["Metric", "Value"], [["Total Employees", 2], ["Active Employees", 2], ["Pending Leaves", 2], ["Pending Payroll", 1], ["Monthly Payroll Cost", "24362.50"]], "Dashboard");
});
function previewDashboardPayload(role = "ADMIN") {
  const employees = previewEmployeeRecords();
  const countByField = (field: string) => {
    const counts = new Map<string, number>();
    employees.forEach((row) => {
      const value = String(row[field] ?? "Not specified");
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  const total = employees.length;
  return {
    role,
    canSeePayroll: role !== "EMPLOYEE",
    filters: { company: "Current Company", branch: "All", department: "All", dateRange: "Last 12 months", status: "Active/Inactive" },
    summaryCards: [
      { label: "Total Employees", value: total, href: "/employees", icon: "users" },
      { label: "Active Employees", value: employees.filter((row) => row.status === "ACTIVE").length, href: "/employees", icon: "check" },
      { label: "Inactive Employees", value: employees.filter((row) => row.status !== "ACTIVE").length, href: "/employees", icon: "minus" },
      { label: "New Joiners This Month", value: 3, href: "/employees", icon: "plus" },
      { label: "Employees on Leave Today", value: 1, href: "/leave", icon: "calendar" },
      { label: "Pending Leave Approvals", value: 2, href: "/leave", icon: "clock" },
      { label: "Pending Payroll Approval", value: role === "EMPLOYEE" ? "Hidden" : 1, href: "/payroll", icon: "money" },
      { label: "Pending Business Trip Requests", value: 1, href: "/business-trips", icon: "plane" },
      { label: "Pending Loan Requests", value: 1, href: "/loans", icon: "money" },
      { label: "Pending Resignation Requests", value: 1, href: "/resignations", icon: "exit" },
      { label: "Expiring Iqama", value: 1, href: "/reports", icon: "alert" },
      { label: "Expiring Passport", value: 1, href: "/reports", icon: "alert" },
      { label: "Expiring Contract", value: 2, href: "/reports", icon: "alert" },
      { label: "Monthly Payroll Cost", value: role === "EMPLOYEE" ? "Hidden" : "24362.50", href: "/payroll", icon: "money" },
      { label: "Open Exit Clearance", value: 1, href: "/exit-clearance", icon: "exit" },
      { label: "Pending Appraisals", value: 1, href: "/performance-appraisals", icon: "star" }
    ],
    charts: {
      nationality: countByField("nationality").slice(0, 8),
      employeeStatus: countByField("status"),
      departmentHeadcount: [{ label: "Operations", value: 3 }, { label: "Human Resources", value: 2 }, { label: "Sales", value: 2 }, { label: "Power department", value: 8 }],
      branchHeadcount: countByField("branch"),
      leaveTrend: ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"].map((label, index) => ({ label, value: index % 4 + 1 })),
      payrollTrend: role === "EMPLOYEE" ? [] : ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"].map((label, index) => ({ label, value: 18000 + index * 900 })),
      gender: countByField("gender"),
      employeeType: countByField("employeeType"),
      attendanceToday: [{ label: "Present", value: 52 }, { label: "Late", value: 4 }, { label: "Absent", value: 2 }, { label: "On Leave", value: 1 }],
      requestStatus: [{ label: "Leave", value: 2 }, { label: "Loan", value: 1 }, { label: "Business Trip", value: 1 }, { label: "Petty Cash", value: 1 }, { label: "Ticket", value: 1 }, { label: "Resignation", value: 1 }, { label: "Appraisal", value: 1 }]
    },
    alerts: [
      { label: "Iqama expiring within 60 days", count: 1, href: "/reports" },
      { label: "Passport expiring within 60 days", count: 1, href: "/reports" },
      { label: "Contract expiring within 60 days", count: 2, href: "/reports" },
      { label: "Probation ending soon", count: 1, href: "/reports" },
      { label: "Employees with missing documents", count: 5, href: "/employee-document-expiry" },
      { label: "Pending payroll publish", count: role === "EMPLOYEE" ? 0 : 1, href: "/payroll" }
    ],
    recentActivities: [
      { action: "EMPLOYEE_IMPORT_COMPLETE", user: "admin@company.sa", target: "EmployeeDetails.xls", createdAt: new Date().toISOString() },
      { action: "LEAVE_SUBMITTED", user: "employee@company.com", target: "LR-PREVIEW-001", createdAt: new Date().toISOString() },
      { action: "PAYROLL_UPLOADED", user: "admin@company.sa", target: "June 2026", createdAt: new Date().toISOString() }
    ],
    pendingApprovals: [
      { type: "Leave", number: "LR-PREVIEW-001", employeeName: "Employee User", status: "PENDING_MANAGER_APPROVAL", submittedDate: new Date().toISOString(), agingDays: 2, href: "/leave" },
      { type: "Loan", number: "LOAN-PREVIEW-001", employeeName: "Employee User", status: "PENDING_MANAGER", submittedDate: new Date().toISOString(), agingDays: 1, href: "/loans" }
    ],
    quickActions: role === "EMPLOYEE"
      ? [{ label: "Apply Leave", href: "/employee/leaves" }, { label: "View Payslip", href: "/employee/payslips" }, { label: "Vacation Balance", href: "/employee/vacation-balance" }]
      : [{ label: "Add Employee", href: "/employees/new" }, { label: "Import Employees", href: "/employee-import" }, { label: "Upload Payroll", href: "/payroll-upload" }, { label: "View Audit Logs", href: "/audit-logs" }]
  };
}
previewRouter.get("/dashboard", (req, res) => res.json(previewDashboardPayload(String(req.user?.role ?? "ADMIN"))));
previewRouter.get("/dashboard/summary.xlsx", async (_req, res) => {
  await xlsxFile(res, "hrms-dashboard-summary.xlsx", ["Metric", "Value"], previewDashboardPayload().summaryCards.map((card) => [card.label, card.value]), "Dashboard");
});
previewRouter.get("/dashboard/export.pdf", (_req, res) => {
  const dashboard = previewDashboardPayload();
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  res.header("Content-Type", "application/pdf");
  res.attachment("hrms-dashboard.pdf");
  doc.pipe(res);
  doc.fontSize(16).text("HRMS Dashboard");
  doc.fontSize(9).text(`Generated on ${new Date().toLocaleString()}`);
  doc.moveDown();
  dashboard.summaryCards.forEach((card) => doc.fontSize(9).text(`${card.label}: ${card.value}`));
  doc.moveDown().fontSize(12).text("Alerts");
  dashboard.alerts.forEach((alert) => doc.fontSize(9).text(`${alert.label}: ${alert.count}`));
  doc.end();
});
previewRouter.get("/dashboard/print", (_req, res) => {
  const rows = previewDashboardPayload().summaryCards.map((card) => `<tr><td>${card.label}</td><td>${card.value}</td></tr>`).join("");
  res.header("Content-Type", "text/html");
  res.send(`<!doctype html><html><body><button onclick="window.print()">Print</button><h1>HRMS Dashboard</h1><table border="1">${rows}</table></body></html>`);
});
previewRouter.get("/reports/audit-trail.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("createdAt,userId,module,action,entityId,ipAddress,device\n2026-06-30T00:00:00Z,preview-admin,Employee,CREATE,EMP-001,127.0.0.1,Preview");
});
previewRouter.get("/reports/audit-trail.xlsx", async (_req, res) => {
  await xlsxFile(res, "audit-trail.xlsx", ["createdAt", "userId", "module", "action", "entityId", "ipAddress", "device"], [["2026-06-30T00:00:00Z", "preview-admin", "Employee", "CREATE", "EMP-001", "127.0.0.1", "Preview"]], "Audit Trail");
});

function previewReportDefinition(id: string) {
  return previewReportCatalog.flatMap((group) => group.reports.map((report) => ({ ...report, category: group.category }))).find((report) => report.id === id) ?? previewReportCatalog[0].reports[0];
}

function previewReportRows(id: string) {
  const employees = previewEmployeeRecords().map((row) => ({
    employeeId: String(row.employeeCode ?? ""),
    employeeName: `${String(row.firstName ?? "")} ${String(row.lastName ?? "")}`.trim(),
    nationality: String(row.nationality ?? "Saudi"),
    department: String((row.department as { name?: string } | undefined)?.name ?? row.department ?? "Operations"),
    designation: String(row.jobTitle ?? ""),
    branch: String(row.branch ?? "Riyadh"),
    location: String(row.location ?? row.branch ?? "Riyadh"),
    joiningDate: String(row.joiningDate ?? "2026-01-01").slice(0, 10),
    status: String(row.status ?? "ACTIVE"),
    mobile: String(row.phone ?? ""),
    companyEmail: String(row.email ?? ""),
    reportingManager: row.employeeCode === "EMP-002" ? "Manager User" : ""
  }));
  const reports: Record<string, { columns: Array<{ key: string; label: string; sensitive?: boolean }>; rows: Array<Record<string, unknown>>; summary: Record<string, unknown> }> = {
    "employee-master": {
      columns: ["employeeId", "employeeName", "nationality", "department", "designation", "branch", "location", "joiningDate", "status", "mobile", "companyEmail", "reportingManager"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) })),
      rows: employees,
      summary: { totalEmployees: employees.length }
    },
    "leave-balance": {
      columns: ["employeeId", "employeeName", "department", "leaveType", "openingBalance", "accrued", "used", "pending", "adjustment", "availableBalance", "carryForward", "expiryDate"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) })),
      rows: employees.slice(0, 4).map((row) => ({ ...row, leaveType: "ANNUAL", openingBalance: 21, accrued: 2, used: 4, pending: 1, adjustment: 0, availableBalance: 18, carryForward: 0, expiryDate: "2026-12-31" })),
      summary: { totalBalance: 72 }
    },
    "leave-requests": {
      columns: ["requestNo", "employeeId", "employeeName", "department", "leaveType", "startDate", "endDate", "totalDays", "status", "currentApprover", "requestDate"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) })),
      rows: [{ requestNo: "LR-PREVIEW-001", employeeId: "EMP-002", employeeName: "Employee User", department: "Operations", leaveType: "ANNUAL", startDate: "2026-07-20", endDate: "2026-07-25", totalDays: 6, status: "PENDING", currentApprover: "Manager", requestDate: "2026-07-08" }],
      summary: { totalRequests: 1, totalDays: 6 }
    },
    "attendance-daily": {
      columns: ["employeeId", "employeeName", "department", "date", "shift", "firstIn", "lastOut", "workingHours", "lateMinutes", "earlyOutMinutes", "overtimeHours", "status", "source", "deviceName"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) })),
      rows: employees.slice(0, 4).map((row, index) => ({ ...row, date: "2026-07-08", shift: "Default", firstIn: index === 1 ? "08:17" : "08:00", lastOut: "17:30", workingHours: "9.50", lateMinutes: index === 1 ? 17 : 0, earlyOutMinutes: 0, overtimeHours: "1.00", source: "BIOMETRIC", deviceName: "ZKTeco Riyadh" })),
      summary: { totalRecords: 4, lateMinutes: 17, overtimeHours: "4.00" }
    },
    "payroll-register": {
      columns: ["payrollBatchNo", "payrollMonth", "employeeId", "employeeName", "department", "basicSalary", "housingAllowance", "transportAllowance", "otherEarnings", "totalEarnings", "totalDeductions", "netSalary", "paymentDate", "payrollStatus", "erpPostingStatus"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), sensitive: ["basicSalary", "housingAllowance", "transportAllowance", "otherEarnings", "totalEarnings", "totalDeductions", "netSalary"].includes(key) })),
      rows: employees.slice(0, 3).map((row, index) => ({ ...row, payrollBatchNo: "PAY-PREVIEW-2026-06", payrollMonth: "6/2026", basicSalary: 8000 + index * 1000, housingAllowance: 2000, transportAllowance: 800, otherEarnings: 250, totalEarnings: 11050 + index * 1000, totalDeductions: 550, netSalary: 10500 + index * 1000, paymentDate: "2026-06-30", payrollStatus: "APPROVED", erpPostingStatus: "NOT_POSTED" })),
      summary: { totalNetSalary: "34500.00" }
    },
    "pending-approvals": {
      columns: ["processType", "requestNo", "employeeId", "employeeName", "currentStatus", "currentApprover", "pendingSince", "agingDays", "lastAction", "comments"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) })),
      rows: [{ processType: "Leave", requestNo: "LR-PREVIEW-001", employeeId: "EMP-002", employeeName: "Employee User", currentStatus: "PENDING_MANAGER", currentApprover: "Manager", pendingSince: "2026-07-08", agingDays: 0, lastAction: "Submitted", comments: "" }],
      summary: { pendingApprovals: 1 }
    },
    "petty-cash": {
      columns: ["requestNo", "employeeId", "employeeName", "department", "requestType", "requestedAmount", "approvedAmount", "paidAmount", "settledAmount", "outstandingAmount", "status", "currentApprover"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), sensitive: key.includes("Amount") })),
      rows: [{ requestNo: "PC-PREVIEW-001", employeeId: "EMP-002", employeeName: "Employee User", department: "Operations", requestType: "Travel Expense", requestedAmount: 800, approvedAmount: 800, paidAmount: 800, settledAmount: 0, outstandingAmount: 800, status: "PENDING_FINANCE", currentApprover: "Finance" }],
      summary: { outstanding: "800.00" }
    },
    "business-trips": {
      columns: ["tripRequestNo", "employeeId", "employeeName", "department", "destination", "startDate", "endDate", "totalDays", "estimatedCost", "approvedCost", "status", "currentApprover"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) })),
      rows: [{ tripRequestNo: "TRIP-PREVIEW-001", employeeId: "EMP-002", employeeName: "Employee User", department: "Operations", destination: "Dubai, UAE", startDate: "2026-07-20", endDate: "2026-07-22", totalDays: 3, estimatedCost: 3200, approvedCost: 3200, status: "PENDING_MANAGER", currentApprover: "Manager" }],
      summary: { totalTrips: 1 }
    },
    "appraisal-report": {
      columns: ["appraisalRefNo", "employeeId", "employeeName", "department", "currentSalary", "increasePercentage", "increaseAmount", "newSalary", "effectiveDate", "reason", "status", "approvedBy"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), sensitive: ["currentSalary", "increasePercentage", "increaseAmount", "newSalary"].includes(key) })),
      rows: [{ appraisalRefNo: "MAPP-PREVIEW-001", employeeId: "EMP-002", employeeName: "Employee User", department: "Operations", currentSalary: 10800, increasePercentage: 5, increaseAmount: 540, newSalary: 11340, effectiveDate: "2026-07-01", reason: "Annual Performance Appraisal", status: "SUBMITTED", approvedBy: "" }],
      summary: { totalIncrease: "540.00" }
    },
    "resignation-report": {
      columns: ["resignationRequestNo", "employeeId", "employeeName", "department", "proposedLastWorkingDate", "noticePeriod", "status", "currentApprover", "finalSettlementStatus", "exitClearanceStatus"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) })),
      rows: [{ resignationRequestNo: "RES-PREVIEW-001", employeeId: "EMP-002", employeeName: "Employee User", department: "Operations", proposedLastWorkingDate: "2026-08-15", noticePeriod: "0/30", status: "PENDING_MANAGER", currentApprover: "Manager", finalSettlementStatus: "NOT_STARTED", exitClearanceStatus: "PENDING" }],
      summary: { totalResignations: 1 }
    },
    "audit-log": {
      columns: ["user", "role", "module", "action", "recordNo", "previousValue", "newValue", "dateTime", "ipDevice", "status"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) })),
      rows: [{ user: "preview-admin", role: "ADMIN", module: "User", action: "LOGIN", recordNo: "preview-admin", previousValue: "", newValue: "", dateTime: new Date().toISOString(), ipDevice: "127.0.0.1 / Preview", status: "RECORDED" }],
      summary: { totalLogs: 1 }
    },
    "employee-mapping-audit": {
      columns: ["moduleName", "recordNumber", "employeeId", "employeeName", "mappingStatus", "createdDate", "actions"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) })),
      rows: previewEmployeeRecords().map((record) => {
        const employeeRecord = normalizePreviewEmployee(record);
        return { moduleName: "Employee Master", recordNumber: employeeRecord.employeeCode, employeeId: employeeRecord.id, employeeName: employeeRecord.fullName, mappingStatus: "Valid", createdDate: String((record as Record<string, unknown>).createdAt ?? ""), actions: "View" };
      }),
      summary: { totalRecords: previewEmployeeRecords().length, valid: previewEmployeeRecords().length, missingEmployeeId: 0, employeeNotFound: 0 }
    }
  };
  if (id === "payslip-report") return reports["payroll-register"];
  if (id === "ticket-requests") return { columns: ["ticketRequestNo", "linkedLeaveRequestNo", "employeeId", "employeeName", "destination", "departureDate", "returnDate", "ticketType", "estimatedCost", "bookingReference", "status"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) })), rows: [{ ticketRequestNo: "TKT-PREVIEW-001", linkedLeaveRequestNo: "LR-PREVIEW-001", employeeId: "EMP-002", employeeName: "Employee User", destination: "Jeddah, Saudi Arabia", departureDate: "2026-07-20", returnDate: "2026-07-25", ticketType: "RETURN", estimatedCost: 1200, bookingReference: "", status: "PENDING_HR_MANAGER" }] as Array<Record<string, unknown>>, summary: { totalTickets: 1 } };
  if (id === "loan-requests") return { columns: ["requestNo", "employeeId", "employeeName", "loanType", "requestedAmount", "approvedAmount", "monthlyDeduction", "outstandingBalance", "status", "currentApprover"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), sensitive: ["requestedAmount", "approvedAmount", "monthlyDeduction", "outstandingBalance"].includes(key) })), rows: [{ requestNo: "LOAN-PREVIEW-001", employeeId: "EMP-002", employeeName: "Employee User", loanType: "Salary Advance", requestedAmount: 5000, approvedAmount: 5000, monthlyDeduction: 500, outstandingBalance: 5000, status: "PENDING_MANAGER", currentApprover: "Manager" }] as Array<Record<string, unknown>>, summary: { totalRequested: "5000.00" } };
  if (id === "government-integration-log") return { columns: ["module", "recordNo", "status", "syncDate", "errorMessage"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) })), rows: [{ module: "GOSI", recordNo: "GOSI-PREVIEW-001", status: "QUEUED", syncDate: "2026-07-08", errorMessage: "" }] as Array<Record<string, unknown>>, summary: { totalLogs: 1 } };
  if (id === "master-data") return { columns: ["code", "nameEnglish", "nameArabic", "relatedCompanyBranch", "status", "createdBy", "createdDate", "lastUpdatedBy", "lastUpdatedDate"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) })), rows: [{ code: "COMPANY", nameEnglish: getPreviewCompanyProfile().companyName, nameArabic: getPreviewCompanyProfile().companyNameArabic ?? "", relatedCompanyBranch: "Riyadh", status: "ACTIVE", createdBy: "preview-admin", createdDate: "2026-01-01", lastUpdatedBy: "preview-admin", lastUpdatedDate: "2026-07-08" }] as Array<Record<string, unknown>>, summary: { totalRecords: 1 } };
  return reports[id] ?? reports["employee-master"];
}

function previewReportPayload(id: string, req: { query?: Record<string, unknown>; user?: { email?: string } }) {
  const report = previewReportDefinition(id);
  const data = previewReportRows(id);
  const page = Math.max(Number(req.query?.page ?? 1), 1);
  const pageSize = Math.max(Number(req.query?.pageSize ?? 25), 1);
  const rows = data.rows.slice((page - 1) * pageSize, page * pageSize);
  const company = getPreviewCompanyProfile();
  return {
    report,
    company: { name: company.companyName, logoDataUrl: company.logoDataUrl, logoVersion: company.logoVersion },
    generatedAt: new Date().toISOString(),
    generatedBy: req.user?.email ?? "preview@company.local",
    filters: { search: String(req.query?.search ?? ""), dateFrom: String(req.query?.dateFrom ?? ""), dateTo: String(req.query?.dateTo ?? ""), branch: String(req.query?.branch ?? ""), department: String(req.query?.department ?? ""), location: String(req.query?.location ?? ""), employee: String(req.query?.employee ?? ""), status: String(req.query?.status ?? "") },
    columns: data.columns,
    rows,
    summary: data.summary,
    pagination: { page, pageSize, total: data.rows.length, totalPages: Math.max(Math.ceil(data.rows.length / pageSize), 1) }
  };
}

previewRouter.get("/reports/:id/export.csv", (req, res) => {
  const payload = previewReportPayload(req.params.id, req);
  res.header("Content-Type", "text/csv");
  res.attachment(`${req.params.id}.csv`);
  res.send([payload.columns.map((column) => column.label).join(","), ...payload.rows.map((row) => payload.columns.map((column) => JSON.stringify(row[column.key] ?? "")).join(","))].join("\n"));
});
previewRouter.get("/reports/:id/export.xlsx", async (req, res) => {
  const payload = previewReportPayload(req.params.id, req);
  await xlsxFile(res, `${req.params.id}.xlsx`, payload.columns.map((column) => column.label), payload.rows.map((row) => payload.columns.map((column) => row[column.key] ?? "")), payload.report.title.slice(0, 31));
});
previewRouter.get("/reports/:id/export.pdf", (req, res) => {
  const payload = previewReportPayload(req.params.id, req);
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28 });
  res.header("Content-Type", "application/pdf");
  res.attachment(`${req.params.id}.pdf`);
  doc.pipe(res);
  doc.fontSize(15).text(payload.report.title);
  doc.fontSize(9).text(`${payload.company.name} | Generated by ${payload.generatedBy}`);
  doc.moveDown();
  payload.rows.forEach((row) => doc.fontSize(8).text(payload.columns.slice(0, 8).map((column) => `${column.label}: ${row[column.key] ?? ""}`).join(" | ")));
  doc.end();
});
previewRouter.get("/reports/:id/print", async (req, res) => {
  const payload = previewReportPayload(req.params.id, req);
  const company = await getCurrentCompanyProfile();
  const header = payload.columns.map((column) => `<th>${column.label}</th>`).join("");
  const rows = payload.rows.map((row) => `<tr>${payload.columns.map((column) => `<td>${row[column.key] ?? ""}</td>`).join("")}</tr>`).join("");
  res.send(`<!doctype html><html><body>${companyPrintHeader(company, payload.report.title)}<button onclick="window.print()">Print</button><table border="1"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></body></html>`);
});
previewRouter.get("/reports/:id", (req, res) => res.json(previewReportPayload(req.params.id, req)));

const previewTrip = {
  id: "preview-trip-1",
  requestNumber: "TRIP-PREVIEW-001",
  tripType: "International",
  purpose: "Client site visit",
  destinationCountry: "United Arab Emirates",
  destinationCity: "Dubai",
  startDate: "2026-07-20T00:00:00.000Z",
  endDate: "2026-07-22T00:00:00.000Z",
  totalDays: 3,
  totalEstimatedCost: "4500.00",
  requestedAdvanceAmount: "2500.00",
  status: "PENDING_MANAGER",
  currentApprover: "MANAGER",
  createdAt: new Date().toISOString(),
  employee: { ...selfServiceEmployee, jobTitle: "Operations Specialist", department: selfServiceEmployee.department }
};
previewRouter.get("/business-trips", (req, res) => res.json(previewScopedModuleList(req, "business-trips", [previewTrip])));
previewRouter.post("/business-trips", (req, res) => {
  const currentEmployee = previewEmployeeForUser(req.user);
  const created = { ...previewTrip, id: `preview-trip-${Date.now()}`, requestNumber: `TRIP-${Date.now()}`, employeeId: currentEmployee.id, employee: currentEmployee, ...req.body };
  if (req.user?.role === "EMPLOYEE") previewStoreEmployeeModuleRecord("business-trips", currentEmployee.id, created);
  res.status(201).json(created);
});
previewRouter.patch("/business-trips/:id", (req, res) => res.json({ ...previewTrip, id: req.params.id, ...req.body, updatedAt: new Date().toISOString() }));
previewRouter.patch("/business-trips/:id/decision", (req, res) => res.json({ ...previewTrip, id: req.params.id, status: req.body.action === "REJECT" ? "REJECTED" : req.body.action === "RETURN_FOR_CORRECTION" ? "RETURNED_FOR_CORRECTION" : "PENDING_OM", approvalTimeline: [{ action: req.body.action, comments: req.body.comments, at: new Date().toISOString() }] }));
previewRouter.post("/business-trips/expense-claims", (req, res) => res.status(201).json({ id: `preview-trip-claim-${Date.now()}`, claimNumber: `TEXP-${Date.now()}`, status: "PENDING_MANAGER", ...req.body }));
previewRouter.get("/business-trips/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Request Number,Employee ID,Employee Name,Department,Destination,Trip Type,Start Date,End Date,Total Days,Estimated Cost,Advance Amount,Status\nTRIP-PREVIEW-001,EMP-002,Employee User,Operations,Dubai UAE,International,2026-07-20,2026-07-22,3,4500.00,2500.00,PENDING_MANAGER");
});
previewRouter.get("/business-trips/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "business-trips.xlsx", ["Request Number", "Employee ID", "Employee Name", "Department", "Destination", "Trip Type", "Status"], [["TRIP-PREVIEW-001", "EMP-002", "Employee User", "Operations", "Dubai, UAE", "International", "PENDING_MANAGER"]], "Business Trips");
});
previewRouter.get("/business-trips/:id/print", async (_req, res) => {
  const company = await getCurrentCompanyProfile();
  res.header("Content-Type", "text/html");
  res.send(`<!doctype html><html><body>${companyPrintHeader(company, "Business Trip Authorization")}<h2>TRIP-PREVIEW-001</h2><p>Employee User - Dubai</p><script>window.print()</script></body></html>`);
});

const previewLoan = {
  id: "preview-loan-1",
  requestNumber: "LOAN-PREVIEW-001",
  loanType: "Salary Advance",
  requestedAmount: "5000.00",
  approvedAmount: "5000.00",
  numberOfInstallments: 5,
  monthlyInstallmentAmount: "1000.00",
  outstandingBalance: "5000.00",
  createdAt: new Date().toISOString(),
  disbursementDate: null,
  status: "PENDING_MANAGER",
  loanStatus: "REQUESTED",
  employee: { ...selfServiceEmployee, department: selfServiceEmployee.department }
};
previewRouter.get("/loans", (req, res) => res.json(previewScopedModuleList(req, "loans", [previewLoan])));
previewRouter.post("/loans", (req, res) => {
  const currentEmployee = previewEmployeeForUser(req.user);
  const created = { ...previewLoan, id: `preview-loan-${Date.now()}`, requestNumber: `LOAN-${Date.now()}`, employeeId: currentEmployee.id, employee: currentEmployee, ...req.body };
  if (req.user?.role === "EMPLOYEE") previewStoreEmployeeModuleRecord("loans", currentEmployee.id, created);
  res.status(201).json(created);
});
previewRouter.patch("/loans/:id", (req, res) => res.json({ ...previewLoan, id: req.params.id, ...req.body, updatedAt: new Date().toISOString() }));
previewRouter.patch("/loans/:id/decision", (req, res) => res.json({ ...previewLoan, id: req.params.id, status: req.body.action === "REJECT" ? "REJECTED" : req.body.action === "RETURN_FOR_CORRECTION" ? "RETURNED_FOR_CORRECTION" : "PENDING_OM", approvalTimeline: [{ action: req.body.action, comments: req.body.comments, at: new Date().toISOString() }] }));
previewRouter.get("/loans/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Request Number,Employee ID,Employee Name,Loan Type,Requested Amount,Approved Amount,Installments,Monthly Deduction,Outstanding Balance,Status\nLOAN-PREVIEW-001,EMP-002,Employee User,Salary Advance,5000.00,5000.00,5,1000.00,5000.00,PENDING_MANAGER");
});
previewRouter.get("/loans/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "employee-loans.xlsx", ["Request Number", "Employee ID", "Employee Name", "Loan Type", "Requested Amount", "Approved Amount", "Status"], [["LOAN-PREVIEW-001", "EMP-002", "Employee User", "Salary Advance", "5000.00", "5000.00", "PENDING_MANAGER"]], "Loans");
});
previewRouter.get("/loans/:id/print", async (_req, res) => {
  const company = await getCurrentCompanyProfile();
  res.header("Content-Type", "text/html");
  res.send(`<!doctype html><html><body>${companyPrintHeader(company, "Loan Agreement")}<h2>LOAN-PREVIEW-001</h2><p>Salary Advance - 5000.00 SAR</p><script>window.print()</script></body></html>`);
});

const previewAppraisal = {
  id: "preview-appraisal-1",
  referenceNumber: "APP-PREVIEW-001",
  periodCode: "2026-ANNUAL",
  status: "PENDING_MANAGER",
  finalScore: "3.50",
  finalRating: "Meets Expectations",
  publishedAt: null,
  employee: { ...selfServiceEmployee, jobTitle: "Operations Specialist", department: selfServiceEmployee.department, manager: managerEmployee }
};
const previewBaseSalaryEmployees = [
  {
    id: employee.id,
    employeeCode: employee.employeeCode,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    department: employee.department.name,
    designation: employee.jobTitle,
    branch: "Riyadh",
    location: "Human Resources",
    reportingManager: "",
    joiningDate: "2026-01-01T00:00:00.000Z",
    currentBasicSalary: 12000,
    currentHousingAllowance: 3000,
    currentTransportAllowance: 1000,
    currentOtherAllowance: 0,
    currentGrossSalary: 16000,
    currentPayrollGroup: "Admin",
    lastAppraisalAmount: 0,
    lastAppraisalPercentage: 0,
    managerId: ""
  },
  {
    id: selfServiceEmployee.id,
    employeeCode: selfServiceEmployee.employeeCode,
    employeeName: `${selfServiceEmployee.firstName} ${selfServiceEmployee.lastName}`,
    department: selfServiceEmployee.department.name,
    designation: selfServiceEmployee.jobTitle,
    branch: "Riyadh",
    location: "Operations",
    reportingManager: `${managerEmployee.firstName} ${managerEmployee.lastName}`,
    joiningDate: "2026-02-01T00:00:00.000Z",
    currentBasicSalary: 8000,
    currentHousingAllowance: 2000,
    currentTransportAllowance: 800,
    currentOtherAllowance: 0,
    currentGrossSalary: 10800,
    currentPayrollGroup: "Monthly Salaried Employees",
    lastAppraisalDate: "2025-12-31T00:00:00.000Z",
    lastAppraisalAmount: 500,
    lastAppraisalPercentage: 5,
    managerId: managerEmployee.id
  },
  {
    id: managerEmployee.id,
    employeeCode: managerEmployee.employeeCode,
    employeeName: `${managerEmployee.firstName} ${managerEmployee.lastName}`,
    department: managerEmployee.department.name,
    designation: managerEmployee.jobTitle,
    branch: "Riyadh",
    location: "Operations",
    reportingManager: "",
    joiningDate: "2025-06-01T00:00:00.000Z",
    currentBasicSalary: 15000,
    currentHousingAllowance: 4000,
    currentTransportAllowance: 1200,
    currentOtherAllowance: 0,
    currentGrossSalary: 20200,
    currentPayrollGroup: "Management",
    lastAppraisalAmount: 0,
    lastAppraisalPercentage: 0,
    managerId: ""
  },
  {
    id: omEmployee.id,
    employeeCode: omEmployee.employeeCode,
    employeeName: `${omEmployee.firstName} ${omEmployee.lastName}`,
    department: omEmployee.department.name,
    designation: omEmployee.jobTitle,
    branch: "Riyadh",
    location: "Operations",
    reportingManager: "",
    joiningDate: "2025-01-01T00:00:00.000Z",
    currentBasicSalary: 18000,
    currentHousingAllowance: 5000,
    currentTransportAllowance: 1500,
    currentOtherAllowance: 0,
    currentGrossSalary: 24500,
    currentPayrollGroup: "Management",
    lastAppraisalAmount: 0,
    lastAppraisalPercentage: 0,
    managerId: ""
  }
];
function previewImportedSalaryEmployees() {
  return previewImportedEmployees.map((record) => {
    const basic = Number(record.basicSalary ?? 0);
    const housing = Number(record.housingAllowance ?? 0);
    const transport = Number(record.transportAllowance ?? 0);
    const other = Number(record.otherAllowance ?? 0);
    const department = record.department as { name?: string } | undefined;
    return {
      id: String(record.id ?? record.employeeCode),
      employeeCode: String(record.employeeCode ?? ""),
      employeeName: `${record.firstName ?? ""} ${record.lastName ?? ""}`.trim() || String(record.employeeCode ?? "Imported Employee"),
      department: department?.name ?? "Imported Employees",
      designation: String(record.jobTitle ?? "Employee"),
      branch: String(record.branch ?? ""),
      location: String(record.location ?? ""),
      reportingManager: "",
      joiningDate: String(record.joiningDate ?? ""),
      currentBasicSalary: basic,
      currentHousingAllowance: housing,
      currentTransportAllowance: transport,
      currentOtherAllowance: other,
      currentGrossSalary: basic + housing + transport + other,
      currentPayrollGroup: "",
      lastAppraisalAmount: 0,
      lastAppraisalPercentage: 0,
      managerId: String(record.managerId ?? "")
    };
  });
}
function previewSalaryEmployeesForUser(user?: { role?: string; employeeId?: string | null }) {
  const records = [...previewBaseSalaryEmployees, ...previewImportedSalaryEmployees()];
  if (["DEPARTMENT_MANAGER", "OPERATIONS_MANAGER"].includes(String(user?.role))) return records.filter((record) => record.managerId === user?.employeeId);
  return records;
}
const previewManualAppraisals: Array<Record<string, unknown>> = [{
  id: "preview-manual-appraisal-1",
  referenceNumber: "MAPP-PREVIEW-001",
  appraisalType: "Salary Increase",
  effectiveDate: "2026-07-01T00:00:00.000Z",
  currentGrossSalary: "10800.00",
  salaryDifference: "540.00",
  newGrossSalary: "11340.00",
  reason: "Annual Performance Appraisal",
  performanceRating: "Meets Expectations",
  status: "SUBMITTED",
  currentApprover: "HR Manager",
  employee: { ...selfServiceEmployee, jobTitle: "Operations Specialist", department: selfServiceEmployee.department, manager: managerEmployee }
}];
const previewAppraisalBatches: Array<Record<string, unknown>> = [{
  id: "preview-appraisal-batch-1",
  batchNumber: "BAPP-PREVIEW-001",
  uploadFileName: "bulk-appraisal.csv",
  numberOfEmployees: 1,
  totalCurrentSalary: "10800.00",
  totalIncreaseAmount: "540.00",
  totalNewSalary: "11340.00",
  status: "DRAFT",
  currentApprover: "",
  createdAt: new Date().toISOString(),
  details: []
}];
previewRouter.get("/appraisals/eligible-employees", (req, res) => res.json(previewSalaryEmployeesForUser(req.user)));
previewRouter.get("/appraisals/employees/:id/salary-profile", (req, res) => {
  const employees = previewSalaryEmployeesForUser(req.user);
  const profile = employees.find((employee) => employee.id === req.params.id || employee.employeeCode === req.params.id);
  if (!profile) return res.status(403).json({ message: "Managers can view only direct-report employees." });
  res.json(profile);
});
previewRouter.get("/appraisals/manual", (req, res) => {
  const allowedCodes = new Set(previewSalaryEmployeesForUser(req.user).map((item) => item.employeeCode));
  res.json(["DEPARTMENT_MANAGER", "OPERATIONS_MANAGER"].includes(String(req.user?.role)) ? previewManualAppraisals.filter((item) => allowedCodes.has(String((item.employee as { employeeCode?: string } | undefined)?.employeeCode))) : previewManualAppraisals);
});
previewRouter.post("/appraisals/manual", (req, res) => {
  const employeeProfile = previewSalaryEmployeesForUser(req.user).find((employee) => employee.id === req.body.employeeId) ?? previewSalaryEmployeesForUser(req.user)[0];
  if (!employeeProfile) return res.status(403).json({ message: "Managers can create appraisals only for direct-report employees." });
  const record = {
    id: `preview-manual-appraisal-${Date.now()}`,
    referenceNumber: `MAPP-${Date.now()}`,
    currentGrossSalary: employeeProfile.currentGrossSalary.toFixed(2),
    salaryDifference: (Number(req.body.newBasicSalary ?? 0) + Number(req.body.newHousingAllowance ?? 0) + Number(req.body.newTransportAllowance ?? 0) + Number(req.body.newOtherAllowance ?? 0) - employeeProfile.currentGrossSalary).toFixed(2),
    newGrossSalary: (Number(req.body.newBasicSalary ?? 0) + Number(req.body.newHousingAllowance ?? 0) + Number(req.body.newTransportAllowance ?? 0) + Number(req.body.newOtherAllowance ?? 0)).toFixed(2),
    currentApprover: req.body.status === "SUBMITTED" ? "HR Manager" : "",
    employee: { ...selfServiceEmployee, employeeCode: employeeProfile.employeeCode, firstName: employeeProfile.employeeName.split(" ")[0], lastName: employeeProfile.employeeName.split(" ").slice(1).join(" ") || "User", department: { id: "preview-dept", name: String(employeeProfile.department), code: "OPS" }, jobTitle: employeeProfile.designation, manager: managerEmployee },
    ...req.body
  };
  previewManualAppraisals.unshift(record);
  res.status(201).json(record);
});
previewRouter.patch("/appraisals/manual/:id/decision", (req, res) => {
  const index = previewManualAppraisals.findIndex((item) => item.id === req.params.id);
  const status = req.body.action === "ADMIN_FINAL_APPROVE" ? "APPLIED_TO_EMPLOYEE_SALARY" : req.body.action === "FINANCE_APPROVE" ? "PENDING_ADMIN_FINAL_APPROVAL" : req.body.action === "HR_MANAGER_APPROVE" ? "PENDING_FINANCE_APPROVAL" : req.body.action === "RETURN_FOR_CORRECTION" ? "RETURNED_FOR_CORRECTION" : req.body.action === "REJECT" ? "REJECTED" : "SUBMITTED";
  const record = { ...(previewManualAppraisals[index] ?? previewManualAppraisals[0]), id: req.params.id, status, currentApprover: status === "PENDING_FINANCE_APPROVAL" ? "Finance" : status === "PENDING_ADMIN_FINAL_APPROVAL" ? "Admin" : "" };
  if (index >= 0) previewManualAppraisals[index] = record;
  res.json(record);
});
previewRouter.get("/appraisals/manual/history/:employeeId", (_req, res) => res.json([{ id: "preview-history-1", referenceNumber: "MAPP-PREVIEW-001", effectiveDate: "2026-07-01T00:00:00.000Z", oldGrossSalary: "10800.00", increaseAmount: "540.00", increasePercentage: "5.00", newGrossSalary: "11340.00", reason: "Annual Performance Appraisal", status: "APPLIED" }]));
previewRouter.get("/appraisals/manual/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Reference,Employee ID,Employee Name,Current Salary,Increase,New Salary,Status\nMAPP-PREVIEW-001,EMP-002,Employee User,10800.00,540.00,11340.00,SUBMITTED");
});
previewRouter.get("/appraisals/manual/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "manual-appraisals.xlsx", ["Reference", "Employee ID", "Employee Name", "Current Salary", "Increase", "New Salary", "Status"], [["MAPP-PREVIEW-001", "EMP-002", "Employee User", "10800.00", "540.00", "11340.00", "SUBMITTED"]], "Manual Appraisals");
});
previewRouter.get("/appraisals/manual/:id/print", async (_req, res) => {
  const company = await getCurrentCompanyProfile();
  res.header("Content-Type", "text/html");
  res.send(`<!doctype html><html><body>${companyPrintHeader(company, "Manual Salary Appraisal Form")}<h2>MAPP-PREVIEW-001</h2><p>Employee User - New salary 11340.00</p><script>window.print()</script></body></html>`);
});
previewRouter.get("/appraisals/manual/:id/pdf", (_req, res) => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  res.header("Content-Type", "application/pdf");
  res.attachment("manual-appraisal-preview.pdf");
  doc.pipe(res);
  doc.fontSize(16).text("Manual Salary Appraisal Form");
  doc.text("MAPP-PREVIEW-001 - Employee User - New salary 11340.00");
  doc.end();
});
previewRouter.get("/appraisals/bulk/template.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Employee ID,Employee Name,Department,Current Basic Salary,Current Gross Salary,Appraisal Type,Effective Date,Appraisal Method,Appraisal Percentage,Appraisal Amount,Apply To Component,New Basic Salary,New Housing Allowance,New Transportation Allowance,New Other Allowance,New Gross Salary,Reason for Appraisal,Performance Rating,Remarks\n");
});
previewRouter.get("/appraisals/bulk/template.xlsx", async (_req, res) => {
  await xlsxTemplate(res, "bulk-appraisal-template.xlsx", ["Employee ID", "Employee Name", "Department", "Current Basic Salary", "Current Gross Salary", "Appraisal Type", "Effective Date", "Appraisal Method", "Appraisal Percentage", "Appraisal Amount", "Apply To Component", "New Basic Salary", "New Housing Allowance", "New Transportation Allowance", "New Other Allowance", "New Gross Salary", "Reason for Appraisal", "Performance Rating", "Remarks"], "Bulk Appraisal");
});
previewRouter.post("/appraisals/bulk/validate", (_req, res) => res.json({ valid: true, totalRows: 1, errors: [], preview: [] }));
previewRouter.get("/appraisals/bulk", (_req, res) => res.json(previewAppraisalBatches));
previewRouter.post("/appraisals/bulk", (req, res) => {
  const batch = { ...previewAppraisalBatches[0], id: `preview-appraisal-batch-${Date.now()}`, batchNumber: `BAPP-${Date.now()}`, uploadFileName: req.body.fileName ?? "bulk-appraisal.csv", createdAt: new Date().toISOString() };
  previewAppraisalBatches.unshift(batch);
  res.status(201).json(batch);
});
previewRouter.patch("/appraisals/bulk/:id/submit", (req, res) => res.json({ ...previewAppraisalBatches[0], id: req.params.id, status: "SUBMITTED", currentApprover: "HR Manager" }));
previewRouter.patch("/appraisals/bulk/:id/decision", (req, res) => res.json({ ...previewAppraisalBatches[0], id: req.params.id, status: req.body.action ?? "SUBMITTED" }));
previewRouter.get("/appraisals/bulk/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Batch Number,Upload File Name,Employees,Total Current Salary,Total Increase,Total New Salary,Status\nBAPP-PREVIEW-001,bulk-appraisal.csv,1,10800.00,540.00,11340.00,DRAFT");
});
previewRouter.get("/appraisals/bulk/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "bulk-appraisal-batches.xlsx", ["Batch Number", "Upload File Name", "Employees", "Total Current Salary", "Total Increase", "Total New Salary", "Status"], [["BAPP-PREVIEW-001", "bulk-appraisal.csv", 1, "10800.00", "540.00", "11340.00", "DRAFT"]], "Bulk Appraisal");
});
previewRouter.get("/appraisals", (req, res) => res.json(previewScopedModuleList(req, "appraisals", [previewAppraisal])));
previewRouter.get("/appraisals/periods", (_req, res) => res.json([{ id: "period-1", code: "2026-ANNUAL", year: 2026, status: "ACTIVE", startDate: "2026-01-01T00:00:00.000Z", endDate: "2026-12-31T00:00:00.000Z" }]));
previewRouter.post("/appraisals/periods", (req, res) => res.status(201).json({ id: `period-${Date.now()}`, ...req.body }));
previewRouter.get("/appraisals/templates", (_req, res) => res.json([{ id: "template-1", name: "Default Appraisal", active: true }]));
previewRouter.post("/appraisals/templates", (req, res) => res.status(201).json({ id: `template-${Date.now()}`, ...req.body }));
previewRouter.post("/appraisals", (req, res) => res.status(201).json({ ...previewAppraisal, id: `preview-appraisal-${Date.now()}`, referenceNumber: `APP-${Date.now()}`, ...req.body }));
previewRouter.patch("/appraisals/:id", (req, res) => res.json({ ...previewAppraisal, id: req.params.id, ...req.body, updatedAt: new Date().toISOString() }));
previewRouter.patch("/appraisals/:id/decision", (req, res) => res.json({ ...previewAppraisal, id: req.params.id, status: req.body.action === "PUBLISH" ? "PUBLISHED" : req.body.action === "RETURN_FOR_CORRECTION" ? "RETURNED_FOR_CORRECTION" : "PENDING_OM", approvalTimeline: [{ action: req.body.action, comments: req.body.comments, at: new Date().toISOString() }] }));
previewRouter.get("/appraisals/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Reference,Employee ID,Employee Name,Department,Designation,Period,Status,Final Score,Final Rating\nAPP-PREVIEW-001,EMP-002,Employee User,Operations,Operations Specialist,2026-ANNUAL,PENDING_MANAGER,3.50,Meets Expectations");
});
previewRouter.get("/appraisals/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "performance-appraisals.xlsx", ["Reference", "Employee ID", "Employee Name", "Department", "Designation", "Period", "Status", "Final Score", "Final Rating"], [["APP-PREVIEW-001", "EMP-002", "Employee User", "Operations", "Operations Specialist", "2026-ANNUAL", "PENDING_MANAGER", "3.50", "Meets Expectations"]], "Appraisals");
});
previewRouter.get("/appraisals/:id/print", async (_req, res) => {
  const company = await getCurrentCompanyProfile();
  res.header("Content-Type", "text/html");
  res.send(`<!doctype html><html><body>${companyPrintHeader(company, "Performance Appraisal")}<h2>APP-PREVIEW-001</h2><p>Employee User - Meets Expectations</p><script>window.print()</script></body></html>`);
});

const previewTicketRequest = {
  id: "preview-ticket-1",
  requestNumber: "TKT-PREVIEW-001",
  leaveRequestId: "preview-employee-leave-1",
  departureCountry: "Saudi Arabia",
  departureCity: "Riyadh",
  arrivalCountry: "Saudi Arabia",
  arrivalCity: "Jeddah",
  preferredDepartureDate: "2026-06-15T00:00:00.000Z",
  preferredReturnDate: "2026-06-17T00:00:00.000Z",
  ticketType: "RETURN",
  estimatedTicketCost: "1200.00",
  currentApprover: "Manager",
  bookingReference: "",
  status: "PENDING_MANAGER",
  employee: { ...selfServiceEmployee, department: selfServiceEmployee.department },
  leaveRequest: { id: "preview-employee-leave-1", requestNumber: "LR-PREVIEW-001", startDate: "2026-06-15T00:00:00.000Z", endDate: "2026-06-16T00:00:00.000Z", returnToWorkDate: "2026-06-17T00:00:00.000Z", status: "PENDING", type: "ANNUAL" },
  createdAt: new Date().toISOString()
};
previewRouter.get("/ticket-requests/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Ticket Request No,Leave Request No,Employee ID,Employee Name,Department,Destination,Departure Date,Return Date,Ticket Type,Estimated Cost,Status,Approver,Booking Reference\nTKT-PREVIEW-001,LR-PREVIEW-001,EMP-002,Employee User,Operations,Jeddah Saudi Arabia,2026-06-15,2026-06-17,RETURN,1200.00,PENDING_MANAGER,Manager,");
});
previewRouter.get("/ticket-requests/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "ticket-requests.xlsx", ["Ticket Request No", "Leave Request No", "Employee ID", "Employee Name", "Department", "Destination", "Departure Date", "Return Date", "Ticket Type", "Estimated Cost", "Status"], [["TKT-PREVIEW-001", "LR-PREVIEW-001", "EMP-002", "Employee User", "Operations", "Jeddah, Saudi Arabia", "2026-06-15", "2026-06-17", "RETURN", "1200.00", "PENDING_MANAGER"]], "Ticket Requests");
});
previewRouter.get("/ticket-requests", (req, res) => res.json(previewScopedModuleList(req, "ticket-requests", [previewTicketRequest])));
previewRouter.post("/ticket-requests", (req, res) => {
  const currentEmployee = previewEmployeeForUser(req.user);
  const created = { ...previewTicketRequest, id: `preview-ticket-${Date.now()}`, requestNumber: `TKT-${Date.now()}`, employeeId: currentEmployee.id, employee: currentEmployee, ...req.body };
  if (req.user?.role === "EMPLOYEE") previewStoreEmployeeModuleRecord("ticket-requests", currentEmployee.id, created);
  res.status(201).json(created);
});
previewRouter.patch("/ticket-requests/:id/decision", (req, res) => res.json({ ...previewTicketRequest, id: req.params.id, status: req.body.action === "REJECT" ? "REJECTED" : req.body.action === "RETURN_FOR_CORRECTION" ? "RETURNED_FOR_CORRECTION" : "PENDING_OM", approvalTimeline: [{ action: req.body.action, comments: req.body.comments, at: new Date().toISOString() }] }));
previewRouter.get("/ticket-requests/:id/print", async (_req, res) => {
  const company = await getCurrentCompanyProfile();
  res.header("Content-Type", "text/html");
  res.send(`<!doctype html><html><body>${companyPrintHeader(company, "Ticket Request")}<h2>TKT-PREVIEW-001</h2><p>Linked Leave LR-PREVIEW-001 - Jeddah</p><script>window.print()</script></body></html>`);
});

const previewPettyCash = {
  id: "preview-petty-1",
  requestNumber: "PC-PREVIEW-001",
  requestType: "Travel Expense",
  purpose: "Annual vacation travel support",
  businessTripReference: "",
  requestedAmount: "800.00",
  approvedAmount: "0.00",
  paidAmount: "0.00",
  settledAmount: "0.00",
  outstandingAmount: "800.00",
  requiredDate: "2026-06-10T00:00:00.000Z",
  status: "PENDING_MANAGER",
  currentApprover: "Manager",
  employee: { ...selfServiceEmployee, department: selfServiceEmployee.department },
  linkedLeaveRequest: { id: "preview-employee-leave-1", requestNumber: "LR-PREVIEW-001" },
  createdAt: new Date().toISOString()
};
previewRouter.get("/petty-cash/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Request No,Employee ID,Employee Name,Department,Request Type,Linked Reference,Requested,Approved,Paid,Settled,Outstanding,Required Date,Status,Approver\nPC-PREVIEW-001,EMP-002,Employee User,Operations,Travel Expense,LR-PREVIEW-001,800.00,0.00,0.00,0.00,800.00,2026-06-10,PENDING_MANAGER,Manager");
});
previewRouter.get("/petty-cash/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "petty-cash-requests.xlsx", ["Request No", "Employee ID", "Employee Name", "Department", "Request Type", "Linked Reference", "Requested", "Outstanding", "Status"], [["PC-PREVIEW-001", "EMP-002", "Employee User", "Operations", "Travel Expense", "LR-PREVIEW-001", "800.00", "800.00", "PENDING_MANAGER"]], "Petty Cash");
});
previewRouter.get("/petty-cash", (req, res) => res.json(previewScopedModuleList(req, "petty-cash", [previewPettyCash])));
previewRouter.post("/petty-cash", (req, res) => {
  const currentEmployee = previewEmployeeForUser(req.user);
  const created = { ...previewPettyCash, id: `preview-petty-${Date.now()}`, requestNumber: `PC-${Date.now()}`, employeeId: currentEmployee.id, employee: currentEmployee, ...req.body };
  if (req.user?.role === "EMPLOYEE") previewStoreEmployeeModuleRecord("petty-cash", currentEmployee.id, created);
  res.status(201).json(created);
});
previewRouter.patch("/petty-cash/:id/decision", (req, res) => res.json({ ...previewPettyCash, id: req.params.id, status: req.body.action === "REJECT" ? "REJECTED" : req.body.action === "PAY" ? "FINAL_APPROVED" : "PENDING_OM", approvalTimeline: [{ action: req.body.action, comments: req.body.comments, at: new Date().toISOString() }] }));
previewRouter.get("/petty-cash/:id/print", async (_req, res) => {
  const company = await getCurrentCompanyProfile();
  res.header("Content-Type", "text/html");
  res.send(`<!doctype html><html><body>${companyPrintHeader(company, "Petty Cash Request")}<h2>PC-PREVIEW-001</h2><p>Travel Expense - 800.00 SAR</p><script>window.print()</script></body></html>`);
});

const previewResignation = {
  id: "preview-resignation-1",
  requestNumber: "RES-PREVIEW-001",
  proposedLastWorkingDate: "2026-08-15T00:00:00.000Z",
  noticePeriodRequired: 30,
  noticePeriodServed: 10,
  resignationReason: "Personal reason",
  detailedRemarks: "Preview resignation request.",
  employeeContactNumber: "+966511111111",
  personalEmail: "employee.personal@example.com",
  forwardingAddress: "Riyadh, Saudi Arabia",
  employeeConfirmed: true,
  status: "PENDING_MANAGER",
  currentApprover: "Manager",
  createdAt: new Date().toISOString(),
  employee: { ...selfServiceEmployee, jobTitle: "Operations Specialist", department: selfServiceEmployee.department, manager: managerEmployee }
};
const previewClearance = [
  { id: "preview-clearance-1", clearanceNumber: "CLR-PREVIEW-001", assignedDepartment: "Manager / Department", clearanceItem: "Work handover completed", assignedOfficer: "manager@company.com", status: "PENDING", completedDate: null, employee: { ...selfServiceEmployee, department: selfServiceEmployee.department }, resignation: previewResignation },
  { id: "preview-clearance-2", clearanceNumber: "CLR-PREVIEW-002", assignedDepartment: "IT Department", clearanceItem: "Laptop, email, VPN, ERP and biometric access closed", assignedOfficer: "it@company.com", status: "PENDING", completedDate: null, employee: { ...selfServiceEmployee, department: selfServiceEmployee.department }, resignation: previewResignation },
  { id: "preview-clearance-3", clearanceNumber: "CLR-PREVIEW-003", assignedDepartment: "Finance", clearanceItem: "Loans, advances, claims and bank account verified", assignedOfficer: "finance@company.com", status: "PENDING", completedDate: null, employee: { ...selfServiceEmployee, department: selfServiceEmployee.department }, resignation: previewResignation }
];
const previewSettlement = {
  id: "preview-settlement-1",
  settlementNumber: "SET-PREVIEW-001",
  lastWorkingDate: "2026-08-15T00:00:00.000Z",
  yearsOfService: "1.50",
  basicSalary: "8000.00",
  leaveEncashment: "1200.00",
  pendingSalary: "4000.00",
  overtime: "0.00",
  bonus: "0.00",
  otherEarnings: "0.00",
  loanDeduction: "500.00",
  salaryAdvanceDeduction: "0.00",
  absenceDeduction: "0.00",
  otherDeductions: "0.00",
  endOfServiceBenefit: "6000.00",
  totalEarnings: "11200.00",
  totalDeductions: "500.00",
  netFinalSettlement: "10700.00",
  status: "PENDING_HR_APPROVAL",
  paymentDate: null,
  employee: { ...selfServiceEmployee, department: selfServiceEmployee.department },
  resignation: previewResignation
};
const resignationWithChildren = { ...previewResignation, clearanceItems: previewClearance, finalSettlement: previewSettlement };
previewRouter.get("/resignations/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Request No,Employee ID,Employee Name,Department,Designation,Last Working Date,Notice Period,Status,Approver,Request Date\nRES-PREVIEW-001,EMP-002,Employee User,Operations,Operations Specialist,2026-08-15,30,PENDING_MANAGER,Manager,2026-07-06");
});
previewRouter.get("/resignations/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "resignations.xlsx", ["Request No", "Employee ID", "Employee Name", "Department", "Designation", "Last Working Date", "Notice Period", "Status", "Approver"], [["RES-PREVIEW-001", "EMP-002", "Employee User", "Operations", "Operations Specialist", "2026-08-15", 30, "PENDING_MANAGER", "Manager"]], "Resignations");
});
previewRouter.get("/resignations/final-settlements/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "final-settlements.xlsx", ["Settlement No", "Employee ID", "Employee Name", "Last Working Date", "EOSB", "Total Earnings", "Total Deductions", "Net Settlement", "Status"], [["SET-PREVIEW-001", "EMP-002", "Employee User", "2026-08-15", "6000.00", "11200.00", "500.00", "10700.00", "PENDING_HR_APPROVAL"]], "Final Settlements");
});
previewRouter.get("/resignations/clearance", (_req, res) => res.json(previewClearance));
previewRouter.patch("/resignations/clearance/:id", (req, res) => res.json({ ...previewClearance[0], id: req.params.id, status: req.body.status ?? "COMPLETED", remarks: req.body.remarks, completedBy: req.user?.email, completedDate: new Date().toISOString() }));
previewRouter.get("/resignations", (req, res) => res.json(previewScopedModuleList(req, "resignations", [resignationWithChildren])));
previewRouter.post("/resignations", (req, res) => {
  const currentEmployee = previewEmployeeForUser(req.user);
  const created = { ...resignationWithChildren, id: `preview-resignation-${Date.now()}`, requestNumber: `RES-${Date.now()}`, employeeId: currentEmployee.id, employee: currentEmployee, ...req.body, status: "DRAFT", createdAt: new Date().toISOString() };
  if (req.user?.role === "EMPLOYEE") previewStoreEmployeeModuleRecord("resignations", currentEmployee.id, created);
  res.status(201).json(created);
});
previewRouter.patch("/resignations/:id", (req, res) => res.json({ ...resignationWithChildren, id: req.params.id, ...req.body, updatedAt: new Date().toISOString() }));
previewRouter.patch("/resignations/:id/decision", (req, res) => {
  const status = req.body.action === "REJECT" ? "REJECTED" : req.body.action === "RETURN_FOR_CORRECTION" ? "RETURNED_FOR_CORRECTION" : req.body.action === "CANCEL" ? "CANCELLED" : req.body.action === "SUBMIT" ? "PENDING_MANAGER" : "PENDING_OM";
  res.json({ ...resignationWithChildren, id: req.params.id, status, approvalTimeline: [{ action: req.body.action, comments: req.body.comments, at: new Date().toISOString() }] });
});
previewRouter.post("/resignations/:id/final-settlement", (req, res) => res.status(201).json({ ...previewSettlement, id: `preview-settlement-${Date.now()}`, settlementNumber: `SET-${Date.now()}`, resignationId: req.params.id, ...req.body }));
previewRouter.patch("/resignations/final-settlements/:id/decision", (req, res) => res.json({ ...previewSettlement, id: req.params.id, status: req.body.action === "ADMIN_APPROVE" ? "FINAL_APPROVED" : req.body.action }));
previewRouter.get("/resignations/:id/print", async (_req, res) => {
  const company = await getCurrentCompanyProfile();
  res.header("Content-Type", "text/html");
  res.send(`<!doctype html><html><body>${companyPrintHeader(company, "Resignation Acknowledgement")}<h2>RES-PREVIEW-001</h2><p>Employee User - Proposed last working date 2026-08-15</p><script>window.print()</script></body></html>`);
});
previewRouter.get("/resignations/final-settlements/:id/print", async (_req, res) => {
  const company = await getCurrentCompanyProfile();
  res.header("Content-Type", "text/html");
  res.send(`<!doctype html><html><body>${companyPrintHeader(company, "Final Settlement")}<h2>SET-PREVIEW-001</h2><p>Net final settlement: 10700.00 SAR</p><script>window.print()</script></body></html>`);
});

const previewWorkflow = {
  id: "preview-workflow-1",
  workflowCode: "WF-RESIGNATION-DEFAULT",
  workflowName: "Default Resignation Workflow",
  processType: "Resignation Request",
  company: "Current Company",
  branch: "Riyadh",
  department: "Operations",
  employeeGroup: "All Employees",
  leaveType: null,
  amountThreshold: null,
  effectiveStartDate: "2026-01-01T00:00:00.000Z",
  effectiveEndDate: null,
  status: "ACTIVE",
  description: "Employee to Manager to OM to HR Manager to Finance to Admin.",
  steps: [
    { stepNumber: 1, approverType: "Reporting Manager", required: true, approvalMode: "SEQUENTIAL", slaDays: 2 },
    { stepNumber: 2, approverType: "OM", required: true, approvalMode: "SEQUENTIAL", slaDays: 2 },
    { stepNumber: 3, approverType: "HR Manager", required: true, approvalMode: "SEQUENTIAL", slaDays: 2 },
    { stepNumber: 4, approverType: "Finance", required: true, approvalMode: "SEQUENTIAL", slaDays: 2 },
    { stepNumber: 5, approverType: "Admin", required: true, approvalMode: "SEQUENTIAL", slaDays: 2, finalApprovalStep: true }
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
previewRouter.get("/workflows/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Workflow Code,Workflow Name,Process,Company,Branch,Department,Steps,Status\nWF-RESIGNATION-DEFAULT,Default Resignation Workflow,Resignation Request,Current Company,Riyadh,Operations,5,ACTIVE");
});
previewRouter.get("/workflows/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "approval-workflows.xlsx", ["Workflow Code", "Workflow Name", "Process", "Company", "Branch", "Department", "Steps", "Status"], [["WF-RESIGNATION-DEFAULT", "Default Resignation Workflow", "Resignation Request", "Current Company", "Riyadh", "Operations", 5, "ACTIVE"]], "Approval Workflows");
});
previewRouter.get("/workflows", (_req, res) => res.json([previewWorkflow]));
previewRouter.post("/workflows", (req, res) => res.status(201).json({ ...previewWorkflow, id: `preview-workflow-${Date.now()}`, ...req.body }));
previewRouter.patch("/workflows/:id", (req, res) => res.json({ ...previewWorkflow, id: req.params.id, ...req.body, updatedAt: new Date().toISOString() }));
previewRouter.delete("/workflows/:id", (req, res) => res.json({ ...previewWorkflow, id: req.params.id, status: "INACTIVE" }));
previewRouter.post("/workflows/:id/copy", (req, res) => res.status(201).json({ ...previewWorkflow, id: `preview-workflow-${Date.now()}`, workflowCode: `${previewWorkflow.workflowCode}-COPY`, sourceId: req.params.id }));

const previewMasterDataPath = path.join(process.cwd(), ".preview", "master-data.json");
const defaultPreviewMasterData = [
  { id: "md-branch-jed", type: "BRANCH", code: "JED", name: "Jeddah", nameArabic: "", active: true, createdAt: new Date().toISOString(), metadata: { company: "Demo Company", location: "Jeddah", city: "Jeddah", country: "Saudi Arabia" } },
  { id: "md-branch-ruh", type: "BRANCH", code: "RUH", name: "Riyadh", nameArabic: "", active: true, createdAt: new Date().toISOString(), metadata: { company: "Demo Company", location: "Riyadh", city: "Riyadh", country: "Saudi Arabia" } },
  { id: "md-branch-dmm", type: "BRANCH", code: "DMM", name: "Dammam", nameArabic: "", active: true, createdAt: new Date().toISOString(), metadata: { company: "Demo Company", location: "Dammam", city: "Dammam", country: "Saudi Arabia" } },
  { id: "md-2", type: "LEAVE_TYPE", code: "ANNUAL", name: "Annual Leave", nameArabic: "", active: true, createdAt: new Date().toISOString(), metadata: { category: "Annual", paidUnpaid: "Paid", annualEntitlement: "21", accrualMethod: "Monthly", carryForwardAllowed: true, attachmentRequired: false, approvalRequired: true } },
  { id: "md-3", type: "SHIFT", code: "DAY", name: "Day Shift", nameArabic: "", active: true, createdAt: new Date().toISOString(), metadata: { startTime: "08:00", endTime: "17:00", workingHours: "8", lateGraceMinutes: "10", earlyOutGraceMinutes: "0", weeklyOffDays: "Friday, Saturday", ramadanShift: false } }
];
function readPreviewMasterData() {
  try {
    if (!fs.existsSync(previewMasterDataPath)) return [...defaultPreviewMasterData];
    const parsed = JSON.parse(fs.readFileSync(previewMasterDataPath, "utf8"));
    return Array.isArray(parsed) ? parsed : [...defaultPreviewMasterData];
  } catch {
    return [...defaultPreviewMasterData];
  }
}
function writePreviewMasterData(records: Array<Record<string, unknown>>) {
  fs.mkdirSync(path.dirname(previewMasterDataPath), { recursive: true });
  fs.writeFileSync(previewMasterDataPath, JSON.stringify(records, null, 2), "utf8");
}
const previewMasterData = readPreviewMasterData();
function previewMasterWithCurrentCompany(records: Array<Record<string, unknown>>) {
  const company = getPreviewCompanyProfile();
  return records.map((record) => {
    if (record.type !== "BRANCH") return record;
    const metadata = record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata) ? record.metadata as Record<string, unknown> : {};
    return { ...record, metadata: { ...metadata, company: company.companyName } };
  });
}
previewRouter.get("/master-data", (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const records = type ? previewMasterData.filter((record) => record.type === type) : previewMasterData;
  res.json(previewMasterWithCurrentCompany(records));
});
previewRouter.get("/master-data/template.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("type,code,name,nameArabic,active\n");
});
previewRouter.get("/master-data/template.xlsx", async (_req, res) => {
  await xlsxTemplate(res, "master-data-template.xlsx", ["type", "code", "name", "nameArabic", "active"], "Master Data");
});
previewRouter.get("/master-data/export.csv", (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const records = previewMasterWithCurrentCompany(type ? previewMasterData.filter((record) => record.type === type) : previewMasterData);
  res.header("Content-Type", "text/csv");
  res.send(["type,code,name,nameArabic,active", ...records.map((record) => `${record.type},${record.code},${record.name},${record.nameArabic ?? ""},${record.active}`)].join("\n"));
});
previewRouter.get("/master-data/export.xlsx", async (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const records = previewMasterWithCurrentCompany(type ? previewMasterData.filter((record) => record.type === type) : previewMasterData);
  await xlsxFile(res, "master-data-export.xlsx", ["type", "code", "name", "nameArabic", "active"], records.map((record) => [record.type, record.code, record.name, record.nameArabic ?? "", record.active]), "Master Data");
});
previewRouter.get("/master-data/export.pdf", (req, res) => {
  res.header("Content-Type", "application/pdf");
  res.attachment(`${String(req.query.type ?? "master-data").toLowerCase()}-export.pdf`);
  res.send(Buffer.from(`%PDF-1.1\n% ${String(req.query.type ?? "Master Data")} preview export\n`));
});
previewRouter.get("/master-data/print", (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const company = getPreviewCompanyProfile();
  const records = previewMasterWithCurrentCompany(type ? previewMasterData.filter((record) => record.type === type) : previewMasterData);
  const rows = records.map((record) => `<tr><td>${record.type}</td><td>${record.code}</td><td>${record.name}</td><td>${record.nameArabic ?? ""}</td><td>${record.active ? "ACTIVE" : "INACTIVE"}</td></tr>`).join("");
  res.header("Content-Type", "text/html");
  res.send(`<!doctype html><html><body><button onclick="window.print()">Print</button><h1>${company.companyName}</h1><table border="1"><tbody>${rows}</tbody></table></body></html>`);
});
previewRouter.post("/master-data/import", (_req, res) => res.status(201).json({ message: "Import completed successfully.", createdCount: 1, updatedCount: 0, failedCount: 0, errors: [] }));
previewRouter.post("/master-data", (req, res) => {
  const type = String(req.body.type ?? "").trim().toUpperCase();
  const code = String(req.body.code ?? "").trim() || previewGenerateNumber(`MASTER_${type}`);
  const duplicate = previewMasterData.find((record) => record.type === type && record.code === code);
  if (duplicate) return res.status(409).json({ message: "Master code must be unique for this master type." });
  const metadata = req.body.metadata && typeof req.body.metadata === "object" && !Array.isArray(req.body.metadata) ? { ...req.body.metadata } : {};
  if (type === "BRANCH") metadata.company = getPreviewCompanyProfile().companyName;
  const record = { id: `md-${Date.now()}`, createdAt: new Date().toISOString(), archivedAt: null, ...req.body, type, code, metadata };
  previewMasterData.push(record);
  writePreviewMasterData(previewMasterData);
  res.status(201).json(record);
});
previewRouter.patch("/master-data/:id", (req, res) => {
  const index = previewMasterData.findIndex((record) => record.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: "Master record not found" });
  previewMasterData[index] = { ...previewMasterData[index], ...req.body, updatedAt: new Date().toISOString() };
  writePreviewMasterData(previewMasterData);
  res.json(previewMasterData[index]);
});
previewRouter.delete("/master-data/:id", (req, res) => {
  const index = previewMasterData.findIndex((record) => record.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: "Master record not found" });
  previewMasterData[index] = { ...previewMasterData[index], active: false, archivedAt: new Date().toISOString() };
  writePreviewMasterData(previewMasterData);
  res.json(previewMasterData[index]);
});

const previewNumberSeriesPath = path.join(process.cwd(), ".preview", "number-series.json");
function readPreviewNumberSeries() {
  try {
    if (!fs.existsSync(previewNumberSeriesPath)) {
      return defaultNumberSeries.map((item) => ({ id: `series-${item.code}`, ...item, separator: item.separator ?? "-", padding: item.padding ?? 5, nextNumber: 1, startNumber: 1, resetFrequency: item.resetFrequency ?? "YEARLY", lastResetKey: String(new Date().getFullYear()), active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
    }
    const parsed = JSON.parse(fs.readFileSync(previewNumberSeriesPath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writePreviewNumberSeries(records: Array<Record<string, unknown>>) {
  fs.mkdirSync(path.dirname(previewNumberSeriesPath), { recursive: true });
  fs.writeFileSync(previewNumberSeriesPath, JSON.stringify(records, null, 2), "utf8");
}
const previewNumberSeries = readPreviewNumberSeries();
function previewApplyDateTokens(value: string) {
  const now = new Date();
  return value.replaceAll("{YYYY}", String(now.getFullYear())).replaceAll("{YY}", String(now.getFullYear()).slice(-2)).replaceAll("{MM}", String(now.getMonth() + 1).padStart(2, "0")).replaceAll("{DD}", String(now.getDate()).padStart(2, "0"));
}
function previewGenerateNumber(code: string) {
  let index = previewNumberSeries.findIndex((row) => row.code === code);
  if (index < 0) {
    const fallback = defaultNumberSeries.find((item) => item.code === code) ?? { code, name: code.replace(/_/g, " "), prefix: code, padding: 5, separator: "-", resetFrequency: "NEVER" };
    previewNumberSeries.push({ id: `series-${code}`, ...fallback, separator: fallback.separator ?? "-", padding: fallback.padding ?? 5, nextNumber: 1, startNumber: 1, resetFrequency: fallback.resetFrequency ?? "NEVER", active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    index = previewNumberSeries.length - 1;
  }
  const row = previewNumberSeries[index];
  const issued = Number(row.nextNumber ?? 1);
  previewNumberSeries[index] = { ...row, nextNumber: issued + 1, updatedAt: new Date().toISOString() };
  writePreviewNumberSeries(previewNumberSeries);
  return `${previewApplyDateTokens(String(row.prefix ?? code))}${String(row.separator ?? "-")}${String(issued).padStart(Number(row.padding ?? 5), "0")}`;
}
previewRouter.get("/number-series", (_req, res) => res.json(previewNumberSeries));
previewRouter.get("/number-series/defaults", (_req, res) => res.json(defaultNumberSeries));
previewRouter.post("/number-series/initialize-defaults", (_req, res) => {
  for (const item of defaultNumberSeries) {
    if (!previewNumberSeries.some((row) => row.code === item.code)) {
      previewNumberSeries.push({ id: `series-${item.code}`, ...item, separator: item.separator ?? "-", padding: item.padding ?? 5, nextNumber: 1, startNumber: 1, resetFrequency: item.resetFrequency ?? "YEARLY", active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
  }
  writePreviewNumberSeries(previewNumberSeries);
  res.json(previewNumberSeries);
});
previewRouter.post("/number-series", (req, res) => {
  const row = { id: `series-${Date.now()}`, active: true, nextNumber: 1, startNumber: 1, separator: "-", padding: 5, resetFrequency: "YEARLY", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...req.body };
  previewNumberSeries.push(row);
  writePreviewNumberSeries(previewNumberSeries);
  res.status(201).json(row);
});
previewRouter.patch("/number-series/:id", (req, res) => {
  const index = previewNumberSeries.findIndex((row) => row.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: "Number series not found" });
  previewNumberSeries[index] = { ...previewNumberSeries[index], ...req.body, updatedAt: new Date().toISOString() };
  writePreviewNumberSeries(previewNumberSeries);
  res.json(previewNumberSeries[index]);
});
previewRouter.delete("/number-series/:id", (req, res) => {
  const index = previewNumberSeries.findIndex((row) => row.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: "Number series not found" });
  previewNumberSeries[index] = { ...previewNumberSeries[index], active: false, archivedAt: new Date().toISOString() };
  writePreviewNumberSeries(previewNumberSeries);
  res.json(previewNumberSeries[index]);
});

previewRouter.get("/permissions", (_req, res) => res.json([
  { id: "perm-1", role: "ADMIN", module: "Employees", canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canExportExcel: true, canExportPdf: true },
  { id: "perm-2", role: "EMPLOYEE", module: "Self Service", canView: true, canAdd: true, canEdit: true, canDelete: false }
]));
previewRouter.put("/permissions", (req, res) => res.json({ id: "perm-updated", ...req.body }));

previewRouter.get("/auth/admin/portal-accounts", (_req, res) => {
  const accounts = previewEmployeeRecords().map((record) => {
    const employeeRecord = normalizePreviewEmployee(withPreviewUserStatus(record));
    const user = (employeeRecord.user as Record<string, unknown> | undefined) ?? {};
    return {
      id: String(user.id ?? `preview-user-${employeeRecord.employeeCode}`),
      email: employeeRecord.email,
      role: String(user.role ?? "EMPLOYEE"),
      portalStatus: String(user.portalStatus ?? "ACTIVE"),
      failedLoginAttempts: 0,
      lockedUntil: null,
      employee: employeeRecord
    };
  });
  res.json(accounts);
});
previewRouter.get("/auth/admin/portal-accounts/:id/history", (_req, res) => res.json({
  logins: [{ id: "login-1", username: "EMP-002", result: "SUCCESS", createdAt: new Date().toISOString(), device: "Preview Browser" }],
  resets: [{ id: "reset-1", action: "ADMIN_PASSWORD_RESET", createdAt: new Date().toISOString() }]
}));
previewRouter.post("/auth/admin/reset-password", (req, res) => res.json({ ok: true, userId: req.body.userId, portalStatus: "PASSWORD_RESET_REQUIRED" }));
previewRouter.post("/auth/admin/unlock-user", (req, res) => res.json({ ok: true, userId: req.body.userId }));
previewRouter.post("/auth/admin/portal-status", (req, res) => res.json({ id: req.body.userId, portalStatus: req.body.portalStatus }));
previewRouter.post("/auth/change-password", (req, res) => {
  const role = String(req.user?.role ?? "EMPLOYEE");
  res.json({ ok: true, redirectTo: role === "EMPLOYEE" ? "/employee/dashboard" : role === "DEPARTMENT_MANAGER" ? "/manager/dashboard" : "/dashboard" });
});

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
      totalDeduction: "0.00",
      netSalary: "10800.00",
      paymentDate: "2026-06-30T00:00:00.000Z",
      documentReference: "PAY-2026-06-EMP-002-PREVIEW"
    }
  ]
};

previewRouter.get("/payroll-uploads/template.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Employee ID,Employee Name,Department,Job Title,Payroll Period,Basic Salary,Housing Allowance,Transportation Allowance,Other Allowances,Overtime,Bonus,Commission,Leave Deduction,Unpaid Leave Deduction,Loan Deduction,Advance Deduction,Other Deduction,Gross Salary,Total Deduction,Net Salary,Bank Name,IBAN,Payment Date,Payroll Remarks\n");
});
previewRouter.get("/payroll-uploads/template.xlsx", async (_req, res) => {
  await xlsxTemplate(res, "payroll-upload-template.xlsx", ["Employee ID", "Employee Name", "Department", "Job Title", "Payroll Period", "Basic Salary", "Housing Allowance", "Transportation Allowance", "Other Allowances", "Overtime", "Bonus", "Commission", "Leave Deduction", "Unpaid Leave Deduction", "Loan Deduction", "Advance Deduction", "Other Deduction", "Gross Salary", "Total Deduction", "Net Salary", "Bank Name", "IBAN", "Payment Date", "Payroll Remarks"], "Payroll Upload");
});
previewRouter.post("/payroll-uploads/validate", (_req, res) => res.json({ valid: true, rowCount: 1, errors: [] }));
previewRouter.get("/payroll-uploads", (_req, res) => res.json([payrollUploadBatch]));
previewRouter.post("/payroll-uploads", (_req, res) => res.status(201).json(payrollUploadBatch));
previewRouter.patch("/payroll-uploads/:id/status", (req, res) => res.json({ ...payrollUploadBatch, id: req.params.id, status: req.body.status, approvalComments: req.body.comments }));
previewRouter.delete("/payroll-uploads/:id", (req, res) => res.json({ id: req.params.id, archivedAt: new Date().toISOString() }));
previewRouter.get("/payroll-uploads/:id/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Employee ID,Employee Name,Gross Salary,Total Deduction,Net Salary\nEMP-002,Employee User,10800.00,0.00,10800.00");
});
previewRouter.get("/payroll-uploads/:id/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "payroll-upload-preview.xlsx", ["Employee ID", "Employee Name", "Gross Salary", "Total Deduction", "Net Salary", "Bank Name", "IBAN"], [["EMP-002", "Employee User", "10800.00", "0.00", "10800.00", "Al Rajhi Bank", "SA0380000000608010167519"]], "Payroll");
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
    deductions: [],
    netSalary: 10800,
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
previewRouter.get("/leave-balance-uploads/template.xlsx", async (_req, res) => {
  await xlsxTemplate(res, "leave-balance-upload-template.xlsx", ["Employee ID", "Employee Name", "Department", "Leave Type", "Leave Year", "Opening Balance", "Accrued Leave", "Used Leave", "Pending Leave", "Carried Forward Balance", "Encashment Balance", "Adjustment Balance", "Final Available Balance", "Expiry Date of Carry-Forward Balance", "Remarks"], "Leave Balance");
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
previewRouter.get("/leave-balance-uploads/:id/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "leave-balance-upload-preview.xlsx", ["Employee ID", "Employee Name", "Leave Type", "Leave Year", "Final Available Balance", "Remarks"], [["EMP-002", "Employee User", "ANNUAL", 2026, "22.00", "Preview"]], "Leave Balance");
});

previewRouter.get("/employee-imports/template.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Employee Code,Employee Name English,Employee Name Arabic,First Name,Middle Name,Last Name,Nationality,Gender,Date of Birth,Marital Status,Religion,Mobile Number,Personal Email,Company Email,Address,Emergency Contact Name,Emergency Contact Number,Iqama Number,Iqama Expiry Date,National ID Number,Passport Number,Passport Expiry Date,Visa Number,Visa Expiry Date,GOSI Number,QIWA Employee Reference,Joining Date,Probation Start Date,Probation End Date,Employee Status,Employee Type,Contract Type,Contract Start Date,Contract End Date,Department,Designation,Job Grade,Branch,Location,Cost Center,Reporting Manager,Shift,Weekly Off Days,Basic Salary,Housing Allowance,Transportation Allowance,Other Allowance,Gross Salary,Bank Name,IBAN,Payment Method,User Login Email,Employee Portal Access,Document Reference,Notes,Remarks\n");
});
previewRouter.get("/employee-imports/template.xlsx", async (_req, res) => {
  await xlsxTemplate(res, "employee-import-template.xlsx", ["Employee Code", "Employee Name English", "Department", "Designation", "Joining Date", "Basic Salary"], "Employees");
});
function previewNameParts(row: UploadRow) {
  const fullName = row["Employee Name English"] || row["Employee Full Name"] || row["Name English"] || row.Name || row["Employee Code"] || "Employee";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { firstName: row["First Name"] || parts[0] || fullName, lastName: row["Last Name"] || parts.slice(1).join(" ") || "-" };
}

function previewImportedEmployeeFromRow(row: UploadRow) {
  const code = row["Employee Code"] || row["Employee ID"] || row.Code || `EMP-${Date.now()}`;
  const names = previewNameParts(row);
  const departmentName = row.Department || row["Sub Department"] || "Imported Employees";
  const status = row["Employee Status"] || row.Status || "ACTIVE";
  return {
    id: `preview-imported-${code}`,
    employeeCode: code,
    nationalId: row["National ID Number"] || row["Iqama Number"] || row["Iqama No"] || row["Iqama No."] || code,
    firstName: names.firstName,
    lastName: names.lastName,
    fullNameArabic: row["Employee Name Arabic"] || row["Employee Full Name (Arabic)"] || "",
    email: row["Personal Email"] || row["Company Email"] || row["Email ID"] || `${code}@company.local`,
    companyEmail: row["Company Email"] || row["Email ID"] || "",
    phone: row["Mobile Number"] || row["Notification Mobile No."] || "",
    jobTitle: row.Designation || row["Job Title"] || "Employee",
    status: ["CONFIRMED", "ACTIVE"].includes(status.toUpperCase()) ? "ACTIVE" : status.toUpperCase(),
    leaveBalance: 21,
    branch: row.Branch || "",
    location: row.Location || "",
    nationality: row.Nationality || "",
    gender: row.Gender || "",
    maritalStatus: row["Marital Status"] || "",
    religion: row.Religion || "",
    joiningDate: row["Joining Date"] || row["Join Date"] || "",
    basicSalary: row["Basic Salary"] || row.Basic || "0",
    housingAllowance: row["Housing Allowance"] || "0",
    transportAllowance: row["Transportation Allowance"] || row["Transport Allowance"] || "0",
    otherAllowance: row["Other Allowance"] || "0",
    bankName: row["Bank Name"] || "",
    iban: row.IBAN || row["Bank Account Number"] || "",
    department: { id: `preview-dept-${departmentName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: departmentName, code: departmentName.slice(0, 6).toUpperCase() },
    user: { id: `preview-user-${code}`, role: "EMPLOYEE", portalStatus: "ACTIVE" }
  };
}

async function previewRowsFromImportBody(body: { content?: string; contentBase64?: string; fileName?: string }) {
  const rows = await rowsFromUpload(body);
  return rows.filter((row) => row["Employee Code"] || row["Employee Full Name"] || row["Employee Name English"]);
}

previewRouter.post("/employee-imports/validate", async (req, res, next) => {
  try {
    const rows = await previewRowsFromImportBody(req.body ?? {});
    const seen = new Set<string>();
    const errors: Array<{ row: number; employeeCode?: string; column: string; reason: string }> = [];
    rows.forEach((row, index) => {
      const code = row["Employee Code"];
      if (!code) errors.push({ row: index + 2, column: "Employee Code", reason: "Employee Code is mandatory" });
      if (code && seen.has(code)) errors.push({ row: index + 2, employeeCode: code, column: "Employee Code", reason: "Duplicate employee code in file" });
      if (code) seen.add(code);
      if (!row["Employee Name English"] && !row["Employee Full Name"] && !(row["First Name"] && row["Last Name"])) errors.push({ row: index + 2, employeeCode: code, column: "Employee Name English", reason: "Employee name is mandatory" });
    });
    res.json({ valid: errors.length === 0, totalRows: rows.length, errors, preview: rows.slice(0, 20) });
  } catch (error) {
    next(error);
  }
});
previewRouter.post("/employee-imports", async (req, res, next) => {
  try {
    const rows = await previewRowsFromImportBody(req.body ?? {});
    const imported = rows.map(previewImportedEmployeeFromRow);
    imported.forEach((employeeRecord) => {
      const index = previewImportedEmployees.findIndex((existing) => existing.employeeCode === employeeRecord.employeeCode);
      if (index >= 0) previewImportedEmployees[index] = employeeRecord;
      else previewImportedEmployees.push(employeeRecord);
    });
    writePreviewImportedEmployees(previewImportedEmployees);
    res.status(201).json({
      id: `preview-import-${Date.now()}`,
      batchNumber: `EMP-IMP-PREVIEW-${Date.now()}`,
      fileName: req.body?.fileName ?? "employee-import.csv",
      mode: req.body?.mode ?? "CREATE_AND_UPDATE",
      status: "IMPORTED",
      totalRows: rows.length,
      createdCount: imported.length,
      updatedCount: 0,
      failedCount: 0,
      duplicateCount: 0,
      createdAt: new Date().toISOString(),
      rows: rows.map((row, index) => ({ id: `preview-import-row-${index + 1}`, rowNumber: index + 2, employeeCode: row["Employee Code"], status: "IMPORTED", rawData: row, errors: [] }))
    });
  } catch (error) {
    next(error);
  }
});
previewRouter.get("/employee-imports/history", (_req, res) => res.json([
  { id: "preview-import-1", batchNumber: "EMP-IMP-PREVIEW", fileName: "preview.csv", mode: "CREATE_AND_UPDATE", status: "IMPORTED", totalRows: 1, createdCount: 1, updatedCount: 0, failedCount: 0, duplicateCount: 0, createdAt: new Date().toISOString(), rows: [] }
]));
previewRouter.get("/employee-imports/exports/employees.csv", (req, res) => {
  if (blockEmployeePreviewExport(req, res)) return;
  res.header("Content-Type", "text/csv");
  res.attachment("employee-master-export.csv");
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
previewRouter.get("/groups/template.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("groupCode,groupName,groupType,description,company,branch,department,status,groupOwner\n");
});
previewRouter.get("/groups/template.xlsx", async (_req, res) => {
  await xlsxTemplate(res, "group-import-template.xlsx", ["groupCode", "groupName", "groupType", "description", "company", "branch", "department", "status", "groupOwner"], "Groups");
});
previewRouter.get("/groups/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Group Code,Group Name,Group Type,Company,Branch,Department,Status,Members\nHEAD-OFFICE,Head Office Employees,EMPLOYEE,Demo Company,Riyadh,All,ACTIVE,2");
});
previewRouter.get("/groups/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "groups.xlsx", ["Group Code", "Group Name", "Group Type", "Company", "Branch", "Department", "Status", "Members"], [["HEAD-OFFICE", "Head Office Employees", "EMPLOYEE", "Demo Company", "Riyadh", "All", "ACTIVE", 2]], "Groups");
});
previewRouter.post("/groups/import", (_req, res) => res.json({ message: "Import completed successfully.", saved: 1, errors: [] }));
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
previewRouter.get("/audit-logs/export.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.send("Created At,User ID,Module,Action,Entity ID,IP Address,Device\n2026-06-30T00:00:00Z,preview-admin,User,LOGIN,preview-admin,127.0.0.1,Preview");
});
previewRouter.get("/audit-logs/export.xlsx", async (_req, res) => {
  await xlsxFile(res, "audit-logs-export.xlsx", ["Created At", "User ID", "Module", "Action", "Entity ID", "IP Address", "Device"], [["2026-06-30T00:00:00Z", "preview-admin", "User", "LOGIN", "preview-admin", "127.0.0.1", "Preview"]], "Audit Logs");
});
