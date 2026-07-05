"use client";

import { KeyRound, Send } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function FirstTimeLoginForm() {
  const router = useRouter();
  const [employeeCode, setEmployeeCode] = useState("");
  const [message, setMessage] = useState("");
  const [otpPreview, setOtpPreview] = useState("");
  const [verified, setVerified] = useState(false);

  async function start(formData: FormData) {
    const code = String(formData.get("employeeCode") ?? "");
    const response = await fetch("/api/backend/auth/first-time/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeCode: code,
        contact: formData.get("contact"),
        verification: formData.get("verification")
      })
    });
    const data = await response.json();
    setEmployeeCode(code);
    setMessage(data.message ?? (response.ok ? "OTP sent." : "Verification failed."));
    setOtpPreview(data.otpPreview ?? "");
    if (response.ok) setVerified(true);
  }

  async function complete(formData: FormData) {
    const response = await fetch("/api/backend/auth/first-time/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeCode,
        otp: formData.get("otp"),
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
  }

  return (
    <div className="auth-card grid">
      <h1 className="page-title">First-Time Login</h1>
      <p className="muted">Verify your Employee ID, registered contact, and National ID/Iqama last four digits.</p>
      {!verified ? (
        <form action={start} className="grid">
          <label className="field"><span>Employee ID / Employee Code</span><input name="employeeCode" defaultValue="EMP-002" required /></label>
          <label className="field"><span>Registered mobile or email</span><input name="contact" defaultValue="employee@company.com" required /></label>
          <label className="field"><span>National ID / Iqama last four digits</span><input name="verification" defaultValue="0002" required /></label>
          <button className="button" type="submit"><Send size={18} /> Send OTP</button>
        </form>
      ) : (
        <form action={complete} className="grid">
          <label className="field"><span>OTP</span><input name="otp" defaultValue={otpPreview} required /></label>
          <label className="field"><span>Create password</span><input name="password" type="password" required /></label>
          <label className="field"><span>Confirm password</span><input name="confirmPassword" type="password" required /></label>
          <button className="button" type="submit"><KeyRound size={18} /> Activate Account</button>
        </form>
      )}
      {message ? <p className="status">{message}</p> : null}
      {otpPreview ? <p className="notice">Preview OTP: {otpPreview}</p> : null}
      <a className="button secondary" href="/login">Back to login</a>
    </div>
  );
}
