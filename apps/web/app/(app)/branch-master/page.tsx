import { MasterSpecificEditForm, MasterSpecificForm } from "@/components/MasterSpecificActions";
import { RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { ArchiveRecordButton } from "@/components/DeleteActions";
import { apiFetch } from "@/lib/api";

type MasterRecord = { id: string; type: string; code: string; name: string; nameArabic?: string; active: boolean; createdAt?: string; metadata?: Record<string, string> };
type CompanyProfile = { companyName: string };

const branchFields = [
  { name: "location", label: "Location" },
  { name: "address", label: "Address" },
  { name: "city", label: "City" },
  { name: "country", label: "Country" },
  { name: "telephone", label: "Telephone" },
  { name: "email", label: "Email", type: "email" as const },
  { name: "branchManager", label: "Branch Manager" },
  { name: "remarks", label: "Remarks" }
];

export default async function BranchMasterPage() {
  const [records, company] = await Promise.all([
    apiFetch<MasterRecord[]>("/master-data?type=BRANCH"),
    apiFetch<CompanyProfile>("/company-profile")
  ]);
  const fields = [
    { name: "company", label: "Company", required: true, type: "select" as const, options: [company.companyName] },
    ...branchFields
  ];
  return (
    <>
      <TableToolbar title="Branch Master" count={`${records.length} records`} searchPlaceholder="Search branch" actions={[
        { label: "Import", href: "/api/backend/master-data/template.xlsx", icon: "import" },
        { label: "Export Excel", href: "/api/backend/master-data/export.xlsx?type=BRANCH", icon: "export" },
        { label: "Export PDF", href: "/api/backend/master-data/export.pdf?type=BRANCH", icon: "export" },
        { label: "Print", href: "/api/backend/master-data/print?type=BRANCH", icon: "print" },
        { label: "Refresh", href: "/branch-master", icon: "refresh" },
        { label: "Columns", icon: "columns" }
      ]} />
      <MasterSpecificForm masterType="BRANCH" fields={fields} />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label="Select branches" type="checkbox" /></th><th className="freeze-col">Branch Code</th><th>Branch Name English</th><th>Branch Name Arabic</th><th>Company</th><th>Location</th><th>Address</th><th>City</th><th>Country</th><th>Telephone</th><th>Email</th><th>Branch Manager</th><th>Status</th><th>Created Date</th><th>Actions</th></tr></thead>
          <tbody>
            {records.map((row) => (
              <tr key={row.id}>
                <td><input aria-label={`Select ${row.code}`} type="checkbox" /></td>
                <td className="freeze-col">{row.code}</td><td>{row.name}</td><td>{row.nameArabic ?? "-"}</td><td>{row.metadata?.company ?? "-"}</td><td>{row.metadata?.location ?? "-"}</td><td>{row.metadata?.address ?? "-"}</td><td>{row.metadata?.city ?? "-"}</td><td>{row.metadata?.country ?? "-"}</td><td>{row.metadata?.telephone ?? "-"}</td><td>{row.metadata?.email ?? "-"}</td><td>{row.metadata?.branchManager ?? "-"}</td><td><span className="status">{row.active ? "ACTIVE" : "INACTIVE"}</span></td><td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-"}</td>
                <td><MasterSpecificEditForm record={row} fields={fields} /><RowActionMenu actions={[{ label: "View", href: `/api/backend/master-data/print?type=BRANCH` }, { label: row.active ? "Deactivate" : "Activate", href: `/branch-master` }, { label: "Audit History", href: `/audit-logs?entityId=${row.id}` }]} /><ArchiveRecordButton endpoint={`/api/backend/master-data/${row.id}`} label="Delete" confirmLabel={`Delete / archive branch ${row.code}?`} /></td>
              </tr>
            ))}
            {records.length === 0 ? <tr><td colSpan={15}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
