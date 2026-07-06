"use client";

import { useState } from "react";
import { RefreshCw, Save, Upload, Wifi } from "lucide-react";

type Device = { id: string; deviceName: string };
type Employee = { id: string; employeeCode: string; firstName: string; lastName: string };

async function send(path: string, method: string, body?: unknown) {
  const response = await fetch(`/api/backend${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? data.error ?? "Request failed");
  return data;
}

export function BiometricDeviceForm() {
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    setMessage("Saving...");
    try {
      await send("/biometrics/devices", "POST", Object.fromEntries(formData.entries()));
      setMessage("Device saved.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save device.");
    }
  }

  return (
    <form action={submit} className="panel form-grid">
      <input name="deviceName" placeholder="Device Name" required />
      <input name="deviceCode" placeholder="Device Code" required />
      <input name="model" placeholder="Model" />
      <input name="serialNumber" placeholder="Serial Number" />
      <input name="ipAddress" placeholder="IP Address" />
      <input name="port" placeholder="Port" type="number" />
      <select name="connectionType" required defaultValue="MANUAL_IMPORT">
        <option value="TCP_IP">TCP/IP</option>
        <option value="ADMS_PUSH">ADMS Push</option>
        <option value="BIOTIME_API">BioTime API</option>
        <option value="BIOTIME_DATABASE">BioTime Database</option>
        <option value="MANUAL_IMPORT">Manual Import</option>
      </select>
      <input name="deviceLocation" placeholder="Device Location" />
      <input name="branch" placeholder="Branch" />
      <input name="timezone" placeholder="Timezone" defaultValue="Asia/Riyadh" />
      <input name="syncIntervalMinutes" placeholder="Sync Interval" type="number" defaultValue={15} />
      <select name="status" defaultValue="ACTIVE"><option>ACTIVE</option><option>INACTIVE</option></select>
      <textarea name="remarks" placeholder="Remarks" />
      <div className="actions"><button className="button" type="submit"><Save size={16} /> Add Device</button>{message ? <span className={message.includes("Unable") || message.includes("failed") ? "status danger" : "status"}>{message}</span> : null}</div>
    </form>
  );
}

export function DeviceActionButtons({ deviceId }: { deviceId: string }) {
  const [message, setMessage] = useState("");
  async function run(action: "test-connection" | "sync") {
    setMessage("Working...");
    try {
      const result = await send(`/biometrics/devices/${deviceId}/${action}`, "POST");
      setMessage(result.message ?? result.status ?? "Done.");
      if (action === "test-connection") window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
    }
  }
  return (
    <div className="actions">
      <button className="button secondary" type="button" onClick={() => run("test-connection")}><Wifi size={16} /> Test</button>
      <button className="button secondary" type="button" onClick={() => run("sync")}><RefreshCw size={16} /> Sync</button>
      {message ? <span className={message.includes("failed") || message.includes("requires") ? "status danger" : "status"}>{message}</span> : null}
    </div>
  );
}

export function BiometricImportForm({ devices }: { devices: Device[] }) {
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    setMessage("Importing...");
    try {
      const file = formData.get("file");
      if (!(file instanceof File) || !file.size) throw new Error("Select a CSV file.");
      const content = await file.text();
      const result = await send("/biometrics/import", "POST", { deviceId: formData.get("deviceId"), content });
      setMessage(`Imported ${result.processedCount ?? 0}, unmatched ${result.unmatchedCount ?? 0}, duplicates ${result.duplicateCount ?? 0}.`);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import attendance logs.");
    }
  }
  return (
    <form action={submit} className="bulk-bar">
      <select name="deviceId" required>{devices.map((device) => <option key={device.id} value={device.id}>{device.deviceName}</option>)}</select>
      <input name="file" type="file" accept=".csv" required />
      <button className="button" type="submit"><Upload size={16} /> Import CSV</button>
      {message ? <span className={message.includes("Unable") || message.includes("Select") ? "status danger" : "status"}>{message}</span> : null}
    </form>
  );
}

export function BiometricMappingForm({ devices, employees }: { devices: Device[]; employees: Employee[] }) {
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    setMessage("Saving...");
    try {
      await send("/biometrics/mappings", "POST", Object.fromEntries(formData.entries()));
      setMessage("Mapping saved.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save mapping.");
    }
  }
  return (
    <form action={submit} className="panel form-grid">
      <select name="employeeId" required>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} - {employee.firstName} {employee.lastName}</option>)}</select>
      <select name="deviceId"><option value="">Any Device</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.deviceName}</option>)}</select>
      <input name="biometricId" placeholder="Biometric ID" />
      <input name="deviceUserId" placeholder="Device User ID" required />
      <input name="cardNumber" placeholder="Card Number" />
      <input name="remarks" placeholder="Remarks" />
      <div className="actions"><button className="button" type="submit"><Save size={16} /> Assign Device User ID</button>{message ? <span className={message.includes("Unable") ? "status danger" : "status"}>{message}</span> : null}</div>
    </form>
  );
}
