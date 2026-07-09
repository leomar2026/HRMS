import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";
import { env } from "../config/env.js";
import { companyPrintHeader, getCurrentCompanyProfile } from "../utils/companyProfile.js";
import { csvFile, xlsxFile } from "../utils/uploadParsers.js";

const router = Router();

const employeeSchema = z.object({
  employeeCode: z.string().min(2),
  nationalId: z.string().min(10),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  fullNameArabic: z.string().optional(),
  nationality: z.string().optional(),
  gender: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  maritalStatus: z.string().optional(),
  religion: z.string().optional(),
  email: z.string().email(),
  companyEmail: z.string().email().optional(),
  phone: z.string().optional(),
  emergencyContact: z.string().optional(),
  address: z.string().optional(),
  passportNumber: z.string().optional(),
  iqamaExpiryDate: z.coerce.date().optional(),
  passportExpiryDate: z.coerce.date().optional(),
  visaDetails: z.string().optional(),
  visaExpiryDate: z.coerce.date().optional(),
  workPermitDetails: z.string().optional(),
  gosiNumber: z.string().optional(),
  qiwaReference: z.string().optional(),
  biometricId: z.string().optional(),
  deviceUserId: z.string().optional(),
  cardNumber: z.string().optional(),
  fingerprintEnrollmentStatus: z.string().optional(),
  faceEnrollmentStatus: z.string().optional(),
  deviceAssignment: z.string().optional(),
  biometricActive: z.coerce.boolean().default(true),
  bankName: z.string().optional(),
  iban: z.string().optional(),
  jobTitle: z.string().min(2),
  branch: z.string().optional(),
  location: z.string().optional(),
  managerId: z.string().optional(),
  employeeType: z.string().optional(),
  contractType: z.string().optional(),
  contractExpiryDate: z.coerce.date().optional(),
  probationStartDate: z.coerce.date().optional(),
  probationEndDate: z.coerce.date().optional(),
  medicalInsuranceExpiryDate: z.coerce.date().optional(),
  drivingLicenseExpiryDate: z.coerce.date().optional(),
  photoUrl: z.string().url().optional(),
  joiningDate: z.coerce.date(),
  departmentId: z.string().min(1),
  basicSalary: z.coerce.number().nonnegative(),
  housingAllowance: z.coerce.number().nonnegative().default(0),
  transportAllowance: z.coerce.number().nonnegative().default(0),
  otherAllowance: z.coerce.number().nonnegative().default(0),
  leaveBalance: z.coerce.number().int().nonnegative().default(21),
  role: z.nativeEnum(Role).default(Role.EMPLOYEE),
  password: z.string().min(8).optional()
});

const updateEmployeeSchema = employeeSchema.partial().omit({ password: true, role: true }).extend({
  changeReason: z.string().min(3).optional()
});

const userRoleSchema = z.object({
  role: z.nativeEnum(Role),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  portalStatus: z.enum(["ACTIVE", "PENDING_FIRST_LOGIN", "PASSWORD_RESET_REQUIRED", "DISABLED"]).optional()
});

const provisionPortalUsersSchema = z.object({
  role: z.nativeEnum(Role).default(Role.EMPLOYEE),
  portalStatus: z.enum(["ACTIVE", "PENDING_FIRST_LOGIN", "PASSWORD_RESET_REQUIRED", "DISABLED"]).default("PENDING_FIRST_LOGIN")
});

const documentSchema = z.object({
  documentType: z.string().min(2),
  fileName: z.string().min(2),
  fileDataUrl: z.string().min(10).optional(),
  fileUrl: z.string().min(2).optional(),
  expiryDate: z.coerce.date().optional(),
  notes: z.string().optional()
}).refine((value) => value.fileDataUrl || value.fileUrl, { message: "Document file content or URL is required" });

const profilePhotoSchema = z.object({
  fileName: z.string().min(2),
  mimeType: z.enum(["image/jpeg", "image/jpg", "image/png", "image/webp"]),
  size: z.coerce.number().int().positive().max(2 * 1024 * 1024, "Profile picture must be 2 MB or less"),
  dataUrl: z.string().startsWith("data:image/"),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "ACTIVE"]).default("ACTIVE")
});

const querySchema = z.object({
  search: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

const privilegedRoles = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.HR_MANAGER,
  Role.HR_OFFICER,
  Role.HR,
  Role.ACCOUNTANT,
  Role.PAYROLL_OFFICER,
  Role.FINANCE,
  Role.AUDITOR
];

const writeRoles = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR];

router.use(requireAuth);

