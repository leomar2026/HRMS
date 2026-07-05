import { AdminPasswordResetForm, PortalStatusButtons } from "@/components/AdminPortalActions";
import { RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type PortalUser = {
  id: string;
  email: string;
  role: string;
  portalStatus: string;
  failedLoginAttempts: number;
  lockedUntil?: string | null;
  employee?: {
    employeeCode: string;
    firstName: string;
    lastName: string;
    branch?: string | null;
    status: string;
    department: { name: string };
  } | null;
};

export default async function AdminPasswordResetPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const params = await searchParams;
  const users = await apiFetch<PortalUser[]>(`/auth/admin/portal-accounts${params.search ? `?search=${encodeURIComponent(params.search)}` : ""}`);

  return (
    <>
      <TableToolbar
        title="Admin Password Reset"
        count={`${users.length} portal accounts`}
        searchPlaceholder="Search employee ID, name, department, branch, or status"
      />
      <form className="form-panel actions">
        <input name="search" defaultValue={params.search ?? ""} placeholder="Employee ID, name, department, branch, status" />
        <button className="button" type="submit">Search</button>
      </form>
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Employee ID</th><th>Name</th><th>Department</th><th>Branch</th><th>Employee Status</th><th>Portal Status</th><th>Failed Attempts</th><th>Locked Until</th><th>Reset Password</th><th>Access Control</th><th>History</th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.employee?.employeeCode ?? "-"}</td>
                <td>{user.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user.email}</td>
                <td>{user.employee?.department.name ?? "-"}</td>
                <td>{user.employee?.branch ?? "-"}</td>
                <td><span className="status">{user.employee?.status ?? "-"}</span></td>
                <td><span className={user.portalStatus === "ACTIVE" ? "status" : "status warn"}>{user.portalStatus}</span></td>
                <td>{user.failedLoginAttempts}</td>
                <td>{user.lockedUntil ? new Date(user.lockedUntil).toLocaleString() : "-"}</td>
                <td><AdminPasswordResetForm userId={user.id} /></td>
                <td><PortalStatusButtons userId={user.id} /></td>
                <td><RowActionMenu actions={[{ label: "View login/reset history", href: `/admin-password-reset/history?userId=${user.id}` }]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
