import { RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type AttendanceRecord = {
  id: string;
  workDate: string;
  shift?: string;
  firstIn?: string;
  lastOut?: string;
  workingHours: string;
  lateMinutes: number;
  earlyOutMinutes: number;
  overtimeHours: string;
  attendanceStatus: string;
  source: string;
  approvalStatus: string;
  employee: { employeeCode: string; firstName: string; lastName: string; department: { name: string } };
  device?: { deviceName: string };
};

export default async function BiometricAttendancePage() {
  const records = await apiFetch<AttendanceRecord[]>("/biometrics/attendance-records");

  return (
    <>
      <TableToolbar
        title="Attendance Records"
        count={`${records.length} records`}
        actions={[{ label: "Devices", href: "/biometric-devices", icon: "columns" }, { label: "Raw Logs", href: "/biometric-logs", icon: "more" }, { label: "Print", icon: "print" }, { label: "Export", icon: "export" }]}
        searchPlaceholder="Search attendance..."
      />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Employee ID</th><th>Employee Name</th><th>Department</th><th>Date</th><th>Shift</th><th>First In</th><th>Last Out</th><th>Working Hours</th><th>Late</th><th>Early Out</th><th>Overtime</th><th>Status</th><th>Device</th><th>Source</th><th>Approval</th><th>Actions</th></tr></thead>
          <tbody>
            {records.length ? records.map((record) => (
              <tr key={record.id}>
                <td>{record.employee.employeeCode}</td>
                <td>{record.employee.firstName} {record.employee.lastName}</td>
                <td>{record.employee.department.name}</td>
                <td>{new Date(record.workDate).toLocaleDateString()}</td>
                <td>{record.shift ?? "-"}</td>
                <td>{record.firstIn ? new Date(record.firstIn).toLocaleTimeString() : "-"}</td>
                <td>{record.lastOut ? new Date(record.lastOut).toLocaleTimeString() : "-"}</td>
                <td>{record.workingHours} h</td>
                <td>{record.lateMinutes} min</td>
                <td>{record.earlyOutMinutes} min</td>
                <td>{record.overtimeHours} h</td>
                <td><span className={record.attendanceStatus.includes("ABSENT") || record.attendanceStatus.includes("MISSING") ? "status danger" : "status"}>{record.attendanceStatus}</span></td>
                <td>{record.device?.deviceName ?? "-"}</td>
                <td>{record.source}</td>
                <td><span className="status">{record.approvalStatus}</span></td>
                <td><RowActionMenu actions={[{ label: "View raw logs", href: "/biometric-logs" }, { label: "View mapping", href: "/biometric-mapping" }]} /></td>
              </tr>
            )) : <tr><td colSpan={16}>No records found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
