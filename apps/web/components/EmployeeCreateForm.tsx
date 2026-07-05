"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Department = {
  id: string;
  name: string;
  code: string;
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
