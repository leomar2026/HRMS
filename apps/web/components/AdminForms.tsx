"use client";

import { Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function MasterDataForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    const response = await fetch("/api/backend/master-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: formData.get("type"),
        code: formData.get("code") || undefined,
        name: formData.get("name"),
        nameArabic: formData.get("nameArabic") || undefined,
        active: true
      })
    });
    setMessage(response.ok ? "Master data saved." : "Save failed.");
    router.refresh();
  }

  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field"><span>Type</span><input name="type" placeholder="BRANCH" required /></label>
        <label className="field"><span>Code</span><input name="code" placeholder="Auto from number series" /></label>
        <label className="field"><span>Name</span><input name="name" required /></label>
        <label className="field"><span>Arabic name</span><input name="nameArabic" /></label>
      </div>
      <div className="actions"><button className="button" type="submit"><Save size={18} /> Save</button>{message ? <span className="status">{message}</span> : null}</div>
    </form>
  );
}

type MasterDataRecord = {
  id: string;
  type: string;
  code: string;
  name: string;
  nameArabic?: string;
  active: boolean;
};

export function MasterDataEditForm({ record }: { record: MasterDataRecord }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    const response = await fetch(`/api/backend/master-data/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: formData.get("type"),
        code: formData.get("code"),
        name: formData.get("name"),
        nameArabic: formData.get("nameArabic") || undefined,
        active: formData.get("active") === "on"
      })
    });
    setMessage(response.ok ? "Updated." : "Update failed.");
    router.refresh();
  }

  async function archive() {
    if (!confirm(`Archive ${record.code}?`)) return;
    const response = await fetch(`/api/backend/master-data/${record.id}`, { method: "DELETE" });
    setMessage(response.ok ? "Archived." : "Archive failed.");
    router.refresh();
  }

  async function toggleActive() {
    const response = await fetch(`/api/backend/master-data/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !record.active })
    });
    setMessage(response.ok ? (record.active ? "Deactivated." : "Activated.") : "Status update failed.");
    router.refresh();
  }

  return (
    <form action={submit} className="inline-edit-form">
      <input name="type" defaultValue={record.type} aria-label="Type" required />
      <input name="code" defaultValue={record.code} aria-label="Code" required />
      <input name="name" defaultValue={record.name} aria-label="Name" required />
      <input name="nameArabic" defaultValue={record.nameArabic ?? ""} aria-label="Arabic name" />
      <label className="status"><input name="active" type="checkbox" defaultChecked={record.active} /> Active</label>
      <button className="button secondary" type="submit">Edit</button>
      <button className="button secondary" type="button" onClick={toggleActive}>{record.active ? "Deactivate" : "Activate"}</button>
      <button className="button secondary" type="button" onClick={archive}>Archive</button>
      {message ? <span className="status">{message}</span> : null}
    </form>
  );
}

type DepartmentRecord = {
  id: string;
  code: string;
  name: string;
  nameArabic?: string | null;
  company?: string | null;
  branch?: string | null;
  parentDepartmentId?: string | null;
  departmentHeadId?: string | null;
  defaultReportingManagerId?: string | null;
  omId?: string | null;
  hrManagerId?: string | null;
  costCenter?: string | null;
  status?: string;
  remarks?: string | null;
  _count?: { employees: number };
};

type EmployeeOption = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
};

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function employeeOptions(employees: EmployeeOption[]) {
  return employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} - {employee.firstName} {employee.lastName}</option>);
}

function departmentPayload(formData: FormData) {
  return {
    code: formData.get("code"),
    name: formData.get("name"),
    nameArabic: optionalText(formData.get("nameArabic")),
    company: optionalText(formData.get("company")),
    branch: optionalText(formData.get("branch")),
    parentDepartmentId: optionalText(formData.get("parentDepartmentId")),
    departmentHeadId: optionalText(formData.get("departmentHeadId")),
    defaultReportingManagerId: optionalText(formData.get("defaultReportingManagerId")),
    omId: optionalText(formData.get("omId")),
    hrManagerId: optionalText(formData.get("hrManagerId")),
    costCenter: optionalText(formData.get("costCenter")),
    status: formData.get("status") || "ACTIVE",
    remarks: optionalText(formData.get("remarks"))
  };
}

