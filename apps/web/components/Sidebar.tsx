"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  Banknote,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  Database,
  FileClock,
  FileInput,
  FileSpreadsheet,
  Gauge,
  Gavel,
  Landmark,
  LayoutDashboard,
  Plane,
  ReceiptText,
  ShieldAlert,
  UserMinus,
  Users
} from "lucide-react";

const sections = [
  { title: "Dashboard", icon: LayoutDashboard, links: [{ href: "/dashboard", label: "Dashboard" }] },
  { title: "Administration", icon: ShieldAlert, links: [{ href: "/permissions", label: "Permissions" }, { href: "/admin-password-reset", label: "Password Reset" }, { href: "/audit-logs", label: "Audit Logs" }] },
  { title: "Masters", icon: Database, links: [{ href: "/company-profile", label: "Company Details" }, { href: "/departments", label: "Departments" }, { href: "/master-data", label: "Master Data" }] },
  { title: "Employee Management", icon: Users, links: [{ href: "/employees", label: "Employees" }, { href: "/employee-import", label: "Employee Import" }, { href: "/employee-export", label: "Employee Export" }, { href: "/employee-document-expiry", label: "Documents & Expiry" }, { href: "/employee-import-history", label: "Import History" }] },
  { title: "Time & Attendance", icon: CalendarClock, links: [{ href: "/attendance", label: "Attendance" }] },
  { title: "Leave Management", icon: FileClock, links: [{ href: "/leave", label: "Leave Requests" }, { href: "/notification-admin", label: "Approval Setup" }, { href: "/group-management?type=LEAVE", label: "Leave Groups" }] },
  { title: "Vacation Management", icon: FileInput, links: [{ href: "/leave-balance-upload", label: "Vacation Balances" }] },
  { title: "Loans & Advances", icon: Banknote, links: [{ href: "/master-data", label: "Loan Settings" }] },
  { title: "Travel Management", icon: Plane, links: [{ href: "/master-data", label: "Travel Settings" }] },
  { title: "My HRMS", icon: Bell, links: [{ href: "/employee/dashboard", label: "Self Service" }, { href: "/announcements", label: "Announcements" }] },
  { title: "Transfer Management", icon: BriefcaseBusiness, links: [{ href: "/group-management?type=EMPLOYEE", label: "Employee Groups" }] },
  { title: "Payroll", icon: ReceiptText, links: [{ href: "/payroll", label: "Payroll" }, { href: "/payroll-upload", label: "Payroll Upload" }, { href: "/group-management?type=PAYROLL", label: "Payroll Groups" }] },
  { title: "Recruitment Management", icon: ClipboardCheck, links: [{ href: "/master-data", label: "Recruitment Setup" }] },
  { title: "Performance Appraisal", icon: Gauge, links: [{ href: "/reports", label: "Performance Reports" }] },
  { title: "Government Affairs", icon: Landmark, links: [{ href: "/government-sync", label: "GOSI / Mudad / Qiwa" }, { href: "/compliance", label: "Compliance" }] },
  { title: "Separation", icon: UserMinus, links: [{ href: "/employee-document-expiry", label: "Exit Documents" }] },
  { title: "Disciplinary Actions", icon: Gavel, links: [{ href: "/audit-logs", label: "Action Logs" }] },
  { title: "Reports", icon: FileSpreadsheet, links: [{ href: "/reports", label: "Reports" }] }
];

const hrSections = sections.filter((section) => ["Dashboard", "Employee Management", "Leave Management", "Vacation Management", "Reports"].includes(section.title));

type SidebarBranding = {
  companyName?: string;
  logoDataUrl?: string;
  logoVersion?: number;
};

export function Sidebar({ branding, role }: { branding?: SidebarBranding; role?: string }) {
  const pathname = usePathname();
  const logoSrc = branding?.logoDataUrl ?? "";
  const visibleSections = role && ["HR", "HR_MANAGER", "HR_OFFICER"].includes(role) ? hrSections : sections;

  return (
    <aside className="sidebar">
      <div className="brand">
        {logoSrc ? <img src={logoSrc} alt={`${branding?.companyName ?? "Company"} logo`} /> : <Building2 size={34} />}
      </div>
      <nav className="nav">
        {visibleSections.map((section) => {
          const Icon = section.icon;
          const open = section.links.some((link) => pathname === link.href.split("?")[0]);
          return (
            <details className="nav-group" key={section.title} open={open || section.title === "Dashboard"}>
              <summary>
                <Icon size={15} />
                <span>{section.title}</span>
                <ChevronRight className="nav-chevron" size={13} />
              </summary>
              <div className="nav-children">
                {section.links.map((link) => (
                  <Link className={pathname === link.href.split("?")[0] ? "active" : ""} key={`${section.title}-${link.href}-${link.label}`} href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </details>
          );
        })}
      </nav>
    </aside>
  );
}
