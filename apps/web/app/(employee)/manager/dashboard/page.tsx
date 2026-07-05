import { apiFetch } from "@/lib/api";

type ManagerDashboard = {
  directReportsCount: number;
  employeesCurrentlyOnLeave: number;
  employeesScheduledForLeave: number;
  pendingLeaves: Array<{ id: string; requestNumber?: string; type: string; days: number; employee: { employeeCode: string; firstName: string; lastName: string } }>;
};

export default async function ManagerDashboardPage() {
  const dashboard = await apiFetch<ManagerDashboard>("/manager/dashboard");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Team Dashboard</h1>
          <p className="muted">Direct reports, leave approval queue, and team leave alerts.</p>
        </div>
        <div className="actions">
          <a className="button" href="/manager/leave-approvals">Pending Approvals</a>
          <a className="button secondary" href="/employee/dashboard">My Self-Service</a>
        </div>
      </div>
      <section className="grid cols-4">
        <div className="panel"><span className="muted">Direct reports</span><div className="metric">{dashboard.directReportsCount}</div></div>
        <div className="panel"><span className="muted">Pending leave requests</span><div className="metric">{dashboard.pendingLeaves.length}</div></div>
        <div className="panel"><span className="muted">Currently on leave</span><div className="metric">{dashboard.employeesCurrentlyOnLeave}</div></div>
        <div className="panel"><span className="muted">Scheduled leave</span><div className="metric">{dashboard.employeesScheduledForLeave}</div></div>
      </section>
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Request</th><th>Employee</th><th>Type</th><th>Days</th><th>Status</th></tr></thead>
          <tbody>
            {dashboard.pendingLeaves.map((leave) => (
              <tr key={leave.id}>
                <td>{leave.requestNumber ?? leave.id}</td>
                <td>{leave.employee.employeeCode} - {leave.employee.firstName} {leave.employee.lastName}</td>
                <td>{leave.type}</td>
                <td>{leave.days}</td>
                <td><span className="status warn">Pending Manager Approval</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
