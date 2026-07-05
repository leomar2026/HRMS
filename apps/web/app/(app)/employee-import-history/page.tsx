import { apiFetch } from "@/lib/api";

type ImportBatch = { id: string; batchNumber: string; fileName?: string; mode: string; status: string; totalRows: number; createdCount: number; updatedCount: number; failedCount: number; duplicateCount: number; createdAt: string };

export default async function EmployeeImportHistoryPage() {
  const batches = await apiFetch<ImportBatch[]>("/employee-imports/history");
  return (
    <>
      <div className="page-head"><div><h1 className="page-title">Employee Import History</h1><p className="muted">Import batch summaries, row counts, failures, duplicates, and audit traceability.</p></div></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Batch</th><th>File</th><th>Mode</th><th>Status</th><th>Total</th><th>Created</th><th>Updated</th><th>Failed</th><th>Duplicates</th><th>Date</th></tr></thead>
          <tbody>{batches.map((batch) => <tr key={batch.id}><td>{batch.batchNumber}</td><td>{batch.fileName ?? "-"}</td><td>{batch.mode}</td><td><span className="status">{batch.status}</span></td><td>{batch.totalRows}</td><td>{batch.createdCount}</td><td>{batch.updatedCount}</td><td>{batch.failedCount}</td><td>{batch.duplicateCount}</td><td>{new Date(batch.createdAt).toLocaleString()}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
