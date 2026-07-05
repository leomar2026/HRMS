"use client";

import { Check, Send, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type UploadKind = "payroll" | "leave";

const endpoints = {
  payroll: "/api/backend/payroll-uploads",
  leave: "/api/backend/leave-balance-uploads"
};

export function UploadForm({ kind }: { kind: UploadKind }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Array<{ row: number; column: string; message: string }>>([]);

  async function submit(formData: FormData) {
    const payload = kind === "payroll"
      ? {
          month: formData.get("month"),
          year: formData.get("year"),
          company: formData.get("company"),
          branch: formData.get("branch"),
          payrollType: formData.get("payrollType"),
          paymentDate: formData.get("paymentDate"),
          content: formData.get("content")
        }
      : {
          company: formData.get("company"),
          branch: formData.get("branch"),
          leaveYear: formData.get("leaveYear"),
          leaveType: formData.get("leaveType"),
          content: formData.get("content")
        };

    const validation = await fetch(`${endpoints[kind]}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const validationData = await validation.json();
    if (!validationData.valid) {
      setErrors(validationData.errors ?? []);
      setMessage("Validation failed. Fix the listed rows and upload again.");
      return;
    }

    const response = await fetch(endpoints[kind], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setErrors([]);
    setMessage(response.ok ? "Saved as draft." : "Upload failed.");
    router.refresh();
  }

  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field"><span>Company</span><input name="company" defaultValue="Demo Company" required /></label>
        <label className="field"><span>Branch</span><input name="branch" defaultValue="Riyadh" /></label>
        {kind === "payroll" ? (
          <>
            <label className="field"><span>Month</span><input name="month" type="number" min="1" max="12" defaultValue="6" required /></label>
            <label className="field"><span>Year</span><input name="year" type="number" defaultValue="2026" required /></label>
            <label className="field"><span>Payroll type</span><input name="payrollType" defaultValue="MONTHLY" required /></label>
            <label className="field"><span>Payment date</span><input name="paymentDate" type="date" defaultValue="2026-06-30" required /></label>
          </>
        ) : (
          <>
            <label className="field"><span>Leave year</span><input name="leaveYear" type="number" defaultValue="2026" required /></label>
            <label className="field"><span>Leave type</span><select name="leaveType" defaultValue="ANNUAL"><option>ANNUAL</option><option>SICK</option><option>EMERGENCY</option><option>UNPAID</option><option>COMPENSATORY</option><option>CUSTOM</option></select></label>
          </>
        )}
      </div>
      <label className="field">
        <span>{kind === "payroll" ? "Payroll CSV content" : "Leave balance CSV content"}</span>
        <textarea name="content" required />
      </label>
      <div className="actions">
        <button className="button" type="submit"><Upload size={18} /> Validate and save draft</button>
        <a className="button secondary" href={`${endpoints[kind]}/template.csv`}>Download template</a>
        {message ? <span className={errors.length ? "status danger" : "status"}>{message}</span> : null}
      </div>
      {errors.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Row</th><th>Column</th><th>Error</th></tr></thead>
            <tbody>{errors.map((error, index) => <tr key={index}><td>{error.row}</td><td>{error.column}</td><td>{error.message}</td></tr>)}</tbody>
          </table>
        </div>
      ) : null}
    </form>
  );
}

export function StatusButton({ endpoint, id, status, label }: { endpoint: string; id: string; status: string; label: string }) {
  const router = useRouter();
  async function update() {
    await fetch(`/api/backend/${endpoint}/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, comments: `${label} from HRMS` })
    });
    router.refresh();
  }
  return <button className="button secondary" type="button" onClick={update}>{status === "PUBLISHED" ? <Send size={16} /> : <Check size={16} />} {label}</button>;
}
