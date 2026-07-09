import { ApprovePayroll, PayrollGenerate } from "@/components/ModuleActions";
import { apiFetch } from "@/lib/api";

type PayrollRun = {
  id: string;
  month: number;
  year: number;
  status: string;
  items: Array<{
    id: string;
    netSalary: string;
    employee: { employeeCode: string; firstName: string; lastName: string };
  }>;
};

export default async function PayrollPage() {
  const runs = await apiFetch<PayrollRun[]>("/payroll");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Payroll</h1>
          <p className="muted">Salary components, deductions, approvals, payslips, and Mudad/WPS export files.</p>
        </div>
      </div>
      <PayrollGenerate />
      <div style={{ height: 16 }} />
      <div className="grid">
        {runs.map((run) => (
          <section className="panel" key={run.id}>
            <div className="page-head">
              <div>
                <h2>{run.month}/{run.year}</h2>
                <span className={run.status === "DRAFT" ? "status warn" : "status"}>{run.status}</span>
              </div>
              <div className="actions">
                {run.status === "DRAFT" ? <ApprovePayroll id={run.id} /> : null}
                <a className="button secondary" href={`/api/backend/payroll/${run.id}/mudad-wps.csv`}>Export Mudad/WPS</a>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Employee</th><th>Net salary</th><th>Payslip</th></tr></thead>
                <tbody>
                  {run.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.employee.employeeCode} - {item.employee.firstName} {item.employee.lastName}</td>
                      <td>{item.netSalary}</td>
                      <td><a className="button secondary" href={`/api/backend/payroll/items/${item.id}/payslip.pdf`}>PDF</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
