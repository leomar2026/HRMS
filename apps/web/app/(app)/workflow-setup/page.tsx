import { WorkflowDefinitionForm } from "@/components/ExtendedHrmsActions";
import { TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Workflow = { id: string; workflowCode: string; workflowName: string; processType: string; company?: string; branch?: string; department?: string; steps: unknown[]; status: string; effectiveStartDate?: string; effectiveEndDate?: string };

export default async function WorkflowSetupPage() {
  const workflows = await apiFetch<Workflow[]>("/workflows");
  return (
    <>
      <TableToolbar title="Approval Workflow Setup" count={`${workflows.length} records`} searchPlaceholder="Search workflows" actions={[{ label: "Export CSV", href: "/api/backend/workflows/export.csv", icon: "export" }, { label: "Export Excel", href: "/api/backend/workflows/export.xlsx", icon: "export" }]} />
      <WorkflowDefinitionForm />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label="Select workflows" type="checkbox" /></th><th className="freeze-col">Workflow Code</th><th>Workflow Name</th><th>Process</th><th>Company</th><th>Branch</th><th>Department</th><th>Steps</th><th>Status</th><th>Effective Dates</th></tr></thead>
          <tbody>
            {workflows.map((row) => (
              <tr key={row.id}>
                <td><input aria-label={`Select ${row.workflowCode}`} type="checkbox" /></td>
                <td className="freeze-col">{row.workflowCode}</td>
                <td>{row.workflowName}</td>
                <td>{row.processType}</td>
                <td>{row.company ?? "-"}</td>
                <td>{row.branch ?? "-"}</td>
                <td>{row.department ?? "-"}</td>
                <td>{Array.isArray(row.steps) ? row.steps.length : 0}</td>
                <td><span className="status">{row.status}</span></td>
                <td>{row.effectiveStartDate ? new Date(row.effectiveStartDate).toLocaleDateString() : "-"} - {row.effectiveEndDate ? new Date(row.effectiveEndDate).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
            {workflows.length === 0 ? <tr><td colSpan={10}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
