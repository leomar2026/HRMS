import { ManagerSidebar } from "@/components/ManagerSidebar";
import { Topbar } from "@/components/SessionControls";
import { apiFetch } from "@/lib/api";

type CompanyBranding = {
  companyName?: string;
  logoDataUrl?: string;
  logoVersion?: number;
};

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const branding = await apiFetch<CompanyBranding>("/company-profile");

  return (
    <div className="app-shell">
      <ManagerSidebar branding={branding} />
      <main className="content"><Topbar />{children}</main>
    </div>
  );
}
