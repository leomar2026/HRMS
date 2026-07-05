import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { getGosiStatus } from "../services/gosiService.js";
import { getMudadStatus } from "../services/mudadService.js";
import { getQiwaStatus } from "../services/qiwaService.js";
import { audit } from "../utils/audit.js";

const router = Router();

router.use(requireAuth, requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR));

const providerSchema = z.object({
  provider: z.enum(["GOSI", "MUDAD", "QIWA"]),
  action: z.string().min(2).default("MANUAL_SYNC")
});

router.get("/status", async (_req, res) => {
  const logs = await prisma.governmentIntegrationLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  const settings = await prisma.governmentIntegrationSetting.findMany({ orderBy: { provider: "asc" } });
  res.json({
    notice: "Official integration with GOSI, Mudad, and Qiwa requires approved API access, company authorization, and official credentials.",
    connectors: [getGosiStatus(), getMudadStatus(), getQiwaStatus()],
    settings,
    logs
  });
});

router.post("/manual-sync", async (req, res, next) => {
  try {
    const body = providerSchema.parse(req.body);
    const log = await prisma.governmentIntegrationLog.create({
      data: {
        provider: body.provider,
        action: body.action,
        status: "QUEUED_FOR_APPROVED_CONNECTOR",
        message: "Manual sync was queued for an approved official integration method. No government website scraping or bypass was attempted."
      }
    });
    await audit(req, "QUEUE_GOVERNMENT_SYNC", "GovernmentIntegrationLog", log.id, body);
    res.status(202).json(log);
  } catch (error) {
    next(error);
  }
});

router.get("/:provider/export.csv", async (req, res) => {
  const provider = String(req.params.provider).toUpperCase();
  const header = "provider,recordType,status,message";
  const rows = [
    [provider, "VALIDATION", "READY_FOR_OFFICIAL_METHOD", "Export generated for secure manual upload or approved middleware"].join(",")
  ];
  res.header("Content-Type", "text/csv");
  res.attachment(`${provider.toLowerCase()}-official-export.csv`);
  res.send([header, ...rows].join("\n"));
});

export default router;
