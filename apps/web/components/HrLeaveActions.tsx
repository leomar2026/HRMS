"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function HrLeaveDecisionForm({ leaveId }: { leaveId: string }) {
  const router = useRouter();
  const [comments, setComments] = useState("");
  const [message, setMessage] = useState("");

  async function decide(decision: "APPROVE" | "REJECT" | "RETURN_FOR_CORRECTION") {
    const response = await fetch(`/api/backend/leaves/${leaveId}/decision`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, comments: comments || undefined })
    });
    setMessage(response.ok ? "HR decision saved." : "Decision failed.");
    router.refresh();
  }

  return (
    <div className="grid">
      <input value={comments} onChange={(event) => setComments(event.target.value)} placeholder="HR approval comments" />
      <div className="actions">
        <button className="button" type="button" onClick={() => decide("APPROVE")}><Check size={16} /> Final approve</button>
        <button className="button warn" type="button" onClick={() => decide("RETURN_FOR_CORRECTION")}><RotateCcw size={16} /> Return</button>
        <button className="button secondary" type="button" onClick={() => decide("REJECT")}><X size={16} /> Reject</button>
        {message ? <span className="status">{message}</span> : null}
      </div>
    </div>
  );
}

type LeaveEdit = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  workflowStage?: string;
  comments?: string;
};

export function AdminLeaveEditForm({ leave }: { leave: LeaveEdit }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    const changeReason = String(formData.get("changeReason") ?? "").trim();
    if (!changeReason) {
      setMessage("Reason is required.");
      return;
    }
    const response = await fetch(`/api/backend/leaves/${leave.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: formData.get("type"),
        startDate: formData.get("startDate"),
        endDate: formData.get("endDate"),
        days: formData.get("days"),
        status: formData.get("status"),
        comments: formData.get("comments"),
        changeReason
      })
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Leave updated." : data.message ?? "Update failed.");
    router.refresh();
  }

  return (
    <form action={submit} className="inline-edit-form">
      <select name="type" defaultValue={leave.type}>
        <option value="ANNUAL">ANNUAL</option>
        <option value="SICK">SICK</option>
        <option value="EMERGENCY">EMERGENCY</option>
        <option value="UNPAID">UNPAID</option>
        <option value="CUSTOM">CUSTOM</option>
      </select>
      <input name="startDate" type="date" defaultValue={new Date(leave.startDate).toISOString().slice(0, 10)} />
      <input name="endDate" type="date" defaultValue={new Date(leave.endDate).toISOString().slice(0, 10)} />
      <input name="days" type="number" min="1" defaultValue={leave.days} />
      <select name="status" defaultValue={leave.status}>
        <option value="PENDING">PENDING</option>
        <option value="APPROVED">APPROVED</option>
        <option value="REJECTED">REJECTED</option>
        <option value="RETURNED_FOR_CORRECTION">RETURNED_FOR_CORRECTION</option>
        <option value="CANCELLED">CANCELLED</option>
      </select>
      <input name="comments" defaultValue={leave.comments ?? ""} placeholder="Comments" />
      <input name="changeReason" placeholder="Required reason" required />
      <button className="button secondary" type="submit">Edit</button>
      {message ? <span className={message.includes("failed") || message.includes("required") ? "status danger" : "status"}>{message}</span> : null}
    </form>
  );
}
