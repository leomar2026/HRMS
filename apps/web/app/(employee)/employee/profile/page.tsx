import { ContactForm } from "@/components/EmployeeActions";
import { ProfilePhotoUploader } from "@/components/ProfilePhoto";
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
  photoUrl?: string;
  profilePhotoPath?: string;
  profilePhotoStatus?: string;
  department: { name: string };
  manager?: { employeeCode: string; firstName: string; lastName: string } | null;
  departmentHead?: { employeeCode: string; firstName: string; lastName: string } | null;
  operationsManager?: { employeeCode: string; firstName: string; lastName: string } | null;
  hrManager?: { employeeCode: string; firstName: string; lastName: string } | null;
  alternateManager?: { employeeCode: string; firstName: string; lastName: string } | null;
};

function person(value?: { employeeCode: string; firstName: string; lastName: string } | null) {
  return value ? `${value.employeeCode} - ${value.firstName} ${value.lastName}` : "Not assigned";
}

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
        <div className="panel"><ProfilePhotoUploader employee={employee} endpoint="/api/backend/employee/me/profile-photo" /></div>
        <div className="panel"><span className="muted">Employee ID</span><h2>{employee.employeeCode}</h2></div>
        <div className="panel"><span className="muted">Name</span><h2>{employee.firstName} {employee.lastName}</h2></div>
        <div className="panel"><span className="muted">Role</span><h2>{employee.jobTitle}</h2></div>
        <div className="panel"><span className="muted">Department</span><h2>{employee.department.name}</h2></div>
        <div className="panel"><span className="muted">Reporting Manager</span><h2>{person(employee.manager)}</h2></div>
        <div className="panel"><span className="muted">Department Head</span><h2>{person(employee.departmentHead)}</h2></div>
        <div className="panel"><span className="muted">OM</span><h2>{person(employee.operationsManager)}</h2></div>
        <div className="panel"><span className="muted">HR Manager</span><h2>{person(employee.hrManager)}</h2></div>
      </section>
      <div style={{ height: 16 }} />
      <ContactForm employee={employee} />
    </>
  );
}
