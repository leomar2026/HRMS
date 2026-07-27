import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";
import { csvFile, csvTemplate, rowsFromUpload, xlsxFile, xlsxTemplate } from "../utils/uploadParsers.js";

const router = Router();
const optionalText = z.preprocess((value) => String(value ?? "").trim() || undefined, z.string().optional());
const optionalDate = z.preprocess((value) => String(value ?? "").trim() || undefined, z.coerce.date().optional());
const schema = z.object({
  name: z.string().min(2),
  nameArabic: optionalText,
  code: z.string().min(2).max(20),
  company: optionalText,
  branch: optionalText,
  parentDepartmentId: optionalText,
  departmentHeadId: optionalText,
  defaultReportingManagerId: optionalText,
  omId: optionalText,
  hrManagerId: optionalText,
  costCenter: optionalText,
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  remarks: optionalText
});
const reportingSetupBaseSchema = z.object({
  company: optionalText,
  branch: optionalText,
  departmentId: z.string().min(1),
  departmentHeadId: optionalText,
  reportingManagerId: optionalText,
  omId: optionalText,
  hrManagerId: optionalText,
  backupManagerId: optionalText,
  effectiveStartDate: z.coerce.date(),
  effectiveEndDate: optionalDate,
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  defaultReportingManager: z.coerce.boolean().default(true),
  remarks: optionalText
});
const reportingSetupSchema = reportingSetupBaseSchema.refine((value) => value.reportingManagerId || value.departmentHeadId, { message: "Reporting Manager or Department Head is required." });
const bulkAssignSchema = z.object({
  setupId: z.string().min(1),
  departmentId: z.string().min(1),
  branch: z.string().optional(),
  preview: z.coerce.boolean().default(false),
  reason: optionalText
});
const writeRoles = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR];
const headers = ["code", "name", "nameArabic", "company", "branch", "parentDepartmentCode", "departmentHeadEmployeeId", "defaultReportingManagerEmployeeId", "omEmployeeId", "hrManagerEmployeeId", "costCenter", "status", "remarks"];
const reportingHeaders = ["companyCode", "branchCode", "departmentCode", "departmentHeadEmployeeId", "reportingManagerEmployeeId", "omEmployeeId", "hrManagerEmployeeId", "effectiveStartDate", "effectiveEndDate", "status", "remarks"];
const employeeSelect = { id: true, employeeCode: true, firstName: true, lastName: true, jobTitle: true, status: true, isActive: true };
const setupInclude = {
  department: true,
  departmentHead: { select: employeeSelect },
  reportingManager: { select: employeeSelect },
  operationsManager: { select: employeeSelect },
  hrManager: { select: employeeSelect },
  backupManager: { select: employeeSelect }
};

router.use(requireAuth);

const departmentInclude = {
  _count: { select: { employees: true } },
  parentDepartment: true,
  departmentHead: { select: employeeSelect },
  defaultReportingManager: { select: employeeSelect },
  operationsManager: { select: employeeSelect },
  hrManager: { select: employeeSelect }
};

router.get("/", async (_req, res) => {
  const departments = await prisma.department.findMany({ include: departmentInclude, orderBy: { name: "asc" } });
  res.json(departments);
});

