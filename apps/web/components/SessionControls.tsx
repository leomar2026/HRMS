"use client";

import { LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const timeoutMs = 30 * 60 * 1000;
const warningMs = 25 * 60 * 1000;

export function SessionControls() {
  const router = useRouter();
  const [warning, setWarning] = useState(false);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/login?loggedOut=1");
  }

  function resetTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [
      setTimeout(() => setWarning(true), warningMs),
      setTimeout(() => logout(), timeoutMs)
    ];
  }

  useEffect(() => {
    resetTimers();
    const events = ["click", "keydown", "mousemove", "scroll"];
    events.forEach((event) => window.addEventListener(event, resetTimers, { passive: true }));
    return () => {
      timers.current.forEach(clearTimeout);
      events.forEach((event) => window.removeEventListener(event, resetTimers));
    };
  }, []);

  return (
    <div className="topbar-actions">
      <details className="row-actions">
        <summary><UserRound size={18} /><span>Profile</span></summary>
        <div className="row-menu">
          <button type="button" onClick={() => window.confirm("Are you sure you want to logout?") && logout()}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </details>
      {warning ? (
        <div className="session-warning">
          <p>Your session will expire soon due to inactivity.</p>
          <div className="actions">
            <button className="button" type="button" onClick={() => { setWarning(false); resetTimers(); }}>Stay Logged In</button>
            <button className="button secondary" type="button" onClick={logout}>Logout Now</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Topbar() {
  function setScale(scale: string) {
    document.documentElement.dataset.fontScale = scale;
    localStorage.setItem("hrms_font_scale", scale);
  }

  return (
    <div className="topbar">
      <span className="muted">Secure HRMS Session</span>
      <div className="actions">
        <select aria-label="Font scale" defaultValue="compact" onChange={(event) => setScale(event.target.value)}>
          <option value="compact">Compact</option>
          <option value="standard">Standard</option>
          <option value="large">Large Accessibility</option>
        </select>
        <SessionControls />
      </div>
    </div>
  );
}
