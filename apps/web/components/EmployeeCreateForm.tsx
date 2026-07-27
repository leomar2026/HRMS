"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Department = {
  id: string;
  name: string;
  code: string;
};

type SelectOption = {
  label: string;
  value: string;
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
  departmentHeadId?: string;
  omId?: string;
  hrManagerId?: string;
  alternateManagerId?: string;
  employeeType?: string;
  contractType?: string;
  joiningDate: string;
  departmentId: string;
  basicSalary: string | number;
  housingAllowance?: string | number;
  transportAllowance?: string | number;
  otherAllowance?: string | number;
  leaveBalance: number;
  user?: { role?: string; portalStatus?: string } | null;
};

type EmployeeOption = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
};

type ReportingSetup = {
  departmentHeadId?: string | null;
  reportingManagerId?: string | null;
  omId?: string | null;
  hrManagerId?: string | null;
  backupManagerId?: string | null;
};

const employeeRoles = [
  "EMPLOYEE",
  "DEPARTMENT_MANAGER",
  "OPERATIONS_MANAGER",
  "HR_MANAGER",
  "HR_OFFICER",
  "HR",
  "PAYROLL_OFFICER",
  "ACCOUNTANT",
  "FINANCE",
  "AUDITOR",
  "ADMIN",
  "SUPER_ADMIN"
];

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function EmployeeSelect({ name, label, value, employees, excludeId, onChange }: { name: string; label: string; value: string; employees: EmployeeOption[]; excludeId?: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select employee</option>
        {employees.filter((employee) => employee.id !== excludeId).map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} - {employee.firstName} {employee.lastName}</option>)}
      </select>
    </label>
  );
}

