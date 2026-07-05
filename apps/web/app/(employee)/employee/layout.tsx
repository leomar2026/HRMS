import { EmployeeSidebar } from "@/components/EmployeeSidebar";
import { Topbar } from "@/components/SessionControls";
import { apiFetch } from "@/lib/api";

type CompanyBranding = {
  companyName?: string;
  logoDataUrl?: string;
  logoVersion?: number;
};

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const branding = await apiFetch<CompanyBranding>("/company-profile");

  return (
    <div className="app-shell">
      <EmployeeSidebar branding={branding} />
      <main className="content"><Topbar />{children}</main>
    </div>
  );
}
