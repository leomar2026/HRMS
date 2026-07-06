import { RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type TeamMember = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle: string;
  branch?: string;
  status: string;
  leaveBalance: number;
  department: { name: string };
  user?: { role?: string; portalStatus?: string };
  leaves?: Array<{ id: string; requestNumber?: string; workflowStage?: string; status: string }>;
};

export default async function MyTeamPage() {
  const team = await apiFetch<TeamMember[]>("/manager/team");

  return (
    <>
      <TableToolbar
        title="My Team"
        count={`${team.length} records`}
        actions={[
          { label: "Refresh", href: "/manager/my-team", icon: "refresh" },
          { label: "Print", icon: "print" },
          { label: "Export", icon: "export" }
        ]}
        searchPlaceholder="Search team..."
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th><input aria-label="Select all team members" type="checkbox" /></th>
              <th>Employee Code</th>
              <th>Employee Name</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Branch</th>
              <th>Email</th>
              <th>Mobile</th>
              <th>Leave Balance</th>
              <th>Portal Role</th>
              <th>Status</th>
              <th>Latest Approval</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {team.length ? team.map((employee) => {
              const latestLeave = employee.leaves?.[0];
              return (
                <tr key={employee.id}>
                  <td><input aria-label={`Select ${employee.employeeCode}`} type="checkbox" /></td>
                  <td>{employee.employeeCode}</td>
                  <td>{employee.firstName} {employee.lastName}</td>
                  <td>{employee.department.name}</td>
                  <td>{employee.jobTitle}</td>
                  <td>{employee.branch ?? "-"}</td>
                  <td>{employee.email}</td>
                  <td>{employee.phone ?? "-"}</td>
                  <td><span className="status">{employee.leaveBalance}</span></td>
                  <td>{employee.user?.role ?? "EMPLOYEE"}</td>
                  <td><span className="status">{employee.status}</span></td>
                  <td>{latestLeave ? `${latestLeave.requestNumber ?? latestLeave.id} - ${latestLeave.workflowStage ?? latestLeave.status}` : "-"}</td>
                  <td><RowActionMenu actions={[{ label: "View approvals", href: "/manager/my-approvals" }, { label: "View calendar", href: "/manager/team-calendar" }]} /></td>
                </tr>
              );
            }) : (
              <tr><td colSpan={13}>No records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
