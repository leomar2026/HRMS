import { ProfileAvatar } from "@/components/ProfilePhoto";
import { apiFetch } from "@/lib/api";

type EmployeeMini = {
  employeeCode: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  branch?: string;
  photoUrl?: string;
  profilePhotoPath?: string;
  department: { name: string };
};

type ManagerDashboard = {
  manager?: EmployeeMini;
  directReportsCount: number;
  employeesPresentToday: number;
  employeesOnLeaveToday: number;
  employeesScheduledForLeave: number;
  pendingLoans: number;
  pendingBusinessTrips: number;
  pendingPettyCash: number;
  pendingResignations: number;
  pendingAttendanceAdjustments: number;
  teamDocumentExpiryAlerts: number;
  directReports: EmployeeMini[];
  pendingApprovals: Array<{
    id: string;
    requestType: string;
    requestNumber?: string;
    employee: EmployeeMini;
    department: { name: string };
    submittedDate: string;
    currentStatus: string;
    agingDays: number;
    actionUrl: string;
  }>;
};

export default async function ManagerDashboardPage() {
  const dashboard = await apiFetch<ManagerDashboard>("/manager/dashboard");
  const manager = dashboard.manager;

  return (
    <>
      <div className="page-head">
        <div className="employee-identity">
          {manager ? <ProfileAvatar employee={manager} size={72} /> : null}
          <div>
            <h1 className="page-title">Team Dashboard</h1>
            <p className="muted">{manager ? `${manager.employeeCode} - ${manager.jobTitle} - ${manager.department.name}` : "Direct-report monitoring and approvals"}</p>
            <p className="muted">Direct reports: {dashboard.directReportsCount}</p>
          </div>
        </div>
        <div className="actions">
          <a className="button" href="/manager/leave-approvals">Pending Approvals</a>
          <a className="button secondary" href="/manager/team-attendance">Team Attendance</a>
          <a className="button secondary" href="/manager/my-team">My Team</a>
        </div>
      </div>

      <section className="grid cols-4">
        <div className="panel"><span className="muted">Direct reports</span><div className="metric">{dashboard.directReportsCount}</div></div>
        <div className="panel"><span className="muted">Present today</span><div className="metric">{dashboard.employeesPresentToday}</div></div>
        <div className="panel"><span className="muted">On leave today</span><div className="metric">{dashboard.employeesOnLeaveToday}</div></div>
        <div className="panel"><span className="muted">Upcoming leaves</span><div className="metric">{dashboard.employeesScheduledForLeave}</div></div>
        <div className="panel"><span className="muted">Leave approvals</span><div className="metric">{dashboard.pendingApprovals.length}</div></div>
        <div className="panel"><span className="muted">Loan approvals</span><div className="metric">{dashboard.pendingLoans}</div></div>
        <div className="panel"><span className="muted">Trip approvals</span><div className="metric">{dashboard.pendingBusinessTrips}</div></div>
        <div className="panel"><span className="muted">Document alerts</span><div className="metric">{dashboard.teamDocumentExpiryAlerts}</div></div>
      </section>

      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Request Type</th><th>Request Number</th><th>Employee</th><th>Department</th><th>Submitted</th><th>Status</th><th>Aging</th><th>Actions</th></tr></thead>
          <tbody>
            {dashboard.pendingApprovals.length ? dashboard.pendingApprovals.map((approval) => (
              <tr key={approval.id}>
                <td>{approval.requestType}</td>
                <td>{approval.requestNumber ?? approval.id}</td>
                <td><div className="employee-identity"><ProfileAvatar employee={approval.employee} size={34} /><span>{approval.employee.employeeCode} - {approval.employee.firstName} {approval.employee.lastName}</span></div></td>
                <td>{approval.department.name}</td>
                <td>{new Date(approval.submittedDate).toLocaleDateString()}</td>
                <td><span className="status warn">{approval.currentStatus}</span></td>
                <td>{approval.agingDays} day(s)</td>
                <td><a className="button secondary small" href={approval.actionUrl}>View</a></td>
              </tr>
            )) : <tr><td colSpan={8}>No records found.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ height: 16 }} />
      <section className="grid cols-3">
        {dashboard.directReports.slice(0, 6).map((employee) => (
          <div className="panel employee-identity" key={employee.employeeCode}>
            <ProfileAvatar employee={employee} size={44} />
            <div><strong>{employee.firstName} {employee.lastName}</strong><span className="muted">{employee.employeeCode} - {employee.jobTitle}</span></div>
          </div>
        ))}
      </section>
    </>
  );
}
