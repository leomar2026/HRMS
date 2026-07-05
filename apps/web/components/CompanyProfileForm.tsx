"use client";

import { Save, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

export function CompanyProfileForm({ profile }: { profile: CompanyProfile }) {
  const router = useRouter();
  const [logoDataUrl, setLogoDataUrl] = useState(profile.logoDataUrl ?? "");
  const [deleteLogo, setDeleteLogo] = useState(false);
  const [message, setMessage] = useState("");

  function handleLogo(file?: File) {
    if (!file) return;
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setMessage("Upload a PNG, JPG, or WebP logo. SVG files are not supported for PDFs.");
      return;
    }
    if (file.size > 2_000_000) {
      setMessage("Company logo must be 2 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoDataUrl(String(reader.result));
      setDeleteLogo(false);
      setMessage("");
    };
    reader.readAsDataURL(file);
  }

  function optionalText(value: FormDataEntryValue | null) {
    const text = String(value ?? "").trim();
    return text || undefined;
  }

  function websiteValue(value: FormDataEntryValue | null) {
    const text = String(value ?? "").trim();
    if (!text) return undefined;
    return /^https?:\/\//i.test(text) ? text : `https://${text}`;
  }

  function formatApiError(payload: unknown) {
    if (!payload || typeof payload !== "object") return "Unable to save company details.";
    const response = payload as { message?: string; issues?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } };
    const fieldErrors = response.issues?.fieldErrors ? Object.values(response.issues.fieldErrors).flat() : [];
    const formErrors = response.issues?.formErrors ?? [];
    return [...fieldErrors, ...formErrors, response.message].filter(Boolean).join(" ") || "Unable to save company details.";
  }

  async function submit(formData: FormData) {
    const response = await fetch("/api/backend/company-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: optionalText(formData.get("companyName")),
        companyNameArabic: optionalText(formData.get("companyNameArabic")),
        registrationNumber: optionalText(formData.get("registrationNumber")),
        vatNumber: optionalText(formData.get("vatNumber")),
        address: optionalText(formData.get("address")),
        city: optionalText(formData.get("city")),
        country: optionalText(formData.get("country")),
        phone: optionalText(formData.get("phone")),
        fax: optionalText(formData.get("fax")),
        email: optionalText(formData.get("email")),
        website: websiteValue(formData.get("website")),
        gosiNumber: optionalText(formData.get("gosiNumber")),
        qiwaReference: optionalText(formData.get("qiwaReference")),
        bankDetails: optionalText(formData.get("bankDetails")),
        authorizedSignatory: optionalText(formData.get("authorizedSignatory")),
        documentCompanyMode: formData.get("documentCompanyMode") || "CURRENT",
        logoDataUrl: logoDataUrl || undefined,
        deleteLogo
      })
    });
    if (response.ok) {
      setDeleteLogo(false);
      setMessage("Company details saved.");
      router.refresh();
      return;
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    setMessage(response.status === 401 ? "Please log in again before saving company details." : formatApiError(payload));
  }

  return (
    <form action={submit} className="form-panel grid">
      <div className="company-logo-box">
        <div className="logo-preview">
          {logoDataUrl ? <img src={logoDataUrl} alt="Company logo preview" /> : <span className="muted">No logo uploaded</span>}
        </div>
        <label className="button secondary">
          <Upload size={16} /> Upload Logo
          <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleLogo(event.target.files?.[0])} />
        </label>
        {logoDataUrl ? <button className="button secondary" type="button" onClick={() => { setLogoDataUrl(""); setDeleteLogo(true); }}>Delete Logo</button> : null}
      </div>
      <div className="form-grid">
        <label className="field"><span>Company name</span><input name="companyName" defaultValue={profile.companyName} required /></label>
        <label className="field"><span>Arabic company name</span><input name="companyNameArabic" defaultValue={profile.companyNameArabic ?? ""} dir="rtl" /></label>
        <label className="field"><span>Commercial registration</span><input name="registrationNumber" defaultValue={profile.registrationNumber ?? ""} /></label>
        <label className="field"><span>VAT number</span><input name="vatNumber" defaultValue={profile.vatNumber ?? ""} /></label>
        <label className="field"><span>Phone</span><input name="phone" defaultValue={profile.phone ?? ""} /></label>
        <label className="field"><span>Fax</span><input name="fax" defaultValue={profile.fax ?? ""} /></label>
        <label className="field"><span>Email</span><input name="email" type="email" defaultValue={profile.email ?? ""} /></label>
        <label className="field"><span>Website</span><input name="website" defaultValue={profile.website ?? ""} /></label>
        <label className="field"><span>GOSI number</span><input name="gosiNumber" defaultValue={profile.gosiNumber ?? ""} /></label>
        <label className="field"><span>QIWA reference</span><input name="qiwaReference" defaultValue={profile.qiwaReference ?? ""} /></label>
        <label className="field"><span>Bank details</span><input name="bankDetails" defaultValue={profile.bankDetails ?? ""} /></label>
        <label className="field"><span>Authorized signatory</span><input name="authorizedSignatory" defaultValue={profile.authorizedSignatory ?? ""} /></label>
        <label className="field"><span>Document company details</span><select name="documentCompanyMode" defaultValue={profile.documentCompanyMode ?? "CURRENT"}><option value="CURRENT">Use Current Company Details</option><option value="APPROVAL_TIME">Use Company Details at Time of Approval</option></select></label>
        <label className="field"><span>City</span><input name="city" defaultValue={profile.city ?? ""} /></label>
        <label className="field"><span>Country</span><input name="country" defaultValue={profile.country ?? "Saudi Arabia"} /></label>
        <label className="field"><span>Address</span><input name="address" defaultValue={profile.address ?? ""} /></label>
      </div>
      <div className="actions">
        <button className="button" type="submit"><Save size={16} /> Save Company Details</button>
        {message ? <span className="status">{message}</span> : null}
      </div>
    </form>
  );
}
