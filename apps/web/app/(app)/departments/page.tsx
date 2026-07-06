import { apiFetch } from "@/lib/api";
import { TableToolbar } from "@/components/DataTableControls";

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
      <section className="grid cols-3">
        {departments.map((department) => (
          <article className="panel" key={department.id}>
            <span className="status">{department.code}</span>
            <h2>{department.name}</h2>
            <p className="muted">{department._count.employees} employees</p>
          </article>
        ))}
      </section>
    </>
  );
}
