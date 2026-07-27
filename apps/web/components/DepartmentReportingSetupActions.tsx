"use client";

import { Save, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Department = { id: string; code: string; name: string };
type Employee = { id: string; employeeCode: string; firstName: string; lastName: string; jobTitle?: string };
type Setup = {
  id: string;
  company?: string | null;
  branch?: string | null;
  departmentId: string;
  departmentHeadId?: string | null;
  reportingManagerId?: string | null;
  omId?: string | null;
  hrManagerId?: string | null;
  backupManagerId?: string | null;
  effectiveStartDate: string;
  effectiveEndDate?: string | null;
  status: string;
  remarks?: string | null;
};

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function EmployeeOptions({ employees }: { employees: Employee[] }) {
  return (
    <>
      <option value="">Select employee</option>
      {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} - {employee.firstName} {employee.lastName}</option>)}
    </>
  );
}

export function DepartmentReportingSetupForm({ departments, employees, setup }: { departments: Department[]; employees: Employee[]; setup?: Setup }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setMessage("");
    const payload = {
      company: optionalText(formData.get("company")),
      branch: optionalText(formData.get("branch")),
      departmentId: formData.get("departmentId"),
      departmentHeadId: optionalText(formData.get("departmentHeadId")),
      reportingManagerId: optionalText(formData.get("reportingManagerId")),
      omId: optionalText(formData.get("omId")),
      hrManagerId: optionalText(formData.get("hrManagerId")),
      backupManagerId: optionalText(formData.get("backupManagerId")),
      effectiveStartDate: formData.get("effectiveStartDate"),
      effectiveEndDate: optionalText(formData.get("effectiveEndDate")),
      status: formData.get("status"),
      remarks: optionalText(formData.get("remarks"))
    };
    const response = await fetch(`/api/backend/departments/reporting-setups${setup ? `/${setup.id}` : ""}`, {
      method: setup ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.message ?? "Unable to save reporting setup.");
      return;
    }
    setMessage("Reporting setup saved.");
    router.refresh();
  }

  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field"><span>Company</span><input name="company" defaultValue={setup?.company ?? ""} placeholder="Current company" /></label>
        <label className="field"><span>Branch</span><input name="branch" defaultValue={setup?.branch ?? ""} placeholder="All branches" /></label>
        <label className="field"><span>Department</span><select name="departmentId" defaultValue={setup?.departmentId ?? ""} required><option value="">Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.code} - {department.name}</option>)}</select></label>
        <label className="field"><span>Department head</span><select name="departmentHeadId" defaultValue={setup?.departmentHeadId ?? ""}><EmployeeOptions employees={employees} /></select></label>
        <label className="field"><span>Reporting manager</span><select name="reportingManagerId" defaultValue={setup?.reportingManagerId ?? ""}><EmployeeOptions employees={employees} /></select></label>
        <label className="field"><span>OM</span><select name="omId" defaultValue={setup?.omId ?? ""}><EmployeeOptions employees={employees} /></select></label>
        <label className="field"><span>HR manager</span><select name="hrManagerId" defaultValue={setup?.hrManagerId ?? ""}><EmployeeOptions employees={employees} /></select></label>
        <label className="field"><span>Backup manager</span><select name="backupManagerId" defaultValue={setup?.backupManagerId ?? ""}><EmployeeOptions employees={employees} /></select></label>
        <label className="field"><span>Effective start</span><input name="effectiveStartDate" type="date" required defaultValue={setup?.effectiveStartDate ? setup.effectiveStartDate.slice(0, 10) : new Date().toISOString().slice(0, 10)} /></label>
        <label className="field"><span>Effective end</span><input name="effectiveEndDate" type="date" defaultValue={setup?.effectiveEndDate ? setup.effectiveEndDate.slice(0, 10) : ""} /></label>
        <label className="field"><span>Status</span><select name="status" defaultValue={setup?.status ?? "ACTIVE"}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
        <label className="field wide"><span>Remarks</span><input name="remarks" defaultValue={setup?.remarks ?? ""} /></label>
      </div>
      <div className="actions">
        <button className="button" type="submit"><Save size={15} /> {setup ? "Update Setup" : "Save Setup"}</button>
        {message ? <span className={message.includes("Unable") ? "status danger" : "status"}>{message}</span> : null}
      </div>
    </form>
  );
}

export function BulkApplyReportingSetupButton({ setup }: { setup: Setup }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function apply() {
    setMessage("");
    const payload = { setupId: setup.id, departmentId: setup.departmentId, branch: setup.branch || undefined };
    const preview = await fetch("/api/backend/departments/reporting-setups/bulk-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, preview: true })
    });
    const previewData = await preview.json().catch(() => ({}));
    if (!preview.ok) {
      setMessage(previewData.message ?? "Unable to preview setup.");
      return;
    }
    if (!confirm(`Apply this reporting setup to ${previewData.count ?? 0} employees?`)) return;
    const reason = prompt("Reason for bulk reporting update");
    if (!reason?.trim()) {
      setMessage("Reason is required.");
      return;
    }
    const response = await fetch("/api/backend/departments/reporting-setups/bulk-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, reason })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.message ?? "Unable to apply setup.");
      return;
    }
    setMessage(`Applied to ${data.count ?? 0} employees.`);
    router.refresh();
  }

  return (
    <span className="inline-actions">
      <button className="button secondary compact" type="button" onClick={apply}><Users size={14} /> Apply</button>
      {message ? <span className="muted">{message}</span> : null}
    </span>
  );
}
