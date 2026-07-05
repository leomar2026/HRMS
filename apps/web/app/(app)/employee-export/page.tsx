export default function EmployeeExportPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Employee Export</h1>
          <p className="muted">Export filtered employee master data with role-based masking for confidential fields.</p>
        </div>
        <div className="actions">
          <a className="button" href="/api/backend/employee-imports/exports/employees.csv">Export CSV</a>
          <a className="button secondary" href="/api/backend/employees/export.csv">Legacy Master CSV</a>
        </div>
      </div>
      <section className="grid cols-3">
        <div className="panel"><h2>Basic Employee Details</h2><p className="muted">Employee code, English/Arabic name, department, designation, branch, joining date, status, mobile, company email.</p></div>
        <div className="panel"><h2>Identification Details</h2><p className="muted">Nationality, gender, iqama, passport, visa, GOSI, QIWA with masking for unauthorized users.</p></div>
        <div className="panel"><h2>Payroll Details</h2><p className="muted">Salary, bank, IBAN, and payment method are restricted to payroll/finance/HR manager roles.</p></div>
      </section>
    </>
  );
}
