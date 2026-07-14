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
  _count?: { employees: number };
};

export function DepartmentForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    const response = await fetch("/api/backend/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: formData.get("code"), name: formData.get("name") })
    });
    setMessage(response.ok ? "Department saved." : "Save failed.");
    router.refresh();
  }

  return (
    <form action={submit} className="form-panel">
      <div className="actions">
        <input name="code" placeholder="Code" required />
        <input name="name" placeholder="Department name" required />
        <button className="button" type="submit"><Save size={16} /> Add New</button>
        {message ? <span className="status">{message}</span> : null}
      </div>
    </form>
  );
}

export function DepartmentEditForm({ department }: { department: DepartmentRecord }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    const response = await fetch(`/api/backend/departments/${department.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: formData.get("code"), name: formData.get("name") })
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
      <button className="button secondary" type="submit">Edit</button>
      <button className="button secondary" type="button" onClick={archive}>Archive</button>
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
