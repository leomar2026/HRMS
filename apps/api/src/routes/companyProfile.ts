import { Prisma, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";

const router = Router();

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
  companyStampDataUrl: z.string().startsWith("data:image/").max(2_500_000, "Company stamp image must be 2 MB or smaller.").optional().or(z.literal("")),
  letterheadSettings: z.record(z.unknown()).optional(),
  logoDataUrl: z.string().startsWith("data:image/").max(2_500_000, "Company logo must be 2 MB or smaller.").optional().or(z.literal("")),
  deleteLogo: z.boolean().optional(),
  documentCompanyMode: z.enum(["CURRENT", "APPROVAL_TIME"]).default("CURRENT")
});

type PreviewCompanyProfile = {
  id: string;
  companyName: string;
  companyNameArabic?: string;
  registrationNumber?: string;
  vatNumber?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  fax?: string;
  email?: string;
  website?: string;
  gosiNumber?: string;
  qiwaReference?: string;
  bankDetails?: string;
  authorizedSignatory?: string;
  companyStampDataUrl?: string;
  letterheadSettings?: Record<string, unknown>;
  logoDataUrl?: string;
  logoVersion: number;
  documentCompanyMode: "CURRENT" | "APPROVAL_TIME";
  updatedBy?: string;
  updatedAt?: string;
};

const previewCompany: PreviewCompanyProfile = {
  id: "default",
  companyName: "Demo Company",
  companyNameArabic: "شركة تجريبية",
  registrationNumber: "CR 1007552026",
  vatNumber: "300000000000003",
  address: "King Fahd Road",
  city: "Riyadh",
  country: "Saudi Arabia",
  phone: "+966 11 000 0000",
  fax: "+966 11 000 0001",
  email: "hr@company.sa",
  website: "https://company.sa",
  gosiNumber: "GOSI-1007552026",
  qiwaReference: "QIWA-1007552026",
  bankDetails: "Al Rajhi Bank - SA0380000000608010167519",
  authorizedSignatory: "Authorized HR Signatory",
  companyStampDataUrl: "",
  letterheadSettings: { showLogo: true, showCr: true, showVat: true },
  logoDataUrl: "",
  logoVersion: 1,
  documentCompanyMode: "CURRENT"
};

let previewCompanyState: PreviewCompanyProfile = { ...previewCompany };

router.use(requireAuth);

router.get("/", async (_req, res) => {
  if (env.HRMS_PREVIEW_MODE) return res.json(previewCompanyState);
  const profile = await prisma.companyProfile.findUnique({ where: { id: "default" } });
  res.json(profile ?? { ...previewCompany, companyName: "Saudi HRMS Company" });
});

router.put("/", requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER), async (req, res, next) => {
  try {
    const body = companyProfileSchema.parse(req.body);
    if (env.HRMS_PREVIEW_MODE) {
      const { deleteLogo, ...profileBody } = body;
      const nextLogoDataUrl = body.deleteLogo ? "" : body.logoDataUrl ?? previewCompanyState.logoDataUrl;
      previewCompanyState = {
        ...previewCompanyState,
        ...profileBody,
        logoDataUrl: nextLogoDataUrl,
        logoVersion: body.logoDataUrl || deleteLogo ? previewCompanyState.logoVersion + 1 : previewCompanyState.logoVersion,
        updatedBy: req.user?.id,
        updatedAt: new Date().toISOString()
      };
      return res.json(previewCompanyState);
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
