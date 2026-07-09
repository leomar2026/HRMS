import { apiFetch } from "@/lib/api";
import { TableToolbar } from "@/components/DataTableControls";
import { DepartmentEditForm, DepartmentForm } from "@/components/AdminForms";

type Department = {
  id: string;
  code: string;
  name: string;
  _count: { employees: number };
};

export default async function DepartmentsPage() {
  const departments = await apiFetch<Department[]>("/departments");

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
      <DepartmentForm />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label="Select all departments" type="checkbox" /></th><th className="freeze-col">Code</th><th>Name</th><th>Employees</th><th>Actions</th></tr></thead>
          <tbody>
            {departments.map((department) => (
              <tr key={department.id}>
                <td><input aria-label={`Select ${department.code}`} type="checkbox" /></td>
                <td className="freeze-col">{department.code}</td>
                <td>{department.name}</td>
                <td>{department._count.employees}</td>
                <td><DepartmentEditForm department={department} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