function employeeWhere(query: z.infer<typeof querySchema>) {
  return {
    archivedAt: null,
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.status ? { status: query.status as never } : {}),
    ...(query.search
      ? {
          OR: [
            { employeeCode: { contains: query.search, mode: "insensitive" as const } },
            { firstName: { contains: query.search, mode: "insensitive" as const } },
            { lastName: { contains: query.search, mode: "insensitive" as const } },
            { email: { contains: query.search, mode: "insensitive" as const } },
            { nationalId: { contains: query.search, mode: "insensitive" as const } }
          ]
        }
      : {})
  };
}

async function availablePortalEmail(employee: { id: string; employeeCode: string; email: string; companyEmail?: string | null }) {
  const preferred = employee.companyEmail || employee.email || `${employee.employeeCode}@company.local`;
  const existing = await prisma.user.findUnique({ where: { email: preferred } });
  if (!existing || existing.employeeId === employee.id) return preferred;
  return `${employee.employeeCode}@company.local`.toLowerCase();
}

router.get("/", requireRoles(...privilegedRoles), async (req, res) => {
  const query = querySchema.parse(req.query);
  const where = employeeWhere(query);
  const [items, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: { department: true, manager: true, user: true },
      orderBy: { employeeCode: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    }),
    prisma.employee.count({ where })
  ]);
  res.json({ items, total, page: query.page, pageSize: query.pageSize });
});

router.get("/me", async (req, res) => {
  const employee = req.user?.employeeId
    ? await prisma.employee.findUnique({ where: { id: req.user.employeeId }, include: { department: true } })
    : null;
  res.json(employee);
});

router.get("/export.csv", requireRoles(...privilegedRoles), async (req, res) => {
  const query = querySchema.parse(req.query);
  const employees = await prisma.employee.findMany({
    where: employeeWhere(query),
    include: { department: true },
    orderBy: { employeeCode: "asc" }
  });
  const headers = ["employeeCode", "fullName", "email", "nationalId", "department", "jobTitle", "status", "joiningDate"];
  const rows = employees.map((employee) => [
    employee.employeeCode,
    `${employee.firstName} ${employee.lastName}`,
    employee.email,
    employee.nationalId,
    employee.department.name,
    employee.jobTitle,
    employee.status,
    employee.joiningDate.toISOString().slice(0, 10)
  ]);
  await audit(req, "EXPORT", "Employee", undefined, { format: "CSV", count: employees.length, filters: query });
  csvFile(res, "employee-master.csv", headers, rows);
});

router.get("/export.xlsx", requireRoles(...privilegedRoles), async (req, res) => {
  const query = querySchema.parse(req.query);
  const employees = await prisma.employee.findMany({
    where: employeeWhere(query),
    include: { department: true },
    orderBy: { employeeCode: "asc" }
  });
  const headers = ["employeeCode", "fullName", "email", "nationalId", "department", "jobTitle", "status", "joiningDate"];
  const rows = employees.map((employee) => [
    employee.employeeCode,
    `${employee.firstName} ${employee.lastName}`,
    employee.email,
    employee.nationalId,
    employee.department.name,
    employee.jobTitle,
    employee.status,
    employee.joiningDate.toISOString().slice(0, 10)
  ]);
  await audit(req, "EXPORT", "Employee", undefined, { format: "XLSX", count: employees.length, filters: query });
  await xlsxFile(res, "employee-master.xlsx", headers, rows, "Employees");
});

