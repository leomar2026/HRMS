import { apiFetch } from "@/lib/api";

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
      <div className="page-head">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="muted">Organizational units used for employee assignment and reporting.</p>
        </div>
      </div>
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
