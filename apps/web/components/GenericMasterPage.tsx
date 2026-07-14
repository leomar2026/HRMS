import { MasterSpecificEditForm, MasterSpecificForm } from "@/components/MasterSpecificActions";
import { RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { ArchiveRecordButton } from "@/components/DeleteActions";
import { apiFetch } from "@/lib/api";

type MasterRecord = { id: string; type: string; code: string; name: string; nameArabic?: string; active: boolean; createdAt?: string; metadata?: Record<string, string> };

const fields = [
  { name: "description", label: "Description" },
  { name: "remarks", label: "Remarks" }
];

export async function GenericMasterPage({ title, masterType, path }: { title: string; masterType: string; path: string }) {
  const records = await apiFetch<MasterRecord[]>(`/master-data?type=${encodeURIComponent(masterType)}`);
  return (
    <>
      <TableToolbar title={title} count={`${records.length} records`} searchPlaceholder={`Search ${title.toLowerCase()}`} actions={[
        { label: "Import", href: "/api/backend/master-data/template.xlsx", icon: "import" },
        { label: "Export Excel", href: `/api/backend/master-data/export.xlsx?type=${masterType}`, icon: "export" },
        { label: "Export PDF", href: `/api/backend/master-data/export.pdf?type=${masterType}`, icon: "export" },
        { label: "Print", href: `/api/backend/master-data/print?type=${masterType}`, icon: "print" },
        { label: "Refresh", href: path, icon: "refresh" },
        { label: "Columns", icon: "columns" }
      ]} />
      <MasterSpecificForm masterType={masterType} fields={fields} />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label={`Select ${title}`} type="checkbox" /></th><th className="freeze-col">Code</th><th>Name English</th><th>Name Arabic</th><th>Description</th><th>Status</th><th>Created Date</th><th>Actions</th></tr></thead>
          <tbody>
            {records.map((row) => <tr key={row.id}><td><input aria-label={`Select ${row.code}`} type="checkbox" /></td><td className="freeze-col">{row.code}</td><td>{row.name}</td><td>{row.nameArabic ?? "-"}</td><td>{row.metadata?.description ?? row.metadata?.remarks ?? "-"}</td><td><span className="status">{row.active ? "ACTIVE" : "INACTIVE"}</span></td><td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-"}</td><td><MasterSpecificEditForm record={row} fields={fields} /><RowActionMenu actions={[{ label: "View / Print", href: `/api/backend/master-data/print?type=${masterType}` }, { label: "Audit History", href: `/audit-logs?entityId=${row.id}` }]} /><ArchiveRecordButton endpoint={`/api/backend/master-data/${row.id}`} label="Delete" confirmLabel={`Delete / archive ${row.code}?`} /></td></tr>)}
            {records.length === 0 ? <tr><td colSpan={8}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
