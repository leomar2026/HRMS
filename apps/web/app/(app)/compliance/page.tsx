import { apiFetch } from "@/lib/api";

type Compliance = {
  activeEmployees: number;
  pendingLeaveApprovals: number;
  latestPayrollStatus: string;
  payrollRunsAwaitingMudadWpsExport: number;
  checks: Array<{ name: string; status: string }>;
};

export default async function CompliancePage() {
  const compliance = await apiFetch<Compliance>("/compliance/dashboard");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Saudi Compliance</h1>
          <p className="muted">Compliance-focused payroll, leave, attendance, and connector readiness status.</p>
        </div>
      </div>
      <section className="grid cols-4">
        <div className="panel"><span className="muted">Active employees</span><div className="metric">{compliance.activeEmployees}</div></div>
        <div className="panel"><span className="muted">Pending leave</span><div className="metric">{compliance.pendingLeaveApprovals}</div></div>
        <div className="panel"><span className="muted">Payroll exports due</span><div className="metric">{compliance.payrollRunsAwaitingMudadWpsExport}</div></div>
        <div className="panel"><span className="muted">Latest payroll</span><div className="metric">{compliance.latestPayrollStatus}</div></div>
      </section>
      <div style={{ height: 16 }} />
      <section className="grid cols-3">
        {compliance.checks.map((check) => (
          <article className="panel" key={check.name}>
            <h2>{check.name}</h2>
            <span className={check.status === "ACTION_REQUIRED" ? "status warn" : "status"}>{check.status}</span>
          </article>
        ))}
      </section>
    </>
  );
}