async function activeSetupForDepartment(departmentId: string, branch?: string) {
  const today = new Date();
  const setup = await prisma.departmentReportingSetup.findFirst({
    where: {
      departmentId,
      status: "ACTIVE",
      AND: [
        { effectiveStartDate: { lte: today } },
        { OR: [{ effectiveEndDate: null }, { effectiveEndDate: { gte: today } }] },
        ...(branch ? [{ OR: [{ branch }, { branch: null }, { branch: "" }] }] : [])
      ]
    },
    include: setupInclude,
    orderBy: [{ branch: "desc" }, { effectiveStartDate: "desc" }]
  });
  if (setup) return setup;
  const department = await prisma.department.findUnique({ where: { id: departmentId }, include: departmentInclude });
  if (!department?.defaultReportingManagerId && !department?.departmentHeadId) return null;
  return {
    id: `department-default-${department.id}`,
    company: department.company,
    branch: department.branch,
    departmentId: department.id,
    department,
    departmentHeadId: department.departmentHeadId,
    reportingManagerId: department.defaultReportingManagerId,
    omId: department.omId,
    hrManagerId: department.hrManagerId,
    backupManagerId: null,
    departmentHead: department.departmentHead,
    reportingManager: department.defaultReportingManager,
    operationsManager: department.operationsManager,
    hrManager: department.hrManager,
    backupManager: null,
    effectiveStartDate: department.createdAt,
    effectiveEndDate: null,
    status: department.status,
    defaultReportingManager: true,
    remarks: department.remarks,
    createdAt: department.createdAt,
    updatedAt: department.updatedAt
  };
}

async function validateEmployeeIds(ids: Array<string | undefined>, currentEmployeeId?: string) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean))) as string[];
  if (!uniqueIds.length) return;
  if (currentEmployeeId && uniqueIds.includes(currentEmployeeId)) throw new Error("Employee cannot report to themselves.");
  const employees = await prisma.employee.findMany({ where: { id: { in: uniqueIds }, archivedAt: null, isActive: true }, select: { id: true } });
  const activeIds = new Set(employees.map((employee) => employee.id));
  const missing = uniqueIds.filter((id) => !activeIds.has(id));
  if (missing.length) throw new Error("Selected reporting employee is not active or does not exist.");
}

router.get("/reporting-setups", requireRoles(...writeRoles, Role.AUDITOR), async (_req, res) => {
  const setups = await prisma.departmentReportingSetup.findMany({ include: setupInclude, orderBy: [{ status: "asc" }, { effectiveStartDate: "desc" }] });
  res.json(setups);
});

router.get("/reporting-setups/export.csv", requireRoles(...writeRoles, Role.AUDITOR), async (req, res) => {
  const setups = await prisma.departmentReportingSetup.findMany({ include: setupInclude, orderBy: [{ department: { code: "asc" } }, { effectiveStartDate: "desc" }] });
  await audit(req, "EXPORT", "DepartmentReportingSetup", undefined, { format: "CSV", count: setups.length });
  csvFile(res, "department-reporting-setup.csv", ["company", "branch", "departmentCode", "department", "departmentHead", "reportingManager", "om", "hrManager", "backupManager", "effectiveStartDate", "effectiveEndDate", "status", "remarks"], setups.map((setup) => [setup.company ?? "", setup.branch ?? "", setup.department.code, setup.department.name, setup.departmentHead?.employeeCode ?? "", setup.reportingManager?.employeeCode ?? "", setup.operationsManager?.employeeCode ?? "", setup.hrManager?.employeeCode ?? "", setup.backupManager?.employeeCode ?? "", setup.effectiveStartDate.toISOString().slice(0, 10), setup.effectiveEndDate?.toISOString().slice(0, 10) ?? "", setup.status, setup.remarks ?? ""]));
});

router.get("/reporting-setups/export.xlsx", requireRoles(...writeRoles, Role.AUDITOR), async (req, res) => {
  const setups = await prisma.departmentReportingSetup.findMany({ include: setupInclude, orderBy: [{ department: { code: "asc" } }, { effectiveStartDate: "desc" }] });
  await audit(req, "EXPORT", "DepartmentReportingSetup", undefined, { format: "XLSX", count: setups.length });
  await xlsxFile(res, "department-reporting-setup.xlsx", ["company", "branch", "departmentCode", "department", "departmentHead", "reportingManager", "om", "hrManager", "backupManager", "effectiveStartDate", "effectiveEndDate", "status", "remarks"], setups.map((setup) => [setup.company ?? "", setup.branch ?? "", setup.department.code, setup.department.name, setup.departmentHead?.employeeCode ?? "", setup.reportingManager?.employeeCode ?? "", setup.operationsManager?.employeeCode ?? "", setup.hrManager?.employeeCode ?? "", setup.backupManager?.employeeCode ?? "", setup.effectiveStartDate.toISOString().slice(0, 10), setup.effectiveEndDate?.toISOString().slice(0, 10) ?? "", setup.status, setup.remarks ?? ""]), "Reporting Setup");
});