router.post("/portal-users/provision-missing", requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER), async (req, res, next) => {
  try {
    const body = provisionPortalUsersSchema.parse(req.body ?? {});
    const employees = await prisma.employee.findMany({
      where: { archivedAt: null, user: null },
      include: { user: true, department: true },
      orderBy: { employeeCode: "asc" }
    });
    const created: Array<{ employeeCode: string; email: string; role: Role; portalStatus: string }> = [];
    const skipped: Array<{ employeeCode: string; reason: string }> = [];

    for (const employee of employees) {
      try {
        const email = await availablePortalEmail(employee);
        await prisma.user.create({
          data: {
            email,
            employeeId: employee.id,
            role: body.role,
        portalStatus: body.portalStatus,
        passwordHash: await bcrypt.hash(crypto.randomUUID(), env.BCRYPT_ROUNDS),
        firstLoginRequired: body.portalStatus === "PENDING_FIRST_LOGIN" || body.portalStatus === "PASSWORD_RESET_REQUIRED",
        passwordResetRequired: body.portalStatus === "PASSWORD_RESET_REQUIRED",
        forcePasswordChange: body.portalStatus === "PENDING_FIRST_LOGIN" || body.portalStatus === "PASSWORD_RESET_REQUIRED"
          }
        });
        created.push({ employeeCode: employee.employeeCode, email, role: body.role, portalStatus: body.portalStatus });
      } catch (error) {
        skipped.push({ employeeCode: employee.employeeCode, reason: error instanceof Error ? error.message : "Unable to create user" });
      }
    }

    await audit(req, "BULK_PROVISION_PORTAL_USERS", "Employee", undefined, { createdCount: created.length, skippedCount: skipped.length, role: body.role, portalStatus: body.portalStatus });
    res.json({ message: `Created ${created.length} portal account(s).`, createdCount: created.length, skippedCount: skipped.length, created, skipped });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requireRoles(...privilegedRoles), async (req, res, next) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: String(req.params.id) },
      include: { department: true, manager: true, documents: true, user: true }
    });
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.json(employee);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/print", requireRoles(...privilegedRoles), async (req, res, next) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: String(req.params.id) },
      include: { department: true, manager: true }
    });
    if (!employee) return res.status(404).send("Employee not found");
    const company = await getCurrentCompanyProfile();
    res.header("Content-Type", "text/html");
    res.send(`<!doctype html>
      <html><head><title>Employee Profile ${employee.employeeCode}</title>
      <style>body{font-family:Arial;margin:32px;color:#172033}.head{border-bottom:2px solid #0f766e;padding-bottom:16px}.brand-line{display:flex;gap:16px;align-items:center}.head h1{font-size:20px;margin:0 0 6px}.head p{margin:2px 0}table{width:100%;border-collapse:collapse;margin-top:20px}td{border:1px solid #dfe4ec;padding:10px}.sig{margin-top:60px;display:flex;justify-content:space-between}</style>
      </head><body>${companyPrintHeader(company, "Employee Profile")}<p>Document: EMP-${employee.employeeCode} | Printed: ${new Date().toLocaleString()} | Printed by: ${req.user?.email}</p>
      <table>
      <tr><td>Employee Number</td><td>${employee.employeeCode}</td><td>Name</td><td>${employee.firstName} ${employee.lastName}</td></tr>
      <tr><td>Arabic Name</td><td>${employee.fullNameArabic ?? "-"}</td><td>National ID/Iqama</td><td>${employee.nationalId}</td></tr>
      <tr><td>Department</td><td>${employee.department.name}</td><td>Job Title</td><td>${employee.jobTitle}</td></tr>
      <tr><td>Mobile</td><td>${employee.phone ?? "-"}</td><td>Email</td><td>${employee.email}</td></tr>
      <tr><td>Status</td><td>${employee.status}</td><td>Joining Date</td><td>${employee.joiningDate.toISOString().slice(0, 10)}</td></tr>
      </table><div class="sig"><span>HR Signature</span><span>Employee Signature</span></div><script>window.print()</script></body></html>`);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/documents", requireRoles(...writeRoles), async (req, res, next) => {
  try {
    const employeeId = String(req.params.id);
    const body = documentSchema.parse(req.body);
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    const document = await prisma.employeeDocument.create({
      data: {
        employeeId,
        documentType: body.documentType,
        fileName: body.fileName,
        fileUrl: body.fileDataUrl ?? body.fileUrl,
        expiryDate: body.expiryDate,
        notes: body.notes
      }
    });
    await audit(req, "UPLOAD", "EmployeeDocument", document.id, { employeeCode: employee.employeeCode, documentType: body.documentType });
    res.status(201).json(document);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/documents/:documentId/download", requireRoles(...privilegedRoles), async (req, res, next) => {
  try {
    const document = await prisma.employeeDocument.findFirst({
      where: { id: String(req.params.documentId), employeeId: String(req.params.id), archivedAt: null }
    });
    if (!document) return res.status(404).json({ message: "Employee document not found" });
    await audit(req, "DOWNLOAD", "EmployeeDocument", document.id, { fileName: document.fileName });
    if (document.fileUrl?.startsWith("data:")) {
      const [meta, base64] = document.fileUrl.split(",", 2);
      const contentType = meta.match(/^data:(.*);base64$/)?.[1] ?? "application/octet-stream";
      res.header("Content-Type", contentType);
      res.attachment(document.fileName);
      return res.send(Buffer.from(base64 ?? "", "base64"));
    }
    res.json({ fileName: document.fileName, fileUrl: document.fileUrl });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireRoles(...writeRoles), async (req, res, next) => {
  try {
    const body = employeeSchema.parse(req.body);
    const { role, password, ...employeeData } = body;
    const employee = await prisma.employee.create({ data: employeeData });

    await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: await bcrypt.hash(password ?? crypto.randomUUID(), env.BCRYPT_ROUNDS),
        role,
        employeeId: employee.id,
        portalStatus: role === Role.EMPLOYEE ? "PENDING_FIRST_LOGIN" : "ACTIVE",
        firstLoginRequired: true,
        passwordResetRequired: Boolean(password),
        forcePasswordChange: true
      }
    });

    await audit(req, "CREATE", "Employee", employee.id, { employeeCode: employee.employeeCode }, undefined, employee);
    res.status(201).json(employee);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireRoles(...writeRoles), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = updateEmployeeSchema.parse(req.body);
    const { changeReason, ...employeeBody } = body;
    const overrideFields = ["managerId", "departmentId", "branch", "location", "leaveBalance", "basicSalary", "housingAllowance", "transportAllowance", "otherAllowance", "bankName", "iban", "passportNumber", "nationalId", "gosiNumber", "qiwaReference"];
    const changedOverrideFields = overrideFields.filter((field) => Object.prototype.hasOwnProperty.call(employeeBody, field));
    if (changedOverrideFields.length && !changeReason) {
      return res.status(400).json({ message: "Reason for change is required for admin override or confidential employee updates." });
    }
    const previous = await prisma.employee.findUnique({ where: { id } });
    if (!previous) return res.status(404).json({ message: "Employee not found" });
    const employee = await prisma.employee.update({ where: { id }, data: employeeBody, include: { department: true, manager: true, documents: true, user: true } });
    await audit(req, "UPDATE", "Employee", id, { fields: Object.keys(employeeBody), reason: changeReason, overrideFields: changedOverrideFields }, previous, employee);
    res.json(employee);
  } catch (error) {
    next(error);
  }
});

