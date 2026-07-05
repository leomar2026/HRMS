import { ArchiveGroupButton, GroupForm } from "@/components/GroupActions";
import { BulkActionBar, RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Group = {
  id: string;
  groupCode: string;
  groupName: string;
  groupType: string;
  company?: string;
  branch?: string;
  department?: string;
  status: string;
  groupOwner?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { members: number };
};

export default async function GroupManagementPage({ searchParams }: { searchParams: Promise<{ type?: string; search?: string }> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.type) query.set("groupType", params.type);
  if (params.search) query.set("search", params.search);
  const groups = await apiFetch<Group[]>(`/groups${query.size ? `?${query.toString()}` : ""}`);

  return (
    <>
      <TableToolbar
        title={params.type ? `${params.type} Groups` : "Group Management"}
        count={`${groups.length} groups`}
        searchPlaceholder="Search groups"
        actions={[
          { label: "All Groups", href: "/group-management", icon: "refresh" },
          { label: "Employee", href: "/group-management?type=EMPLOYEE", icon: "filter" },
          { label: "Leave", href: "/group-management?type=LEAVE", icon: "filter" },
          { label: "Payroll", href: "/group-management?type=PAYROLL", icon: "filter" }
        ]}
      />
      <GroupForm defaultType={params.type ?? "EMPLOYEE"} />
      <div style={{ height: 16 }} />
      <BulkActionBar
        actions={[
          { label: "Export all members", href: "/api/backend/groups/export-members.csv" }
        ]}
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th><input aria-label="Select all groups" type="checkbox" /></th>
              <th className="freeze-col">Group Code</th>
              <th>Group Name</th>
              <th>Group Type</th>
              <th>Company</th>
              <th>Branch</th>
              <th>Department</th>
              <th>Members</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Created Date</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.id}>
                <td><input aria-label={`Select ${group.groupName}`} type="checkbox" /></td>
                <td className="freeze-col">{group.groupCode}</td>
                <td>{group.groupName}</td>
                <td>{group.groupType}</td>
                <td>{group.company ?? "-"}</td>
                <td>{group.branch ?? "-"}</td>
                <td>{group.department ?? "-"}</td>
                <td>{group._count?.members ?? 0}</td>
                <td>{group.groupOwner ?? "-"}</td>
                <td><span className={group.status === "ACTIVE" ? "status" : "status warn"}>{group.status}</span></td>
                <td>{new Date(group.createdAt).toLocaleDateString()}</td>
                <td>{new Date(group.updatedAt).toLocaleDateString()}</td>
                <td>
                  <RowActionMenu
                    actions={[
                      { label: "Export members", href: `/api/backend/groups/${group.id}/export-members.csv` }
                    ]}
                  />
                  <div className="row-inline-action"><ArchiveGroupButton id={group.id} /></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
