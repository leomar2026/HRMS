import { LeaveRequestForm } from "@/components/EmployeeActions";
import { RowActionMenu } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Leave = {
  id: string;
  requestNumber?: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  workflowStage?: string;
  reason?: string;
  availableBalanceAtRequest?: number;
  comments?: string;
  manager?: { firstName: string; lastName: string };
  approvalHistory?: Array<{ id: string; status: string; comments?: string; createdAt: string }>;
};
type Balance = { leaveBalance: number };

export default async function EmployeeLeavesPage() {
  const [leaves, balance] = await Promise.all([
    apiFetch<Leave[]>("/employee/me/leaves"),
    apiFetch<Balance>("/employee/me/leave-balance")
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Apply Leave</h1>
          <p className="muted">Submit leave requests and track Manager and HR approval status.</p>
        </div>
        <div className="panel"><span className="muted">Available leave balance</span><div className="metric">{balance.leaveBalance}</div></div>
      </div>
      <LeaveRequestForm />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Request No.</th><th>Type</th><th>Start</th><th>End</th><th>Days</th><th>Available Balance</th><th>Manager</th><th>Status</th><th>Remarks</th><th>Actions</th></tr></thead>
          <tbody>
            {leaves.map((leave) => (
              <tr key={leave.id}>
                <td>{leave.requestNumber ?? leave.id}</td>
                <td>{leave.type}</td>
                <td>{new Date(leave.startDate).toLocaleDateString()}</td>
                <td>{new Date(leave.endDate).toLocaleDateString()}</td>
                <td>{leave.days}</td>
                <td>{leave.availableBalanceAtRequest ?? "-"}</td>
                <td>{leave.manager ? `${leave.manager.firstName} ${leave.manager.lastName}` : "-"}</td>
                <td><span className={leave.status === "PENDING" ? "status warn" : "status"}>{leave.workflowStage ?? leave.status}</span></td>
                <td>{leave.comments ?? leave.reason ?? "-"}</td>
                <td><RowActionMenu actions={[{ label: "View approval history", href: "/employee/approval-history" }]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
