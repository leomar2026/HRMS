import { RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type RawLog = {
  id: string;
  deviceName: string;
  deviceUserId: string;
  employeeName?: string;
  punchDate: string;
  punchTime: string;
  punchType: string;
  verificationType?: string;
  workCode?: string;
  deviceSerialNumber?: string;
  deviceIp?: string;
  syncAt: string;
  rawLogReference: string;
  processingStatus: string;
  errorMessage?: string;
  rawPayload?: {
    latitude?: number | string;
    longitude?: number | string;
    accuracyMeters?: number | string;
    distanceMeters?: number | string;
  };
  employee?: { employeeCode: string; firstName: string; lastName: string; department: { name: string } };
};

type SyncHistory = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  pulledCount: number;
  processedCount: number;
  unmatchedCount: number;
  duplicateCount: number;
  errorMessage?: string;
  device?: { deviceName: string };
};

function gpsValue(value: unknown) {
  return value === undefined || value === null || value === "" ? "-" : String(value);
}

export default async function BiometricLogsPage() {
  const [logs, history] = await Promise.all([
    apiFetch<RawLog[]>("/biometrics/raw-logs"),
    apiFetch<SyncHistory[]>("/biometrics/sync-history")
  ]);

  return (
    <>
      <TableToolbar
        title="Biometric Device Logs"
        count={`${logs.length} records`}
        actions={[{ label: "Devices", href: "/biometric-devices", icon: "columns" }, { label: "Attendance Records", href: "/biometric-attendance", icon: "more" }, { label: "Export CSV", href: "/api/backend/biometrics/raw-logs/export.csv", icon: "export" }, { label: "Export Excel", href: "/api/backend/biometrics/raw-logs/export.xlsx", icon: "export" }, { label: "Print", icon: "print" }]}
        searchPlaceholder="Search logs..."
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Device</th><th>Device User ID</th><th>Employee</th><th>Department</th><th>Punch Date</th><th>Punch Time</th><th>Punch Type</th><th>Verification</th><th>GPS Latitude</th><th>GPS Longitude</th><th>GPS Accuracy</th><th>Site Distance</th><th>Work Code</th><th>Serial</th><th>IP</th><th>Sync Time</th><th>Raw Ref</th><th>Status</th><th>Error</th><th>Actions</th></tr></thead>
          <tbody>
            {logs.length ? logs.map((log) => (
              <tr key={log.id}>
                <td>{log.deviceName}</td>
                <td>{log.deviceUserId}</td>
                <td>{log.employee ? `${log.employee.employeeCode} - ${log.employee.firstName} ${log.employee.lastName}` : log.employeeName ?? "-"}</td>
                <td>{log.employee?.department.name ?? "-"}</td>
                <td>{new Date(log.punchDate).toLocaleDateString()}</td>
                <td>{new Date(log.punchTime).toLocaleTimeString()}</td>
                <td>{log.punchType}</td>
                <td>{log.verificationType ?? "-"}</td>
                <td>{gpsValue(log.rawPayload?.latitude)}</td>
                <td>{gpsValue(log.rawPayload?.longitude)}</td>
                <td>{gpsValue(log.rawPayload?.accuracyMeters)}</td>
                <td>{gpsValue(log.rawPayload?.distanceMeters)}</td>
                <td>{log.workCode ?? "-"}</td>
                <td>{log.deviceSerialNumber ?? "-"}</td>
                <td>{log.deviceIp ?? "-"}</td>
                <td>{new Date(log.syncAt).toLocaleString()}</td>
                <td>{log.rawLogReference}</td>
                <td><span className={log.processingStatus === "UNMATCHED" || log.processingStatus === "ERROR" ? "status danger" : "status"}>{log.processingStatus}</span></td>
                <td>{log.errorMessage ?? "-"}</td>
                <td><RowActionMenu actions={[{ label: "Map employee", href: "/biometric-mapping" }, { label: "View attendance", href: "/biometric-attendance" }]} /></td>
              </tr>
            )) : <tr><td colSpan={20}>No records found.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ height: 16 }} />
      <h2 className="section-title">Sync History</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Device</th><th>Started</th><th>Finished</th><th>Status</th><th>Pulled</th><th>Processed</th><th>Unmatched</th><th>Duplicates</th><th>Error</th></tr></thead>
          <tbody>
            {history.length ? history.map((item) => (
              <tr key={item.id}>
                <td>{item.device?.deviceName ?? "-"}</td>
                <td>{new Date(item.startedAt).toLocaleString()}</td>
                <td>{item.finishedAt ? new Date(item.finishedAt).toLocaleString() : "-"}</td>
                <td><span className={item.status === "FAILED" ? "status danger" : "status"}>{item.status}</span></td>
                <td>{item.pulledCount}</td>
                <td>{item.processedCount}</td>
                <td>{item.unmatchedCount}</td>
                <td>{item.duplicateCount}</td>
                <td>{item.errorMessage ?? "-"}</td>
              </tr>
            )) : <tr><td colSpan={9}>No records found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
