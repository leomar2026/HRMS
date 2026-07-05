import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";

const router = Router();
const schema = z.object({ title: z.string().min(2), body: z.string().min(2), publishedAt: z.coerce.date().optional() });

router.use(requireAuth);

router.get("/", async (_req, res) => {
  const announcements = await prisma.announcement.findMany({ orderBy: { publishedAt: "desc" }, take: 100 });
  res.json(announcements);
});

router.post("/", requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR), async (req, res, next) => {
  try {
    const body = schema.parse(req.body);
    const announcement = await prisma.announcement.create({ data: body });
    await audit(req, "CREATE", "Announcement", announcement.id, undefined, undefined, announcement);
    res.status(201).json(announcement);
  } catch (error) {
    next(error);
  }
});

export default router;
