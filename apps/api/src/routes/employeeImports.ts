import { Prisma, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";
import { env } from "../config/env.js";
import { csvFile, csvTemplate, numberValue, rowsFromUpload, type UploadRow, xlsxTemplate } from "../utils/uploadParsers.js";

const router = Router();
const importRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR];
const salaryExportRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.PAYROLL_OFFICER, Role.ACCOUNTANT, Role.FINANCE];

const headers = [
  "Employee Code", "Employee Name English", "Employee Name Arabic", "First Name", "Middle Name", "Last Name", "Nationality", "Gender", "Date of Birth", "Marital Status", "Religion", "Mobile Number", "Personal Email", "Company Email", "Address", "Emergency Contact Name", "Emergency Contact Number",
  "Iqama Number", "Iqama Expiry Date", "National ID Number", "Passport Number", "Passport Expiry Date", "Visa Number", "Visa Expiry Date", "GOSI Number", "QIWA Employee Reference",
  "Joining Date", "Probation Start Date", "Probation End Date", "Employee Status", "Employee Type", "Contract Type", "Contract Start Date", "Contract End Date", "Department", "Designation", "Job Grade", "Branch", "Location", "Cost Center", "Reporting Manager", "Shift", "Weekly Off Days",
  "Basic Salary", "Housing Allowance", "Transportation Allowance", "Other Allowance", "Gross Salary", "Bank Name", "IBAN", "Payment Method", "User Login Email", "Employee Portal Access", "Document Reference", "Notes", "Remarks"
];

const uploadSchema = z.object({
  fileName: z.string().optional(),
  content: z.string().optional(),
  contentBase64: z.string().optional(),
  mode: z.enum(["CREATE_ONLY", "CREATE_AND_UPDATE"]).default("CREATE_ONLY"),
  saveDraft: z.boolean().default(false)
});

function validEmail(value?: string) {
  return !value || z.string().email().safeParse(value).success;
}

function validSaudiIban(value?: string) {
  return !value || /^SA\d{22}$/i.test(value.replace(/\s/g, ""));
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function mask(value?: string | null) {
  if (!value) return "";
  const compact = value.replace(/\s/g, "");
  if (compact.length <= 4) return compact;
  return `${"*".repeat(compact.length - 4)}${compact.slice(-4)}`;
}

async function validateEmployeeRows(rows: UploadRow[], mode: "CREATE_ONLY" | "CREATE_AND_UPDATE") {
  const errors: Array<{ row: number; employeeCode?: string; column: string; reason: string }> = [];
  const codes = rows.map((r) => r["Employee Code"]).filter(Boolean);
  const existing = await prisma.employee.findMany({
    where: { OR: [
      { employeeCode: { in: codes } },
      { nationalId: { in: rows.map((r) => r["National ID Number"] || r["Iqama Number"]).filter(Boolean) } },
      { passportNumber: { in: rows.map((r) => r["Passport Number"]).filter(Boolean) } },
      { companyEmail: { in: rows.map((r) => r["Company Email"]).filter(Boolean) } },
      { gosiNumber: { in: rows.map((r) => r["GOSI Number"]).filter(Boolean) } }
    ] }
  });
  const byCode = new Map(existing.map((e) => [e.employeeCode, e]));
  const seen = new Set<string>();
  const departments = await prisma.department.findMany();
  const departmentNames = new Set(departments.map((d) => d.name.toLowerCase()));

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const employeeCode = row["Employee Code"];
    if (!employeeCode) errors.push({ row: rowNumber, column: "Employee Code", reason: "Employee Code is mandatory" });
    if (employeeCode && seen.has(employeeCode)) errors.push({ row: rowNumber, employeeCode, column: "Employee Code", reason: "Duplicate employee code in file" });
    if (employeeCode) seen.add(employeeCode);
    if (!row["Employee Name English"] && !(row["First Name"] && row["Last Name"])) errors.push({ row: rowNumber, employeeCode, column: "Employee Name English", reason: "Employee name is mandatory" });
    if (employeeCode && byCode.has(employeeCode) && mode === "CREATE_ONLY") errors.push({ row: rowNumber, employeeCode, column: "Employee Code", reason: "Employee already exists; use update mode to update" });
    if (row.Department && !departmentNames.has(row.Department.toLowerCase())) errors.push({ row: rowNumber, employeeCode, column: "Department", reason: "Department does not exist in master data" });
    if (!validEmail(row["Personal Email"])) errors.push({ row: rowNumber, employeeCode, column: "Personal Email", reason: "Invalid email" });
    if (!validEmail(row["Company Email"])) errors.push({ row: rowNumber, employeeCode, column: "Company Email", reason: "Invalid email" });
    if (!validSaudiIban(row.IBAN)) errors.push({ row: rowNumber, employeeCode, column: "IBAN", reason: "Invalid Saudi IBAN" });
    for (const salaryField of ["Basic Salary", "Housing Allowance", "Transportation Allowance", "Other Allowance", "Gross Salary"]) {
      if (row[salaryField] && numberValue(row[salaryField]) < 0) errors.push({ row: rowNumber, employeeCode, column: salaryField, reason: "Salary cannot be negative" });
    }
    const contractStart = parseDate(row["Contract Start Date"]);
    const contractEnd = parseDate(row["Contract End Date"]);
    const joining = parseDate(row["Joining Date"]);
    if (contractStart && joining && joining > contractStart) errors.push({ row: rowNumber, employeeCode, column: "Joining Date", reason: "Joining date cannot be later than contract start date" });
    if (contractStart && contractEnd && contractEnd < contractStart) errors.push({ row: rowNumber, employeeCode, column: "Contract End Date", reason: "Contract end date cannot be earlier than contract start date" });
  });

  return { errors, byCode, departments };
}

