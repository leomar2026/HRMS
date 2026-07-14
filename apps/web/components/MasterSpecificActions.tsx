"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Field = {
  name: string;
  label: string;
  required?: boolean;
  type?: "text" | "email" | "number" | "time" | "date" | "select" | "checkbox";
  options?: string[];
};

type MasterRecord = {
  id: string;
  type: string;
  code: string;
  name: string;
  nameArabic?: string;
  active: boolean;
  metadata?: Record<string, unknown>;
};

function valueFromForm(formData: FormData, field: Field) {
  if (field.type === "checkbox") return formData.get(field.name) === "on";
  const value = formData.get(field.name);
  return value === null || value === "" ? undefined : String(value);
}

function payloadFromForm(formData: FormData, masterType: string, fields: Field[]) {
  const metadata: Record<string, unknown> = {};
  fields.forEach((field) => {
    metadata[field.name] = valueFromForm(formData, field);
  });
  return {
    type: masterType,
    code: String(formData.get("code") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    nameArabic: String(formData.get("nameArabic") ?? "").trim() || undefined,
    active: formData.get("status") !== "INACTIVE",
    metadata
  };
}

function FieldControl({ field, record }: { field: Field; record?: MasterRecord }) {
  const defaultValue = String(record?.metadata?.[field.name] ?? (field.options?.length === 1 ? field.options[0] : ""));
  if (field.type === "checkbox") {
    return <label className="status"><input name={field.name} type="checkbox" defaultChecked={Boolean(record?.metadata?.[field.name])} /> {field.label}</label>;
  }
  if (field.type === "select") {
    return (
      <label className="field">
        <span>{field.label}</span>
        <select name={field.name} defaultValue={defaultValue} required={field.required}>
          <option value="">Select</option>
          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }
  return (
    <label className="field">
      <span>{field.label}</span>
      <input name={field.name} type={field.type ?? "text"} defaultValue={defaultValue} required={field.required} />
    </label>
  );
}

export function MasterSpecificForm({ masterType, fields }: { masterType: string; fields: Field[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    const response = await fetch("/api/backend/master-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFromForm(formData, masterType, fields))
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Saved successfully." : data.message ?? "Save failed.");
    router.refresh();
  }

  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field"><span>Code</span><input name="code" placeholder="Auto from number series" /></label>
        <label className="field"><span>Name English</span><input name="name" required /></label>
        <label className="field"><span>Name Arabic</span><input name="nameArabic" /></label>
        <label className="field"><span>Status</span><select name="status" defaultValue="ACTIVE"><option>ACTIVE</option><option>INACTIVE</option></select></label>
        {fields.map((field) => <FieldControl key={field.name} field={field} />)}
      </div>
      <div className="actions"><button className="button" type="submit"><Save size={16} /> Save</button>{message ? <span className={message.includes("failed") ? "status danger" : "status"}>{message}</span> : null}</div>
    </form>
  );
}

export function MasterSpecificEditForm({ record, fields }: { record: MasterRecord; fields: Field[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    const response = await fetch(`/api/backend/master-data/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFromForm(formData, record.type, fields))
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Updated." : data.message ?? "Update failed.");
    router.refresh();
  }

  async function archive() {
    if (!confirm(`Archive ${record.code}?`)) return;
    const response = await fetch(`/api/backend/master-data/${record.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Archived." : data.message ?? "Archive failed.");
    router.refresh();
  }

  return (
    <details className="row-actions">
      <summary>Edit</summary>
      <div className="row-menu master-edit-menu">
        <form action={submit} className="grid">
          <input name="code" defaultValue={record.code} aria-label="Code" required />
          <input name="name" defaultValue={record.name} aria-label="Name English" required />
          <input name="nameArabic" defaultValue={record.nameArabic ?? ""} aria-label="Name Arabic" />
          <select name="status" defaultValue={record.active ? "ACTIVE" : "INACTIVE"} aria-label="Status"><option>ACTIVE</option><option>INACTIVE</option></select>
          {fields.map((field) => <FieldControl key={field.name} field={field} record={record} />)}
          <button className="button" type="submit"><Save size={14} /> Save</button>
          <button className="button secondary" type="button" onClick={archive}>Archive</button>
          {message ? <span className={message.includes("failed") ? "status danger" : "status"}>{message}</span> : null}
        </form>
      </div>
    </details>
  );
}
