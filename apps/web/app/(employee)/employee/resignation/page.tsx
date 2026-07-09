import { ResignationForm, WorkflowDecisionButtons } from "@/components/ExtendedHrmsActions";
import { PrintDocumentActions, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Resignation = { id: string; requestNumber: string; proposedLastWorkingDate: string; noticePeriodRequired: number; noticePeriodServed: number; status: string; currentApprover?: string; createdAt: string; clearanceItems?: { id: string; assignedDepartment: string; clearanceItem: string; status: string }[]; finalSettlement?: { settlementNumber: string; netFinalSettlement: string; status: string } | null };

export default async function EmployeeResignationPage() {
  const resignations = await apiFetch<Resignation[]>("/resignations");
  return (
    <>
      <TableToolbar title="My Resignation Status" count={`${resignations.length} records`} searchPlaceholder="Search my resignation" actions={[]} />
      <ResignationForm employees={[]} />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Request No.</th><th>Last Working Date</th><th>Notice Period</th><th>Status</th><th>Current Approver</th><th>Clearance</th><th>Final Settlement</th><th>Actions</th></tr></thead>
          <tbody>
            {resignations.map((row) => <tr key={row.id}><td>{row.requestNumber}</td><td>{new Date(row.proposedLastWorkingDate).toLocaleDateString()}</td><td>{row.noticePeriodRequired} / {row.noticePeriodServed}</td><td><span className="status">{row.status}</span></td><td>{row.currentApprover ?? "-"}</td><td>{row.clearanceItems?.filter((item) => item.status === "COMPLETED").length ?? 0} / {row.clearanceItems?.length ?? 0}</td><td>{row.finalSettlement ? `${row.finalSettlement.netFinalSettlement} (${row.finalSettlement.status})` : "-"}</td><td><PrintDocumentActions module="resignations" id={row.id} /><WorkflowDecisionButtons modulePath="resignations" id={row.id} /></td></tr>)}
            {resignations.length === 0 ? <tr><td colSpan={8}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
