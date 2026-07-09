import { ClearanceActionForm } from "@/components/ExtendedHrmsActions";
import { TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Clearance = {
  id: string;
  clearanceNumber: string;
  assignedDepartment: string;
  clearanceItem: string;
  assignedOfficer?: string;
  status: string;
  completedDate?: string;
  employee: { employeeCode: string; firstName: string; lastName: string; department: { name: string } };
  resignation: { requestNumber: string; proposedLastWorkingDate: string };
};

export default async function ExitClearancePage() {
  const items = await apiFetch<Clearance[]>("/resignations/clearance");
  return (
    <>
      <TableToolbar title="Exit Clearance" count={`${items.length} records`} searchPlaceholder="Search clearance" actions={[{ label: "Export Resignations", href: "/api/backend/resignations/export.xlsx", icon: "export" }]} />
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label="Select clearance" type="checkbox" /></th><th className="freeze-col">Clearance No.</th><th>Employee</th><th>Department</th><th>Resignation Request</th><th>Last Working Date</th><th>Clearance Department</th><th>Item</th><th>Assigned Officer</th><th>Status</th><th>Completion Date</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><input aria-label={`Select ${item.clearanceNumber}`} type="checkbox" /></td>
                <td className="freeze-col">{item.clearanceNumber}</td>
                <td>{item.employee.employeeCode} - {item.employee.firstName} {item.employee.lastName}</td>
                <td>{item.employee.department.name}</td>
                <td>{item.resignation.requestNumber}</td>
                <td>{new Date(item.resignation.proposedLastWorkingDate).toLocaleDateString()}</td>
                <td>{item.assignedDepartment}</td>
                <td>{item.clearanceItem}</td>
                <td>{item.assignedOfficer ?? "-"}</td>
                <td><span className="status">{item.status}</span></td>
                <td>{item.completedDate ? new Date(item.completedDate).toLocaleDateString() : "-"}</td>
                <td><ClearanceActionForm id={item.id} /></td>
              </tr>
            ))}
            {items.length === 0 ? <tr><td colSpan={12}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
