"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function EmailTemplateForm({ code, subject, body }: { code: string; subject: string; body: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function save(formData: FormData) {
    const response = await fetch(`/api/backend/notification-admin/email-templates/${code}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: formData.get("subject"),
        body: formData.get("body"),
        active: true
      })
    });
    setMessage(response.ok ? "Template saved." : "Template save failed.");
    router.refresh();
  }

  async function sendTest(formData: FormData) {
    const recipient = formData.get("testRecipient");
    const response = await fetch(`/api/backend/notification-admin/email-templates/${code}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient })
    });
    setMessage(response.ok ? "Test email queued." : "Test email failed.");
    router.refresh();
  }

  return (
    <form action={save} className="grid">
      <input name="subject" defaultValue={subject} />
      <textarea name="body" defaultValue={body} rows={4} />
      <div className="actions">
        <input name="testRecipient" placeholder="test@example.com" />
        <button className="button" type="submit">Save</button>
        <button className="button secondary" formAction={sendTest}><Send size={16} /> Send Test</button>
        {message ? <span className="status">{message}</span> : null}
      </div>
    </form>
  );
}

export function ResendEmailButton({ id }: { id: string }) {
  const router = useRouter();
  async function resend() {
    await fetch(`/api/backend/notification-admin/email-logs/${id}/resend`, { method: "POST" });
    router.refresh();
  }
  return <button className="button secondary" type="button" onClick={resend}>Resend</button>;
}