function rowToEmployeeData(row: UploadRow, departmentId: string) {
  const names = (row["Employee Name English"] || "").split(" ");
  return {
    employeeCode: row["Employee Code"],
    nationalId: row["National ID Number"] || row["Iqama Number"] || row["Employee Code"],
    firstName: row["First Name"] || names[0] || row["Employee Code"],
    lastName: row["Last Name"] || names.slice(1).join(" ") || "-",
    fullNameArabic: row["Employee Name Arabic"] || undefined,
    nationality: row.Nationality || undefined,
    gender: row.Gender || undefined,
    dateOfBirth: parseDate(row["Date of Birth"]),
    maritalStatus: row["Marital Status"] || undefined,
    religion: row.Religion || undefined,
    email: row["Personal Email"] || row["Company Email"] || `${row["Employee Code"]}@company.local`,
    companyEmail: row["Company Email"] || undefined,
    phone: row["Mobile Number"] || undefined,
    emergencyContact: [row["Emergency Contact Name"], row["Emergency Contact Number"]].filter(Boolean).join(" / ") || undefined,
    address: row.Address || undefined,
    passportNumber: row["Passport Number"] || undefined,
    iqamaExpiryDate: parseDate(row["Iqama Expiry Date"]),
    passportExpiryDate: parseDate(row["Passport Expiry Date"]),
    visaDetails: row["Visa Number"] || undefined,
    visaExpiryDate: parseDate(row["Visa Expiry Date"]),
    gosiNumber: row["GOSI Number"] || undefined,
    qiwaReference: row["QIWA Employee Reference"] || undefined,
    bankName: row["Bank Name"] || undefined,
    iban: row.IBAN || undefined,
    jobTitle: row.Designation || "Employee",
    branch: row.Branch || undefined,
    location: row.Location || undefined,
    employeeType: row["Employee Type"] || undefined,
    contractType: row["Contract Type"] || undefined,
    contractExpiryDate: parseDate(row["Contract End Date"]),
    probationStartDate: parseDate(row["Probation Start Date"]),
    probationEndDate: parseDate(row["Probation End Date"]),
    joiningDate: parseDate(row["Joining Date"]) ?? new Date(),
    basicSalary: numberValue(row["Basic Salary"]),
    housingAllowance: numberValue(row["Housing Allowance"]),
    transportAllowance: numberValue(row["Transportation Allowance"]),
    otherAllowance: numberValue(row["Other Allowance"]),
    departmentId
  };
}

