"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, Bell, BriefcaseBusiness, ClipboardCheck, FileClock, LayoutDashboard, LogOut, Plane, ReceiptText, Umbrella, UserMinus, UserRound } from "lucide-react";

const links = [
  { href: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employee/profile", label: "My Profile", icon: UserRound },
  { href: "/employee/payslips", label: "My Payslips", icon: ReceiptText },
  { href: "/employee/leaves", label: "Leave Requests", icon: FileClock },
  { href: "/employee/vacation-balance", label: "Vacation Balance", icon: Umbrella },
  { href: "/employee/loans", label: "Loans / Salary Advances", icon: Banknote },
  { href: "/employee/business-trips", label: "Business Trips", icon: BriefcaseBusiness },
  { href: "/employee/ticket-requests", label: "Ticket Requests", icon: Plane },
  { href: "/employee/petty-cash", label: "Petty Cash Requests", icon: Banknote },
  { href: "/employee/resignation", label: "Resignation Status", icon: UserMinus },
  { href: "/employee/approval-history", label: "My Approval History", icon: ClipboardCheck },
  { href: "/employee/notifications", label: "Notifications", icon: Bell }
];

type SidebarBranding = {
  companyName?: string;
  logoDataUrl?: string;
  logoVersion?: number;
};

export function EmployeeSidebar({ branding }: { branding?: SidebarBranding }) {
  const pathname = usePathname();
  const logoSrc = branding?.logoDataUrl ?? "";
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/login?loggedOut=1");
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        {logoSrc ? <img src={logoSrc} alt={`${branding?.companyName ?? "Company"} logo`} /> : null}
      </div>
      <nav className="nav simple-nav">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link className={pathname === link.href ? "active" : ""} key={`${link.href}-${link.label}`} href={link.href}>
              <Icon size={15} />
              {link.label}
            </Link>
          );
        })}
        <button type="button" onClick={logout}>
          <LogOut size={15} /> Logout
        </button>
      </nav>
    </aside>
  );
}
