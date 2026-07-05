"use client";

import { LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const timeoutMs = 30 * 60 * 1000;
const warningMs = 25 * 60 * 1000;

export function SessionControls() {
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
    <div className="profile-actions">
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

type TopbarUser = {
  email?: string;
  role?: string;
  employee?: { firstName?: string; lastName?: string };
};

export function Topbar({ user }: { user?: TopbarUser | null }) {
  const displayName = [user?.employee?.firstName, user?.employee?.lastName].filter(Boolean).join(" ") || user?.email || "User";
  return (
    <div className="topbar">
      <span className="system-title">HRMS - Human Resource Management</span>
      <div className="topbar-actions">
        <select className="language-select" aria-label="Language" defaultValue="English">
          <option>English</option>
          <option>Arabic</option>
        </select>
        <span className="topbar-user">{displayName}</span>
        <SessionControls />
      </div>
    </div>
  );
}