async function availablePortalEmail(employee: { id: string; employeeCode: string; email: string; companyEmail?: string | null }, loginEmail?: string) {
  const preferred = loginEmail || employee.companyEmail || employee.email || `${employee.employeeCode}@company.local`;
  const existing = await prisma.user.findUnique({ where: { email: preferred } });
  if (!existing || existing.employeeId === employee.id) return preferred;
  return `${employee.employeeCode}@company.local`.toLowerCase();
}

async function ensureEmployeePortalUser(employee: { id: string; employeeCode: string; email: string; companyEmail?: string | null }, row: UploadRow) {
  const portalAccess = String(row["Employee Portal Access"] || "YES").trim().toUpperCase();
  const portalStatus = portalAccess === "NO" || portalAccess === "DISABLED" ? "DISABLED" : "PENDING_FIRST_LOGIN";
  const role = Role.EMPLOYEE;
  const email = await availablePortalEmail(employee, row["User Login Email"]);
  return prisma.user.upsert({
    where: { employeeId: employee.id },
    update: {
      email,
      role,
      portalStatus,
      firstLoginRequired: portalStatus === "PENDING_FIRST_LOGIN",
      passwordResetRequired: false,
      forcePasswordChange: portalStatus === "PENDING_FIRST_LOGIN"
    },
    create: {
      email,
      employeeId: employee.id,
      role,
      portalStatus,
      passwordHash: await bcrypt.hash(crypto.randomUUID(), env.BCRYPT_ROUNDS),
      firstLoginRequired: portalStatus === "PENDING_FIRST_LOGIN",
      passwordResetRequired: false,
      forcePasswordChange: portalStatus === "PENDING_FIRST_LOGIN"
    }
  });
}

router.use(requireAuth);

router.get("/template.csv", requireRoles(...importRoles), (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.attachment("employee-import-template.csv");
  res.send(csvTemplate(headers));
});

router.get("/template.xlsx", requireRoles(...importRoles), async (_req, res) => {
  await xlsxTemplate(res, "employee-import-template.xlsx", headers, "Employees");
});

