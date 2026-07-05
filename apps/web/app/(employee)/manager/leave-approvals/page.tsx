import { ManagerDecisionForm } from "@/components/ManagerActions";
import { RowActionMenu } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Leave = {
  id: string;
  requestNumber?: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  availableBalanceAtRequest?: number;
  status: string;
  workflowStage?: string;
  reason?: string;
  attachmentName?: string;
  createdAt: string;
  employee: { employeeCode: string; firstName: string; lastName: string; department: { name: string } };
};

export default async function ManagerLeaveApprovalsPage() {
  const leaves = await apiFetch<Leave[]>("/manager/leave-approvals");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Pending Leave Approvals</h1>
          <p className="muted">Manager approval is limited to direct reports and cannot be used for your own leave.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Leave Request Number</th>
              <th>Employee Code</th>
              <th>Employee Name</th>
              <th>Department</th>
              <th>Leave Type</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Requested Days</th>
              <th>Available Balance</th>
              <th>Request Date</th>
              <th>Status</th>
              <th>Employee Remarks</th>
              <th>Attachment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map((leave) => (
              <tr key={leave.id}>
                <td>{leave.requestNumber ?? leave.id}</td>
                <td>{leave.employee.employeeCode}</td>
                <td>{leave.employee.firstName} {leave.employee.lastName}</td>
                <td>{leave.employee.department.name}</td>
                <td>{leave.type}</td>
                <td>{new Date(leave.startDate).toLocaleDateString()}</td>
                <td>{new Date(leave.endDate).toLocaleDateString()}</td>
                <td>{leave.days}</td>
                <td>{leave.availableBalanceAtRequest ?? "-"}</td>
                <td>{new Date(leave.createdAt).toLocaleDateString()}</td>
                <td><span className={leave.workflowStage === "PENDING_MANAGER_APPROVAL" ? "status warn" : "status"}>{leave.workflowStage ?? leave.status}</span></td>
                <td>{leave.reason ?? "-"}</td>
                <td>{leave.attachmentName ?? "-"}</td>
                <td>
                  {leave.workflowStage === "PENDING_MANAGER_APPROVAL" ? <ManagerDecisionForm leaveId={leave.id} /> : null}
                  <RowActionMenu actions={[
                    { label: "View team calendar", href: "/manager/team-calendar" },
                    { label: "View approval history", href: "/employee/approval-history" }
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