export function DepartmentForm({ departments, employees }: { departments: DepartmentRecord[]; employees: EmployeeOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    const response = await fetch("/api/backend/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(departmentPayload(formData))
    });
    setMessage(response.ok ? "Department saved." : "Save failed.");
    router.refresh();
  }

  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field"><span>Department Code</span><input name="code" placeholder="Code" required /></label>
        <label className="field"><span>Name English</span><input name="name" placeholder="Department name" required /></label>
        <label className="field"><span>Name Arabic</span><input name="nameArabic" dir="rtl" /></label>
        <label className="field"><span>Company</span><input name="company" placeholder="Current company" /></label>
        <label className="field"><span>Branch</span><input name="branch" placeholder="Jeddah / Riyadh / Dammam" /></label>
        <label className="field"><span>Parent Department</span><select name="parentDepartmentId"><option value="">None</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.code} - {department.name}</option>)}</select></label>
        <label className="field"><span>Department Head</span><select name="departmentHeadId"><option value="">Select employee</option>{employeeOptions(employees)}</select></label>
        <label className="field"><span>Default Reporting Manager</span><select name="defaultReportingManagerId"><option value="">Select employee</option>{employeeOptions(employees)}</select></label>
        <label className="field"><span>OM</span><select name="omId"><option value="">Select employee</option>{employeeOptions(employees)}</select></label>
        <label className="field"><span>HR Manager</span><select name="hrManagerId"><option value="">Select employee</option>{employeeOptions(employees)}</select></label>
        <label className="field"><span>Cost Center</span><input name="costCenter" /></label>
        <label className="field"><span>Status</span><select name="status" defaultValue="ACTIVE"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
        <label className="field wide"><span>Remarks</span><input name="remarks" /></label>
      </div>
      <div className="actions">
        <button className="button" type="submit"><Save size={16} /> Add New</button>
        {message ? <span className="status">{message}</span> : null}
      </div>
    </form>
  );
}

