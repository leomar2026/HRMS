"use client";

import { Eye, EyeOff, Languages, LogIn, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PublicBranding } from "@/lib/publicBranding";

export function LoginForm({ branding }: { branding: PublicBranding }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const companyName = branding.companyName || "Company HR Portal";
  const displayName = language === "ar" ? branding.companyNameArabic || companyName : companyName;

  async function onSubmit(formData: FormData) {
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loginId: formData.get("loginId"),
        password: formData.get("password"),
        rememberMe: formData.get("rememberMe") === "on"
      })
    });

    const data = await response.json();
    if (!response.ok) {
      setError(response.status === 423 ? "Account is temporarily locked after repeated failed attempts." : data.message ?? "Invalid email or password.");
      return;
    }

    router.push(data.redirectTo ?? "/dashboard");
    router.refresh();
  }

  return (
    <form action={onSubmit} className="auth-card">
      <div className="login-brand">
        <div className="logo-mark">
          {branding.logoDataUrl ? <img src={branding.logoDataUrl} alt={`${companyName} logo`} /> : <ShieldCheck size={26} />}
        </div>
        <div>
          <h1 className="page-title">{displayName}</h1>
          <p className="muted">{language === "ar" ? "تسجيل الدخول الآمن" : "Secure workforce, payroll, and compliance access."}</p>
        </div>
      </div>
      {params.get("loggedOut") ? <p className="status">You have been logged out successfully.</p> : null}
      <div className="grid">
        <label className="field">
          <span>{language === "ar" ? "رقم الموظف" : "Employee ID / Employee Code"}</span>
          <input name="loginId" defaultValue="EMP-002" required />
        </label>
        <label className="field">
          <span>{language === "ar" ? "كلمة المرور" : "Password"}</span>
          <div className="input-with-button">
            <input name="password" type={showPassword ? "text" : "password"} defaultValue="Admin123!" required />
            <button className="icon-button" type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Show or hide password">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        <div className="login-options">
          <label className="check-row"><input name="rememberMe" type="checkbox" /> Remember Me</label>
          <a className="muted" href="/forgot-password">Forgot Password?</a>
        </div>
        <a className="button secondary" href="/first-time-login">First-Time Login / Create Password</a>
        <div className="actions">
          <button className="button" type="submit">
            <LogIn size={18} /> {language === "ar" ? "دخول" : "Login"}
          </button>
          <button className="button secondary" type="button" onClick={() => setLanguage(language === "en" ? "ar" : "en")}>
            <Languages size={18} /> {language === "en" ? "العربية" : "English"}
          </button>
        </div>
        {error ? <p className="status danger">{error}</p> : null}
      </div>
    </form>
  );
}
