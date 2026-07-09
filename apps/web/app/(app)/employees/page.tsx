import { RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { EmployeeRoleForm, ProvisionMissingPortalUsersButton } from "@/components/EmployeeRoleActions";
import { ProfileAvatar } from "@/components/ProfilePhoto";
import { apiFetch } from "@/lib/api";

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
  department: { name: string };
  user?: { role: string; portalStatus: string } | null;
};

type EmployeeResponse = {
  items: Employee[];
  total: number;
  page: number;
  pageSize: number;
};

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const params = await searchParams;
  const query = params.search ? `?search=${encodeURIComponent(params.search)}` : "";
  const response = await apiFetch<EmployeeResponse | Employee[]>(`/employees${query}`);
  const employees = Array.isArray(response) ? response : response.items;
  const total = Array.isArray(response) ? response.length : response.total;

  return (
    <>
      <TableToolbar
        title="Employee Master"
        count={`${total} records`}
        searchPlaceholder="Search employee number, name, email, or national ID"
        actions={[
          { label: "Add New", href: "/employees/new", icon: "add", primary: true },
          { label: "Import", href: "/employee-import", icon: "import" },
          { label: "Export", href: "/api/backend/employees/export.csv", icon: "export" },
          { label: "Groups", href: "/group-management?type=EMPLOYEE", icon: "columns" }
        ]}
      />
      <form className="form-panel" action="/employees">
        <div className="actions">
          <input name="search" placeholder="Search employee number, name, email, or national ID" defaultValue={params.search ?? ""} />
          <button className="button" type="submit">Search</button>
        </div>
        <ProvisionMissingPortalUsersButton />
      </form>
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label="Select all employees" type="checkbox" /></th><th className="freeze-col">ID</th><th>Name</th><th>Email</th><th>Department</th><th>Job title</th><th>User Role</th><th>Portal</th><th>Leave</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td><input aria-label={`Select ${employee.employeeCode}`} type="checkbox" /></td>
                <td className="freeze-col">{employee.employeeCode}</td>
                <td><div className="employee-identity"><ProfileAvatar employee={employee} size={34} /><span>{employee.firstName} {employee.lastName}</span></div></td>
                <td>{employee.email}</td>
                <td>{employee.department.name}</td>
                <td>{employee.jobTitle}</td>
                <td><EmployeeRoleForm employeeId={employee.id} currentRole={employee.user?.role} currentPortalStatus={employee.user?.portalStatus} /></td>
                <td><span className={employee.user ? "status" : "status warn"}>{employee.user?.portalStatus ?? "NO USER"}</span></td>
                <td>{employee.leaveBalance}</td>
                <td><span className="status">{employee.status}</span></td>
                <td>
                  <RowActionMenu
                    actions={[
                      { label: "View / Edit employee", href: `/employees/${employee.id}` },
                      { label: "Print Preview", href: `/api/backend/print-documents/employees/${employee.id}/preview` },
                      { label: "Download PDF", href: `/api/backend/print-documents/employees/${employee.id}/pdf` },
                      { label: "Email Document", href: `/api/backend/print-documents/employees/${employee.id}/email` },
                      { label: "Reprint History", href: `/api/backend/print-documents/employees/${employee.id}/history` }
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
