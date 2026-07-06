import { ManagerDecisionForm } from "@/components/ManagerActions";
import { RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Approval = {
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
  comments?: string;
  createdAt: string;
  decidedAt?: string;
  employee: { employeeCode: string; firstName: string; lastName: string; department: { name: string } };
  approvalHistory?: Array<{ id: string; status: string; comments?: string; createdAt: string }>;
};

function statusClass(stage?: string, status?: string) {
  const value = stage ?? status ?? "";
  if (value.includes("PENDING")) return "status warn";
  if (value.includes("REJECT") || value.includes("RETURN")) return "status danger";
  return "status";
}

export default async function MyApprovalsPage() {
  const approvals = await apiFetch<Approval[]>("/manager/approvals");

  return (
    <>
      <TableToolbar
        title="My Approvals"
        count={`${approvals.length} records`}
        actions={[
          { label: "Pending", href: "/manager/leave-approvals", icon: "filter" },
          { label: "Refresh", href: "/manager/my-approvals", icon: "refresh" },
          { label: "Print", icon: "print" },
          { label: "Export", icon: "export" }
        ]}
        searchPlaceholder="Search approvals..."
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th><input aria-label="Select all approvals" type="checkbox" /></th>
              <th>Request No.</th>
              <th>Employee Code</th>
              <th>Employee Name</th>
              <th>Department</th>
              <th>Leave Type</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Days</th>
              <th>Balance</th>
              <th>Submitted</th>
              <th>Approval Status</th>
              <th>History</th>
              <th>Remarks</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {approvals.length ? approvals.map((approval) => (
              <tr key={approval.id}>
                <td><input aria-label={`Select ${approval.requestNumber ?? approval.id}`} type="checkbox" /></td>
                <td>{approval.requestNumber ?? approval.id}</td>
                <td>{approval.employee.employeeCode}</td>
                <td>{approval.employee.firstName} {approval.employee.lastName}</td>
                <td>{approval.employee.department.name}</td>
                <td>{approval.type}</td>
                <td>{new Date(approval.startDate).toLocaleDateString()}</td>
                <td>{new Date(approval.endDate).toLocaleDateString()}</td>
                <td>{approval.days}</td>
                <td>{approval.availableBalanceAtRequest ?? "-"}</td>
                <td>{new Date(approval.createdAt).toLocaleDateString()}</td>
                <td><span className={statusClass(approval.workflowStage, approval.status)}>{approval.workflowStage ?? approval.status}</span></td>
                <td>{approval.approvalHistory?.length ?? 0} steps</td>
                <td>{approval.reason ?? approval.comments ?? "-"}</td>
                <td>
                  {approval.workflowStage === "PENDING_MANAGER_APPROVAL" ? <ManagerDecisionForm leaveId={approval.id} /> : null}
                  <RowActionMenu actions={[
                    { label: "Open pending approvals", href: "/manager/leave-approvals" },
                    { label: "View team", href: "/manager/my-team" },
                    { label: "View calendar", href: "/manager/team-calendar" }
                  ]} />
                </td>
              </tr>
            )) : (
              <tr><td colSpan={15}>No records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
