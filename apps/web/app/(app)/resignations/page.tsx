import { ResignationForm, WorkflowDecisionButtons } from "@/components/ExtendedHrmsActions";
import { PrintDocumentActions, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Employee = { id: string; employeeCode: string; firstName: string; lastName: string };
type EmployeeResponse = { items: Employee[] };
type Resignation = {
  id: string;
  requestNumber: string;
  proposedLastWorkingDate: string;
  noticePeriodRequired: number;
  noticePeriodServed: number;
  resignationReason: string;
  status: string;
  currentApprover?: string;
  createdAt: string;
  employee: { employeeCode: string; firstName: string; lastName: string; jobTitle: string; department: { name: string } };
};

export default async function ResignationsPage() {
  const [resignations, employeesResponse] = await Promise.all([
    apiFetch<Resignation[]>("/resignations"),
    apiFetch<EmployeeResponse | Employee[]>("/employees?pageSize=100")
  ]);
  const employees = Array.isArray(employeesResponse) ? employeesResponse : employeesResponse.items;

  return (
    <>
      <TableToolbar title="Resignation Requests" count={`${resignations.length} records`} searchPlaceholder="Search resignations" actions={[{ label: "Export CSV", href: "/api/backend/resignations/export.csv", icon: "export" }, { label: "Export Excel", href: "/api/backend/resignations/export.xlsx", icon: "export" }]} />
      <ResignationForm employees={employees} />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label="Select resignations" type="checkbox" /></th><th className="freeze-col">Request No.</th><th>Employee</th><th>Department</th><th>Designation</th><th>Proposed Last Working Date</th><th>Notice Period</th><th>Status</th><th>Current Approver</th><th>Request Date</th><th>Actions</th></tr></thead>
          <tbody>
            {resignations.map((row) => (
              <tr key={row.id}>
                <td><input aria-label={`Select ${row.requestNumber}`} type="checkbox" /></td>
                <td className="freeze-col">{row.requestNumber}</td>
                <td>{row.employee.employeeCode} - {row.employee.firstName} {row.employee.lastName}</td>
                <td>{row.employee.department.name}</td>
                <td>{row.employee.jobTitle}</td>
                <td>{new Date(row.proposedLastWorkingDate).toLocaleDateString()}</td>
                <td>{row.noticePeriodRequired} / {row.noticePeriodServed}</td>
                <td><span className="status">{row.status}</span></td>
                <td>{row.currentApprover ?? "-"}</td>
                <td>{new Date(row.createdAt).toLocaleDateString()}</td>
                <td>
                  <PrintDocumentActions module="resignations" id={row.id} />
                  <WorkflowDecisionButtons modulePath="resignations" id={row.id} />
                </td>
              </tr>
            ))}
            {resignations.length === 0 ? <tr><td colSpan={11}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
