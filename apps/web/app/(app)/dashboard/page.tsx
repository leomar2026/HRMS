import Link from "next/link";
import { AlertTriangle, Banknote, CalendarClock, CheckCircle2, Clock3, Download, FileDown, Plane, Plus, Printer, UserMinus, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Point = { label: string; value: number };
type DashboardData = {
  role: string;
  canSeePayroll: boolean;
  filters: Record<string, string>;
  summaryCards: Array<{ label: string; value: string | number; href: string; icon?: string }>;
  charts: {
    nationality: Point[];
    employeeStatus: Point[];
    departmentHeadcount: Point[];
    branchHeadcount: Point[];
    leaveTrend: Point[];
    payrollTrend: Point[];
    gender: Point[];
    employeeType: Point[];
    attendanceToday: Point[];
    requestStatus: Point[];
  };
  alerts: Array<{ label: string; count: number; href: string }>;
  recentActivities: Array<{ action: string; user: string; target: string; createdAt: string }>;
  pendingApprovals: Array<{ type: string; number: string; employeeName: string; status: string; submittedDate: string; agingDays: number; href: string }>;
  quickActions: Array<{ label: string; href: string }>;
};

const iconMap = {
  users: Users,
  check: CheckCircle2,
  minus: UserMinus,
  plus: Plus,
  calendar: CalendarClock,
  clock: Clock3,
  money: Banknote,
  plane: Plane,
  exit: UserMinus,
  alert: AlertTriangle,
  star: CheckCircle2
};

const colors = ["#0f766e", "#f0aa00", "#2563eb", "#dc2626", "#7c3aed", "#059669", "#ea580c", "#64748b", "#0891b2"];

function total(items: Point[]) {
  return items.reduce((sum, item) => sum + Number(item.value || 0), 0);
}

function PieChart({ title, items }: { title: string; items: Point[] }) {
  const sum = total(items);
  let cursor = 0;
  const gradient = items.length && sum
    ? items.map((item, index) => {
      const start = cursor;
      const end = cursor + (item.value / sum) * 100;
      cursor = end;
      return `${colors[index % colors.length]} ${start}% ${end}%`;
    }).join(", ")
    : "#e5e7eb 0 100%";
  return (
    <section className="dashboard-widget">
      <h2>{title}</h2>
      <div className="pie-layout">
        <div className="pie-chart" style={{ background: `conic-gradient(${gradient})` }} />
        <div className="chart-legend">
          {items.length ? items.map((item, index) => <span key={item.label}><i style={{ background: colors[index % colors.length] }} /> {item.label}: {item.value}{sum ? ` (${Math.round((item.value / sum) * 100)}%)` : ""}</span>) : <span>No records found.</span>}
        </div>
      </div>
    </section>
  );
}

function BarChart({ title, items }: { title: string; items: Point[] }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <section className="dashboard-widget">
      <h2>{title}</h2>
      <div className="bar-list">
        {items.length ? items.map((item) => <div className="bar-row" key={item.label}><span>{item.label}</span><div><i style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }} /></div><strong>{item.value}</strong></div>) : <p className="muted">No records found.</p>}
      </div>
    </section>
  );
}

function LineChart({ title, items }: { title: string; items: Point[] }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  const width = 420;
  const height = 120;
  const points = items.map((item, index) => {
    const x = items.length === 1 ? 0 : (index / (items.length - 1)) * width;
    const y = height - (item.value / max) * (height - 16) - 8;
    return `${x},${y}`;
  }).join(" ");
  return (
    <section className="dashboard-widget">
      <h2>{title}</h2>
      {items.length ? <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}><polyline points={points} fill="none" stroke="#0f766e" strokeWidth="3" /><g>{items.map((item, index) => {
        const x = items.length === 1 ? 0 : (index / (items.length - 1)) * width;
        const y = height - (item.value / max) * (height - 16) - 8;
        return <circle key={item.label} cx={x} cy={y} r="3.5" fill="#f0aa00" />;
      })}</g></svg> : <p className="muted">No records found.</p>}
      <div className="line-labels">{items.map((item) => <span key={item.label}>{item.label}</span>)}</div>
    </section>
  );
}

