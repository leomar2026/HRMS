import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";

const router = Router();
const schema = z.object({ name: z.string().min(2), code: z.string().min(2).max(20) });

router.use(requireAuth);

router.get("/", async (_req, res) => {
  const departments = await prisma.department.findMany({ include: { _count: { select: { employees: true } } }, orderBy: { name: "asc" } });
  res.json(departments);
});

router.post("/", requireRoles(Role.ADMIN, Role.HR), async (req, res, next) => {
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
