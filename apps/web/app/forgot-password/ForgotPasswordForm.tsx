"use client";

import { Send } from "lucide-react";
import { useState } from "react";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");

  async function submit(formData: FormData) {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId: formData.get("loginId"), contact: formData.get("contact") })
    });
    const data = await response.json();
    setMessage(data.message ?? (response.ok ? "Reset instructions generated." : "Unable to generate reset instructions."));
    setToken(data.resetTokenPreview ?? "");
  }

  return (
    <form action={submit} className="auth-card grid">
      <h1 className="page-title">Forgot Password</h1>
      <p className="muted">Enter Employee ID and a registered mobile number or email to generate a secure reset link or OTP.</p>
      <label className="field"><span>Employee ID / Employee Code</span><input name="loginId" required /></label>
      <label className="field"><span>Registered mobile or email</span><input name="contact" required /></label>
      <button className="button" type="submit"><Send size={18} /> Send reset instructions</button>
      {message ? <p className="status">{message}</p> : null}
      {token ? <p className="notice">Preview reset token: {token}</p> : null}
      <a className="button secondary" href="/login">Back to login</a>
    </form>
  );
}
