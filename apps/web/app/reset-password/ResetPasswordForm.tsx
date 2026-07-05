"use client";

import { Save } from "lucide-react";
import { useState } from "react";

export function ResetPasswordForm({ token }: { token: string }) {
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: formData.get("token"),
        password: formData.get("password"),
        confirmPassword: formData.get("confirmPassword")
      })
    });
    const data = await response.json();
    setMessage(response.ok ? "Password reset successfully. You can now login." : data.message ?? "Password reset failed.");
  }

  return (
    <form action={submit} className="auth-card grid">
      <h1 className="page-title">Reset Password</h1>
      <p className="muted">Create a new password. It must satisfy the configured security rules.</p>
      <label className="field"><span>Reset token / OTP</span><input name="token" defaultValue={token} required /></label>
      <label className="field"><span>New password</span><input name="password" type="password" required /></label>
      <label className="field"><span>Confirm password</span><input name="confirmPassword" type="password" required /></label>
      <button className="button" type="submit"><Save size={18} /> Reset password</button>
      {message ? <p className="status">{message}</p> : null}
      <a className="button secondary" href="/login">Back to login</a>
    </form>
  );
}
