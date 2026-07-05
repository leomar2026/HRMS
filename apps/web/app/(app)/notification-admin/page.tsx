import { EmailTemplateForm, ResendEmailButton } from "@/components/NotificationAdminActions";
import { apiFetch } from "@/lib/api";

type EmailTemplate = {
  id: string;
  code: string;
  subject: string;
  body: string;
  active: boolean;
};

type EmailLog = {
  id: string;
  recipient: string;
  subject: string;
  templateCode: string;
  leaveRequestNumber?: string;
  status: string;
  sentAt?: string;
  failureReason?: string;
  retryCount: number;
  createdAt: string;
};

export default async function NotificationAdminPage() {
  const [templates, logs] = await Promise.all([
    apiFetch<EmailTemplate[]>("/notification-admin/email-templates"),
    apiFetch<EmailLog[]>("/notification-admin/email-logs")
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Leave Notifications</h1>
          <p className="muted">Email templates, queued logs, failed notification retry, and leave workflow notification audit.</p>
        </div>
      </div>

      <section className="panel grid">
        <h2>Email Templates</h2>
        {templates.map((template) => (
          <article className="panel" key={template.id}>
            <h3>{template.code}</h3>
            <EmailTemplateForm code={template.code} subject={template.subject} body={template.body} />
          </article>
        ))}
      </section>

      <section className="panel">
        <h2>Email Logs</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Recipient</th><th>Subject</th><th>Template</th><th>Leave Request</th><th>Status</th><th>Sent</th><th>Failure</th><th>Retries</th><th>Action</th></tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.recipient}</td>
                  <td>{log.subject}</td>
                  <td>{log.templateCode}</td>
                  <td>{log.leaveRequestNumber ?? "-"}</td>
                  <td><span className={log.status === "FAILED" ? "status danger" : "status"}>{log.status}</span></td>
                  <td>{log.sentAt ? new Date(log.sentAt).toLocaleString() : "-"}</td>
                  <td>{log.failureReason ?? "-"}</td>
                  <td>{log.retryCount}</td>
                  <td>{log.status === "FAILED" ? <ResendEmailButton id={log.id} /> : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
