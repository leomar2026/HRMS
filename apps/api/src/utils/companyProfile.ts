import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import type { PayslipInput } from "./payslipRenderer.js";

const fallbackCompany = {
  id: "default",
  companyName: "Saudi HRMS Company",
  companyNameArabic: "",
  registrationNumber: "",
  vatNumber: "",
  address: "Company Address",
  city: "Riyadh",
  country: "Saudi Arabia",
  phone: "+966",
  fax: "-",
  email: "",
  website: "",
  gosiNumber: "",
  qiwaReference: "",
  bankDetails: "",
  authorizedSignatory: "Authorized Signature",
  companyStampDataUrl: "",
  logoDataUrl: "",
  logoVersion: 1,
  documentCompanyMode: "CURRENT"
};

export async function getCurrentCompanyProfile() {
  if (env.HRMS_PREVIEW_MODE) {
    return {
      ...fallbackCompany,
      companyName: "Demo Company",
      companyNameArabic: "شركة تجريبية",
      registrationNumber: "CR 1007552026",
      vatNumber: "300000000000003",
      address: "King Fahd Road",
      phone: "+966 11 000 0000",
      fax: "+966 11 000 0001",
      email: "hr@company.sa",
      website: "https://company.sa",
      gosiNumber: "GOSI-1007552026",
      qiwaReference: "QIWA-1007552026",
      bankDetails: "Al Rajhi Bank - SA0380000000608010167519"
    };
  }
  return (await prisma.companyProfile.findUnique({ where: { id: "default" } })) ?? fallbackCompany;
}

export function payslipCompanyFromProfile(profile: Awaited<ReturnType<typeof getCurrentCompanyProfile>>): PayslipInput["company"] {
  return {
    name: profile.companyName,
    nameArabic: profile.companyNameArabic ?? undefined,
    registration: profile.registrationNumber ?? undefined,
    vatNumber: profile.vatNumber ?? undefined,
    address: profile.address ?? undefined,
    cityCountry: [profile.city, profile.country].filter(Boolean).join(", "),
    telephone: profile.phone ?? undefined,
    fax: profile.fax ?? undefined,
    email: profile.email ?? undefined,
    website: profile.website ?? undefined,
    gosiNumber: profile.gosiNumber ?? undefined,
    qiwaReference: profile.qiwaReference ?? undefined,
    bankDetails: profile.bankDetails ?? undefined,
    authorizedSignatory: profile.authorizedSignatory ?? undefined,
    logoDataUrl: profile.logoDataUrl ?? undefined,
    logoVersion: profile.logoVersion ?? undefined
  };
}

export function companyPrintHeader(profile: Awaited<ReturnType<typeof getCurrentCompanyProfile>>, title: string) {
  const logo = profile.logoDataUrl ? `<img src="${profile.logoDataUrl}" alt="Company logo" style="max-width:120px;max-height:64px;object-fit:contain" />` : `<strong>${profile.companyName}</strong>`;
  return `<div class="head"><div class="brand-line">${logo}<div><h1>${title}</h1><p>${profile.companyName}${profile.companyNameArabic ? ` | ${profile.companyNameArabic}` : ""}</p><p>${profile.address ?? ""} ${profile.city ?? ""} ${profile.country ?? ""}</p><p>Tel: ${profile.phone ?? "-"} | Fax: ${profile.fax ?? "-"} | CR: ${profile.registrationNumber ?? "-"} | VAT: ${profile.vatNumber ?? "-"}</p></div></div></div>`;
}
