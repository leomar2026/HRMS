"use client";

import { RotateCcw, Save, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function SaveButtonGroup({ submitLabel = "Save", approvalLabel = "Submit for Approval" }: { submitLabel?: string; approvalLabel?: string }) {
  return (
    <div className="actions">
      <button className="button secondary" name="intent" value="draft" type="submit"><Save size={16} /> Save Draft</button>
      <button className="button" name="intent" value="save" type="submit"><Save size={16} /> {submitLabel}</button>
      <button className="button secondary" name="intent" value="continue" type="submit">Save and Continue</button>
      <button className="button secondary" name="intent" value="addAnother" type="submit">Save and Add Another</button>
      <button className="button warn" name="intent" value="submit" type="submit"><Send size={16} /> {approvalLabel}</button>
      <button className="button secondary" type="button" onClick={() => history.back()}><X size={16} /> Cancel</button>
      <button className="button secondary" type="reset" onClick={(event) => { if (!window.confirm("Reset entered values?")) event.preventDefault(); }}><RotateCcw size={16} /> Reset Form</button>
    </div>
  );
}

export function AutoSaveDraft({ module, draftKey, watchSelector = "form" }: { module: string; draftKey: string; watchSelector?: string }) {
  const [status, setStatus] = useState("");
  const lastPayload = useRef("");

  useEffect(() => {
    const interval = setInterval(async () => {
      const form = document.querySelector<HTMLFormElement>(watchSelector);
      if (!form) return;
      const data = Object.fromEntries(new FormData(form).entries());
      const payload = JSON.stringify(data);
      if (payload === lastPayload.current) return;
      lastPayload.current = payload;
      setStatus("Saving...");
      const response = await fetch("/api/backend/drafts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, draftKey, data })
      }).catch(() => undefined);
      setStatus(response?.ok ? `Draft Saved · Last saved at ${new Date().toLocaleTimeString()}` : "Save Failed");
    }, 60000);
    return () => clearInterval(interval);
  }, [module, draftKey, watchSelector]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      const form = document.querySelector<HTMLFormElement>(watchSelector);
      if (!form) return;
      const payload = JSON.stringify(Object.fromEntries(new FormData(form).entries()));
      if (payload !== lastPayload.current) {
        event.preventDefault();
        event.returnValue = "You have unsaved changes. Do you want to save before leaving?";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [watchSelector]);

  return status ? <span className={status === "Save Failed" ? "status danger" : "status"}>{status}</span> : null;
}
