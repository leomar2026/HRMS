import { Router } from "express";
import { getCurrentCompanyProfile } from "../utils/companyProfile.js";

const router = Router();

router.get("/company-branding", async (_req, res, next) => {
  try {
    const profile = await getCurrentCompanyProfile();
    res.json({
      companyName: profile.companyName,
      companyNameArabic: profile.companyNameArabic,
      logoDataUrl: profile.logoDataUrl,
      logoVersion: profile.logoVersion
    });
  } catch (error) {
    next(error);
  }
});

export default router;
