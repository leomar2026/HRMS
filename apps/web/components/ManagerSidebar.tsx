"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarClock, ClipboardCheck, Clock, FileClock, LayoutDashboard, LogOut, Users } from "lucide-react";

const managerLinks = [
  { href: "/manager/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/manager/my-team", label: "My Team", icon: Users },
  { href: "/manager/my-approvals", label: "My Approvals", icon: ClipboardCheck },
  { href: "/manager/leave-approvals", label: "Pending Approvals", icon: FileClock },
  { href: "/manager/team-attendance", label: "Team Attendance", icon: Clock },
  { href: "/manager/team-calendar", label: "Team Calendar", icon: CalendarClock },
  { href: "/manager/team-balances", label: "Team Leave History", icon: FileClock },
  { href: "/employee/notifications", label: "Notifications", icon: Bell }
];

const omLinks = [
  { href: "/om/leave-approvals", label: "Dashboard", icon: LayoutDashboard },
  { href: "/om/leave-approvals", label: "Pending OM Approvals", icon: ClipboardCheck },
  { href: "/manager/my-team", label: "My Team", icon: Users },
  { href: "/manager/my-approvals", label: "My Approvals", icon: FileClock },
  { href: "/manager/team-attendance", label: "Team Attendance", icon: Clock },
  { href: "/manager/team-calendar", label: "Team Calendar", icon: CalendarClock },
  { href: "/employee/notifications", label: "Notifications", icon: Bell }
];

type SidebarBranding = {
  companyName?: string;
  logoDataUrl?: string;
  logoVersion?: number;
};

export function ManagerSidebar({ branding, role }: { branding?: SidebarBranding; role?: string }) {
  const pathname = usePathname();
  const logoSrc = branding?.logoDataUrl ?? "";
  const links = role === "OPERATIONS_MANAGER" ? omLinks : managerLinks;
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
