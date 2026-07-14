import { BiometricMappingForm } from "@/components/BiometricActions";
import { RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Device = { id: string; deviceName: string };
type Employee = { id: string; employeeCode: string; firstName: string; lastName: string };
type EmployeeResponse = { items: Employee[] };
type Mapping = {
  id: string;
  biometricId?: string;
  deviceUserId: string;
  cardNumber?: string;
  syncStatus: string;
  lastPunchAt?: string;
  active: boolean;
  employee: Employee & { department: { name: string } };
  device?: Device;
};

export default async function BiometricMappingPage() {
  const [mappings, devices, employeesResponse] = await Promise.all([
    apiFetch<Mapping[]>("/biometrics/mappings"),
    apiFetch<Device[]>("/biometrics/devices"),
    apiFetch<EmployeeResponse>("/employees")
  ]);
  const employees = employeesResponse.items ?? [];

  return (
    <>
      <TableToolbar
        title="Biometric Mapping"
        count={`${mappings.length} records`}
        actions={[
          { label: "Employee Time-In Link", href: "/mobile-time-in", icon: "more" },
          { label: "Devices", href: "/biometric-devices", icon: "columns" },
          { label: "Logs", href: "/biometric-logs", icon: "more" }
        ]}
        searchPlaceholder="Search mappings..."
      />
      <BiometricMappingForm devices={devices} employees={employees} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Employee ID</th><th>Employee Name</th><th>Department</th><th>Biometric ID</th><th>Device User ID</th><th>Card Number</th><th>Assigned Device</th><th>Sync Status</th><th>Last Punch</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {mappings.length ? mappings.map((mapping) => (
              <tr key={mapping.id}>
                <td>{mapping.employee.employeeCode}</td>
                <td>{mapping.employee.firstName} {mapping.employee.lastName}</td>
                <td>{mapping.employee.department.name}</td>
                <td>{mapping.biometricId ?? "-"}</td>
                <td>{mapping.deviceUserId}</td>
                <td>{mapping.cardNumber ?? "-"}</td>
                <td>{mapping.device?.deviceName ?? "Any Device"}</td>
                <td><span className="status">{mapping.syncStatus}</span></td>
                <td>{mapping.lastPunchAt ? new Date(mapping.lastPunchAt).toLocaleString() : "-"}</td>
                <td><span className={mapping.active ? "status" : "status danger"}>{mapping.active ? "ACTIVE" : "DISABLED"}</span></td>
                <td><RowActionMenu actions={[{ label: "View attendance logs", href: "/biometric-logs" }, { label: "View attendance records", href: "/biometric-attendance" }]} /></td>
              </tr>
            )) : <tr><td colSpan={11}>No records found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
