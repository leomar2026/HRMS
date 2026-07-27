"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function FirstTimeLoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function complete(formData: FormData) {
    const response = await fetch("/api/auth/first-time/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeCode: formData.get("employeeCode"),
        password: formData.get("password"),
        confirmPassword: formData.get("confirmPassword")
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message ?? "Password setup failed.");
      return;
    }
    router.push(data.redirectTo ?? "/employee/dashboard");
    router.refresh();
  }

  return (
    <div className="auth-card grid">
      <h1 className="page-title">First-Time Login</h1>
      <p className="muted">Enter your Employee ID and create your password.</p>
      <form action={complete} className="grid">
        <label className="field"><span>Employee ID / Employee Code</span><input name="employeeCode" required /></label>
        <label className="field"><span>New password</span><input name="password" type="password" minLength={4} required /></label>
        <label className="field"><span>Retype new password</span><input name="confirmPassword" type="password" minLength={4} required /></label>
        <button className="button" type="submit"><KeyRound size={18} /> Activate Account</button>
      </form>
      {message ? <p className="status">{message}</p> : null}
      <a className="button secondary" href="/login">Back to login</a>
    </div>
  );
}
