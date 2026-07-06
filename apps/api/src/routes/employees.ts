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

const updateEmployeeSchema = employeeSchema.partial().omit({ password: true, role: true });

const userRoleSchema = z.object({
  role: z.nativeEnum(Role),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  portalStatus: z.enum(["ACTIVE", "PENDING_FIRST_LOGIN", "PASSWORD_RESET_REQUIRED", "DISABLED"]).optional()
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
  const header = "employeeCode,fullName,email,nationalId,department,jobTitle,status,joiningDate";
  const rows = employees.map((employee) =>
    [
      employee.employeeCode,
      `${employee.firstName} ${employee.lastName}`,
      employee.email,
      employee.nationalId,
      employee.department.name,
      employee.jobTitle,
      employee.status,
      employee.joiningDate.toISOString().slice(0, 10)
    ].join(",")
  );
  res.header("Content-Type", "text/csv");
  res.attachment("employee-master.csv");
  res.send([header, ...rows].join("\n"));
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
        forcePasswordChange: Boolean(password)
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
    const previous = await prisma.employee.findUnique({ where: { id } });
    if (!previous) return res.status(404).json({ message: "Employee not found" });
    const employee = await prisma.employee.update({ where: { id }, data: body, include: { department: true } });
    await audit(req, "UPDATE", "Employee", id, { fields: Object.keys(body) }, previous, employee);
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
        forcePasswordChange: Boolean(body.password)
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
