"use client";

import { Check, Upload, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AttendanceImport() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    const file = formData.get("file");
    let payload: { content?: string; fileName?: string; contentBase64?: string } = {
      content: String(formData.get("content") ?? "")
    };

    if (file instanceof File && file.size > 0) {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      payload = {
        fileName: file.name,
        contentBase64: btoa(binary),
        content: file.name.toLowerCase().endsWith(".csv") ? await file.text() : undefined
      };
    }

    const response = await fetch("/api/backend/attendance/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    setMessage(response.ok ? `Imported ${data.imported} rows.` : data.message ?? "Import failed.");
    router.refresh();
  }

  return (
    <form action={submit} className="form-panel grid">
      <label className="field">
        <span>Biometric CSV or Excel file</span>
        <input name="file" type="file" accept=".csv,.xlsx" />
      </label>
      <label className="field">
        <span>CSV content</span>
        <textarea name="content" placeholder="employeeCode,checkIn,checkOut" />
      </label>
      <div className="actions">
        <button className="button" type="submit">
          <Upload size={18} /> Import
        </button>
        {message ? <span className="status">{message}</span> : null}
      </div>
    </form>
  );
}

export function PayrollGenerate() {
  const router = useRouter();
  const now = new Date();

  async function submit(formData: FormData) {
    await fetch("/api/backend/payroll/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: formData.get("month"), year: formData.get("year") })
    });
    router.refresh();
  }

  return (
    <form action={submit} className="form-panel">
      <div className="form-grid">
        <label className="field">
          <span>Month</span>
          <input name="month" type="number" min="1" max="12" defaultValue={now.getMonth() + 1} required />
        </label>
        <label className="field">
          <span>Year</span>
          <input name="year" type="number" min="2020" defaultValue={now.getFullYear()} required />
        </label>
      </div>
      <div className="actions" style={{ marginTop: 12 }}>
        <button className="button" type="submit">
          <WalletCards size={18} /> Generate payroll
        </button>
      </div>
    </form>
  );
}

export function ApprovePayroll({ id }: { id: string }) {
  const router = useRouter();

  async function approve() {
    await fetch(`/api/backend/payroll/${id}/approve`, { method: "PATCH" });
    router.refresh();
  }

  return (
    <button className="button secondary" type="button" onClick={approve}>
      <Check size={16} /> Approve
    </button>
  );
}
