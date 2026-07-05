import { apiFetch } from "@/lib/api";

type Announcement = { id: string; title: string; body: string; publishedAt: string };

export default async function EmployeeAnnouncementsPage() {
  const announcements = await apiFetch<Announcement[]>("/employee/me/announcements");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Announcements</h1>
          <p className="muted">Company updates and HR notices.</p>
        </div>
      </div>
      <section className="grid">
        {announcements.map((announcement) => (
          <article className="panel" key={announcement.id}>
            <h2>{announcement.title}</h2>
            <p className="muted">{new Date(announcement.publishedAt).toLocaleDateString()}</p>
            <p>{announcement.body}</p>
          </article>
        ))}
      </section>
    </>
  );
}
