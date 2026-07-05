import { apiFetch } from "@/lib/api";
import { GovernmentSyncButton } from "@/components/AdminForms";

type GovernmentStatus = {
  notice: string;
  connectors: Array<{
    name: string;
    configured: boolean;
    apiUrlConfigured: boolean;
    clientIdConfigured: boolean;
    clientSecretConfigured: boolean;
  }>;
  logs?: Array<{ id: string; provider: string; action: string; status: string; message?: string; createdAt: string }>;
};

export default async function GovernmentSyncPage() {
  const status = await apiFetch<GovernmentStatus>("/government/status");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Government Sync</h1>
          <p className="muted">Secure connector readiness for GOSI, Mudad, and Qiwa.</p>
        </div>
      </div>
      <div className="notice">Official integration with GOSI, Mudad, and Qiwa requires approved API access, company authorization, and official credentials.</div>
      <section className="grid cols-3">
        {status.connectors.map((connector) => (
          <article className="panel" key={connector.name}>
            <h2>{connector.name}</h2>
            <p><span className={connector.configured ? "status" : "status warn"}>{connector.configured ? "CONFIGURED" : "NOT CONFIGURED"}</span></p>
            <p className="muted">API URL: {connector.apiUrlConfigured ? "set" : "missing"}</p>
            <p className="muted">Client ID: {connector.clientIdConfigured ? "set" : "missing"}</p>
            <p className="muted">Client secret: {connector.clientSecretConfigured ? "set" : "missing"}</p>
            <GovernmentSyncButton provider={connector.name.toUpperCase()} />
          </article>
        ))}
      </section>
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Provider</th><th>Action</th><th>Status</th><th>Message</th><th>Time</th></tr></thead>
          <tbody>
            {(status.logs ?? []).map((log) => (
              <tr key={log.id}>
                <td>{log.provider}</td>
                <td>{log.action}</td>
                <td><span className="status">{log.status}</span></td>
                <td>{log.message ?? "-"}</td>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