router.get("/reporting-tree", requireRoles(...writeRoles, Role.AUDITOR), async (_req, res) => {
  const departments = await prisma.department.findMany({
    include: {
      reportingSetups: { where: { status: "ACTIVE" }, include: setupInclude, orderBy: { effectiveStartDate: "desc" }, take: 1 },
      employees: { where: { archivedAt: null, isActive: true }, select: { ...employeeSelect, managerId: true }, orderBy: { employeeCode: "asc" } }
    },
    orderBy: { name: "asc" }
  });
  res.json(departments);
});

router.get("/:id/reporting-setup/active", requireRoles(...writeRoles, Role.EMPLOYEE, Role.DEPARTMENT_MANAGER, Role.OPERATIONS_MANAGER, Role.AUDITOR), async (req, res) => {
  const setup = await activeSetupForDepartment(String(req.params.id), String(req.query.branch ?? ""));
  if (!setup) return res.status(404).json({ message: "No reporting setup found for this department." });
  res.json(setup);
});

router.post("/reporting-setups", requireRoles(...writeRoles), async (req, res, next) => {
  try {
    const data = reportingSetupSchema.parse(req.body);
    await validateEmployeeIds([data.departmentHeadId, data.reportingManagerId, data.omId, data.hrManagerId, data.backupManagerId]);
    const setup = await prisma.departmentReportingSetup.create({
      data: { ...data, createdBy: req.user?.id, updatedBy: req.user?.id },
      include: setupInclude
    });
    await audit(req, "CREATE", "DepartmentReportingSetup", setup.id, { departmentId: setup.departmentId, reportingManagerId: setup.reportingManagerId });
    res.status(201).json(setup);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Selected reporting employee")) return res.status(400).json({ message: error.message });
    next(error);
  }
});

async function activeEmployeeByCode(employeeCode: unknown) {
  const code = String(employeeCode ?? "").trim();
  if (!code) return null;
  return prisma.employee.findFirst({ where: { employeeCode: code, archivedAt: null, isActive: true }, select: { id: true, employeeCode: true } });
}

