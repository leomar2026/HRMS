import { EmployeeSidebar } from "@/components/EmployeeSidebar";
import { Topbar } from "@/components/SessionControls";
import { CompactTableEnhancer } from "@/components/CompactTableEnhancer";
import { apiFetch } from "@/lib/api";

type CompanyBranding = {
  companyName?: string;
  logoDataUrl?: string;
  logoVersion?: number;
};

type CurrentUser = {
  email?: string;
  role?: string;
  employee?: { firstName?: string; lastName?: string };
};

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const [branding, user] = await Promise.all([
    apiFetch<CompanyBranding>("/company-profile"),
    apiFetch<CurrentUser>("/auth/me")
  ]);

  return (
    <div className="app-shell">
      <EmployeeSidebar branding={branding} />
      <main className="content"><Topbar user={user} />{children}<CompactTableEnhancer /></main>
    </div>
  );
}
