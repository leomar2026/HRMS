"use client";

import { useEffect, useMemo, useState } from "react";
import { Fingerprint, LocateFixed, LogIn, LogOut, MapPin, ShieldCheck } from "lucide-react";

type MobileSite = {
  id: string;
  name: string;
  branch?: string | null;
  location?: string | null;
  timezone: string;
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number | null;
};

type MobileConfig = {
  timezone: string;
  sites: MobileSite[];
};

type PositionState = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
};

async function sendPunch(body: Record<string, unknown>) {
  const response = await fetch("/api/backend/biometrics/mobile-punch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "Unable to record mobile attendance.");
  return data as { message: string; employeeName: string; siteName: string; punchTime: string; distanceMeters: number; timezone: string };
}

function randomChallenge() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function MobileAttendancePunch({ config, employeeMode = false }: { config: MobileConfig; employeeMode?: boolean }) {
  const [employeeIdentifier, setEmployeeIdentifier] = useState("");
  const [punchType, setPunchType] = useState<"CHECK_IN" | "CHECK_OUT">("CHECK_IN");
  const [timezone, setTimezone] = useState(config.timezone || "Asia/Riyadh");
  const [position, setPosition] = useState<PositionState | null>(null);
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const localTime = useMemo(() => now ? new Intl.DateTimeFormat("en-SA", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "medium",
    hour12: false
  }).format(now) : "--", [now, timezone]);

  function getGps() {
    setMessage("Requesting GPS location...");
    if (!navigator.geolocation) {
      setMessage("GPS is not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracyMeters: Math.round(result.coords.accuracy)
        });
        setMessage("GPS location captured.");
      },
      (error) => setMessage(error.message || "GPS permission is required before time in/out."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function verifyBiometric() {
    setMessage("Checking this phone biometric capability...");
    try {
      if (!window.PublicKeyCredential) throw new Error("This browser does not support phone biometric verification.");
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) throw new Error("No phone biometric or screen lock verifier is available.");
      await navigator.credentials.create({
        publicKey: {
          challenge: randomChallenge(),
          rp: { name: "HRMS Mobile Attendance" },
          user: {
            id: randomChallenge(),
            name: employeeIdentifier || "employee",
            displayName: employeeIdentifier || "employee"
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
          timeout: 60000
        }
      });
      setBiometricVerified(true);
      setMessage("Phone biometric verified for this punch.");
    } catch (error) {
      setBiometricVerified(false);
      setMessage(error instanceof Error ? error.message : "Biometric verification was not completed.");
    }
  }

  async function submit() {
    if (!position) {
      setMessage("GPS is mandatory. Capture GPS before submitting.");
      return;
    }
    if (!employeeMode && !employeeIdentifier.trim()) {
      setMessage("Employee ID is required for admin mobile punch.");
      return;
    }
    setBusy(true);
    setMessage("Recording attendance...");
    try {
      const result = await sendPunch({
        ...(employeeIdentifier.trim() ? { employeeIdentifier: employeeIdentifier.trim() } : {}),
        punchType,
        verificationMethod: biometricVerified ? "MOBILE_BIOMETRIC" : "EMPLOYEE_ID",
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyMeters: position.accuracyMeters,
        timezone,
        clientTime: new Date().toISOString()
      });
      setMessage(`${result.message} ${result.employeeName} at ${result.siteName}. Distance: ${result.distanceMeters}m.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record attendance.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={employeeMode ? "grid" : "grid two"}>
      <section className="panel grid">
        <div>
          <p className="muted">KSA/site time</p>
          <h2>{localTime}</h2>
        </div>
        {!employeeMode ? (
          <>
            <label className="field">
              <span>Employee ID / Iqama / Biometric ID</span>
              <input value={employeeIdentifier} onChange={(event) => setEmployeeIdentifier(event.target.value)} inputMode="text" autoComplete="username" />
            </label>
            <label className="field">
              <span>Site timezone</span>
              <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                <option value="Asia/Riyadh">Asia/Riyadh - KSA</option>
                {Array.from(new Set(config.sites.map((site) => site.timezone).filter(Boolean))).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        <div className="actions">
          <button className={punchType === "CHECK_IN" ? "button" : "button secondary"} type="button" onClick={() => setPunchType("CHECK_IN")}><LogIn size={16} /> Time In</button>
          <button className={punchType === "CHECK_OUT" ? "button" : "button secondary"} type="button" onClick={() => setPunchType("CHECK_OUT")}><LogOut size={16} /> Time Out</button>
        </div>
        <div className="actions">
          <button className="button secondary" type="button" onClick={getGps}><LocateFixed size={16} /> Capture GPS</button>
          <button className="button secondary" type="button" onClick={verifyBiometric}><Fingerprint size={16} /> Phone Biometric</button>
        </div>
        <button className="button" type="button" disabled={busy} onClick={submit}>
          <ShieldCheck size={16} /> Submit {punchType === "CHECK_IN" ? "Time In" : "Time Out"}
        </button>
        {message ? <p className={message.includes("Unable") || message.includes("outside") || message.includes("mandatory") || message.includes("not") || message.includes("required") ? "status danger" : "status"}>{message}</p> : null}
        {employeeMode ? <p className="muted">GPS must be captured before submitting. Your employee profile is used automatically after login.</p> : null}
      </section>

      {!employeeMode ? <section className="panel">
        <h2>Mobile Attendance Sites</h2>
        <div className="grid">
          {config.sites.length ? config.sites.map((site) => (
            <div className="metric-card" key={site.id}>
              <div className="metric-icon"><MapPin size={18} /></div>
              <div>
                <strong>{site.name}</strong>
                <p className="muted">{site.branch ?? "Branch"} - {site.location ?? "Site"}</p>
                <p className="muted">{site.latitude ?? "-"}, {site.longitude ?? "-"} within {site.radiusMeters ?? 150}m</p>
              </div>
            </div>
          )) : <p className="muted">No mobile attendance site is enabled yet.</p>}
        </div>
        <div style={{ height: 12 }} />
        <p className="muted">
          GPS is required for every punch. Phone biometric verification is used when the mobile browser and device support a platform authenticator; otherwise the employee ID is recorded as the verification method.
        </p>
        {position ? <p className="status">GPS: {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)} accuracy {position.accuracyMeters}m</p> : null}
      </section> : null}
    </div>
  );
}
