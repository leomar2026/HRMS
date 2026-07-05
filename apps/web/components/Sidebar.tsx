import Link from "next/link";
import { Bell, Building2, CalendarClock, ClipboardCheck, Database, FileClock, FileInput, FileSpreadsheet, Gauge, KeyRound, Landmark, LayoutDashboard, ReceiptText, Users } from "lucide-react";

const sections = [
  {
    title: "Dashboard",
    links: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }]
  },
  {
    title: "HR Management",
    links: [
      { href: "/employees", label: "Employee Master", icon: Users },
      { href: "/employee-import", label: "Employee Import", icon: FileInput },
      { href: "/employee-export", label: "Employee Export", icon: FileSpreadsheet },
      { href: "/group-management?type=EMPLOYEE", label: "Employee Groups", icon: Users },
      { href: "/employee-document-expiry", label: "Documents & Expiry", icon: FileClock },
      { href: "/employee-import-history", label: "Import History", icon: ClipboardCheck }
    ]
  },
  {
    title: "Organization Setup",
    links: [
      { href: "/departments", label: "Departments", icon: Building2 },
      { href: "/company-profile", label: "Company Details", icon: Building2 },
      { href: "/master-data", label: "Master Data", icon: Database }
    ]
  },
  {
    title: "Leave Management",
    links: [
      { href: "/leave", label: "Leave Requests", icon: FileClock },
      { href: "/leave-balance-upload", label: "Leave Balances", icon: FileInput },
      { href: "/group-management?type=LEAVE", label: "Leave Groups", icon: Users }
    ]
  },
  {
    title: "Attendance Management",
    links: [{ href: "/attendance", label: "Attendance", icon: CalendarClock }]
  },
  {
    title: "Payroll Management",
    links: [
      { href: "/payroll", label: "Payroll", icon: ReceiptText },
      { href: "/payroll-upload", label: "Payroll Upload", icon: FileInput },
      { href: "/group-management?type=PAYROLL", label: "Payroll Groups", icon: Users }
    ]
  },
  {
    title: "Government Integration",
    links: [
      { href: "/government-sync", label: "GOSI / Mudad / Qiwa", icon: Landmark },
      { href: "/compliance", label: "Compliance", icon: Gauge }
    ]
  },
  {
    title: "Reports & Admin",
    links: [
      { href: "/reports", label: "Reports", icon: FileSpreadsheet },
      { href: "/permissions", label: "Permissions", icon: KeyRound },
      { href: "/admin-password-reset", label: "Password Reset", icon: KeyRound },
      { href: "/notification-admin", label: "Leave Notifications", icon: Bell },
      { href: "/group-management", label: "All Groups", icon: Users },
      { href: "/announcements", label: "Announcements", icon: Bell },
      { href: "/audit-logs", label: "Audit Logs", icon: ClipboardCheck }
    ]
  }
];

type SidebarBranding = {
  companyName?: string;
  logoDataUrl?: string;
  logoVersion?: number;
};

export function Sidebar({ branding }: { branding?: SidebarBranding }) {
  const logoSrc = branding?.logoDataUrl ?? "";

  return (
    <aside className="sidebar">
      <div className="brand">
        {logoSrc ? <img src={logoSrc} alt={`${branding?.companyName ?? "Company"} logo`} /> : null}
        <span>{branding?.companyName ?? "Company HR Portal"}</span>
      </div>
      <nav className="nav">
        {sections.map((section) => (
          <div className="nav-section" key={section.title}>
            <div className="nav-heading">{section.title}</div>
            {section.links.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={`${section.title}-${link.href}-${link.label}`} href={link.href}>
                  <Icon size={18} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
