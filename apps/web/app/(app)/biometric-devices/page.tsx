import { BiometricDeviceEditForm, BiometricDeviceForm, BiometricImportForm, DeviceActionButtons } from "@/components/BiometricActions";
import { RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Device = {
  id: string;
  deviceName: string;
  deviceCode: string;
  brand: string;
  model?: string;
  serialNumber?: string;
  ipAddress?: string;
  port?: number;
  connectionType: string;
  deviceLocation?: string;
  branch?: string;
  timezone: string;
  status: string;
  lastSyncAt?: string;
  connectionStatus: string;
  syncIntervalMinutes: number;
  remarks?: string;
  _count?: { logs: number; mappings: number };
};

export default async function BiometricDevicesPage() {
  const devices = await apiFetch<Device[]>("/biometrics/devices");

  return (
    <>
      <TableToolbar
        title="Biometric Devices"
        count={`${devices.length} records`}
        actions={[
          { label: "Mapping", href: "/biometric-mapping", icon: "columns" },
          { label: "Attendance Logs", href: "/biometric-logs", icon: "more" },
          { label: "Refresh", href: "/biometric-devices", icon: "refresh" }
        ]}
        searchPlaceholder="Search devices..."
      />
      <BiometricDeviceForm />
      <div style={{ height: 12 }} />
      <BiometricImportForm devices={devices} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Device</th><th>Code</th><th>Brand</th><th>Connection</th><th>IP/Port</th><th>Branch</th><th>Status</th><th>Connection Status</th><th>Last Sync</th><th>Interval</th><th>Logs</th><th>Actions</th></tr></thead>
          <tbody>
            {devices.length ? devices.map((device) => (
              <tr key={device.id}>
                <td>{device.deviceName}<br /><span className="muted">{device.model ?? "-"}</span></td>
                <td>{device.deviceCode}</td>
                <td>{device.brand}</td>
                <td>{device.connectionType}</td>
                <td>{device.ipAddress ?? "-"}{device.port ? `:${device.port}` : ""}</td>
                <td>{device.branch ?? "-"}</td>
                <td><span className="status">{device.status}</span></td>
                <td><span className={device.connectionStatus === "FAILED" ? "status danger" : "status"}>{device.connectionStatus}</span></td>
                <td>{device.lastSyncAt ? new Date(device.lastSyncAt).toLocaleString() : "-"}</td>
                <td>{device.syncIntervalMinutes} min</td>
                <td>{device._count?.logs ?? 0}</td>
                <td>
                  <DeviceActionButtons deviceId={device.id} />
                  <BiometricDeviceEditForm device={device} />
                  <RowActionMenu actions={[
                    { label: "View device logs", href: "/biometric-logs" },
                    { label: "View attendance records", href: "/biometric-attendance" },
                    { label: "View mappings", href: "/biometric-mapping" }
                  ]} />
                </td>
              </tr>
            )) : <tr><td colSpan={12}>No records found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
