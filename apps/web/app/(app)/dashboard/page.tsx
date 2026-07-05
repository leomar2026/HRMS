import { apiFetch } from "@/lib/api";

type Compliance = {
  activeEmployees: number;
  pendingLeaveApprovals: number;
  latestPayrollStatus: string;
  payrollRunsAwaitingMudadWpsExport: number;
  recordedAbsences: number;
};

export default async function DashboardPage() {
  const data = await apiFetch<Compliance>("/compliance/dashboard");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="muted">Operational snapshot for HR, payroll, attendance, and Saudi compliance workflows.</p>
        </div>
      </div>
      <section className="grid cols-4">
        <div className="panel"><span className="muted">Active employees</span><div className="metric">{data.activeEmployees}</div></div>
        <div className="panel"><span className="muted">Pending leave</span><div className="metric">{data.pendingLeaveApprovals}</div></div>
        <div className="panel"><span className="muted">Payroll status</span><div className="metric">{data.latestPayrollStatus}</div></div>
        <div className="panel"><span className="muted">Recorded absences</span><div className="metric">{data.recordedAbsences}</div></div>
      </section>
    </>
  );
}
