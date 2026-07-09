"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PhotoSource = {
  firstName?: string;
  lastName?: string;
  employeeCode?: string;
  photoUrl?: string | null;
  profilePhotoPath?: string | null;
  profilePhotoStatus?: string | null;
};

export function ProfileAvatar({ employee, size = 44 }: { employee: PhotoSource; size?: number }) {
  const src = employee.profilePhotoPath || employee.photoUrl;
  const initials = `${employee.firstName?.[0] ?? ""}${employee.lastName?.[0] ?? ""}`.trim() || "HR";
  return (
    <span className="profile-avatar" style={{ width: size, height: size }}>
      {src ? <img src={src} alt={`${employee.employeeCode ?? "Employee"} profile photo`} /> : <span>{initials}</span>}
    </span>
  );
}

export function ProfilePhotoUploader({ employee, endpoint, allowDelete = true }: { employee: PhotoSource; endpoint: string; allowDelete?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setMessage("");
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("File type is not allowed.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage("File exceeds maximum allowed size.");
      return;
    }
    setBusy(true);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, mimeType: file.type, size: file.size, dataUrl })
    });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.message ?? "Upload failed. Please try again.");
      return;
    }
    setMessage("File uploaded successfully.");
    router.refresh();
  }

  async function removePhoto() {
    setBusy(true);
    const response = await fetch(endpoint, { method: "DELETE" });
    setBusy(false);
    setMessage(response.ok ? "Profile picture deleted." : "Upload failed. Please try again.");
    if (response.ok) router.refresh();
  }

  return (
    <div className="profile-photo-manager">
      <ProfileAvatar employee={employee} size={76} />
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <div className="profile-photo-actions">
        <button className="button secondary small" type="button" disabled={busy} onClick={() => inputRef.current?.click()}><Camera size={14} /> Browse</button>
        {allowDelete ? <button className="button secondary small" type="button" disabled={busy} onClick={removePhoto}><Trash2 size={14} /> Delete</button> : null}
        <span className="muted">{employee.profilePhotoStatus ?? "ACTIVE"}</span>
      </div>
      {message ? <p className={message.includes("success") || message.includes("deleted") ? "status" : "status danger"}>{message}</p> : null}
    </div>
  );
}
