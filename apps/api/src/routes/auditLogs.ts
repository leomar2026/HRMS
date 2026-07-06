import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";
import { csvFile, xlsxFile } from "../utils/uploadParsers.js";

const router = Router();

router.get("/", requireAuth, requireRoles(Role.ADMIN), async (_req, res) => {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  res.json(logs);
});

router.get("/export.csv", requireAuth, requireRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.AUDITOR), async (req, res) => {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 5000 });
  const headers = ["Created At", "User ID", "Module", "Action", "Entity ID", "IP Address", "Device"];
  await audit(req, "EXPORT", "AuditLog", undefined, { format: "CSV", count: logs.length });
  csvFile(res, "audit-logs-export.csv", headers, logs.map((log) => [log.createdAt.toISOString(), log.userId ?? "", log.entity, log.action, log.entityId ?? "", log.ipAddress ?? "", log.device ?? ""]));
});

router.get("/export.xlsx", requireAuth, requireRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.AUDITOR), async (req, res) => {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 5000 });
  const headers = ["Created At", "User ID", "Module", "Action", "Entity ID", "IP Address", "Device"];
  await audit(req, "EXPORT", "AuditLog", undefined, { format: "XLSX", count: logs.length });
  await xlsxFile(res, "audit-logs-export.xlsx", headers, logs.map((log) => [log.createdAt.toISOString(), log.userId ?? "", log.entity, log.action, log.entityId ?? "", log.ipAddress ?? "", log.device ?? ""]), "Audit Logs");
});

export default router;
