import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { resendFailedEmailLog } from "../utils/leaveWorkflow.js";
import { audit } from "../utils/audit.js";

const router = Router();

const templateSchema = z.object({
  code: z.string().min(2).max(80),
  subject: z.string().min(2).max(200),
  body: z.string().min(2),
  active: z.boolean().optional()
});

router.use(requireAuth, requireRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.HR_MANAGER));

router.get("/email-templates", async (_req, res) => {
  const templates = await prisma.emailTemplate.findMany({ orderBy: { code: "asc" } });
  res.json(templates);
});

router.put("/email-templates/:code", async (req, res, next) => {
  try {
    const body = templateSchema.parse({ ...req.body, code: req.params.code });
    const template = await prisma.emailTemplate.upsert({
      where: { code: body.code },
      update: { subject: body.subject, body: body.body, active: body.active ?? true },
      create: { code: body.code, subject: body.subject, body: body.body, active: body.active ?? true }
    });
    await audit(req, "UPSERT_EMAIL_TEMPLATE", "EmailTemplate", template.id, { code: template.code });
    res.json(template);
  } catch (error) {
    next(error);
  }
});

router.post("/email-templates/:code/test", async (req, res, next) => {
  try {
    const recipient = z.string().email().parse(req.body.recipient);
    const template = await prisma.emailTemplate.findUnique({ where: { code: req.params.code } });
    const log = await prisma.emailLog.create({
      data: {
        notificationKey: `TEST:${req.params.code}:${Date.now()}`,
        recipient,
        subject: template?.subject ?? `Test ${req.params.code}`,
        templateCode: req.params.code,
        status: "PENDING",
        payload: { test: true }
      }
    });
    await audit(req, "SEND_TEST_EMAIL", "EmailLog", log.id, { recipient, templateCode: req.params.code });
    res.status(202).json(log);
  } catch (error) {
    next(error);
  }
});

router.get("/email-logs", async (_req, res) => {
  const logs = await prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  res.json(logs);
});

router.post("/email-logs/:id/resend", async (req, res, next) => {
  try {
    const log = await resendFailedEmailLog(String(req.params.id));
    await audit(req, "RESEND_EMAIL_NOTIFICATION", "EmailLog", log.id, { recipient: log.recipient, templateCode: log.templateCode });
    res.json(log);
  } catch (error) {
    next(error);
  }
});

export default router;
