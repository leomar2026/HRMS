import { ProfileAvatar } from "@/components/ProfilePhoto";
import { apiFetch } from "@/lib/api";

type Dashboard = {
  employee: {
    employeeCode: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    branch?: string;
    status?: string;
    joiningDate?: string;
    leaveBalance: number;
    photoUrl?: string;
    profilePhotoPath?: string;
    department: { name: string };
    manager?: { firstName: string; lastName: string } | null;
    documents?: Array<{ id: string; documentType: string; expiryDate?: string }>;
  };
  pendingLeaves: number;
  pendingLoans?: number;
  pendingBusinessTrips?: number;
  pendingPettyCash?: number;
  pendingResignation?: { status?: string } | null;
  latestPayslip?: { netSalary: string; paymentDate?: string; batch?: { month: number; year: number; status: string } };
  recentPayslips?: Array<{ id: string; netSalary: string; documentReference?: string }>;
  notifications: Array<{ id: string; title: string; message: string; createdAt: string }>;
};

export default async function EmployeeDashboardPage() {
  const dashboard = await apiFetch<Dashboard>("/employee/me/dashboard");
  const employee = dashboard.employee;

  return (
    <>
      <div className="page-head">
        <div className="employee-identity">
          <ProfileAvatar employee={employee} size={72} />
          <div>
            <h1 className="page-title">Welcome, {employee.firstName}</h1>
            <p className="muted">{employee.employeeCode} - {employee.jobTitle} - {employee.department.name}</p>
            <p className="muted">Branch: {employee.branch ?? "-"} | Status: {employee.status ?? "-"} | Joining: {employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString() : "-"}</p>
            <p className="muted">Manager: {employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "Not assigned"}</p>
          </div>
        </div>
        <div className="actions">
          <a className="button" href="/employee/leaves">Apply Leave</a>
          <a className="button secondary" href="/employee/payslips">View Payslip</a>
          <a className="button secondary" href="/employee/vacation-balance">Vacation Balance</a>
        </div>
      </div>

      <section className="grid cols-4">
        <div className="panel"><span className="muted">Annual leave balance</span><div className="metric">{employee.leaveBalance}</div></div>
        <div className="panel"><span className="muted">Pending leave requests</span><div className="metric">{dashboard.pendingLeaves}</div></div>
        <div className="panel"><span className="muted">Latest payslip</span><div className="metric">{dashboard.latestPayslip?.netSalary ?? "-"}</div></div>
        <div className="panel"><span className="muted">Document alerts</span><div className="metric">{employee.documents?.length ?? 0}</div></div>
        <div className="panel"><span className="muted">Pending loans</span><div className="metric">{dashboard.pendingLoans ?? 0}</div></div>
        <div className="panel"><span className="muted">Business trips</span><div className="metric">{dashboard.pendingBusinessTrips ?? 0}</div></div>
        <div className="panel"><span className="muted">Petty cash</span><div className="metric">{dashboard.pendingPettyCash ?? 0}</div></div>
        <div className="panel"><span className="muted">Resignation</span><div className="metric">{dashboard.pendingResignation?.status ?? "-"}</div></div>
      </section>

      <div style={{ height: 16 }} />
      <section className="grid cols-3">
        <div className="panel">
          <h2>My Document Expiry Alerts</h2>
          {(employee.documents ?? []).length === 0 ? <p className="muted">No upcoming document alerts.</p> : null}
          {(employee.documents ?? []).map((document) => (
            <p key={document.id}>{document.documentType}: {document.expiryDate ? new Date(document.expiryDate).toLocaleDateString() : "No expiry date"}</p>
          ))}
        </div>
        <div className="panel">
          <h2>My Recent Payslips</h2>
          {(dashboard.recentPayslips ?? []).length === 0 ? <p className="muted">No recent payslips.</p> : null}
          {(dashboard.recentPayslips ?? []).map((payslip) => (
            <p key={payslip.id}><strong>{payslip.documentReference ?? payslip.id}</strong><br /><span className="muted">{payslip.netSalary}</span></p>
          ))}
        </div>
        <div className="panel">
          <h2>My Notifications</h2>
          {dashboard.notifications.length === 0 ? <p className="muted">No notifications.</p> : null}
          {dashboard.notifications.map((notification) => (
            <p key={notification.id}><strong>{notification.title}</strong><br /><span className="muted">{notification.message}</span></p>
          ))}
        </div>
      </section>
    </>
  );
}
