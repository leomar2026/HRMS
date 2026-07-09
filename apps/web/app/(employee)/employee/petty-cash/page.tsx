import { PrintDocumentActions, TableToolbar } from "@/components/DataTableControls";
import { PettyCashRequestForm } from "@/components/TravelFinanceActions";
import { WorkflowDecisionButtons } from "@/components/ExtendedHrmsActions";
import { apiFetch } from "@/lib/api";

type Leave = { id: string; requestNumber: string; startDate: string; endDate: string; status: string };
type PettyCash = { id: string; requestNumber: string; requestType: string; businessTripReference?: string; requestedAmount: string; approvedAmount: string; paidAmount: string; settledAmount: string; outstandingAmount: string; requiredDate: string; status: string; currentApprover?: string; linkedLeaveRequest?: { requestNumber: string } | null };

export default async function EmployeePettyCashPage() {
  const [requests, leaves] = await Promise.all([apiFetch<PettyCash[]>("/petty-cash"), apiFetch<Leave[]>("/employee/me/leaves")]);
  return (
    <>
      <TableToolbar title="My Petty Cash Requests" count={`${requests.length} records`} searchPlaceholder="Search my petty cash" actions={[]} />
      <PettyCashRequestForm leaves={leaves} />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Request No.</th><th>Type</th><th>Linked Ref</th><th>Requested</th><th>Approved</th><th>Paid</th><th>Settled</th><th>Outstanding</th><th>Required Date</th><th>Status</th><th>Approver</th><th>Actions</th></tr></thead>
          <tbody>
            {requests.map((row) => <tr key={row.id}><td>{row.requestNumber}</td><td>{row.requestType}</td><td>{row.businessTripReference ?? row.linkedLeaveRequest?.requestNumber ?? "-"}</td><td>{row.requestedAmount}</td><td>{row.approvedAmount}</td><td>{row.paidAmount}</td><td>{row.settledAmount}</td><td>{row.outstandingAmount}</td><td>{new Date(row.requiredDate).toLocaleDateString()}</td><td><span className="status">{row.status}</span></td><td>{row.currentApprover ?? "-"}</td><td><PrintDocumentActions module="petty-cash" id={row.id} /><WorkflowDecisionButtons modulePath="petty-cash" id={row.id} /></td></tr>)}
            {requests.length === 0 ? <tr><td colSpan={12}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
