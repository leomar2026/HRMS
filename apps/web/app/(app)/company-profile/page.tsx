import { CompanyProfileForm } from "@/components/CompanyProfileForm";
import { apiFetch } from "@/lib/api";

type CompanyProfile = {
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
  documentCompanyMode?: string;
  logoDataUrl?: string;
};

export default async function CompanyProfilePage() {
  const profile = await apiFetch<CompanyProfile>("/company-profile");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Company Details</h1>
          <p className="muted">Upload company logo and maintain company profile details used across HRMS documents.</p>
        </div>
      </div>
      <CompanyProfileForm profile={profile} />
    </>
  );
}
