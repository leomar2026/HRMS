import { apiFetch } from "@/lib/api";

type Announcement = { id: string; title: string; body: string; publishedAt: string };

export default async function AnnouncementsPage() {
  const announcements = await apiFetch<Announcement[]>("/announcements");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Company Announcements</h1>
          <p className="muted">Publish and review employee portal announcements.</p>
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
