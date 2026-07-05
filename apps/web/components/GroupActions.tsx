"use client";

import { Archive, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function GroupForm({ defaultType = "EMPLOYEE" }: { defaultType?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    const response = await fetch("/api/backend/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupCode: formData.get("groupCode"),
        groupName: formData.get("groupName"),
        groupType: formData.get("groupType"),
        company: formData.get("company") || undefined,
        branch: formData.get("branch") || undefined,
        department: formData.get("department") || undefined,
        groupOwner: formData.get("groupOwner") || undefined,
        description: formData.get("description") || undefined
      })
    });
    setMessage(response.ok ? "Group saved." : "Unable to save group.");
    if (response.ok) router.refresh();
  }

  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field"><span>Group code</span><input name="groupCode" placeholder="EMP-RIYADH-01" required /></label>
        <label className="field"><span>Group name</span><input name="groupName" placeholder="Riyadh Employees" required /></label>
        <label className="field">
          <span>Group type</span>
          <select name="groupType" defaultValue={defaultType}>
            <option>EMPLOYEE</option>
            <option>DEPARTMENT</option>
            <option>PAYROLL</option>
            <option>LEAVE</option>
            <option>ATTENDANCE</option>
          </select>
        </label>
        <label className="field"><span>Company</span><input name="company" /></label>
        <label className="field"><span>Branch</span><input name="branch" /></label>
        <label className="field"><span>Department</span><input name="department" /></label>
        <label className="field"><span>Group owner</span><input name="groupOwner" /></label>
        <label className="field"><span>Description</span><input name="description" /></label>
      </div>
      <div className="actions">
        <button className="button" type="submit"><Save size={18} /> Save group</button>
        {message ? <span className="status">{message}</span> : null}
      </div>
    </form>
  );
}

export function ArchiveGroupButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function archiveGroup() {
    setBusy(true);
    await fetch(`/api/backend/groups/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button className="danger-action" type="button" onClick={archiveGroup} disabled={busy}>
      <Archive size={14} /> {busy ? "Archiving..." : "Archive group"}
    </button>
  );
}
