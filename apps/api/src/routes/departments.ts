import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";
import { csvFile, csvTemplate, rowsFromUpload, xlsxFile, xlsxTemplate } from "../utils/uploadParsers.js";

const router = Router();
const schema = z.object({ name: z.string().min(2), code: z.string().min(2).max(20) });
const writeRoles = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR];
const headers = ["code", "name"];

router.use(requireAuth);

router.get("/", async (_req, res) => {
  const departments = await prisma.department.findMany({ include: { _count: { select: { employees: true } } }, orderBy: { name: "asc" } });
  res.json(departments);
});

router.get("/template.csv", requireRoles(...writeRoles), (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.attachment("department-template.csv");
  res.send(csvTemplate(headers));
});

router.get("/template.xlsx", requireRoles(...writeRoles), async (_req, res) => {
  await xlsxTemplate(res, "department-template.xlsx", headers, "Departments");
});

router.get("/export.csv", requireRoles(...writeRoles, Role.AUDITOR), async (req, res) => {
  const departments = await prisma.department.findMany({ include: { _count: { select: { employees: true } } }, orderBy: { code: "asc" } });
  await audit(req, "EXPORT", "Department", undefined, { format: "CSV", count: departments.length });
  csvFile(res, "departments-export.csv", ["code", "name", "employeeCount"], departments.map((department) => [department.code, department.name, department._count.employees]));
});

router.get("/export.xlsx", requireRoles(...writeRoles, Role.AUDITOR), async (req, res) => {
  const departments = await prisma.department.findMany({ include: { _count: { select: { employees: true } } }, orderBy: { code: "asc" } });
  await audit(req, "EXPORT", "Department", undefined, { format: "XLSX", count: departments.length });
  await xlsxFile(res, "departments-export.xlsx", ["code", "name", "employeeCount"], departments.map((department) => [department.code, department.name, department._count.employees]), "Departments");
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
      const parsed = schema.safeParse(row);
      if (!parsed.success) {
        errors.push({ row: index + 2, message: parsed.error.issues.map((issue) => issue.message).join("; ") });
        continue;
      }
      const existing = await prisma.department.findUnique({ where: { code: parsed.data.code } });
      await prisma.department.upsert({ where: { code: parsed.data.code }, update: { name: parsed.data.name }, create: parsed.data });
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
    const department = await prisma.department.create({ data });
    await audit(req, "CREATE", "Department", department.id, data);
    res.status(201).json(department);
  } catch (error) {
    next(error);
  }
});

export default router;
