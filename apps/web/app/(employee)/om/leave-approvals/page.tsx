import { OmDecisionForm } from "@/components/ManagerActions";
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
  employee: { employeeCode: string; firstName: string; lastName: string; jobTitle?: string; department: { name: string } };
};

export default async function OmLeaveApprovalsPage() {
  const leaves = await apiFetch<Leave[]>("/om/leave-approvals");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">OM Leave Approvals</h1>
          <p className="muted">Operations Manager approval for requests already approved by the direct manager.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Leave Request No.</th>
              <th>Employee ID</th>
              <th>Employee Name</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Leave Type</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Requested Days</th>
              <th>Available Balance</th>
              <th>Request Date</th>
              <th>Current Status</th>
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
                <td>{leave.employee.jobTitle ?? "-"}</td>
                <td>{leave.type}</td>
                <td>{new Date(leave.startDate).toLocaleDateString()}</td>
                <td>{new Date(leave.endDate).toLocaleDateString()}</td>
                <td>{leave.days}</td>
                <td>{leave.availableBalanceAtRequest ?? "-"}</td>
                <td>{new Date(leave.createdAt).toLocaleDateString()}</td>
                <td><span className="status warn">{leave.workflowStage ?? leave.status}</span></td>
                <td>{leave.reason ?? "-"}</td>
                <td>{leave.attachmentName ?? "-"}</td>
                <td>
                  {leave.workflowStage === "PENDING_OM_APPROVAL" ? <OmDecisionForm leaveId={leave.id} /> : null}
                  <RowActionMenu actions={[
                    { label: "View leave history", href: "/employee/approval-history" },
                    { label: "View team balances", href: "/manager/team-balances" }
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
