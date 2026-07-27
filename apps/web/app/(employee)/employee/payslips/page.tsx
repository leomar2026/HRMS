import { apiFetch } from "@/lib/api";

type Payslip = {
  id: string;
  basicSalary: string;
  housingAllowance: string;
  transportAllowance: string;
  netSalary: string;
  paymentDate?: string;
  remarks?: string;
  documentReference?: string;
  source?: string;
  payrollRun: { month: number; year: number; status: string };
};

export default async function EmployeePayslipsPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const params = await searchParams;
  const payslips = await apiFetch<Payslip[]>("/employee/me/payslips");
  const filtered = payslips.filter((payslip) => {
    const monthOk = params.month ? payslip.payrollRun.month === Number(params.month) : true;
    const yearOk = params.year ? payslip.payrollRun.year === Number(params.year) : true;
    return monthOk && yearOk;
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">My Payslips</h1>
          <p className="muted">Approved and published payslips only. Draft and rejected payroll is hidden.</p>
        </div>
        <form className="actions">
          <input name="month" placeholder="Month" defaultValue={params.month ?? ""} />
          <input name="year" placeholder="Year" defaultValue={params.year ?? ""} />
          <button className="button" type="submit">Filter</button>
        </form>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Period</th><th>Status</th><th>Payment date</th><th>Basic</th><th>Housing</th><th>Transport</th><th>Net salary</th><th>Reference</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((payslip) => (
              <tr key={payslip.id}>
                <td>{payslip.payrollRun.month}/{payslip.payrollRun.year}</td>
                <td><span className="status">{payslip.payrollRun.status}</span></td>
                <td>{payslip.paymentDate ? new Date(payslip.paymentDate).toLocaleDateString() : "-"}</td>
                <td>{payslip.basicSalary}</td>
                <td>{payslip.housingAllowance}</td>
                <td>{payslip.transportAllowance}</td>
                <td>{payslip.netSalary}</td>
                <td>{payslip.documentReference ?? payslip.source ?? "-"}</td>
                <td>
                  <a className="button secondary small nowrap" href={`/api/backend/employee/me/payslips/${payslip.id}/download`}>Download PDF</a>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? <tr><td colSpan={9}>No approved payslip available.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