router.post("/reporting-setups/import", requireRoles(...writeRoles), async (req, res, next) => {
  try {
    const rows = await rowsFromUpload(req.body);
    if (!rows.length) return res.status(400).json({ message: "No valid records found to import." });
    const missing = reportingHeaders.filter((header) => !(header in rows[0]));
    if (missing.length) return res.status(400).json({ message: "Template columns do not match required format.", errors: missing });
    let createdCount = 0;
    let updatedCount = 0;
    const errors: Array<{ row: number; message: string }> = [];
    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const department = await prisma.department.findUnique({ where: { code: String(row.departmentCode ?? "").trim() } });
      const departmentHead = await activeEmployeeByCode(row.departmentHeadEmployeeId);
      const reportingManager = await activeEmployeeByCode(row.reportingManagerEmployeeId);
      const om = await activeEmployeeByCode(row.omEmployeeId);
      const hrManager = await activeEmployeeByCode(row.hrManagerEmployeeId);
      if (!department) {
        errors.push({ row: rowNumber, message: "Department does not exist." });
        continue;
      }
      if (row.departmentHeadEmployeeId && !departmentHead) errors.push({ row: rowNumber, message: "Department Head employee ID is invalid or inactive." });
      if (row.reportingManagerEmployeeId && !reportingManager) errors.push({ row: rowNumber, message: "Reporting Manager employee ID is invalid or inactive." });
      if (row.omEmployeeId && !om) errors.push({ row: rowNumber, message: "OM employee ID is invalid or inactive." });
      if (row.hrManagerEmployeeId && !hrManager) errors.push({ row: rowNumber, message: "HR Manager employee ID is invalid or inactive." });
      if (!departmentHead && !reportingManager) {
        errors.push({ row: rowNumber, message: "Reporting Manager or Department Head is required." });
        continue;
      }
      if (errors.some((error) => error.row === rowNumber)) continue;
      const parsed = reportingSetupSchema.safeParse({
        company: row.companyCode,
        branch: row.branchCode,
        departmentId: department.id,
        departmentHeadId: departmentHead?.id,
        reportingManagerId: reportingManager?.id,
        omId: om?.id,
        hrManagerId: hrManager?.id,
        effectiveStartDate: row.effectiveStartDate,
        effectiveEndDate: row.effectiveEndDate,
        status: String(row.status ?? "ACTIVE").toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        remarks: row.remarks
      });
      if (!parsed.success) {
        errors.push({ row: rowNumber, message: parsed.error.issues.map((issue) => issue.message).join("; ") });
        continue;
      }
      const existing = await prisma.departmentReportingSetup.findFirst({ where: { departmentId: department.id, branch: parsed.data.branch ?? "", effectiveStartDate: parsed.data.effectiveStartDate } });
      if (existing) {
        await prisma.departmentReportingSetup.update({ where: { id: existing.id }, data: { ...parsed.data, updatedBy: req.user?.id } });
        updatedCount += 1;
      } else {
        await prisma.departmentReportingSetup.create({ data: { ...parsed.data, createdBy: req.user?.id, updatedBy: req.user?.id } });
        createdCount += 1;
      }
    }
    await audit(req, "IMPORT", "DepartmentReportingSetup", undefined, { createdCount, updatedCount, failedCount: errors.length });
    res.status(errors.length ? 207 : 201).json({ message: errors.length ? "Import completed with errors. Download error report." : "Import completed successfully.", createdCount, updatedCount, failedCount: errors.length, errors });
  } catch (error) {
    next(error);
  }
});

router.patch("/reporting-setups/:id", requireRoles(...writeRoles), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const data = reportingSetupBaseSchema.partial().parse(req.body);
    const previous = await prisma.departmentReportingSetup.findUnique({ where: { id } });
    if (!previous) return res.status(404).json({ message: "Department reporting setup not found." });
    await validateEmployeeIds([data.departmentHeadId, data.reportingManagerId, data.omId, data.hrManagerId, data.backupManagerId]);
    const setup = await prisma.departmentReportingSetup.update({
      where: { id },
      data: { ...data, updatedBy: req.user?.id },
      include: setupInclude
    });
    await audit(req, "UPDATE", "DepartmentReportingSetup", id, { fields: Object.keys(data) }, previous, setup);
    res.json(setup);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Selected reporting employee")) return res.status(400).json({ message: error.message });
    next(error);
  }
});

router.post("/reporting-setups/bulk-assign", requireRoles(...writeRoles), async (req, res, next) => {
  try {
    const body = bulkAssignSchema.parse(req.body);
    const setup = await prisma.departmentReportingSetup.findUnique({ where: { id: body.setupId } });
    if (!setup) return res.status(404).json({ message: "Department reporting setup not found." });
    if (setup.departmentId !== body.departmentId) return res.status(400).json({ message: "Setup does not belong to the selected department." });
    const employees = await prisma.employee.findMany({
      where: { departmentId: body.departmentId, archivedAt: null, isActive: true, ...(body.branch ? { branch: body.branch } : {}) },
      select: { id: true, employeeCode: true }
    });
    const approverIds = [setup.departmentHeadId, setup.reportingManagerId, setup.omId, setup.hrManagerId, setup.backupManagerId].filter(Boolean);
    const targetEmployees = employees.filter((employee) => !approverIds.includes(employee.id));
    if (body.preview) {
      return res.json({ message: "Bulk reporting preview ready.", count: targetEmployees.length, employees: targetEmployees });
    }
    if (!body.reason) return res.status(400).json({ message: "Reason is required for bulk reporting update." });
    await prisma.employee.updateMany({
      where: { id: { in: targetEmployees.map((employee) => employee.id) } },
      data: {
        managerId: setup.reportingManagerId ?? setup.departmentHeadId ?? null,
        departmentHeadId: setup.departmentHeadId ?? null,
        omId: setup.omId ?? null,
        hrManagerId: setup.hrManagerId ?? null,
        alternateManagerId: setup.backupManagerId ?? null
      }
    });
    await audit(req, "BULK_ASSIGN", "DepartmentReportingSetup", setup.id, { departmentId: body.departmentId, branch: body.branch, count: targetEmployees.length, reason: body.reason });
    res.json({ message: "Department reporting setup applied.", count: targetEmployees.length });
  } catch (error) {
    next(error);
  }
});