router.post("/validate", requireRoles(...importRoles), async (req, res, next) => {
  try {
    const body = uploadSchema.parse(req.body);
    const rows = await rowsFromUpload(body);
    const validation = await validateEmployeeRows(rows, body.mode);
    res.json({ valid: validation.errors.length === 0, totalRows: rows.length, errors: validation.errors, preview: rows.slice(0, 20) });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireRoles(...importRoles), async (req, res, next) => {
  try {
    const body = uploadSchema.parse(req.body);
    const rows = await rowsFromUpload(body);
    const validation = await validateEmployeeRows(rows, body.mode);
    const batch = await prisma.employeeImportBatch.create({
      data: {
        batchNumber: `EMP-IMP-${Date.now()}`,
        fileName: body.fileName,
        mode: body.mode,
        status: body.saveDraft ? "DRAFT" : validation.errors.length ? "FAILED" : "VALIDATED",
        totalRows: rows.length,
        failedCount: validation.errors.length,
        validationErrors: validation.errors as Prisma.InputJsonValue,
        originalFileContent: body.content,
        uploadedBy: req.user?.id
      }
    });

    for (const [index, row] of rows.entries()) {
      const rowErrors = validation.errors.filter((error) => error.row === index + 2);
      await prisma.employeeImportRow.create({
        data: {
          batchId: batch.id,
          rowNumber: index + 2,
          employeeCode: row["Employee Code"],
          status: rowErrors.length ? "FAILED" : "VALIDATED",
          rawData: row as Prisma.InputJsonValue,
          errors: rowErrors as Prisma.InputJsonValue
        }
      });
    }

    if (body.saveDraft || validation.errors.length) {
      await audit(req, "EMPLOYEE_IMPORT_DRAFT", "EmployeeImportBatch", batch.id, { fileName: body.fileName, totalRows: rows.length, failedRows: validation.errors.length });
      return res.status(201).json(await prisma.employeeImportBatch.findUnique({ where: { id: batch.id }, include: { rows: true } }));
    }

    let createdCount = 0;
    let updatedCount = 0;
    const departmentFallback = await prisma.department.findFirst();
    for (const row of rows) {
      const department = validation.departments.find((d) => d.name.toLowerCase() === (row.Department || "").toLowerCase()) ?? departmentFallback;
      if (!department) continue;
      const data = rowToEmployeeData(row, department.id);
      const existing = validation.byCode.get(row["Employee Code"]);
      if (existing && body.mode === "CREATE_AND_UPDATE") {
        const updated = await prisma.employee.update({ where: { id: existing.id }, data });
        await ensureEmployeePortalUser(updated, row);
        updatedCount += 1;
        await audit(req, "EMPLOYEE_IMPORT_UPDATE", "Employee", updated.id, { batchNumber: batch.batchNumber }, existing, updated);
      } else if (!existing) {
        const created = await prisma.employee.create({ data });
        await ensureEmployeePortalUser(created, row);
        createdCount += 1;
        await audit(req, "EMPLOYEE_IMPORT_CREATE", "Employee", created.id, { batchNumber: batch.batchNumber }, undefined, created);
      }
    }

    const finalBatch = await prisma.employeeImportBatch.update({
      where: { id: batch.id },
      data: { status: "IMPORTED", createdCount, updatedCount, importedAt: new Date() },
      include: { rows: true }
    });
    await audit(req, "EMPLOYEE_IMPORT_COMPLETE", "EmployeeImportBatch", batch.id, { createdCount, updatedCount, failedCount: validation.errors.length });
    res.status(201).json(finalBatch);
  } catch (error) {
    next(error);
  }
});

router.get("/history", requireRoles(...importRoles, Role.AUDITOR), async (_req, res) => {
  const batches = await prisma.employeeImportBatch.findMany({ include: { rows: true }, orderBy: { createdAt: "desc" }, take: 100 });
  res.json(batches);
});

router.get("/exports/employees.csv", requireRoles(...importRoles, Role.AUDITOR, Role.PAYROLL_OFFICER, Role.FINANCE), async (req, res) => {
  const canSeeSalary = salaryExportRoles.includes(req.user!.role);
  const employees = await prisma.employee.findMany({ where: { archivedAt: null }, include: { department: true, manager: true }, orderBy: { employeeCode: "asc" } });
  const baseHeaders = ["Employee Code", "Name English", "Name Arabic", "Department", "Designation", "Branch", "Joining Date", "Status", "Mobile", "Company Email", "Nationality", "National ID", "Passport Number", "GOSI Number", "QIWA Reference", "IBAN"];
  const salaryHeaders = ["Basic Salary", "Housing Allowance", "Transportation Allowance", "Other Allowance", "Gross Salary", "Bank Name"];
  const exportHeaders = canSeeSalary ? [...baseHeaders, ...salaryHeaders] : baseHeaders;
  const rows = employees.map((e) => {
    const gross = Number(e.basicSalary) + Number(e.housingAllowance) + Number(e.transportAllowance) + Number(e.otherAllowance);
    const base = [e.employeeCode, `${e.firstName} ${e.lastName}`, e.fullNameArabic ?? "", e.department.name, e.jobTitle, e.branch ?? "", e.joiningDate.toISOString().slice(0, 10), e.status, e.phone ?? "", e.companyEmail ?? e.email, e.nationality ?? "", canSeeSalary ? e.nationalId : mask(e.nationalId), canSeeSalary ? e.passportNumber ?? "" : mask(e.passportNumber), canSeeSalary ? e.gosiNumber ?? "" : mask(e.gosiNumber), e.qiwaReference ?? "", canSeeSalary ? e.iban ?? "" : mask(e.iban)];
    return canSeeSalary ? [...base, e.basicSalary, e.housingAllowance, e.transportAllowance, e.otherAllowance, gross.toFixed(2), e.bankName ?? ""] : base;
  });
  await audit(req, "EMPLOYEE_EXPORT", "Employee", undefined, { format: "CSV", count: employees.length, confidential: canSeeSalary });
  csvFile(res, "employee-master-export.csv", exportHeaders, rows);
});

export default router;
