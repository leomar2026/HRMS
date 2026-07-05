import { HrLeaveDecisionForm } from "@/components/HrLeaveActions";
import { apiFetch } from "@/lib/api";

type Leave = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  workflowStage?: string;
  comments?: string;
  employee: { firstName: string; lastName: string; employeeCode: string };
};

export default async function LeavePage() {
  const leaves = await apiFetch<Leave[]>("/leaves");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Leave Requests</h1>
          <p className="muted">Annual, sick, and emergency leave with balance tracking and HR approval workflow.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Employee</th><th>Type</th><th>Start</th><th>End</th><th>Days</th><th>Status</th><th>Comments</th><th>HR Actions</th></tr></thead>
          <tbody>
            {leaves.map((leave) => (
              <tr key={leave.id}>
                <td>{leave.employee.employeeCode} - {leave.employee.firstName} {leave.employee.lastName}</td>
                <td>{leave.type}</td>
                <td>{new Date(leave.startDate).toLocaleDateString()}</td>
                <td>{new Date(leave.endDate).toLocaleDateString()}</td>
                <td>{leave.days}</td>
                <td><span className={leave.status === "PENDING" ? "status warn" : "status"}>{leave.workflowStage ?? leave.status}</span></td>
                <td>{leave.comments ?? "-"}</td>
                <td>{leave.workflowStage === "PENDING_HR_MANAGER_APPROVAL" ? <HrLeaveDecisionForm leaveId={leave.id} /> : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
