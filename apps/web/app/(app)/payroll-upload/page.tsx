import { RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { StatusButton, UploadForm } from "@/components/UploadActions";
import { apiFetch } from "@/lib/api";

type PayrollBatch = {
  id: string;
  month: number;
  year: number;
  company: string;
  branch?: string;
  payrollType: string;
  paymentDate: string;
  status: string;
  items: Array<{ id: string; employeeCode: string; employeeName: string; grossSalary: string; totalDeduction: string; netSalary: string }>;
};

export default async function PayrollUploadPage() {
  const batches = await apiFetch<PayrollBatch[]>("/payroll-uploads");

  return (
    <>
      <TableToolbar
        title="Payroll Upload"
        count={`${batches.length} batches`}
        searchPlaceholder="Search payroll batches"
        actions={[
          { label: "Payroll Groups", href: "/group-management?type=PAYROLL", icon: "columns" },
          { label: "Payroll", href: "/payroll", icon: "refresh" }
        ]}
      />
      <UploadForm kind="payroll" />
      <div style={{ height: 16 }} />
      <section className="grid">
        {batches.map((batch) => (
          <article className="panel" key={batch.id}>
            <div className="page-head">
              <div>
                <h2>{batch.company} · {batch.month}/{batch.year}</h2>
                <p className="muted">{batch.branch ?? "All branches"} · {batch.payrollType} · Payment {new Date(batch.paymentDate).toLocaleDateString()}</p>
                <span className={batch.status === "DRAFT" ? "status warn" : "status"}>{batch.status}</span>
              </div>
              <div className="actions">
                <StatusButton endpoint="payroll-uploads" id={batch.id} status="SUBMITTED" label="Submit" />
                <StatusButton endpoint="payroll-uploads" id={batch.id} status="FINAL_APPROVED" label="Final approve" />
                <StatusButton endpoint="payroll-uploads" id={batch.id} status="PUBLISHED" label="Publish" />
                <RowActionMenu actions={[
                  { label: "Export payroll file", href: `/api/backend/payroll-uploads/${batch.id}/export.csv` },
                  { label: "Print payroll register", href: `/api/backend/payroll-uploads/${batch.id}/print` }
                ]} />
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th><input aria-label="Select all payroll items" type="checkbox" /></th><th className="freeze-col">Employee</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Actions</th></tr></thead>
                <tbody>{batch.items.map((item) => <tr key={item.id}><td><input aria-label={`Select ${item.employeeCode}`} type="checkbox" /></td><td className="freeze-col">{item.employeeCode} - {item.employeeName}</td><td>{item.grossSalary}</td><td>{item.totalDeduction}</td><td>{item.netSalary}</td><td><RowActionMenu actions={[{ label: "Download payslip PDF", href: `/api/backend/payroll-uploads/items/${item.id}/payslip.pdf` }]} /></td></tr>)}</tbody>
              </table>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
