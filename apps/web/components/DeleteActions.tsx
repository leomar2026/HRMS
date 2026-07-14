"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ArchiveRecordButton({ endpoint, label, confirmLabel }: { endpoint: string; label: string; confirmLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function archive() {
    if (!confirm(confirmLabel)) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(endpoint, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(data.message ?? "Delete failed.");
      return;
    }
    setMessage("Deleted.");
    router.refresh();
  }

  return (
    <span className="row-inline-action">
      <button className="danger-action" type="button" disabled={busy} onClick={archive}>
        <Trash2 size={14} /> {busy ? "Deleting..." : label}
      </button>
      {message ? <span className={message.includes("failed") ? "status danger" : "status"}>{message}</span> : null}
    </span>
  );
}