router.put("/:id/profile-photo", requireRoles(...writeRoles), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = profilePhotoSchema.parse(req.body);
    const previous = await prisma.employee.findUnique({ where: { id } });
    if (!previous) return res.status(404).json({ message: "Employee not found" });
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        photoUrl: body.dataUrl,
        profilePhotoPath: body.dataUrl,
        profilePhotoFileName: body.fileName,
        profilePhotoMimeType: body.mimeType,
        profilePhotoSize: body.size,
        profilePhotoUploadedBy: req.user?.id,
        profilePhotoUploadedAt: new Date(),
        profilePhotoStatus: body.status
      },
      include: { department: true, manager: true, user: true }
    });
    await audit(req, previous.profilePhotoPath ? "PROFILE_PHOTO_REPLACED" : "PROFILE_PHOTO_UPLOADED", "Employee", id, { fileName: body.fileName, status: body.status }, previous, employee);
    res.json(employee);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/profile-photo", requireRoles(...writeRoles), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const previous = await prisma.employee.findUnique({ where: { id } });
    if (!previous) return res.status(404).json({ message: "Employee not found" });
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        photoUrl: null,
        profilePhotoPath: null,
        profilePhotoFileName: null,
        profilePhotoMimeType: null,
        profilePhotoSize: null,
        profilePhotoUploadedBy: null,
        profilePhotoUploadedAt: null,
        profilePhotoStatus: "ACTIVE"
      },
      include: { department: true, manager: true, user: true }
    });
    await audit(req, "PROFILE_PHOTO_DELETED", "Employee", id, undefined, previous, employee);
    res.json(employee);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/user-role", requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = userRoleSchema.parse(req.body);
    const employee = await prisma.employee.findUnique({ where: { id }, include: { user: true } });
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    const previous = employee.user;
    const email = body.email ?? employee.email;
    const user = await prisma.user.upsert({
      where: { employeeId: id },
      update: {
        role: body.role,
        email,
        portalStatus: body.portalStatus ?? "ACTIVE",
        ...(body.password
          ? {
              passwordHash: await bcrypt.hash(body.password, env.BCRYPT_ROUNDS),
              portalStatus: "PASSWORD_RESET_REQUIRED",
              firstLoginRequired: true,
              passwordResetRequired: true,
              forcePasswordChange: true,
              passwordChangedAt: new Date()
            }
          : {})
      },
      create: {
        email,
        role: body.role,
        employeeId: id,
        portalStatus: body.portalStatus ?? (body.role === Role.EMPLOYEE ? "PENDING_FIRST_LOGIN" : "ACTIVE"),
        passwordHash: await bcrypt.hash(body.password ?? crypto.randomUUID(), env.BCRYPT_ROUNDS),
        firstLoginRequired: true,
        passwordResetRequired: Boolean(body.password),
        forcePasswordChange: true
      }
    });

    await audit(req, "ASSIGN_USER_ROLE", "Employee", id, { employeeCode: employee.employeeCode, role: body.role }, previous ?? undefined, user);
    res.json({ ...employee, user });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const previous = await prisma.employee.findUnique({ where: { id } });
    if (!previous) return res.status(404).json({ message: "Employee not found" });
    const employee = await prisma.employee.update({
      where: { id },
      data: { archivedAt: new Date(), status: "ARCHIVED" }
    });
    await audit(req, "ARCHIVE", "Employee", id, undefined, previous, employee);
    res.json(employee);
  } catch (error) {
    next(error);
  }
});

export default router;