export function DepartmentEditForm({ department, departments, employees }: { department: DepartmentRecord; departments: DepartmentRecord[]; employees: EmployeeOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    const response = await fetch(`/api/backend/departments/${department.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(departmentPayload(formData))
    });
    setMessage(response.ok ? "Updated." : "Update failed.");
    router.refresh();
  }

  async function archive() {
    if (!confirm(`Archive ${department.code}?`)) return;
    const response = await fetch(`/api/backend/departments/${department.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Archived." : data.message ?? "Archive failed.");
    router.refresh();
  }

  return (
    <form action={submit} className="inline-edit-form">
      <input name="code" defaultValue={department.code} aria-label="Department code" required />
      <input name="name" defaultValue={department.name} aria-label="Department name" required />
      <input name="nameArabic" defaultValue={department.nameArabic ?? ""} aria-label="Department Arabic name" />
      <input name="company" defaultValue={department.company ?? ""} aria-label="Company" />
      <input name="branch" defaultValue={department.branch ?? ""} aria-label="Branch" />
      <select name="parentDepartmentId" defaultValue={department.parentDepartmentId ?? ""} aria-label="Parent Department"><option value="">No parent</option>{departments.filter((item) => item.id !== department.id).map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select>
      <select name="departmentHeadId" defaultValue={department.departmentHeadId ?? ""} aria-label="Department Head"><option value="">Head</option>{employeeOptions(employees)}</select>
      <select name="defaultReportingManagerId" defaultValue={department.defaultReportingManagerId ?? ""} aria-label="Default Reporting Manager"><option value="">Manager</option>{employeeOptions(employees)}</select>
      <select name="omId" defaultValue={department.omId ?? ""} aria-label="OM"><option value="">OM</option>{employeeOptions(employees)}</select>
      <select name="hrManagerId" defaultValue={department.hrManagerId ?? ""} aria-label="HR Manager"><option value="">HR</option>{employeeOptions(employees)}</select>
      <input name="costCenter" defaultValue={department.costCenter ?? ""} aria-label="Cost Center" />
      <select name="status" defaultValue={department.status ?? "ACTIVE"} aria-label="Status"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
      <input name="remarks" defaultValue={department.remarks ?? ""} aria-label="Remarks" />
      <button className="button secondary" type="submit">Save</button>
      <a className="button secondary" href={`/department-reporting?departmentId=${department.id}`}>Manage Reporting Setup</a>
      <a className="button secondary" href={`/department-reporting-tree?departmentId=${department.id}`}>Reporting Tree</a>
      <a className="button secondary" href={`/employees?departmentId=${department.id}`}>Employees</a>
      <button className="button secondary" type="button" onClick={archive}>Archive</button>
      <a className="button secondary" href={`/audit-logs?entity=Department&entityId=${department.id}`}>Audit</a>
      {message ? <span className={message.includes("failed") ? "status danger" : "status"}>{message}</span> : null}
    </form>
  );
}

export function PermissionForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    const response = await fetch("/api/backend/permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: formData.get("role"),
        module: formData.get("module"),
        canView: formData.get("canView") === "on",
        canAdd: formData.get("canAdd") === "on",
        canEdit: formData.get("canEdit") === "on",
        canDelete: formData.get("canDelete") === "on",
        canApprove: formData.get("canApprove") === "on",
        canReject: formData.get("canReject") === "on",
        canPrint: formData.get("canPrint") === "on",
        canExportExcel: formData.get("canExportExcel") === "on",
        canExportPdf: formData.get("canExportPdf") === "on",
        canAccessConfidentialSalary: formData.get("canAccessConfidentialSalary") === "on",
        canAccessEmployeeDocuments: formData.get("canAccessEmployeeDocuments") === "on",
        canAccessGovernmentIntegrations: formData.get("canAccessGovernmentIntegrations") === "on"
      })
    });
    setMessage(response.ok ? "Permission saved." : "Save failed.");
    router.refresh();
  }

  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field"><span>Role</span><select name="role" defaultValue="HR_MANAGER"><option>SUPER_ADMIN</option><option>ADMIN</option><option>HR_MANAGER</option><option>HR_OFFICER</option><option>PAYROLL_OFFICER</option><option>FINANCE</option><option>DEPARTMENT_MANAGER</option><option>EMPLOYEE</option><option>AUDITOR</option></select></label>
        <label className="field"><span>Module</span><input name="module" defaultValue="Employees" required /></label>
      </div>
      <div className="actions">
        {["canView", "canAdd", "canEdit", "canDelete", "canApprove", "canReject", "canPrint", "canExportExcel", "canExportPdf", "canAccessConfidentialSalary", "canAccessEmployeeDocuments", "canAccessGovernmentIntegrations"].map((name) => (
          <label key={name} className="status"><input name={name} type="checkbox" /> {name.replace("can", "")}</label>
        ))}
      </div>
      <div className="actions"><button className="button" type="submit"><Save size={18} /> Save permission</button>{message ? <span className="status">{message}</span> : null}</div>
    </form>
  );
}

export function GovernmentSyncButton({ provider }: { provider: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function sync() {
    const response = await fetch("/api/backend/government/manual-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, action: "MANUAL_SYNC" })
    });
    setMessage(response.ok ? "Queued for approved connector." : "Sync queue failed.");
    router.refresh();
  }

  return (
    <div className="actions">
      <button className="button" type="button" onClick={sync}><Send size={18} /> Manual sync</button>
      <a className="button secondary" href={`/api/backend/government/${provider}/export.csv`}>Export file</a>
      {message ? <span className="status">{message}</span> : null}
    </div>
  );
}
