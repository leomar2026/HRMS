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
  { title: "Administration", icon: ShieldAlert, links: [{ href: "/permissions", label: "Permissions" }, { href: "/workflow-setup", label: "Approval Workflow Setup" }, { href: "/admin-password-reset", label: "Password Reset" }, { href: "/audit-logs", label: "Audit Logs" }] },
  {
    title: "Master Data",
    icon: Database,
    links: [
      { href: "/company-profile", label: "Company Master" },
      { href: "/branch-master", label: "Branch Master" },
      { href: "/location-master", label: "Location Master" },
      { href: "/departments", label: "Department Master" },
      { href: "/job-title-master", label: "Job Title Master" },
      { href: "/cost-center-master", label: "Cost Center Master" },
      { href: "/leave-type-master", label: "Leave Type Master" },
      { href: "/leave-policy-master", label: "Leave Policy Master" },
      { href: "/shift-master", label: "Shift Master" },
      { href: "/holiday-calendar", label: "Holiday Calendar" },
      { href: "/payroll-component-master", label: "Payroll Component Master" },
      { href: "/bank-master", label: "Bank Master" },
      { href: "/document-type-master", label: "Document Type Master" },
      { href: "/workflow-master", label: "Workflow Master" }
    ]
  },
  { title: "Employee Management", icon: Users, links: [{ href: "/employees", label: "Employees" }, { href: "/employee-import", label: "Employee Import" }, { href: "/employee-export", label: "Employee Export" }, { href: "/employee-document-expiry", label: "Documents & Expiry" }, { href: "/employee-import-history", label: "Import History" }] },
  { title: "Time & Attendance", icon: CalendarClock, links: [{ href: "/attendance", label: "Attendance" }, { href: "/biometric-devices", label: "Biometric Devices" }, { href: "/biometric-mapping", label: "Biometric Mapping" }, { href: "/biometric-attendance", label: "Attendance Records" }, { href: "/biometric-logs", label: "Device Logs" }] },
  { title: "Leave Management", icon: FileClock, links: [{ href: "/leave", label: "Leave Requests" }, { href: "/notification-admin", label: "Approval Setup" }, { href: "/group-management?type=LEAVE", label: "Leave Groups" }] },
  { title: "Vacation Management", icon: FileInput, links: [{ href: "/leave-balance-upload", label: "Vacation Balances" }] },
  { title: "Loans & Advances", icon: Banknote, links: [{ href: "/loans", label: "Loans & Advances" }, { href: "/petty-cash", label: "Petty Cash Requests" }, { href: "/master-data?type=LOAN_TYPE", label: "Loan Settings" }] },
  { title: "Travel Management", icon: Plane, links: [{ href: "/business-trips", label: "Business Trips" }, { href: "/ticket-requests", label: "Ticket Requests" }, { href: "/master-data?type=TRAVEL_METHOD", label: "Travel Settings" }] },
  { title: "My HRMS", icon: Bell, links: [{ href: "/employee/dashboard", label: "Self Service" }, { href: "/announcements", label: "Announcements" }] },
  { title: "Transfer Management", icon: BriefcaseBusiness, links: [{ href: "/group-management?type=EMPLOYEE", label: "Employee Groups" }] },
  { title: "Payroll", icon: ReceiptText, links: [{ href: "/payroll", label: "Payroll" }, { href: "/payroll-upload", label: "Payroll Upload" }, { href: "/group-management?type=PAYROLL", label: "Payroll Groups" }] },
  { title: "Performance Appraisal", icon: Gauge, links: [{ href: "/performance-appraisals#manual-appraisal", label: "Manual Appraisal" }, { href: "/performance-appraisals#bulk-appraisal-upload", label: "Bulk Appraisal Upload" }, { href: "/performance-appraisals", label: "Appraisal Approval" }, { href: "/performance-appraisals", label: "Appraisal History" }, { href: "/reports", label: "Appraisal Reports" }] },
  { title: "Government Affairs", icon: Landmark, links: [{ href: "/government-sync", label: "GOSI / Mudad / Qiwa" }, { href: "/compliance", label: "Compliance" }] },
  { title: "Separation", icon: UserMinus, links: [{ href: "/resignations", label: "Resignation Requests" }, { href: "/exit-clearance", label: "Exit Clearance" }, { href: "/final-settlements", label: "Final Settlements" }] },
  {
    title: "Reports",
    icon: FileSpreadsheet,
    links: [
      { href: "/reports?report=employee-master", label: "Employee Reports" },
      { href: "/reports?report=leave-requests", label: "Leave & Vacation Reports" },
      { href: "/reports?report=attendance-daily", label: "Attendance Reports" },
      { href: "/reports?report=payroll-register", label: "Payroll Reports" },
      { href: "/reports?report=loan-requests", label: "Loan & Advance Reports" },
      { href: "/reports?report=business-trips", label: "Business Trip Reports" },
      { href: "/reports?report=ticket-requests", label: "Ticket Request Reports" },
      { href: "/reports?report=petty-cash", label: "Petty Cash Reports" },
      { href: "/reports?report=appraisal-report", label: "Appraisal Reports" },
      { href: "/reports?report=resignation-report", label: "Resignation & Exit Reports" },
      { href: "/reports?report=government-integration-log", label: "Government Reports" },
      { href: "/reports?report=master-data", label: "Master Data Reports" },
      { href: "/reports?report=pending-approvals", label: "Workflow & Approval Reports" },
      { href: "/reports?report=audit-log", label: "Audit & Security Reports" }
    ]
  }
];

const hrSections = sections.filter((section) => ["Dashboard", "Employee Management", "Time & Attendance", "Leave Management", "Vacation Management", "Performance Appraisal", "Reports"].includes(section.title));
const managerAppSections = sections.filter((section) => ["Performance Appraisal"].includes(section.title));

type SidebarBranding = {
  companyName?: string;
  logoDataUrl?: string;
  logoVersion?: number;
};

export function Sidebar({ branding, role }: { branding?: SidebarBranding; role?: string }) {
  const pathname = usePathname();
  const logoSrc = branding?.logoDataUrl ?? "";
  const visibleSections = role && ["DEPARTMENT_MANAGER", "OPERATIONS_MANAGER"].includes(role) ? managerAppSections : role && ["HR", "HR_MANAGER", "HR_OFFICER"].includes(role) ? hrSections : sections;

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
