import { apiFetch } from "@/lib/api";

type Notification = {
  id: string;
  title: string;
  message: string;
  category: string;
  readAt?: string | null;
  createdAt: string;
};

export default async function NotificationsPage() {
  const notifications = await apiFetch<Notification[]>("/employee/me/notifications");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="muted">Leave, payslip, balance, and approval updates.</p>
        </div>
      </div>
      <section className="grid">
        {notifications.map((notification) => (
          <article className="panel" key={notification.id}>
            <div className="page-head">
              <div>
                <h2>{notification.title}</h2>
                <p className="muted">{notification.category} · {new Date(notification.createdAt).toLocaleString()}</p>
              </div>
              <span className={notification.readAt ? "status" : "status warn"}>{notification.readAt ? "READ" : "NEW"}</span>
            </div>
            <p>{notification.message}</p>
          </article>
        ))}
      </section>
    </>
  );
}
