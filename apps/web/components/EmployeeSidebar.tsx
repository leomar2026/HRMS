"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ClipboardCheck, FileClock, LayoutDashboard, LogOut, ReceiptText, Umbrella } from "lucide-react";

const links = [
  { href: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employee/payslips", label: "My Payslips", icon: ReceiptText },
  { href: "/employee/leaves", label: "Apply Leave", icon: FileClock },
  { href: "/employee/leaves", label: "My Leave Requests", icon: FileClock },
  { href: "/employee/vacation-balance", label: "Vacation Balance", icon: Umbrella },
  { href: "/employee/approval-history", label: "Approval Timeline", icon: ClipboardCheck },
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
