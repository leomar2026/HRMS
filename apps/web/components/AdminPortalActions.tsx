"use client";

import { KeyRound, LockOpen, Power, PowerOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminPasswordResetForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    const response = await fetch("/api/backend/auth/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        password: formData.get("password"),
        forceChange: formData.get("forceChange") === "on",
        reason: formData.get("reason")
      })
    });
    setMessage(response.ok ? "Password reset. Sessions ended." : "Reset failed.");
    router.refresh();
  }

  return (
    <form action={submit} className="grid compact-form">
      <input name="password" type="password" placeholder="Temporary password" required />
      <input name="reason" placeholder="Reset reason" />
      <label className="check-row"><input name="forceChange" type="checkbox" defaultChecked /> Force change next login</label>
      <button className="button" type="submit"><KeyRound size={16} /> Reset Password</button>
      {message ? <span className="status">{message}</span> : null}
    </form>
  );
}

export function PortalStatusButtons({ userId }: { userId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function setStatus(portalStatus: string) {
    const response = await fetch("/api/backend/auth/admin/portal-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, portalStatus })
    });
    setMessage(response.ok ? `Status: ${portalStatus}` : "Status update failed.");
    router.refresh();
  }

  async function unlock() {
    const response = await fetch("/api/backend/auth/admin/unlock-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId })
    });
    setMessage(response.ok ? "Account unlocked." : "Unlock failed.");
    router.refresh();
  }

  return (
    <div className="actions">
      <button className="button secondary" type="button" onClick={unlock}><LockOpen size={16} /> Unlock</button>
      <button className="button secondary" type="button" onClick={() => setStatus("ACTIVE")}><Power size={16} /> Enable</button>
      <button className="button secondary" type="button" onClick={() => setStatus("DISABLED")}><PowerOff size={16} /> Disable</button>
      <button className="button warn" type="button" onClick={() => setStatus("PASSWORD_RESET_REQUIRED")}>Require Reset</button>
      {message ? <span className="status">{message}</span> : null}
    </div>
  );
}
