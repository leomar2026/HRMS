import { ContactForm } from "@/components/EmployeeActions";
import { apiFetch } from "@/lib/api";

type Employee = {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  emergencyContact?: string;
  address?: string;
  jobTitle: string;
  department: { name: string };
};

export default async function EmployeeProfilePage() {
  const employee = await apiFetch<Employee>("/employee/me");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="muted">View your employment profile and update only approved contact fields.</p>
        </div>
      </div>
      <section className="grid cols-3">
        <div className="panel"><span className="muted">Employee ID</span><h2>{employee.employeeCode}</h2></div>
        <div className="panel"><span className="muted">Name</span><h2>{employee.firstName} {employee.lastName}</h2></div>
        <div className="panel"><span className="muted">Role</span><h2>{employee.jobTitle}</h2></div>
        <div className="panel"><span className="muted">Department</span><h2>{employee.department.name}</h2></div>
      </section>
      <div style={{ height: 16 }} />
      <ContactForm employee={employee} />
    </>
  );
}
