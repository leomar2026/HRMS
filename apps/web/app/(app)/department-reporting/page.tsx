import { BulkApplyReportingSetupButton, DepartmentReportingSetupForm } from "@/components/DepartmentReportingSetupActions";
import { TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Department = { id: string; code: string; name: string };
type Employee = { id: string; employeeCode: string; firstName: string; lastName: string; jobTitle?: string };
type EmployeeResponse = { items: Employee[]; total: number };
type Setup = {
  id: string;
  company?: string | null;
  branch?: string | null;
  departmentId: string;
  department: Department;
  departmentHeadId?: string | null;
  departmentHead?: Employee | null;
  reportingManagerId?: string | null;
  reportingManager?: Employee | null;
  omId?: string | null;
  operationsManager?: Employee | null;
  hrManagerId?: string | null;
  hrManager?: Employee | null;
  backupManagerId?: string | null;
  backupManager?: Employee | null;
  effectiveStartDate: string;
  effectiveEndDate?: string | null;
  status: string;
  remarks?: string | null;
};

function employeeName(employee?: Employee | null) {
  return employee ? `${employee.employeeCode} - ${employee.firstName} ${employee.lastName}` : "-";
}

export default async function DepartmentReportingPage() {
  const [departments, employeesResponse, setups] = await Promise.all([
    apiFetch<Department[]>("/departments"),
    apiFetch<EmployeeResponse | Employee[]>("/employees?pageSize=100").catch(() => ({ items: [], total: 0 })),
    apiFetch<Setup[]>("/departments/reporting-setups").catch(() => [])
  ]);
  const employees = Array.isArray(employeesResponse) ? employeesResponse : employeesResponse.items;

  return (
    <>
      <TableToolbar
        title="Department Reporting Setup"
        count={`${setups.length} setup records`}
        actions={[
          { label: "Department Master", href: "/departments", icon: "refresh" },
          { label: "CSV Template", href: "/api/backend/departments/reporting-setups/template.csv", icon: "template" },
          { label: "Excel Template", href: "/api/backend/departments/reporting-setups/template.xlsx", icon: "template" },
          { label: "Reporting Tree", href: "/department-reporting-tree", icon: "columns" },
          { label: "Export CSV", href: "/api/backend/departments/reporting-setups/export.csv", icon: "export" },
          { label: "Export Excel", href: "/api/backend/departments/reporting-setups/export.xlsx", icon: "export" }
        ]}
        searchPlaceholder="Search department reporting..."
      />
      <DepartmentReportingSetupForm departments={departments} employees={employees} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th><input aria-label="Select reporting setups" type="checkbox" /></th>
              <th className="freeze-col">Department</th>
              <th>Branch</th>
              <th>Head</th>
              <th>Reporting Manager</th>
              <th>OM</th>
              <th>HR Manager</th>
              <th>Backup</th>
              <th>Effective</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {setups.length ? setups.map((setup) => (
              <tr key={setup.id}>
                <td><input aria-label={`Select ${setup.department?.name ?? setup.id}`} type="checkbox" /></td>
                <td className="freeze-col">{setup.department?.name ?? setup.departmentId}</td>
                <td>{setup.branch || "All"}</td>
                <td>{employeeName(setup.departmentHead)}</td>
                <td>{employeeName(setup.reportingManager)}</td>
                <td>{employeeName(setup.operationsManager)}</td>
                <td>{employeeName(setup.hrManager)}</td>
                <td>{employeeName(setup.backupManager)}</td>
                <td>{setup.effectiveStartDate.slice(0, 10)} {setup.effectiveEndDate ? `to ${setup.effectiveEndDate.slice(0, 10)}` : "onward"}</td>
                <td><span className="status">{setup.status}</span></td>
                <td><BulkApplyReportingSetupButton setup={setup} /></td>
              </tr>
            )) : (
              <tr><td colSpan={11} className="empty">No records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
