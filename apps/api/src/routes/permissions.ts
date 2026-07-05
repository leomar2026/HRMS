import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";

const router = Router();

const permissionSchema = z.object({
  role: z.nativeEnum(Role),
  module: z.string().min(2),
  canView: z.boolean().default(false),
  canAdd: z.boolean().default(false),
  canEdit: z.boolean().default(false),
  canDelete: z.boolean().default(false),
  canApprove: z.boolean().default(false),
  canReject: z.boolean().default(false),
  canPrint: z.boolean().default(false),
  canExportExcel: z.boolean().default(false),
  canExportPdf: z.boolean().default(false),
  canAccessConfidentialSalary: z.boolean().default(false),
  canAccessEmployeeDocuments: z.boolean().default(false),
  canAccessGovernmentIntegrations: z.boolean().default(false)
});

router.use(requireAuth, requireRoles(Role.SUPER_ADMIN, Role.ADMIN));

router.get("/", async (_req, res) => {
  const permissions = await prisma.rolePermission.findMany({ orderBy: [{ role: "asc" }, { module: "asc" }] });
  res.json(permissions);
});

router.put("/", async (req, res, next) => {
  try {
    const body = permissionSchema.parse(req.body);
    const previous = await prisma.rolePermission.findUnique({ where: { role_module: { role: body.role, module: body.module } } });
    const permission = await prisma.rolePermission.upsert({
      where: { role_module: { role: body.role, module: body.module } },
      update: body,
      create: body
    });
    await audit(req, "UPSERT_PERMISSION", "RolePermission", permission.id, { role: body.role, module: body.module }, previous ?? undefined, permission);
    res.json(permission);
  } catch (error) {
    next(error);
  }
});

export default router;
