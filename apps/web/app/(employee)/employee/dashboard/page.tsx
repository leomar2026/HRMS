import { apiFetch } from "@/lib/api";

type Dashboard = {
  employee: {
    employeeCode: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    leaveBalance: number;
    department: { name: string };
    manager?: { firstName: string; lastName: string } | null;
    documents?: Array<{ id: string; documentType: string; expiryDate?: string }>;
  };
  pendingLeaves: number;
  latestPayslip?: { netSalary: string; paymentDate?: string; batch?: { month: number; year: number; status: string } };
  notifications: Array<{ id: string; title: string; message: string; createdAt: string }>;
};

export default async function EmployeeDashboardPage() {
  const dashboard = await apiFetch<Dashboard>("/employee/me/dashboard");
  const employee = dashboard.employee;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Welcome, {employee.firstName}</h1>
          <p className="muted">{employee.employeeCode} · {employee.jobTitle} · {employee.department.name}</p>
          <p className="muted">Manager: {employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "Not assigned"}</p>
        </div>
        <div className="actions">
          <a className="button" href="/employee/payslips">View Payslip</a>
          <a className="button secondary" href="/employee/leaves">Apply Leave</a>
          <a className="button secondary" href="/employee/vacation-balance">Vacation Balance</a>
          <a className="button secondary" href="/employee/leaves">My Leave Requests</a>
        </div>
      </div>

      <section className="grid cols-4">
        <div className="panel"><span className="muted">Current leave balance</span><div className="metric">{employee.leaveBalance}</div></div>
        <div className="panel"><span className="muted">Pending leave requests</span><div className="metric">{dashboard.pendingLeaves}</div></div>
        <div className="panel"><span className="muted">Latest approved payslip</span><div className="metric">{dashboard.latestPayslip?.netSalary ?? "-"}</div></div>
        <div className="panel"><span className="muted">Expiry alerts</span><div className="metric">{employee.documents?.length ?? 0}</div></div>
      </section>

      <div style={{ height: 16 }} />
      <section className="grid cols-3">
        <div className="panel">
          <h2>Upcoming Expiry Alerts</h2>
          {(employee.documents ?? []).length === 0 ? <p className="muted">No upcoming document alerts.</p> : null}
          {(employee.documents ?? []).map((document) => (
            <p key={document.id}>{document.documentType}: {document.expiryDate ? new Date(document.expiryDate).toLocaleDateString() : "No expiry date"}</p>
          ))}
        </div>
        <div className="panel">
          <h2>Recent Notifications</h2>
          {dashboard.notifications.map((notification) => (
            <p key={notification.id}><strong>{notification.title}</strong><br /><span className="muted">{notification.message}</span></p>
          ))}
        </div>
      </section>
    </>
  );
}
