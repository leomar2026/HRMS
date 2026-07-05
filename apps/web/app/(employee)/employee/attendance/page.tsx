import { apiFetch } from "@/lib/api";

type Attendance = {
  id: string;
  workDate: string;
  checkIn?: string;
  checkOut?: string;
  lateMinutes: number;
  overtimeHours: string;
  source: string;
  status: string;
};

export default async function EmployeeAttendancePage() {
  const records = await apiFetch<Attendance[]>("/employee/me/attendance");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">My Attendance</h1>
          <p className="muted">View biometric attendance, late minutes, overtime, and absence status.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Check-in</th><th>Check-out</th><th>Late</th><th>Overtime</th><th>Source</th><th>Status</th></tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{new Date(record.workDate).toLocaleDateString()}</td>
                <td>{record.checkIn ? new Date(record.checkIn).toLocaleTimeString() : "-"}</td>
                <td>{record.checkOut ? new Date(record.checkOut).toLocaleTimeString() : "-"}</td>
                <td>{record.lateMinutes} min</td>
                <td>{record.overtimeHours} h</td>
                <td>{record.source}</td>
                <td><span className={record.status === "ABSENT" ? "status danger" : "status"}>{record.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
