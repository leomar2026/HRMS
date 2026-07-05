import { Router } from "express";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";

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
