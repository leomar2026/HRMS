import { apiFetch } from "@/lib/api";
import { TableToolbar } from "@/components/DataTableControls";
import { DepartmentEditForm, DepartmentForm } from "@/components/AdminForms";

type Department = {
  id: string;
  code: string;
  name: string;
  nameArabic?: string | null;
  company?: string | null;
  branch?: string | null;
  parentDepartmentId?: string | null;
  parentDepartment?: { code: string; name: string } | null;
  departmentHeadId?: string | null;
  departmentHead?: Employee | null;
  defaultReportingManagerId?: string | null;
  defaultReportingManager?: Employee | null;
  omId?: string | null;
  operationsManager?: Employee | null;
  hrManagerId?: string | null;
  hrManager?: Employee | null;
  costCenter?: string | null;
  status?: string;
  remarks?: string | null;
  _count: { employees: number };
};

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
};

type EmployeeResponse = { items: Employee[]; total: number };

export default async function DepartmentsPage() {
  const [departments, employeesResponse] = await Promise.all([
    apiFetch<Department[]>("/departments"),
    apiFetch<EmployeeResponse | Employee[]>("/employees?pageSize=100").catch(() => ({ items: [], total: 0 }))
  ]);
  const employees = Array.isArray(employeesResponse) ? employeesResponse : employeesResponse.items;

  return (
    <>
      <TableToolbar
        title="Departments"
        count={`${departments.length} records`}
        actions={[
          { label: "CSV Template", href: "/api/backend/departments/template.csv", icon: "template" },
          { label: "Excel Template", href: "/api/backend/departments/template.xlsx", icon: "template" },
          { label: "Export CSV", href: "/api/backend/departments/export.csv", icon: "export" },
          { label: "Export Excel", href: "/api/backend/departments/export.xlsx", icon: "export" }
        ]}
        searchPlaceholder="Search departments..."
      />
      <DepartmentForm departments={departments} employees={employees} />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label="Select all departments" type="checkbox" /></th><th className="freeze-col">Department Code</th><th>Department Name</th><th>Company</th><th>Branch</th><th>Parent Department</th><th>Department Head</th><th>Default Reporting Manager</th><th>OM</th><th>HR Manager</th><th>Employees</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {departments.map((department) => (
              <tr key={department.id}>
                <td><input aria-label={`Select ${department.code}`} type="checkbox" /></td>
                <td className="freeze-col">{department.code}</td>
                <td>{department.name}</td>
                <td>{department.company ?? "-"}</td>
                <td>{department.branch ?? "-"}</td>
                <td>{department.parentDepartment?.name ?? "-"}</td>
                <td>{department.departmentHead ? `${department.departmentHead.employeeCode} - ${department.departmentHead.firstName} ${department.departmentHead.lastName}` : "-"}</td>
                <td>{department.defaultReportingManager ? `${department.defaultReportingManager.employeeCode} - ${department.defaultReportingManager.firstName} ${department.defaultReportingManager.lastName}` : "-"}</td>
                <td>{department.operationsManager ? `${department.operationsManager.employeeCode} - ${department.operationsManager.firstName} ${department.operationsManager.lastName}` : "-"}</td>
                <td>{department.hrManager ? `${department.hrManager.employeeCode} - ${department.hrManager.firstName} ${department.hrManager.lastName}` : "-"}</td>
                <td>{department._count.employees}</td>
                <td><span className="status">{department.status ?? "ACTIVE"}</span></td>
                <td><DepartmentEditForm department={department} departments={departments} employees={employees} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
