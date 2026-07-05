import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { audit } from "../utils/audit.js";

const router = Router();

const draftSchema = z.object({
  module: z.string().min(2),
  draftKey: z.string().min(2),
  data: z.record(z.unknown())
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const module = typeof req.query.module === "string" ? req.query.module : undefined;
  const drafts = await prisma.formDraft.findMany({
    where: { userId: req.user?.id, ...(module ? { module } : {}) },
    orderBy: { updatedAt: "desc" }
  });
  res.json(drafts);
});

router.put("/", async (req, res, next) => {
  try {
    const body = draftSchema.parse(req.body);
    const draft = await prisma.formDraft.upsert({
      where: { userId_module_draftKey: { userId: req.user?.id ?? "", module: body.module, draftKey: body.draftKey } },
      update: { data: body.data as Prisma.InputJsonValue, status: "DRAFT" },
      create: { userId: req.user?.id, module: body.module, draftKey: body.draftKey, data: body.data as Prisma.InputJsonValue }
    });
    await audit(req, "DRAFT_SAVED", "FormDraft", draft.id, { module: body.module, draftKey: body.draftKey });
    res.json(draft);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    await prisma.formDraft.delete({ where: { id } });
    await audit(req, "DRAFT_DELETED", "FormDraft", id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