router.get("/template.csv", requireRoles(...writeRoles), (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.attachment("department-template.csv");
  res.send(csvTemplate(headers));
});

router.get("/template.xlsx", requireRoles(...writeRoles), async (_req, res) => {
  await xlsxTemplate(res, "department-template.xlsx", headers, "Departments");
});

router.get("/reporting-setups/template.csv", requireRoles(...writeRoles), (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.attachment("department-reporting-template.csv");
  res.send(csvTemplate(reportingHeaders));
});

router.get("/reporting-setups/template.xlsx", requireRoles(...writeRoles), async (_req, res) => {
  await xlsxTemplate(res, "department-reporting-template.xlsx", reportingHeaders, "Reporting Setup");
});

router.get("/export.csv", requireRoles(...writeRoles, Role.AUDITOR), async (req, res) => {
  const departments = await prisma.department.findMany({ include: departmentInclude, orderBy: { code: "asc" } });
  await audit(req, "EXPORT", "Department", undefined, { format: "CSV", count: departments.length });
  csvFile(res, "departments-export.csv", ["code", "name", "nameArabic", "company", "branch", "parentDepartment", "departmentHead", "defaultReportingManager", "om", "hrManager", "costCenter", "status", "employeeCount", "remarks"], departments.map((department) => [department.code, department.name, department.nameArabic ?? "", department.company ?? "", department.branch ?? "", department.parentDepartment?.code ?? "", department.departmentHead?.employeeCode ?? "", department.defaultReportingManager?.employeeCode ?? "", department.operationsManager?.employeeCode ?? "", department.hrManager?.employeeCode ?? "", department.costCenter ?? "", department.status, department._count.employees, department.remarks ?? ""]));
});

router.get("/export.xlsx", requireRoles(...writeRoles, Role.AUDITOR), async (req, res) => {
  const departments = await prisma.department.findMany({ include: departmentInclude, orderBy: { code: "asc" } });
  await audit(req, "EXPORT", "Department", undefined, { format: "XLSX", count: departments.length });
  await xlsxFile(res, "departments-export.xlsx", ["code", "name", "nameArabic", "company", "branch", "parentDepartment", "departmentHead", "defaultReportingManager", "om", "hrManager", "costCenter", "status", "employeeCount", "remarks"], departments.map((department) => [department.code, department.name, department.nameArabic ?? "", department.company ?? "", department.branch ?? "", department.parentDepartment?.code ?? "", department.departmentHead?.employeeCode ?? "", department.defaultReportingManager?.employeeCode ?? "", department.operationsManager?.employeeCode ?? "", department.hrManager?.employeeCode ?? "", department.costCenter ?? "", department.status, department._count.employees, department.remarks ?? ""]), "Departments");
});

