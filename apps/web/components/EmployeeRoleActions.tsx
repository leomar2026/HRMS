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

export function EmployeeRoleForm({ employeeId, currentRole }: { employeeId: string; currentRole?: string }) {
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
    setMessage(response.ok ? "Role saved." : "Role save failed.");
    router.refresh();
  }

  return (
    <form action={save} className="inline-form">
      <select name="role" defaultValue={currentRole ?? "EMPLOYEE"} aria-label="User role">
        {roles.map((role) => <option key={role} value={role}>{role.replace(/_/g, " ")}</option>)}
      </select>
      <select name="portalStatus" defaultValue="ACTIVE" aria-label="Portal status">
        <option value="ACTIVE">Active</option>
        <option value="PENDING_FIRST_LOGIN">First Login</option>
        <option value="PASSWORD_RESET_REQUIRED">Reset Required</option>
        <option value="DISABLED">Disabled</option>
      </select>
      <button className="icon-button" type="submit" aria-label="Save employee role"><Save size={16} /></button>
      {message ? <span className="status">{message}</span> : null}
    </form>
  );
}
