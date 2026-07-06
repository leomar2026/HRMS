import { RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Attendance = {
  id: string;
  workDate: string;
  checkIn?: string | null;
  checkOut?: string | null;
  lateMinutes: number;
  overtimeHours: string;
  status: string;
  source: string;
  employee: {
    employeeCode: string;
    firstName: string;
    lastName: string;
    department: { name: string };
  };
};

function formatTime(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString() : "-";
}

export default async function TeamAttendancePage() {
  const records = await apiFetch<Attendance[]>("/manager/attendance");

  return (
    <>
      <TableToolbar
        title="Team Attendance"
        count={`${records.length} records`}
        actions={[
          { label: "Refresh", href: "/manager/team-attendance", icon: "refresh" },
          { label: "Print", icon: "print" },
          { label: "Export", icon: "export" }
        ]}
        searchPlaceholder="Search attendance..."
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th><input aria-label="Select all attendance records" type="checkbox" /></th>
              <th>Date</th>
              <th>Employee Code</th>
              <th>Employee Name</th>
              <th>Department</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Late Minutes</th>
              <th>Overtime</th>
              <th>Source</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length ? records.map((record) => (
              <tr key={record.id}>
                <td><input aria-label={`Select attendance ${record.id}`} type="checkbox" /></td>
                <td>{new Date(record.workDate).toLocaleDateString()}</td>
                <td>{record.employee.employeeCode}</td>
                <td>{record.employee.firstName} {record.employee.lastName}</td>
                <td>{record.employee.department.name}</td>
                <td>{formatTime(record.checkIn)}</td>
                <td>{formatTime(record.checkOut)}</td>
                <td>{record.lateMinutes} min</td>
                <td>{record.overtimeHours} h</td>
                <td>{record.source}</td>
                <td><span className={record.status === "ABSENT" ? "status danger" : "status"}>{record.status}</span></td>
                <td><RowActionMenu actions={[{ label: "View team", href: "/manager/my-team" }, { label: "View leave calendar", href: "/manager/team-calendar" }]} /></td>
              </tr>
            )) : (
              <tr><td colSpan={12}>No records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