router.post("/import", requireRoles(...writeRoles), async (req, res, next) => {
  try {
    const rows = await rowsFromUpload(req.body);
    if (!rows.length) return res.status(400).json({ message: "No valid records found to import." });
    const missing = headers.filter((header) => !(header in rows[0]));
    if (missing.length) return res.status(400).json({ message: "Template columns do not match required format.", errors: missing });
    let createdCount = 0;
    let updatedCount = 0;
    const errors: Array<{ row: number; message: string }> = [];
    for (const [index, row] of rows.entries()) {
      const parentDepartment = row.parentDepartmentCode ? await prisma.department.findUnique({ where: { code: String(row.parentDepartmentCode).trim() } }) : null;
      const departmentHead = await activeEmployeeByCode(row.departmentHeadEmployeeId);
      const defaultReportingManager = await activeEmployeeByCode(row.defaultReportingManagerEmployeeId);
      const om = await activeEmployeeByCode(row.omEmployeeId);
      const hrManager = await activeEmployeeByCode(row.hrManagerEmployeeId);
      const parsed = schema.safeParse(row);
      if (!parsed.success) {
        errors.push({ row: index + 2, message: parsed.error.issues.map((issue) => issue.message).join("; ") });
        continue;
      }
      const rowErrors = [
        row.parentDepartmentCode && !parentDepartment ? "Parent department code is invalid." : "",
        row.departmentHeadEmployeeId && !departmentHead ? "Department Head employee ID is invalid or inactive." : "",
        row.defaultReportingManagerEmployeeId && !defaultReportingManager ? "Default Reporting Manager employee ID is invalid or inactive." : "",
        row.omEmployeeId && !om ? "OM employee ID is invalid or inactive." : "",
        row.hrManagerEmployeeId && !hrManager ? "HR Manager employee ID is invalid or inactive." : ""
      ].filter(Boolean);
      if (rowErrors.length) {
        errors.push({ row: index + 2, message: rowErrors.join("; ") });
        continue;
      }
      const existing = await prisma.department.findUnique({ where: { code: parsed.data.code } });
      const data = {
        ...parsed.data,
        parentDepartmentId: parentDepartment?.id,
        departmentHeadId: departmentHead?.id,
        defaultReportingManagerId: defaultReportingManager?.id,
        omId: om?.id,
        hrManagerId: hrManager?.id
      };
      await prisma.department.upsert({ where: { code: parsed.data.code }, update: data, create: data });
      if (existing) updatedCount += 1; else createdCount += 1;
    }
    await audit(req, "IMPORT", "Department", undefined, { createdCount, updatedCount, failedCount: errors.length });
    res.status(errors.length ? 207 : 201).json({ message: errors.length ? "Import completed with errors. Download error report." : "Import completed successfully.", createdCount, updatedCount, failedCount: errors.length, errors });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireRoles(...writeRoles), async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    await validateEmployeeIds([data.departmentHeadId, data.defaultReportingManagerId, data.omId, data.hrManagerId]);
    const department = await prisma.department.create({ data, include: departmentInclude });
    await audit(req, "CREATE", "Department", department.id, data);
    res.status(201).json(department);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Selected reporting employee")) return res.status(400).json({ message: error.message });
    next(error);
  }
});

router.patch("/:id", requireRoles(...writeRoles), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const data = schema.partial().parse(req.body);
    if (data.parentDepartmentId === id) return res.status(400).json({ message: "Department cannot be its own parent." });
    await validateEmployeeIds([data.departmentHeadId, data.defaultReportingManagerId, data.omId, data.hrManagerId]);
    const previous = await prisma.department.findUnique({ where: { id } });
    if (!previous) return res.status(404).json({ message: "Department not found" });
    const department = await prisma.department.update({ where: { id }, data, include: departmentInclude });
    await audit(req, "UPDATE", "Department", id, { fields: Object.keys(data) }, previous, department);
    res.json(department);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Selected reporting employee")) return res.status(400).json({ message: error.message });
    next(error);
  }
});

router.delete("/:id", requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const previous = await prisma.department.findUnique({ where: { id }, include: { _count: { select: { employees: true } } } });
    if (!previous) return res.status(404).json({ message: "Department not found" });
    if (previous._count.employees > 0) return res.status(409).json({ message: "Department has assigned employees. Move employees before archiving this department." });
    const department = await prisma.department.delete({ where: { id } });
    await audit(req, "ARCHIVE", "Department", id, undefined, previous, department);
    res.json(department);
  } catch (error) {
    next(error);
  }
});

export default router;
