import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/SessionControls";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content"><Topbar />{children}</main>
    </div>
  );
}
