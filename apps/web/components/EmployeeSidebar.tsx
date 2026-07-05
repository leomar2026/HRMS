import Link from "next/link";
import { Bell, CalendarClock, ClipboardCheck, FileClock, LayoutDashboard, ReceiptText, Umbrella, UserRound } from "lucide-react";

const links = [
  { href: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employee/profile", label: "My Profile", icon: UserRound },
  { href: "/employee/attendance", label: "My Attendance", icon: CalendarClock },
  { href: "/employee/leaves", label: "My Leaves", icon: FileClock },
  { href: "/employee/vacation-balance", label: "Vacation Balance", icon: Umbrella },
  { href: "/employee/approval-history", label: "Approval History", icon: ClipboardCheck },
  { href: "/employee/payslips", label: "My Payslips", icon: ReceiptText },
  { href: "/employee/notifications", label: "Notifications", icon: Bell },
  { href: "/employee/announcements", label: "Announcements", icon: Bell }
];

export function EmployeeSidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">Employee Portal</div>
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