export function EmployeeCreateForm({
  departments,
  managers,
  jobTitles,
  branches,
  locations,
  employeeTypes,
  contractTypes
}: {
  departments: Department[];
  managers: EmployeeOption[];
  jobTitles: SelectOption[];
  branches: SelectOption[];
  locations: SelectOption[];
  employeeTypes: SelectOption[];
  contractTypes: SelectOption[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [managerId, setManagerId] = useState("");
  const [departmentHeadId, setDepartmentHeadId] = useState("");
  const [omId, setOmId] = useState("");
  const [hrManagerId, setHrManagerId] = useState("");
  const [alternateManagerId, setAlternateManagerId] = useState("");

  async function loadReportingSetup(departmentId: string, branch = "") {
    if (!departmentId) return;
    const query = branch ? `?branch=${encodeURIComponent(branch)}` : "";
    const response = await fetch(`/api/backend/departments/${departmentId}/reporting-setup/active${query}`);
    if (!response.ok) {
      setMessage("No reporting setup found for this department. Please select a reporting manager.");
      setManagerId("");
      setDepartmentHeadId("");
      setOmId("");
      setHrManagerId("");
      setAlternateManagerId("");
      return;
    }
    const setup = await response.json() as ReportingSetup;
    setManagerId(setup.reportingManagerId ?? setup.departmentHeadId ?? "");
    setDepartmentHeadId(setup.departmentHeadId ?? "");
    setOmId(setup.omId ?? "");
    setHrManagerId(setup.hrManagerId ?? "");
    setAlternateManagerId(setup.backupManagerId ?? "");
    setMessage("Department reporting setup loaded.");
  }

  async function submit(formData: FormData) {
    setMessage("");
    const payload = {
      employeeCode: formData.get("employeeCode"),
      nationalId: formData.get("nationalId"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      fullNameArabic: optionalText(formData.get("fullNameArabic")),
      email: formData.get("email"),
      companyEmail: optionalText(formData.get("companyEmail")),
      phone: optionalText(formData.get("phone")),
      emergencyContact: optionalText(formData.get("emergencyContact")),
      address: optionalText(formData.get("address")),
      jobTitle: formData.get("jobTitle"),
      branch: optionalText(formData.get("branch")),
      location: optionalText(formData.get("location")),
      managerId: optionalText(formData.get("managerId")),
      departmentHeadId: optionalText(formData.get("departmentHeadId")),
      omId: optionalText(formData.get("omId")),
      hrManagerId: optionalText(formData.get("hrManagerId")),
      alternateManagerId: optionalText(formData.get("alternateManagerId")),
      employeeType: optionalText(formData.get("employeeType")),
      contractType: optionalText(formData.get("contractType")),
      joiningDate: formData.get("joiningDate"),
      departmentId: formData.get("departmentId"),
      basicSalary: formData.get("basicSalary"),
      housingAllowance: formData.get("housingAllowance") || 0,
      transportAllowance: formData.get("transportAllowance") || 0,
      otherAllowance: formData.get("otherAllowance") || 0,
      leaveBalance: formData.get("leaveBalance") || 21,
      role: formData.get("role")
    };

    const response = await fetch("/api/backend/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.message ?? "Unable to create employee.");
      return;
    }
    setMessage("Employee created.");
    router.push("/employees");
    router.refresh();
  }

  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field"><span>Employee code</span><input name="employeeCode" required /></label>
        <label className="field"><span>National ID / Iqama</span><input name="nationalId" minLength={10} required /></label>
        <label className="field"><span>First name</span><input name="firstName" required /></label>
        <label className="field"><span>Last name</span><input name="lastName" required /></label>
        <label className="field"><span>Arabic full name</span><input name="fullNameArabic" dir="rtl" /></label>
        <label className="field"><span>Personal email</span><input name="email" type="email" required /></label>
        <label className="field"><span>Company email</span><input name="companyEmail" type="email" /></label>
        <label className="field"><span>Mobile number</span><input name="phone" /></label>
        <label className="field"><span>Emergency contact</span><input name="emergencyContact" /></label>
        <label className="field"><span>Address</span><input name="address" /></label>
        <label className="field"><span>Department</span><select name="departmentId" required onChange={(event) => loadReportingSetup(event.target.value)}><option value="">Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
        <label className="field"><span>Job title</span><select name="jobTitle" required><option value="">Select job title</option>{jobTitles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="field"><span>Branch</span><select name="branch"><option value="">Select branch</option>{branches.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="field"><span>Location</span><select name="location"><option value="">Select location</option>{locations.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <EmployeeSelect name="managerId" label="Reporting manager" value={managerId} employees={managers} onChange={setManagerId} />
        <EmployeeSelect name="departmentHeadId" label="Department head" value={departmentHeadId} employees={managers} onChange={setDepartmentHeadId} />
        <EmployeeSelect name="omId" label="OM approver" value={omId} employees={managers} onChange={setOmId} />
        <EmployeeSelect name="hrManagerId" label="HR manager" value={hrManagerId} employees={managers} onChange={setHrManagerId} />
        <EmployeeSelect name="alternateManagerId" label="Backup manager" value={alternateManagerId} employees={managers} onChange={setAlternateManagerId} />
        <label className="field"><span>Employee type</span><select name="employeeType"><option value="">Select employee type</option>{employeeTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="field"><span>Contract type</span><select name="contractType"><option value="">Select contract type</option>{contractTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="field"><span>Joining date</span><input name="joiningDate" type="date" required /></label>
        <label className="field"><span>Basic salary</span><input name="basicSalary" type="number" min="0" step="0.01" required /></label>
        <label className="field"><span>Housing allowance</span><input name="housingAllowance" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Transport allowance</span><input name="transportAllowance" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Other allowance</span><input name="otherAllowance" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Leave balance</span><input name="leaveBalance" type="number" min="0" defaultValue="21" /></label>
        <label className="field"><span>User role</span><select name="role" defaultValue="EMPLOYEE"><option>EMPLOYEE</option><option>DEPARTMENT_MANAGER</option><option>OPERATIONS_MANAGER</option><option>HR</option><option>HR_OFFICER</option><option>HR_MANAGER</option><option>ACCOUNTANT</option><option>FINANCE</option></select></label>
        <label className="field"><span>Initial portal password</span><input value="Employee code" readOnly /></label>
      </div>
      <div className="actions">
        <button className="button" type="submit"><Save size={16} /> Save Employee</button>
        <a className="button secondary" href="/employees">Cancel</a>
        {message ? <span className={message === "Employee created." ? "status" : "status danger"}>{message}</span> : null}
      </div>
    </form>
  );
}

export function EmployeeAdminEditForm({ employee, departments, managers }: { employee: Employee; departments: Department[]; managers: EmployeeOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [managerId, setManagerId] = useState(employee.managerId ?? "");
  const [departmentHeadId, setDepartmentHeadId] = useState(employee.departmentHeadId ?? "");
  const [omId, setOmId] = useState(employee.omId ?? "");
  const [hrManagerId, setHrManagerId] = useState(employee.hrManagerId ?? "");
  const [alternateManagerId, setAlternateManagerId] = useState(employee.alternateManagerId ?? "");

  async function loadReportingSetup(departmentId: string, branch = "") {
    if (!departmentId) return;
    const query = branch ? `?branch=${encodeURIComponent(branch)}` : "";
    const response = await fetch(`/api/backend/departments/${departmentId}/reporting-setup/active${query}`);
    if (!response.ok) {
      setMessage("No reporting setup found for this department. Existing reporting values were kept.");
      return;
    }
    const setup = await response.json() as ReportingSetup;
    setManagerId(setup.reportingManagerId ?? setup.departmentHeadId ?? "");
    setDepartmentHeadId(setup.departmentHeadId ?? "");
    setOmId(setup.omId ?? "");
    setHrManagerId(setup.hrManagerId ?? "");
    setAlternateManagerId(setup.backupManagerId ?? "");
    setMessage("Department reporting setup loaded.");
  }

  async function submit(formData: FormData) {
    const response = await fetch(`/api/backend/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nationalId: formData.get("nationalId"),
        firstName: formData.get("firstName"),
        lastName: formData.get("lastName"),
        fullNameArabic: optionalText(formData.get("fullNameArabic")),
        email: formData.get("email"),
        companyEmail: optionalText(formData.get("companyEmail")),
        phone: optionalText(formData.get("phone")),
        emergencyContact: optionalText(formData.get("emergencyContact")),
        address: optionalText(formData.get("address")),
        passportNumber: optionalText(formData.get("passportNumber")),
        gosiNumber: optionalText(formData.get("gosiNumber")),
        qiwaReference: optionalText(formData.get("qiwaReference")),
        biometricId: optionalText(formData.get("biometricId")),
        deviceUserId: optionalText(formData.get("deviceUserId")),
        bankName: optionalText(formData.get("bankName")),
        iban: optionalText(formData.get("iban")),
        jobTitle: formData.get("jobTitle"),
        branch: optionalText(formData.get("branch")),
        location: optionalText(formData.get("location")),
        managerId: optionalText(formData.get("managerId")),
        departmentHeadId: optionalText(formData.get("departmentHeadId")),
        omId: optionalText(formData.get("omId")),
        hrManagerId: optionalText(formData.get("hrManagerId")),
        alternateManagerId: optionalText(formData.get("alternateManagerId")),
        employeeType: optionalText(formData.get("employeeType")),
        contractType: optionalText(formData.get("contractType")),
        joiningDate: formData.get("joiningDate"),
        departmentId: formData.get("departmentId"),
        basicSalary: formData.get("basicSalary"),
        housingAllowance: formData.get("housingAllowance") || 0,
        transportAllowance: formData.get("transportAllowance") || 0,
        otherAllowance: formData.get("otherAllowance") || 0,
        leaveBalance: formData.get("leaveBalance") || 0,
        role: formData.get("role"),
        portalStatus: formData.get("portalStatus")
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.message ?? "Unable to update employee.");
      return;
    }
    setMessage("Employee updated.");
    router.push("/employees");
    router.refresh();
  }

  async function uploadDocument(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setMessage("Please select a file.");
      return;
    }
    const uploadData = new FormData();
    uploadData.append("file", file);
    uploadData.append("relatedModule", "EmployeeDocument");
    uploadData.append("relatedRecordId", employee.id);
    uploadData.append("relatedRecordNumber", employee.employeeCode);
    uploadData.append("employeeId", employee.id);
    uploadData.append("attachmentType", String(formData.get("documentType") ?? "Employee document"));
    const uploadResponse = await fetch("/api/backend/attachments", { method: "POST", body: uploadData });
    const uploaded = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) {
      setMessage(uploaded.message ?? "Upload failed. Please try again.");
      return;
    }
    const response = await fetch(`/api/backend/employees/${employee.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentType: formData.get("documentType"),
        fileName: uploaded.originalFileName ?? file.name,
        fileUrl: `/api/backend/attachments/${uploaded.id}/download`,
        expiryDate: optionalText(formData.get("expiryDate")),
        notes: optionalText(formData.get("notes"))
      })
    });
    setMessage(response.ok ? "Document uploaded." : "Document upload failed.");
    router.refresh();
  }

  const joinDate = employee.joiningDate ? new Date(employee.joiningDate).toISOString().slice(0, 10) : "";

  return (
    <>
      <form action={submit} className="form-panel grid">
        <div className="form-grid">
          <label className="field"><span>Employee code</span><input value={employee.employeeCode} readOnly /></label>
          <label className="field"><span>National ID / Iqama</span><input name="nationalId" minLength={10} defaultValue={employee.nationalId} required /></label>
          <label className="field"><span>First name</span><input name="firstName" defaultValue={employee.firstName} required /></label>
          <label className="field"><span>Last name</span><input name="lastName" defaultValue={employee.lastName} required /></label>
          <label className="field"><span>Arabic full name</span><input name="fullNameArabic" defaultValue={employee.fullNameArabic ?? ""} dir="rtl" /></label>
          <label className="field"><span>Personal email</span><input name="email" type="email" defaultValue={employee.email} required /></label>
          <label className="field"><span>Company email</span><input name="companyEmail" type="email" defaultValue={employee.companyEmail ?? ""} /></label>
          <label className="field"><span>Mobile number</span><input name="phone" defaultValue={employee.phone ?? ""} /></label>
          <label className="field"><span>Emergency contact</span><input name="emergencyContact" defaultValue={employee.emergencyContact ?? ""} /></label>
          <label className="field"><span>Address</span><input name="address" defaultValue={employee.address ?? ""} /></label>
          <label className="field"><span>Department</span><select name="departmentId" defaultValue={employee.departmentId} required onChange={(event) => loadReportingSetup(event.target.value)}>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
          <EmployeeSelect name="managerId" label="Reporting manager" value={managerId} employees={managers} excludeId={employee.id} onChange={setManagerId} />
          <EmployeeSelect name="departmentHeadId" label="Department head" value={departmentHeadId} employees={managers} excludeId={employee.id} onChange={setDepartmentHeadId} />
          <EmployeeSelect name="omId" label="OM approver" value={omId} employees={managers} excludeId={employee.id} onChange={setOmId} />
          <EmployeeSelect name="hrManagerId" label="HR manager" value={hrManagerId} employees={managers} excludeId={employee.id} onChange={setHrManagerId} />
          <EmployeeSelect name="alternateManagerId" label="Backup manager" value={alternateManagerId} employees={managers} excludeId={employee.id} onChange={setAlternateManagerId} />
          <label className="field"><span>Job title</span><input name="jobTitle" defaultValue={employee.jobTitle} required /></label>
          <label className="field"><span>Branch</span><input name="branch" defaultValue={employee.branch ?? ""} /></label>
          <label className="field"><span>Location</span><input name="location" defaultValue={employee.location ?? ""} /></label>
          <label className="field"><span>Employee type</span><input name="employeeType" defaultValue={employee.employeeType ?? ""} /></label>
          <label className="field"><span>Contract type</span><input name="contractType" defaultValue={employee.contractType ?? ""} /></label>
          <label className="field"><span>Joining date</span><input name="joiningDate" type="date" defaultValue={joinDate} required /></label>
          <label className="field"><span>Basic salary</span><input name="basicSalary" type="number" min="0" step="0.01" defaultValue={String(employee.basicSalary)} required /></label>
          <label className="field"><span>Housing allowance</span><input name="housingAllowance" type="number" min="0" step="0.01" defaultValue={String(employee.housingAllowance ?? 0)} /></label>
          <label className="field"><span>Transport allowance</span><input name="transportAllowance" type="number" min="0" step="0.01" defaultValue={String(employee.transportAllowance ?? 0)} /></label>
          <label className="field"><span>Other allowance</span><input name="otherAllowance" type="number" min="0" step="0.01" defaultValue={String(employee.otherAllowance ?? 0)} /></label>
          <label className="field"><span>Leave balance</span><input name="leaveBalance" type="number" min="0" defaultValue={employee.leaveBalance} /></label>
          <label className="field"><span>User role</span><select name="role" defaultValue={employee.user?.role ?? "EMPLOYEE"}>{employeeRoles.map((role) => <option key={role} value={role}>{role.replace(/_/g, " ")}</option>)}</select></label>
          <label className="field"><span>Portal status</span><select name="portalStatus" defaultValue={employee.user?.portalStatus ?? "PENDING_FIRST_LOGIN"}><option value="ACTIVE">Active</option><option value="PENDING_FIRST_LOGIN">First Login</option><option value="PASSWORD_RESET_REQUIRED">Reset Required</option><option value="DISABLED">Disabled</option></select></label>
          <label className="field"><span>Passport number</span><input name="passportNumber" defaultValue={employee.passportNumber ?? ""} /></label>
          <label className="field"><span>GOSI number</span><input name="gosiNumber" defaultValue={employee.gosiNumber ?? ""} /></label>
          <label className="field"><span>QIWA reference</span><input name="qiwaReference" defaultValue={employee.qiwaReference ?? ""} /></label>
          <label className="field"><span>Bank name</span><input name="bankName" defaultValue={employee.bankName ?? ""} /></label>
          <label className="field"><span>IBAN</span><input name="iban" defaultValue={employee.iban ?? ""} /></label>
          <label className="field"><span>Biometric ID</span><input name="biometricId" defaultValue={employee.biometricId ?? ""} /></label>
          <label className="field"><span>Device user ID</span><input name="deviceUserId" defaultValue={employee.deviceUserId ?? ""} /></label>
        </div>
        <div className="actions">
          <button className="button" type="submit"><Save size={16} /> Save Employee Changes</button>
          <a className="button secondary" href="/employees">Back</a>
          {message ? <span className={message.includes("failed") || message.includes("Unable") || message.includes("required") ? "status danger" : "status"}>{message}</span> : null}
        </div>
      </form>
      <form action={uploadDocument} className="form-panel grid">
        <div className="form-grid">
          <label className="field"><span>Document type</span><input name="documentType" placeholder="Iqama, Passport, Contract" required /></label>
          <label className="field"><span>Expiry date</span><input name="expiryDate" type="date" /></label>
          <label className="field"><span>Document file</span><input name="file" type="file" required /></label>
          <label className="field"><span>Notes</span><input name="notes" /></label>
        </div>
        <div className="actions"><button className="button secondary" type="submit">Upload Document</button></div>
      </form>
    </>
  );
}
