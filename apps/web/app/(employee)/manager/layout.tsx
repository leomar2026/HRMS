import { ManagerSidebar } from "@/components/ManagerSidebar";
import { Topbar } from "@/components/SessionControls";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <ManagerSidebar />
      <main className="content"><Topbar />{children}</main>
    </div>
  );
}
