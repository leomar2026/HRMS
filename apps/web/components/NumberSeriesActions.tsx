"use client";

import { RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type NumberSeriesRow = {
  id: string;
  code: string;
  name: string;
  prefix: string;
  separator: string;
  padding: number;
  nextNumber: number;
  startNumber: number;
  resetFrequency: string;
  active: boolean;
  remarks?: string;
};

export function NumberSeriesEditForm({ row }: { row: NumberSeriesRow }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function save(formData: FormData) {
    setMessage("");
    const response = await fetch(`/api/backend/number-series/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        prefix: formData.get("prefix"),
        separator: formData.get("separator"),
        padding: Number(formData.get("padding")),
        nextNumber: Number(formData.get("nextNumber")),
        startNumber: Number(formData.get("startNumber")),
        resetFrequency: formData.get("resetFrequency"),
        active: formData.get("active") === "on",
        remarks: formData.get("remarks")
      })
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Saved." : data.message ?? "Unable to save number series.");
    if (response.ok) router.refresh();
  }

  return (
    <form action={save} className="inline-grid-form">
      <input name="name" defaultValue={row.name} aria-label={`${row.code} name`} />
      <input name="prefix" defaultValue={row.prefix} aria-label={`${row.code} prefix`} />
      <input name="separator" defaultValue={row.separator} aria-label={`${row.code} separator`} />
      <input name="padding" type="number" min="1" max="12" defaultValue={row.padding} aria-label={`${row.code} padding`} />
      <input name="nextNumber" type="number" min="1" defaultValue={row.nextNumber} aria-label={`${row.code} next number`} />
      <input name="startNumber" type="number" min="1" defaultValue={row.startNumber} aria-label={`${row.code} start number`} />
      <select name="resetFrequency" defaultValue={row.resetFrequency} aria-label={`${row.code} reset frequency`}>
        <option value="NEVER">Never</option>
        <option value="YEARLY">Yearly</option>
        <option value="MONTHLY">Monthly</option>
        <option value="DAILY">Daily</option>
      </select>
      <label className="check-row compact"><input name="active" type="checkbox" defaultChecked={row.active} /> Active</label>
      <input name="remarks" defaultValue={row.remarks ?? ""} placeholder="Remarks" aria-label={`${row.code} remarks`} />
      <button className="button compact-save" type="submit"><Save size={14} /> Save</button>
      {message ? <span className={message === "Saved." ? "status" : "status danger"}>{message}</span> : null}
    </form>
  );
}

export function InitializeNumberSeriesButton() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function initialize() {
    setMessage("");
    const response = await fetch("/api/backend/number-series/initialize-defaults", { method: "POST" });
    setMessage(response.ok ? "Defaults initialized." : "Unable to initialize defaults.");
    if (response.ok) router.refresh();
  }

  return <button className="button secondary" type="button" onClick={initialize}><RotateCcw size={15} /> Initialize Defaults {message ? `- ${message}` : ""}</button>;
}
