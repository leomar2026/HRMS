import Link from "next/link";
import { CalendarClock, ClipboardCheck, FileClock, LayoutDashboard, Users } from "lucide-react";

const links = [
  { href: "/manager/dashboard", label: "Team Dashboard", icon: LayoutDashboard },
  { href: "/manager/leave-approvals", label: "Pending Leave Approvals", icon: ClipboardCheck },
  { href: "/manager/team-calendar", label: "Team Leave Calendar", icon: CalendarClock },
  { href: "/manager/team-balances", label: "Team Leave Balances", icon: FileClock },
  { href: "/employee/dashboard", label: "My Self-Service", icon: Users }
];

type SidebarBranding = {
  companyName?: string;
  logoDataUrl?: string;
  logoVersion?: number;
};

export function ManagerSidebar({ branding }: { branding?: SidebarBranding }) {
  const logoSrc = branding?.logoDataUrl ?? "";

  return (
    <aside className="sidebar">
      <div className="brand">
        {logoSrc ? <img src={logoSrc} alt={`${branding?.companyName ?? "Company"} logo`} /> : null}
        <span>{branding?.companyName ?? "Manager Portal"}</span>
      </div>
      <nav className="nav">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <Icon size={18} />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
