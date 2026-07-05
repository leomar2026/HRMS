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
        code: formData.get("code"),
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
        <label className="field"><span>Code</span><input name="code" required /></label>
        <label className="field"><span>Name</span><input name="name" required /></label>
        <label className="field"><span>Arabic name</span><input name="nameArabic" /></label>
      </div>
      <div className="actions"><button className="button" type="submit"><Save size={18} /> Save</button>{message ? <span className="status">{message}</span> : null}</div>
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
