import fs from "node:fs";
import path from "node:path";

export type PreviewCompanyProfile = {
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

export const defaultPreviewCompanyProfile: PreviewCompanyProfile = {
  id: "default",
  companyName: "Demo Company",
  companyNameArabic: "",
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

const previewProfilePath = path.join(process.cwd(), ".preview", "company-profile.json");

function readPreviewCompanyProfile() {
  try {
    if (!fs.existsSync(previewProfilePath)) return { ...defaultPreviewCompanyProfile };
    const parsed = JSON.parse(fs.readFileSync(previewProfilePath, "utf8")) as Partial<PreviewCompanyProfile>;
    return { ...defaultPreviewCompanyProfile, ...parsed };
  } catch {
    return { ...defaultPreviewCompanyProfile };
  }
}

function writePreviewCompanyProfile(profile: PreviewCompanyProfile) {
  fs.mkdirSync(path.dirname(previewProfilePath), { recursive: true });
  fs.writeFileSync(previewProfilePath, JSON.stringify(profile, null, 2), "utf8");
}

let previewCompanyProfileState: PreviewCompanyProfile = readPreviewCompanyProfile();

export function getPreviewCompanyProfile() {
  return previewCompanyProfileState;
}

export function updatePreviewCompanyProfile(profile: PreviewCompanyProfile) {
  previewCompanyProfileState = profile;
  writePreviewCompanyProfile(profile);
  return previewCompanyProfileState;
}
