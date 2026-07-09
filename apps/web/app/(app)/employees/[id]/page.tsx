import { EmployeeAdminEditForm } from "@/components/EmployeeCreateForm";
import { TableToolbar } from "@/components/DataTableControls";
import { ProfilePhotoUploader } from "@/components/ProfilePhoto";
import { apiFetch } from "@/lib/api";

type Department = {
  id: string;
  name: string;
  code: string;
};

type Employee = {
  id: string;
  employeeCode: string;
  nationalId: string;
  firstName: string;
  lastName: string;
  fullNameArabic?: string;
  email: string;
  companyEmail?: string;
  phone?: string;
  emergencyContact?: string;
  address?: string;
  passportNumber?: string;
  gosiNumber?: string;
  qiwaReference?: string;
  biometricId?: string;
  deviceUserId?: string;
  bankName?: string;
  iban?: string;
  jobTitle: string;
  branch?: string;
  location?: string;
  managerId?: string;
  employeeType?: string;
  contractType?: string;
  joiningDate: string;
  departmentId: string;
  department: Department;
  basicSalary: string | number;
  housingAllowance?: string | number;
  transportAllowance?: string | number;
  otherAllowance?: string | number;
  leaveBalance: number;
  photoUrl?: string;
  profilePhotoPath?: string;
  profilePhotoStatus?: string;
};

type EmployeeResponse = {
  items: Employee[];
  total: number;
};

export default async function EmployeeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [employee, departments, employeesResponse] = await Promise.all([
    apiFetch<Employee>(`/employees/${id}`),
    apiFetch<Department[]>("/departments"),
    apiFetch<EmployeeResponse | Employee[]>("/employees?pageSize=100")
  ]);
  const managers = Array.isArray(employeesResponse) ? employeesResponse : employeesResponse.items;

  return (
    <>
      <TableToolbar
        title={`Edit Employee - ${employee.employeeCode}`}
        count={`${employee.firstName} ${employee.lastName}`}
        actions={[
          { label: "Employee Master", href: "/employees", icon: "refresh" },
          { label: "Print", href: `/api/backend/employees/${employee.id}/print`, icon: "print" }
        ]}
      />
      <div className="panel">
        <ProfilePhotoUploader employee={employee} endpoint={`/api/backend/employees/${employee.id}/profile-photo`} />
      </div>
      <div style={{ height: 16 }} />
      <EmployeeAdminEditForm employee={employee} departments={departments} managers={managers} />
    </>
  );
}
