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
