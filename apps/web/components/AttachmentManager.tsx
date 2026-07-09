"use client";

import { Download, Eye, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Attachment = {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy?: string;
  createdAt: string;
  relatedModule: string;
  relatedRecordNumber?: string;
  status: string;
  message?: string;
};

const allowedTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png"
]);
const maxBytes = 10 * 1024 * 1024;

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentManager({
  relatedModule,
  relatedRecordId,
  relatedRecordNumber,
  attachmentType,
  fieldName = "attachmentName",
  required = false,
  compact = false
}: {
  relatedModule: string;
  relatedRecordId?: string;
  relatedRecordNumber?: string;
  attachmentType?: string;
  fieldName?: string;
  required?: boolean;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  async function loadAttachments() {
    const query = new URLSearchParams({ relatedModule });
    if (relatedRecordId) query.set("relatedRecordId", relatedRecordId);
    const response = await fetch(`/api/backend/attachments?${query.toString()}`);
    if (response.ok) setAttachments(await response.json());
  }

  useEffect(() => {
    void loadAttachments();
  }, [relatedModule, relatedRecordId]);

  function validate(file?: File | null) {
    if (!file) return "Please select a file.";
    if (!allowedTypes.has(file.type)) return "File type is not allowed.";
    if (file.size > maxBytes) return "File exceeds maximum allowed size.";
    return "";
  }

  function choose(file?: File | null) {
    const error = validate(file);
    if (error) {
      setMessage(error);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file ?? null);
    setMessage(file ? file.name : "");
  }

  async function upload() {
    const error = validate(selectedFile);
    if (error || !selectedFile) {
      setMessage(error || "Please select a file.");
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("relatedModule", relatedModule);
    if (relatedRecordId) formData.append("relatedRecordId", relatedRecordId);
    if (relatedRecordNumber) formData.append("relatedRecordNumber", relatedRecordNumber);
    if (attachmentType) formData.append("attachmentType", attachmentType);
    const response = await fetch("/api/backend/attachments", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    setUploading(false);
    if (!response.ok) {
      setMessage(data.message ?? "Upload failed. Please try again.");
      return;
    }
    setMessage(data.message ?? "File uploaded successfully.");
    setAttachments((current) => [data, ...current]);
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(id: string) {
    const response = await fetch(`/api/backend/attachments/${id}`, { method: "DELETE" });
    if (response.ok) {
      setAttachments((current) => current.filter((attachment) => attachment.id !== id));
      setMessage("Attachment deleted.");
    }
  }

  const activeAttachment = attachments[0];

  return (
    <div className={compact ? "attachment-manager compact" : "attachment-manager"}>
      <input name={fieldName} type="hidden" value={activeAttachment?.originalFileName ?? selectedFile?.name ?? ""} />
      {required ? <input aria-hidden name={`${fieldName}Uploaded`} required style={{ height: 1, opacity: 0, position: "absolute", width: 1 }} value={activeAttachment?.id ?? ""} onChange={() => undefined} /> : null}
      <input ref={inputRef} hidden type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={(event) => choose(event.target.files?.[0])} />
      <div
        className="drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          choose(event.dataTransfer.files?.[0]);
        }}
      >
        <button className="button secondary" type="button" onClick={() => inputRef.current?.click()}>Browse File</button>
        <span className="muted">{selectedFile ? selectedFile.name : activeAttachment ? activeAttachment.originalFileName : "Drag and drop file here"}</span>
        <button className="button" disabled={uploading} type="button" onClick={upload}><Upload size={15} /> {uploading ? "Uploading..." : "Upload"}</button>
      </div>
      {message ? <span className={message.includes("success") || message.includes("uploaded") ? "status" : "status warn"}>{message}</span> : null}
      {attachments.length ? (
        <div className="table-wrap attachment-table">
          <table>
            <thead><tr><th>File Name</th><th>File Type</th><th>File Size</th><th>Uploaded By</th><th>Uploaded Date</th><th>Related Module</th><th>Related Record Number</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {attachments.map((attachment) => (
                <tr key={attachment.id}>
                  <td>{attachment.originalFileName}</td>
                  <td>{attachment.mimeType}</td>
                  <td>{fileSize(attachment.sizeBytes)}</td>
                  <td>{attachment.uploadedBy ?? "-"}</td>
                  <td>{new Date(attachment.createdAt).toLocaleString()}</td>
                  <td>{attachment.relatedModule}</td>
                  <td>{attachment.relatedRecordNumber ?? relatedRecordNumber ?? "-"}</td>
                  <td><span className="status">{attachment.status}</span></td>
                  <td className="actions">
                    <a className="button secondary" href={`/api/backend/attachments/${attachment.id}/preview`} target="_blank"><Eye size={15} /> Preview</a>
                    <a className="button secondary" href={`/api/backend/attachments/${attachment.id}/download`}><Download size={15} /> Download</a>
                    <button className="button secondary" type="button" onClick={() => inputRef.current?.click()}>Replace</button>
                    <button className="button secondary" type="button" onClick={() => remove(attachment.id)}><Trash2 size={15} /> Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
