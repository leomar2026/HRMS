import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";
import { defaultNumberSeries, ensureDefaultNumberSeries } from "../utils/numberSeries.js";

const router = Router();

const seriesSchema = z.object({
  code: z.string().min(2).regex(/^[A-Z0-9_]+$/),
  name: z.string().min(2),
  prefix: z.string().min(1),
  separator: z.string().max(3).default("-"),
  padding: z.coerce.number().int().min(1).max(12).default(5),
  nextNumber: z.coerce.number().int().min(1).default(1),
  startNumber: z.coerce.number().int().min(1).default(1),
  resetFrequency: z.enum(["NEVER", "YEARLY", "MONTHLY", "DAILY"]).default("YEARLY"),
  active: z.coerce.boolean().default(true),
  remarks: z.string().optional()
});

router.use(requireAuth, requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER));

router.get("/", async (_req, res) => {
  await ensureDefaultNumberSeries();
  const rows = await prisma.numberSeries.findMany({ where: { archivedAt: null }, orderBy: { code: "asc" } });
  res.json(rows);
});

router.get("/defaults", (_req, res) => res.json(defaultNumberSeries));

router.post("/", async (req, res, next) => {
  try {
    const body = seriesSchema.parse(req.body);
    const row = await prisma.numberSeries.create({ data: { ...body, createdBy: req.user?.id, updatedBy: req.user?.id } });
    await audit(req, "CREATE", "NumberSeries", row.id, { code: row.code }, undefined, row);
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const previous = await prisma.numberSeries.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) return res.status(404).json({ message: "Number series not found" });
    const body = seriesSchema.partial().parse(req.body);
    const row = await prisma.numberSeries.update({ where: { id: previous.id }, data: { ...body, updatedBy: req.user?.id } });
    await audit(req, "UPDATE", "NumberSeries", row.id, { code: row.code }, previous, row);
    res.json(row);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const previous = await prisma.numberSeries.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) return res.status(404).json({ message: "Number series not found" });
    const row = await prisma.numberSeries.update({ where: { id: previous.id }, data: { archivedAt: new Date(), active: false, updatedBy: req.user?.id } });
    await audit(req, "ARCHIVE", "NumberSeries", row.id, { code: row.code }, previous, row);
    res.json(row);
  } catch (error) {
    next(error);
  }
});

router.post("/initialize-defaults", async (req, res, next) => {
  try {
    await ensureDefaultNumberSeries();
    await audit(req, "INITIALIZE_DEFAULTS", "NumberSeries");
    const rows = await prisma.numberSeries.findMany({ where: { archivedAt: null }, orderBy: { code: "asc" } });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

export default router;
