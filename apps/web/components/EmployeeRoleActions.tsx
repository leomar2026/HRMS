"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const roles = [
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

export function EmployeeRoleForm({ employeeId, currentRole, currentPortalStatus }: { employeeId: string; currentRole?: string; currentPortalStatus?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function save(formData: FormData) {
    const response = await fetch(`/api/backend/employees/${employeeId}/user-role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: formData.get("role"),
        portalStatus: formData.get("portalStatus")
      })
    });
    const data = await response.json().catch(() => null);
    setMessage(response.ok ? "Role saved." : data?.message ?? "Role save failed.");
    router.refresh();
  }

  return (
    <form action={save} className="employee-role-inline">
      <select name="role" defaultValue={currentRole ?? "EMPLOYEE"} aria-label="User role">
        {roles.map((role) => <option key={role} value={role}>{role.replace(/_/g, " ")}</option>)}
      </select>
      <select name="portalStatus" defaultValue={currentPortalStatus ?? "PENDING_FIRST_LOGIN"} aria-label="Portal status">
        <option value="ACTIVE">Active</option>
        <option value="PENDING_FIRST_LOGIN">First Login</option>
        <option value="PASSWORD_RESET_REQUIRED">Reset Required</option>
        <option value="DISABLED">Disabled</option>
      </select>
      <button className="button compact-save" type="submit" aria-label="Save employee role"><Save size={14} /> Save</button>
      {message ? <span className="status">{message}</span> : null}
    </form>
  );
}

export function ProvisionMissingPortalUsersButton() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function provision() {
    setMessage("Creating accounts...");
    const response = await fetch("/api/backend/employees/portal-users/provision-missing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "EMPLOYEE", portalStatus: "PENDING_FIRST_LOGIN" })
    });
    const data = await response.json().catch(() => null);
    setMessage(response.ok ? data?.message ?? "Portal accounts created." : data?.message ?? "Unable to create portal accounts.");
    router.refresh();
  }

  return (
    <div className="actions">
      <button className="button secondary" type="button" onClick={provision}>Create Missing Employee Portal Accounts</button>
      {message ? <span className={message.includes("Unable") ? "status danger" : "status"}>{message}</span> : null}
    </div>
  );
}
