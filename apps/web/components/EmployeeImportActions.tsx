"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ValidationError = { row: number; employeeCode?: string; column: string; reason: string };

export function EmployeeImportForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);

  async function submit(formData: FormData) {
    const payload = {
      mode: formData.get("mode"),
      saveDraft: formData.get("saveDraft") === "on",
      fileName: "employee-import.csv",
      content: formData.get("content")
    };

    const validation = await fetch("/api/backend/employee-imports/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const validationData = await validation.json();
    setErrors(validationData.errors ?? []);
    setPreview(validationData.preview ?? []);

    if (!validationData.valid) {
      setMessage("Validation failed. Correct rows and re-upload.");
      return;
    }

    const response = await fetch("/api/backend/employee-imports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setMessage(response.ok ? "Import saved successfully." : "Import failed.");
    router.refresh();
  }

  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field">
          <span>Import mode</span>
          <select name="mode" defaultValue="CREATE_ONLY">
            <option value="CREATE_ONLY">Create New Employees Only</option>
            <option value="CREATE_AND_UPDATE">Create New and Update Existing Employees</option>
          </select>
        </label>
        <label className="status"><input name="saveDraft" type="checkbox" /> Save as draft</label>
      </div>
      <label className="field">
        <span>Employee CSV content</span>
        <textarea name="content" placeholder="Employee Code,Employee Name English,Department,Designation,Joining Date" required />
      </label>
      <div className="actions">
        <button className="button" type="submit"><Upload size={18} /> Validate and import</button>
        <a className="button secondary" href="/api/backend/employee-imports/template.csv">Download CSV template</a>
        <a className="button secondary" href="/api/backend/employee-imports/template.xlsx">Download Excel template</a>
        {message ? <span className={errors.length ? "status danger" : "status"}>{message}</span> : null}
      </div>
      {errors.length ? (
        <div className="table-wrap"><table><thead><tr><th>Row</th><th>Employee</th><th>Column</th><th>Reason</th></tr></thead><tbody>{errors.map((e, i) => <tr key={i}><td>{e.row}</td><td>{e.employeeCode ?? "-"}</td><td>{e.column}</td><td>{e.reason}</td></tr>)}</tbody></table></div>
      ) : null}
      {preview.length ? (
        <div className="table-wrap"><table><thead><tr><th>Employee Code</th><th>Name</th><th>Department</th><th>Designation</th></tr></thead><tbody>{preview.map((row, i) => <tr key={i}><td>{row["Employee Code"]}</td><td>{row["Employee Name English"]}</td><td>{row.Department}</td><td>{row.Designation}</td></tr>)}</tbody></table></div>
      ) : null}
    </form>
  );
}
