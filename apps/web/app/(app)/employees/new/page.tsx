import { EmployeeCreateForm } from "@/components/EmployeeCreateForm";
import { apiFetch } from "@/lib/api";

type Department = {
  id: string;
  name: string;
  code: string;
};

export default async function NewEmployeePage() {
  const departments = await apiFetch<Department[]>("/departments");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Add New Employee</h1>
          <p className="muted">Admin and HR users can create employee records and portal access.</p>
        </div>
      </div>
      <EmployeeCreateForm departments={departments} />
    </>
  );
}
