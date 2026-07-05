import { StatusButton, UploadForm } from "@/components/UploadActions";
import { apiFetch } from "@/lib/api";

type LeaveBatch = {
  id: string;
  company: string;
  branch?: string;
  leaveYear: number;
  leaveType: string;
  status: string;
  items: Array<{ id: string; employeeCode: string; employeeName: string; openingBalance: string; accruedLeave: string; usedLeave: string; pendingLeave: string; finalAvailableBalance: string }>;
};

export default async function LeaveBalanceUploadPage() {
  const batches = await apiFetch<LeaveBatch[]>("/leave-balance-uploads");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Vacation Balance Upload</h1>
          <p className="muted">Import existing leave balances, validate formulas, approve, and publish to employee leave profiles.</p>
        </div>
      </div>
      <UploadForm kind="leave" />
      <div style={{ height: 16 }} />
      <section className="grid">
        {batches.map((batch) => (
          <article className="panel" key={batch.id}>
            <div className="page-head">
              <div>
                <h2>{batch.company} · {batch.leaveType} {batch.leaveYear}</h2>
                <p className="muted">{batch.branch ?? "All branches"}</p>
                <span className={batch.status === "DRAFT" ? "status warn" : "status"}>{batch.status}</span>
              </div>
              <div className="actions">
                <StatusButton endpoint="leave-balance-uploads" id={batch.id} status="SUBMITTED" label="Submit" />
                <StatusButton endpoint="leave-balance-uploads" id={batch.id} status="APPROVED" label="Approve" />
                <StatusButton endpoint="leave-balance-uploads" id={batch.id} status="PUBLISHED" label="Publish" />
                <a className="button secondary" href={`/api/backend/leave-balance-uploads/${batch.id}/export.csv`}>Export</a>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Employee</th><th>Opening</th><th>Accrued</th><th>Used</th><th>Pending</th><th>Available</th></tr></thead>
                <tbody>{batch.items.map((item) => <tr key={item.id}><td>{item.employeeCode} - {item.employeeName}</td><td>{item.openingBalance}</td><td>{item.accruedLeave}</td><td>{item.usedLeave}</td><td>{item.pendingLeave}</td><td>{item.finalAvailableBalance}</td></tr>)}</tbody>
              </table>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
