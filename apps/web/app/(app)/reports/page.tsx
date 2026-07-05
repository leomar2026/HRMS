import { apiFetch } from "@/lib/api";

type Catalog = { category: string; reports: string[] };
type Dashboard = {
  totalEmployees: number;
  activeEmployees: number;
  pendingLeaves: number;
  pendingPayroll: number;
  expiringIqama: number;
  expiringPassport: number;
  expiringContracts: number;
  monthlyPayrollCost: string | number;
  gosiEstimatedContribution: string | number;
};

export default async function ReportsPage() {
  const [catalog, dashboard] = await Promise.all([
    apiFetch<Catalog[]>("/reports/catalog"),
    apiFetch<Dashboard>("/reports/dashboard")
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Reporting Center</h1>
          <p className="muted">Centralized HR, leave, attendance, payroll, government, and audit reports.</p>
        </div>
        <div className="actions">
          <a className="button secondary" href="/api/backend/reports/audit-trail.csv">Export Audit CSV</a>
        </div>
      </div>
      <section className="grid cols-4">
        <div className="panel"><span className="muted">Total employees</span><div className="metric">{dashboard.totalEmployees}</div></div>
        <div className="panel"><span className="muted">Active</span><div className="metric">{dashboard.activeEmployees}</div></div>
        <div className="panel"><span className="muted">Expiring Iqama</span><div className="metric">{dashboard.expiringIqama}</div></div>
        <div className="panel"><span className="muted">Payroll cost</span><div className="metric">{dashboard.monthlyPayrollCost}</div></div>
      </section>
      <div style={{ height: 16 }} />
      <section className="grid cols-3">
        {catalog.map((group) => (
          <article className="panel" key={group.category}>
            <h2>{group.category}</h2>
            {group.reports.map((report) => <p className="muted" key={report}>{report}</p>)}
          </article>
        ))}
      </section>
    </>
  );
}
