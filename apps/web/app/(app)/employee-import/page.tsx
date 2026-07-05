import { EmployeeImportForm } from "@/components/EmployeeImportActions";

export default function EmployeeImportPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Employee Import</h1>
          <p className="muted">Validate, preview, draft, create, or update employee master records from CSV or Excel templates.</p>
        </div>
      </div>
      <EmployeeImportForm />
    </>
  );
}
