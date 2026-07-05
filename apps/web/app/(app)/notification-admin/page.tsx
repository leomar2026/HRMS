import { EmailTemplateForm, LeaveWorkflowForm, ResendEmailButton } from "@/components/NotificationAdminActions";
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

type LeaveWorkflowStep = {
  stage: string;
  label: string;
  active: boolean;
};

type LeaveWorkflowDepartment = {
  department: { id: string; name: string; code: string };
  workflow: {
    id: string | null;
    steps: LeaveWorkflowStep[];
  };
};

type LeaveWorkflowResponse = {
  defaultSteps: LeaveWorkflowStep[];
  departments: LeaveWorkflowDepartment[];
};

export default async function NotificationAdminPage() {
  const [templates, logs, leaveWorkflows] = await Promise.all([
    apiFetch<EmailTemplate[]>("/notification-admin/email-templates"),
    apiFetch<EmailLog[]>("/notification-admin/email-logs"),
    apiFetch<LeaveWorkflowResponse>("/notification-admin/leave-workflows")
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Leave Approval Setup</h1>
          <p className="muted">Department-wise approval routes for employee leave requests.</p>
        </div>
      </div>

      <section className="workflow-section">
        <div className="workflow-toolbar">
          <div>
            <h2>Department Leave Approval Process</h2>
            <p className="muted">Set the approval route for each department. Requests follow the employee department workflow.</p>
          </div>
          <span className="status">{leaveWorkflows.departments.length} Departments</span>
        </div>

        <div className="workflow-card-grid">
          {leaveWorkflows.departments.map((item) => {
            const steps = item.workflow.steps?.length ? item.workflow.steps : leaveWorkflows.defaultSteps;
            const activeSteps = steps.filter((step) => step.active);
            const initials = item.department.code.slice(0, 2).toUpperCase();

            return (
              <article className="workflow-card" key={item.department.id}>
                <div className="workflow-card-head">
                  <div className="workflow-avatar">{initials}</div>
                  <div>
                    <h3>{item.department.name}</h3>
                    <p className="muted">{item.department.code} Department</p>
                  </div>
                </div>
                <div className="workflow-route">
                  <span className="workflow-route-label">Current route</span>
                  <strong>{activeSteps.map((step) => step.label).join(" -> ") || "Not configured"}</strong>
                </div>
                <LeaveWorkflowForm departmentId={item.department.id} steps={steps} />
              </article>
            );
          })}
        </div>
      </section>

      <details className="panel notification-advanced">
        <summary>Email Templates</summary>
        <div className="grid">
          {templates.map((template) => (
            <article className="sub-panel" key={template.id}>
              <h3>{template.code}</h3>
              <EmailTemplateForm code={template.code} subject={template.subject} body={template.body} />
            </article>
          ))}
        </div>
      </details>

      <details className="panel notification-advanced">
        <summary>Email Logs</summary>
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
      </details>
    </>
  );
}
