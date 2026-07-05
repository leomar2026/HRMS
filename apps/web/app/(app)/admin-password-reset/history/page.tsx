import { apiFetch } from "@/lib/api";

type History = {
  logins: Array<{ id: string; username: string; result: string; reason?: string; ipAddress?: string; device?: string; createdAt: string }>;
  resets: Array<{ id: string; action: string; metadata?: unknown; createdAt: string }>;
};

export default async function AdminPasswordHistoryPage({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  const params = await searchParams;
  const history = params.userId ? await apiFetch<History>(`/auth/admin/portal-accounts/${params.userId}/history`) : { logins: [], resets: [] };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Password Reset & Login History</h1>
          <p className="muted">Admin-only audit view for portal access events.</p>
        </div>
        <a className="button secondary" href="/admin-password-reset">Back</a>
      </div>
      <section className="grid cols-3">
        <div className="panel">
          <h2>Login History</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Login ID</th><th>Result</th><th>Reason</th><th>Device</th></tr></thead>
              <tbody>{history.logins.map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.username}</td><td>{item.result}</td><td>{item.reason ?? "-"}</td><td>{item.device ?? "-"}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <h2>Password Reset History</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Action</th></tr></thead>
              <tbody>{history.resets.map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.action}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
