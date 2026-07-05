import { apiFetch } from "@/lib/api";

type Approval = {
  id: string;
  module: string;
  status: string;
  comments?: string;
  actedBy?: string;
  createdAt: string;
  leaveRequest?: { requestNumber?: string; type?: string };
};

export default async function ApprovalHistoryPage() {
  const history = await apiFetch<Approval[]>("/employee/me/approval-history");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">My Approval History</h1>
          <p className="muted">Full timeline of submitted leave requests and approval comments.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Module</th><th>Reference</th><th>Type</th><th>Status</th><th>Comments</th><th>Acted By</th></tr></thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.createdAt).toLocaleString()}</td>
                <td>{item.module}</td>
                <td>{item.leaveRequest?.requestNumber ?? "-"}</td>
                <td>{item.leaveRequest?.type ?? "-"}</td>
                <td><span className="status">{item.status}</span></td>
                <td>{item.comments ?? "-"}</td>
                <td>{item.actedBy ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
