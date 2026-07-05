import { Prisma, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";
import { defaultPreviewCompanyProfile, getPreviewCompanyProfile, updatePreviewCompanyProfile } from "../utils/previewCompanyProfile.js";

const router = Router();

const documentImageSchema = z.string().regex(/^data:image\/(png|jpeg|jpg);base64,/, "Upload a PNG or JPG image.").max(2_500_000);

const companyProfileSchema = z.object({
  companyName: z.string().min(2),
  companyNameArabic: z.string().optional(),
  registrationNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  gosiNumber: z.string().optional(),
  qiwaReference: z.string().optional(),
  bankDetails: z.string().optional(),
  authorizedSignatory: z.string().optional(),
  companyStampDataUrl: documentImageSchema.optional().or(z.literal("")),
  letterheadSettings: z.record(z.unknown()).optional(),
  logoDataUrl: documentImageSchema.optional().or(z.literal("")),
  deleteLogo: z.boolean().optional(),
  documentCompanyMode: z.enum(["CURRENT", "APPROVAL_TIME"]).default("CURRENT")
});

router.use(requireAuth);

router.get("/", async (_req, res) => {
  if (env.HRMS_PREVIEW_MODE) return res.json(getPreviewCompanyProfile());
  const profile = await prisma.companyProfile.findUnique({ where: { id: "default" } });
  res.json(profile ?? { ...defaultPreviewCompanyProfile, companyName: "Saudi HRMS Company" });
});

router.put("/", requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER), async (req, res, next) => {
  try {
    const body = companyProfileSchema.parse(req.body);
    if (env.HRMS_PREVIEW_MODE) {
      const { deleteLogo, ...profileBody } = body;
      const currentProfile = getPreviewCompanyProfile();
      const nextLogoDataUrl = deleteLogo ? "" : body.logoDataUrl ?? currentProfile.logoDataUrl;
      const profile = updatePreviewCompanyProfile({
        ...currentProfile,
        ...profileBody,
        logoDataUrl: nextLogoDataUrl,
        logoVersion: body.logoDataUrl || deleteLogo ? currentProfile.logoVersion + 1 : currentProfile.logoVersion,
        updatedBy: req.user?.id,
        updatedAt: new Date().toISOString()
      });
      return res.json(profile);
    }
    const previous = await prisma.companyProfile.findUnique({ where: { id: "default" } });
    const { deleteLogo, ...profileBody } = body;
    const data = { ...profileBody, letterheadSettings: profileBody.letterheadSettings as Prisma.InputJsonValue | undefined };
    const profile = await prisma.companyProfile.upsert({
      where: { id: "default" },
      update: {
        ...data,
        email: body.email || undefined,
        website: body.website || undefined,
        companyStampDataUrl: body.companyStampDataUrl || undefined,
        logoDataUrl: deleteLogo ? null : body.logoDataUrl || undefined,
        logoVersion: { increment: body.logoDataUrl || deleteLogo ? 1 : 0 },
        updatedBy: req.user?.id
      },
      create: {
        id: "default",
        ...data,
        email: body.email || undefined,
        website: body.website || undefined,
        companyStampDataUrl: body.companyStampDataUrl || undefined,
        logoDataUrl: deleteLogo ? undefined : body.logoDataUrl || undefined,
        updatedBy: req.user?.id
      }
    });
    await audit(req, "UPDATE_COMPANY_PROFILE", "CompanyProfile", "default", undefined, previous ?? undefined, profile);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

export default router;
