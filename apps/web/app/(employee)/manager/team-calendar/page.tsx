import { apiFetch } from "@/lib/api";

type Leave = {
  id: string;
  requestNumber?: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  workflowStage?: string;
  employee: { employeeCode: string; firstName: string; lastName: string; department: { name: string } };
};

export default async function TeamCalendarPage() {
  const leaves = await apiFetch<Leave[]>("/manager/leave-approvals");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Team Leave Calendar</h1>
          <p className="muted">Direct-report leave schedule and overlapping leave visibility.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Employee</th><th>Department</th><th>Leave Type</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
          <tbody>
            {leaves.map((leave) => (
              <tr key={leave.id}>
                <td>{leave.employee.employeeCode} - {leave.employee.firstName} {leave.employee.lastName}</td>
                <td>{leave.employee.department.name}</td>
                <td>{leave.type}</td>
                <td>{new Date(leave.startDate).toLocaleDateString()}</td>
                <td>{new Date(leave.endDate).toLocaleDateString()}</td>
                <td><span className="status">{leave.workflowStage ?? leave.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
