"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  basicSalary: string | number;
  housingAllowance?: string | number;
  transportAllowance?: string | number;
  otherAllowance?: string | number;
  leaveBalance: number;
};

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

export function EmployeeCreateForm({ departments }: { departments: Department[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

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
      employeeType: optionalText(formData.get("employeeType")),
      contractType: optionalText(formData.get("contractType")),
      joiningDate: formData.get("joiningDate"),
      departmentId: formData.get("departmentId"),
      basicSalary: formData.get("basicSalary"),
      housingAllowance: formData.get("housingAllowance") || 0,
      transportAllowance: formData.get("transportAllowance") || 0,
      otherAllowance: formData.get("otherAllowance") || 0,
      leaveBalance: formData.get("leaveBalance") || 21,
      role: formData.get("role"),
      password: optionalText(formData.get("password"))
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
        <label className="field"><span>Department</span><select name="departmentId" required>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
        <label className="field"><span>Job title</span><input name="jobTitle" required /></label>
        <label className="field"><span>Branch</span><input name="branch" /></label>
        <label className="field"><span>Location</span><input name="location" /></label>
        <label className="field"><span>Employee type</span><input name="employeeType" placeholder="Full-time" /></label>
        <label className="field"><span>Contract type</span><input name="contractType" placeholder="Unlimited" /></label>
        <label className="field"><span>Joining date</span><input name="joiningDate" type="date" required /></label>
        <label className="field"><span>Basic salary</span><input name="basicSalary" type="number" min="0" step="0.01" required /></label>
        <label className="field"><span>Housing allowance</span><input name="housingAllowance" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Transport allowance</span><input name="transportAllowance" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Other allowance</span><input name="otherAllowance" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Leave balance</span><input name="leaveBalance" type="number" min="0" defaultValue="21" /></label>
        <label className="field"><span>User role</span><select name="role" defaultValue="EMPLOYEE"><option>EMPLOYEE</option><option>DEPARTMENT_MANAGER</option><option>OPERATIONS_MANAGER</option><option>HR</option><option>HR_OFFICER</option><option>HR_MANAGER</option><option>ACCOUNTANT</option><option>FINANCE</option></select></label>
        <label className="field"><span>Temporary password</span><input name="password" type="password" placeholder="Optional" /></label>
      </div>
      <div className="actions">
        <button className="button" type="submit"><Save size={16} /> Save Employee</button>
        <a className="button secondary" href="/employees">Cancel</a>
        {message ? <span className={message === "Employee created." ? "status" : "status danger"}>{message}</span> : null}
      </div>
    </form>
  );
}

export function EmployeeAdminEditForm({ employee, departments, managers }: { employee: Employee; departments: Department[]; managers: Employee[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    const changeReason = optionalText(formData.get("changeReason"));
    if (!changeReason) {
      setMessage("Reason for change is required.");
      return;
    }
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
        employeeType: optionalText(formData.get("employeeType")),
        contractType: optionalText(formData.get("contractType")),
        joiningDate: formData.get("joiningDate"),
        departmentId: formData.get("departmentId"),
        basicSalary: formData.get("basicSalary"),
        housingAllowance: formData.get("housingAllowance") || 0,
        transportAllowance: formData.get("transportAllowance") || 0,
        otherAllowance: formData.get("otherAllowance") || 0,
        leaveBalance: formData.get("leaveBalance") || 0,
        changeReason
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.message ?? "Unable to update employee.");
      return;
    }
    setMessage("Employee updated.");
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
          <label className="field"><span>Department</span><select name="departmentId" defaultValue={employee.departmentId} required>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
          <label className="field"><span>Assigned manager</span><select name="managerId" defaultValue={employee.managerId ?? ""}><option value="">No manager</option>{managers.filter((manager) => manager.id !== employee.id).map((manager) => <option key={manager.id} value={manager.id}>{manager.employeeCode} - {manager.firstName} {manager.lastName}</option>)}</select></label>
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
          <label className="field"><span>Passport number</span><input name="passportNumber" defaultValue={employee.passportNumber ?? ""} /></label>
          <label className="field"><span>GOSI number</span><input name="gosiNumber" defaultValue={employee.gosiNumber ?? ""} /></label>
          <label className="field"><span>QIWA reference</span><input name="qiwaReference" defaultValue={employee.qiwaReference ?? ""} /></label>
          <label className="field"><span>Bank name</span><input name="bankName" defaultValue={employee.bankName ?? ""} /></label>
          <label className="field"><span>IBAN</span><input name="iban" defaultValue={employee.iban ?? ""} /></label>
          <label className="field"><span>Biometric ID</span><input name="biometricId" defaultValue={employee.biometricId ?? ""} /></label>
          <label className="field"><span>Device user ID</span><input name="deviceUserId" defaultValue={employee.deviceUserId ?? ""} /></label>
        </div>
        <label className="field"><span>Reason for change</span><textarea name="changeReason" required placeholder="Required for admin edit, override, leave balance, salary, manager, or confidential-data changes." /></label>
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