export default async function DashboardPage() {
  const data = await apiFetch<DashboardData>("/dashboard");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">HRMS Dashboard</h1>
          <p className="muted">Role-based operational snapshot for employees, approvals, attendance, payroll, and compliance.</p>
        </div>
        <div className="actions">
          <a className="button secondary" href="/api/backend/dashboard/print"><Printer size={15} /> Print</a>
          <a className="button secondary" href="/api/backend/dashboard/export.pdf"><FileDown size={15} /> PDF</a>
          <a className="button secondary" href="/api/backend/dashboard/summary.xlsx"><Download size={15} /> Excel</a>
        </div>
      </div>

      <form className="dashboard-filters">
        {Object.entries(data.filters).map(([key, value]) => <label key={key}><span>{key.replace(/([A-Z])/g, " $1")}</span><select defaultValue={value}><option>{value}</option></select></label>)}
      </form>

      <section className="dashboard-cards">
        {data.summaryCards.map((card) => {
          const Icon = iconMap[(card.icon ?? "users") as keyof typeof iconMap] ?? Users;
          return <Link className="dashboard-card" href={card.href} key={card.label}><Icon size={17} /><span>{card.label}</span><strong>{card.value}</strong></Link>;
        })}
      </section>

      <section className="dashboard-actions">
        {data.quickActions.map((action) => <Link className="button secondary" href={action.href} key={action.label}>{action.label}</Link>)}
      </section>

      <section className="dashboard-grid">
        <PieChart title="Nationality Distribution" items={data.charts.nationality} />
        <PieChart title="Employee Status" items={data.charts.employeeStatus} />
        <BarChart title="Employees by Department" items={data.charts.departmentHeadcount} />
        <BarChart title="Employees by Branch" items={data.charts.branchHeadcount} />
        <LineChart title="Monthly Leave Trend" items={data.charts.leaveTrend} />
        {data.canSeePayroll ? <LineChart title="Payroll Cost Trend" items={data.charts.payrollTrend} /> : null}
        <PieChart title="Gender Distribution" items={data.charts.gender} />
        <BarChart title="Employee Type" items={data.charts.employeeType} />
        <PieChart title="Today's Attendance" items={data.charts.attendanceToday} />
        <BarChart title="Pending Requests by Type" items={data.charts.requestStatus} />
      </section>

      <section className="dashboard-bottom">
        <div className="dashboard-widget">
          <h2>Alerts and Reminders</h2>
          <div className="alert-list">
            {data.alerts.map((alert) => <Link href={alert.href} key={alert.label}><strong>{alert.count}</strong><span>{alert.label}</span><em>View Details</em></Link>)}
          </div>
        </div>
        <div className="dashboard-widget">
          <h2>Pending Approvals</h2>
          <div className="table-wrap mini-table">
            <table><thead><tr><th>Type</th><th>Number</th><th>Employee</th><th>Status</th><th>Aging</th><th>Action</th></tr></thead><tbody>{data.pendingApprovals.map((row) => <tr key={`${row.type}-${row.number}`}><td>{row.type}</td><td>{row.number}</td><td>{row.employeeName}</td><td>{row.status}</td><td>{row.agingDays}d</td><td><Link href={row.href}>View</Link></td></tr>)}{data.pendingApprovals.length === 0 ? <tr><td colSpan={6}>No records found.</td></tr> : null}</tbody></table>
          </div>
        </div>
        <div className="dashboard-widget">
          <h2>Recent Activity</h2>
          <div className="activity-list">
            {data.recentActivities.map((activity) => <div key={`${activity.action}-${activity.createdAt}`}><strong>{activity.action.replace(/_/g, " ")}</strong><span>{activity.user} - {activity.target}</span><em>{new Date(activity.createdAt).toLocaleString()}</em></div>)}
          </div>
        </div>
      </section>
    </>
  );
}
