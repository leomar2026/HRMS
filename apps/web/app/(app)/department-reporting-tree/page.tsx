import { TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Employee = { id: string; employeeCode: string; firstName: string; lastName: string; jobTitle?: string; managerId?: string | null };
type Department = {
  id: string;
  code: string;
  name: string;
  company?: string | null;
  branch?: string | null;
  reportingSetups?: Array<{
    departmentHead?: Employee | null;
    reportingManager?: Employee | null;
    operationsManager?: Employee | null;
    hrManager?: Employee | null;
    backupManager?: Employee | null;
  }>;
  employees?: Employee[];
};

function name(employee?: Employee | null) {
  return employee ? `${employee.employeeCode} - ${employee.firstName} ${employee.lastName}` : "-";
}

export default async function DepartmentReportingTreePage() {
  const departments = await apiFetch<Department[]>("/departments/reporting-tree").catch(() => []);

  return (
    <>
      <TableToolbar
        title="Reporting Tree"
        count={`${departments.length} departments`}
        actions={[
          { label: "Department Reporting Setup", href: "/department-reporting", icon: "refresh" },
          { label: "Export Excel", href: "/api/backend/departments/reporting-setups/export.xlsx", icon: "export" }
        ]}
        searchPlaceholder="Search company, branch, department, manager..."
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Branch</th>
              <th className="freeze-col">Department</th>
              <th>Department Head</th>
              <th>Reporting Manager</th>
              <th>OM</th>
              <th>HR Manager</th>
              <th>Employees Under Manager</th>
            </tr>
          </thead>
          <tbody>
            {departments.length ? departments.map((department) => {
              const setup = department.reportingSetups?.[0];
              const managerId = setup?.reportingManager?.id;
              const employees = (department.employees ?? []).filter((employee) => !managerId || employee.managerId === managerId);
              return (
                <tr key={department.id}>
                  <td>{department.company ?? "Current Company"}</td>
                  <td>{department.branch ?? "All"}</td>
                  <td className="freeze-col">{department.code} - {department.name}</td>
                  <td>{name(setup?.departmentHead)}</td>
                  <td>{name(setup?.reportingManager)}</td>
                  <td>{name(setup?.operationsManager)}</td>
                  <td>{name(setup?.hrManager)}</td>
                  <td>{employees.length ? employees.map(name).join(", ") : "No employees assigned"}</td>
                </tr>
              );
            }) : <tr><td colSpan={8} className="empty">No records found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
