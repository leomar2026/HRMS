import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Fingerprint } from "lucide-react";
import { MobileAttendancePunch } from "@/components/MobileAttendancePunch";
import { apiFetch } from "@/lib/api";
import { getPublicBranding } from "@/lib/publicBranding";

type MobileConfig = {
  timezone: string;
  sites: Array<{
    id: string;
    name: string;
    branch?: string | null;
    location?: string | null;
    timezone: string;
    latitude?: number | null;
    longitude?: number | null;
    radiusMeters?: number | null;
  }>;
};

export default async function SharedMobileTimeInPage() {
  const cookieStore = await cookies();
  if (!cookieStore.get("hrms_token")?.value) redirect("/login?returnTo=/mobile-time-in");

  const [branding, config] = await Promise.all([
    getPublicBranding(),
    apiFetch<MobileConfig>("/biometrics/mobile-config")
  ]);
  const companyName = branding.companyName || "Company HR Portal";

  return (
    <main className="mobile-time-shell">
      <section className="mobile-time-header">
        <div className="logo-mark">
          {branding.logoDataUrl ? <img src={branding.logoDataUrl} alt={`${companyName} logo`} /> : <Fingerprint size={26} />}
        </div>
        <div>
          <h1>Biometric Time In</h1>
          <p className="muted">{companyName}</p>
        </div>
      </section>
      <MobileAttendancePunch config={config} employeeMode />
    </main>
  );
}
