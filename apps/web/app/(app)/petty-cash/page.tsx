import { PrintDocumentActions, TableToolbar } from "@/components/DataTableControls";
import { PettyCashRequestForm } from "@/components/TravelFinanceActions";
import { WorkflowDecisionButtons } from "@/components/ExtendedHrmsActions";
import { apiFetch } from "@/lib/api";

type Leave = { id: string; requestNumber: string; startDate: string; endDate: string; status: string };
type PettyCash = { id: string; requestNumber: string; requestType: string; businessTripReference?: string; requestedAmount: string; approvedAmount: string; paidAmount: string; settledAmount: string; outstandingAmount: string; requiredDate: string; status: string; currentApprover?: string; employee: { employeeCode: string; firstName: string; lastName: string; department: { name: string } }; linkedLeaveRequest?: { requestNumber: string } | null };

export default async function PettyCashPage() {
  const [requests, leaves] = await Promise.all([apiFetch<PettyCash[]>("/petty-cash"), apiFetch<Leave[]>("/leaves")]);
  return (
    <>
      <TableToolbar title="Petty Cash Requests" count={`${requests.length} records`} searchPlaceholder="Search petty cash" actions={[{ label: "Export CSV", href: "/api/backend/petty-cash/export.csv", icon: "export" }, { label: "Export Excel", href: "/api/backend/petty-cash/export.xlsx", icon: "export" }]} />
      <PettyCashRequestForm leaves={leaves} />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label="Select petty cash" type="checkbox" /></th><th className="freeze-col">Request No.</th><th>Employee</th><th>Department</th><th>Request Type</th><th>Linked Ref</th><th>Requested</th><th>Approved</th><th>Paid</th><th>Settled</th><th>Outstanding</th><th>Required Date</th><th>Status</th><th>Approver</th><th>Actions</th></tr></thead>
          <tbody>
            {requests.map((row) => <tr key={row.id}><td><input aria-label={`Select ${row.requestNumber}`} type="checkbox" /></td><td className="freeze-col">{row.requestNumber}</td><td>{row.employee.employeeCode} - {row.employee.firstName} {row.employee.lastName}</td><td>{row.employee.department.name}</td><td>{row.requestType}</td><td>{row.businessTripReference ?? row.linkedLeaveRequest?.requestNumber ?? "-"}</td><td>{row.requestedAmount}</td><td>{row.approvedAmount}</td><td>{row.paidAmount}</td><td>{row.settledAmount}</td><td>{row.outstandingAmount}</td><td>{new Date(row.requiredDate).toLocaleDateString()}</td><td><span className="status">{row.status}</span></td><td>{row.currentApprover ?? "-"}</td><td><PrintDocumentActions module="petty-cash" id={row.id} /><WorkflowDecisionButtons modulePath="petty-cash" id={row.id} /></td></tr>)}
            {requests.length === 0 ? <tr><td colSpan={15}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
