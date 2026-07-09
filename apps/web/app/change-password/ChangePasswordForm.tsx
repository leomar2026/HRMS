"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChangePasswordForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setMessage("");
    const response = await fetch("/api/backend/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: formData.get("currentPassword"),
        newPassword: formData.get("newPassword"),
        confirmPassword: formData.get("confirmPassword")
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message ?? "Password change failed.");
      return;
    }
    router.push(data.redirectTo ?? "/dashboard");
    router.refresh();
  }

  return (
    <form action={submit} className="auth-card grid">
      <h1 className="page-title">Change Password</h1>
      <p className="muted">You must create a new password before accessing the HRMS.</p>
      <label className="field"><span>Current temporary password</span><input name="currentPassword" type="password" required /></label>
      <label className="field"><span>New password</span><input name="newPassword" type="password" required /></label>
      <label className="field"><span>Confirm new password</span><input name="confirmPassword" type="password" required /></label>
      <button className="button" type="submit"><KeyRound size={18} /> Save Password</button>
      {message ? <p className="status danger">{message}</p> : null}
    </form>
  );
}
