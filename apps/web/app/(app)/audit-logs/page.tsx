import { apiFetch } from "@/lib/api";

type AuditLog = {
  id: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  createdAt: string;
};

export default async function AuditLogsPage() {
  const logs = await apiFetch<AuditLog[]>("/audit-logs");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="muted">Security and operational event trail.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Entity ID</th></tr></thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.userId ?? "-"}</td>
                <td>{log.action}</td>
                <td>{log.entity}</td>
                <td>{log.entityId ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
