import { apiFetch } from "@/lib/api";
import { TableToolbar } from "@/components/DataTableControls";

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
      <TableToolbar
        title="Audit Logs"
        count={`${logs.length} records`}
        actions={[
          { label: "Export CSV", href: "/api/backend/audit-logs/export.csv", icon: "export" },
          { label: "Export Excel", href: "/api/backend/audit-logs/export.xlsx", icon: "export" },
          { label: "Print", icon: "print" }
        ]}
        searchPlaceholder="Search audit logs..."
      />
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
