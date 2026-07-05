import { apiFetch } from "@/lib/api";

type ManagerDashboard = {
  directReports: Array<{ id: string; employeeCode: string; firstName: string; lastName: string; leaveBalance: number; department: { name: string } }>;
};

export default async function TeamBalancesPage() {
  const dashboard = await apiFetch<ManagerDashboard>("/manager/dashboard");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Team Leave Balances</h1>
          <p className="muted">View-only balance summary for direct reports.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Employee Code</th><th>Employee Name</th><th>Department</th><th>Available Balance</th></tr></thead>
          <tbody>
            {dashboard.directReports.map((employee) => (
              <tr key={employee.id}>
                <td>{employee.employeeCode}</td>
                <td>{employee.firstName} {employee.lastName}</td>
                <td>{employee.department.name}</td>
                <td><span className="status">{employee.leaveBalance}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
