"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  employeeId: string;
  employeeCode: string;
  archived?: boolean;
};

async function readMessage(response: Response) {
  const data = await response.json().catch(() => ({}));
  return typeof data.message === "string" ? data.message : response.ok ? "Action completed." : "Action failed. Please try again.";
}

export function EmployeeLifecycleActions({ employeeId, employeeCode, archived = false }: Props) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState("");

  async function runAction(action: "archive" | "restore" | "deletePermanent") {
    const confirmText =
      action === "restore"
        ? `Restore employee ${employeeCode}?`
        : action === "deletePermanent"
          ? `Permanently delete employee ${employeeCode}? This is allowed only when no related records exist.`
          : `Archive employee ${employeeCode}?`;
    if (!confirm(confirmText)) return;

    setBusyAction(action);
    setMessage("");
    const response = await fetch(
      action === "restore"
        ? `/api/backend/employees/${employeeId}/restore`
        : `/api/backend/employees/${employeeId}${action === "deletePermanent" ? "?permanent=true" : ""}`,
      { method: action === "restore" ? "PATCH" : "DELETE" }
    );
    const resultMessage = await readMessage(response);
    setBusyAction("");
    setMessage(resultMessage);
    if (response.ok || response.status === 409) {
      router.refresh();
    }
  }

  return (
    <span className="employee-lifecycle-actions">
      {archived ? (
        <button className="button small" type="button" disabled={Boolean(busyAction)} onClick={() => runAction("restore")}>
          {busyAction === "restore" ? "Restoring..." : "Restore"}
        </button>
      ) : (
        <button className="button small secondary" type="button" disabled={Boolean(busyAction)} onClick={() => runAction("archive")}>
          {busyAction === "archive" ? "Archiving..." : "Archive"}
        </button>
      )}
      <button className="danger-action" type="button" disabled={Boolean(busyAction)} onClick={() => runAction("deletePermanent")}>
        {busyAction === "deletePermanent" ? "Deleting..." : "Delete Permanently"}
      </button>
      {message ? <span className={message.includes("failed") || message.includes("permission") ? "status danger" : "status"}>{message}</span> : null}
    </span>
  );
}
