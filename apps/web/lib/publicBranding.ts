export type PublicBranding = {
  companyName?: string;
  companyNameArabic?: string;
  logoDataUrl?: string;
  logoVersion?: number;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function getPublicBranding(): Promise<PublicBranding> {
  try {
    const response = await fetch(`${apiUrl}/api/public/company-branding`, { cache: "no-store" });
    if (!response.ok) return {};
    return (await response.json()) as PublicBranding;
  } catch {
    return {};
  }
}
