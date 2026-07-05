import { EmployeeSidebar } from "@/components/EmployeeSidebar";
import { Topbar } from "@/components/SessionControls";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <EmployeeSidebar />
      <main className="content"><Topbar />{children}</main>
    </div>
  );
}
