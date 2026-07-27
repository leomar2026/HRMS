import { TableToolbar } from "@/components/DataTableControls";
import { EmployeeLifecycleActions } from "@/components/EmployeeLifecycleActions";
import { ProfileAvatar } from "@/components/ProfilePhoto";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  status: string;
  photoUrl?: string;
  profilePhotoPath?: string;
  leaveBalance: number;
  archivedAt?: string;
  department: { name: string };
  user?: { role: string; portalStatus: string } | null;
};

type EmployeeResponse = {
  items: Employee[];
  total: number;
  page: number;
  pageSize: number;
};

export default async function ArchivedEmployeesPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const params = await searchParams;
  const query = params.search ? `?search=${encodeURIComponent(params.search)}` : "";
  const response = await apiFetch<EmployeeResponse | Employee[]>(`/employees/archived${query}`);
  const employees = Array.isArray(response) ? response : response.items;
  const total = Array.isArray(response) ? response.length : response.total;

  return (
    <>
      <TableToolbar
        title="Archived Employees"
        count={`${total} records`}
        searchPlaceholder="Search archived employee"
        actions={[
          { label: "Active Employees", href: "/employees", icon: "refresh" },
          { label: "Export", href: "/api/backend/employees/archived/export.csv", icon: "export" },
          { label: "Print", href: "/api/backend/employees/archived/print", icon: "print" },
          { label: "Refresh", href: "/employees/archived", icon: "refresh" }
        ]}
      />
      <form className="form-panel" action="/employees/archived">
        <div className="actions">
          <input name="search" placeholder="Search employee number, name, email, or national ID" defaultValue={params.search ?? ""} />
          <button className="button" type="submit">Search</button>
        </div>
      </form>
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label="Select archived employees" type="checkbox" /></th><th className="freeze-col">ID</th><th>Name</th><th>Email</th><th>Department</th><th>Job title</th><th>Status</th><th>Archived</th><th>Actions</th></tr></thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td><input aria-label={`Select ${employee.employeeCode}`} type="checkbox" /></td>
                <td className="freeze-col">{employee.employeeCode}</td>
                <td><div className="employee-identity"><ProfileAvatar employee={employee} size={34} /><span>{employee.firstName} {employee.lastName}</span></div></td>
                <td>{employee.email}</td>
                <td>{employee.department.name}</td>
                <td>{employee.jobTitle}</td>
                <td><span className="status warn">{employee.status}</span></td>
                <td>{employee.archivedAt ? new Date(employee.archivedAt).toLocaleDateString() : "-"}</td>
                <td className="employee-action-cell">
                  <div className="employee-row-actions">
                    <Link className="button small" href={`/employees/${employee.id}`}>View</Link>
                    <a className="button small secondary" href={`/api/backend/print-documents/employees/${employee.id}/preview`}>Print</a>
                    <a className="button small secondary" href={`/api/backend/print-documents/employees/${employee.id}/pdf`}>PDF</a>
                    <Link className="button small secondary" href={`/audit-logs?entity=Employee&entityId=${employee.id}`}>Audit</Link>
                  </div>
                  <EmployeeLifecycleActions employeeId={employee.id} employeeCode={employee.employeeCode} archived />
                </td>
              </tr>
            ))}
            {employees.length === 0 ? <tr><td colSpan={9}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
