import { Router } from "express";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";
import { csvFile, csvTemplate, rowsFromUpload, xlsxFile, xlsxTemplate } from "../utils/uploadParsers.js";

const router = Router();

const masterSchema = z.object({
  type: z.string().min(2),
  code: z.string().min(1),
  name: z.string().min(2),
  nameArabic: z.string().optional(),
  active: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional()
});

const writeRoles = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR];
const headers = ["type", "code", "name", "nameArabic", "active"];

router.use(requireAuth);

router.get("/", requireRoles(...writeRoles, Role.ACCOUNTANT, Role.PAYROLL_OFFICER, Role.FINANCE, Role.AUDITOR), async (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const records = await prisma.masterData.findMany({
    where: {
      archivedAt: null,
      ...(type ? { type } : {}),
      ...(search ? { OR: [{ code: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }] } : {})
    },
    orderBy: [{ type: "asc" }, { code: "asc" }]
  });
  res.json(records);
});

router.get("/template.csv", requireRoles(...writeRoles), (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.attachment("master-data-template.csv");
  res.send(csvTemplate(headers));
});

router.get("/template.xlsx", requireRoles(...writeRoles), async (_req, res) => {
  await xlsxTemplate(res, "master-data-template.xlsx", headers, "Master Data");
});

router.get("/export.csv", requireRoles(...writeRoles, Role.ACCOUNTANT, Role.PAYROLL_OFFICER, Role.FINANCE, Role.AUDITOR), async (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const records = await prisma.masterData.findMany({ where: { archivedAt: null, ...(type ? { type } : {}) }, orderBy: [{ type: "asc" }, { code: "asc" }] });
  await audit(req, "EXPORT", "MasterData", undefined, { format: "CSV", type, count: records.length });
  csvFile(res, "master-data-export.csv", headers, records.map((record) => [record.type, record.code, record.name, record.nameArabic ?? "", record.active]));
});

router.get("/export.xlsx", requireRoles(...writeRoles, Role.ACCOUNTANT, Role.PAYROLL_OFFICER, Role.FINANCE, Role.AUDITOR), async (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const records = await prisma.masterData.findMany({ where: { archivedAt: null, ...(type ? { type } : {}) }, orderBy: [{ type: "asc" }, { code: "asc" }] });
  await audit(req, "EXPORT", "MasterData", undefined, { format: "XLSX", type, count: records.length });
  await xlsxFile(res, "master-data-export.xlsx", headers, records.map((record) => [record.type, record.code, record.name, record.nameArabic ?? "", record.active]), "Master Data");
});

router.post("/import", requireRoles(...writeRoles), async (req, res, next) => {
  try {
    const rows = await rowsFromUpload(req.body);
    const required = ["type", "code", "name"];
    const invalidColumns = rows.length ? required.filter((header) => !(header in rows[0])) : [];
    if (!rows.length) return res.status(400).json({ message: "No valid records found to import." });
    if (invalidColumns.length) return res.status(400).json({ message: "Template columns do not match required format.", errors: invalidColumns });
    let createdCount = 0;
    let updatedCount = 0;
    const errors: Array<{ row: number; message: string }> = [];
    for (const [index, row] of rows.entries()) {
      const parsed = masterSchema.safeParse({ ...row, active: row.active === undefined || row.active === "" ? true : String(row.active).toLowerCase() !== "false" });
      if (!parsed.success) {
        errors.push({ row: index + 2, message: parsed.error.issues.map((issue) => issue.message).join("; ") });
        continue;
      }
      const existing = await prisma.masterData.findUnique({ where: { type_code: { type: parsed.data.type, code: parsed.data.code } } });
      await prisma.masterData.upsert({
        where: { type_code: { type: parsed.data.type, code: parsed.data.code } },
        update: { name: parsed.data.name, nameArabic: parsed.data.nameArabic, active: parsed.data.active, archivedAt: null },
        create: { ...parsed.data, metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined }
      });
      if (existing) updatedCount += 1; else createdCount += 1;
    }
    await audit(req, "IMPORT", "MasterData", undefined, { createdCount, updatedCount, failedCount: errors.length });
    res.status(errors.length ? 207 : 201).json({ message: errors.length ? "Import completed with errors. Download error report." : "Import completed successfully.", createdCount, updatedCount, failedCount: errors.length, errors });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireRoles(...writeRoles), async (req, res, next) => {
  try {
    const body = masterSchema.parse(req.body);
    const record = await prisma.masterData.create({ data: { ...body, metadata: body.metadata as Prisma.InputJsonValue | undefined } });
    await audit(req, "CREATE", "MasterData", record.id, { type: record.type }, undefined, record);
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireRoles(...writeRoles), async (req, res, next) => {
  try {
    const body = masterSchema.partial().parse(req.body);
    const id = String(req.params.id);
    const previous = await prisma.masterData.findUnique({ where: { id } });
    const record = await prisma.masterData.update({ where: { id }, data: { ...body, metadata: body.metadata as Prisma.InputJsonValue | undefined } });
    await audit(req, "UPDATE", "MasterData", id, undefined, previous ?? undefined, record);
    res.json(record);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const previous = await prisma.masterData.findUnique({ where: { id } });
    const record = await prisma.masterData.update({ where: { id }, data: { archivedAt: new Date(), active: false } });
    await audit(req, "ARCHIVE", "MasterData", id, undefined, previous ?? undefined, record);
    res.json(record);
  } catch (error) {
    next(error);
  }
});

export default router;
