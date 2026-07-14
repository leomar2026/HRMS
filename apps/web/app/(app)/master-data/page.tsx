import { MasterDataEditForm, MasterDataForm } from "@/components/AdminForms";
import { RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { ArchiveRecordButton } from "@/components/DeleteActions";
import { apiFetch } from "@/lib/api";

type MasterData = { id: string; type: string; code: string; name: string; nameArabic?: string; active: boolean };

export default async function MasterDataPage() {
  const records = await apiFetch<MasterData[]>("/master-data");

  return (
    <>
      <TableToolbar
        title="Master Data"
        count={`${records.length} records`}
        searchPlaceholder="Search master data"
        actions={[
          { label: "CSV Template", href: "/api/backend/master-data/template.csv", icon: "template" },
          { label: "Excel Template", href: "/api/backend/master-data/template.xlsx", icon: "template" },
          { label: "Export CSV", href: "/api/backend/master-data/export.csv", icon: "export" },
          { label: "Export Excel", href: "/api/backend/master-data/export.xlsx", icon: "export" },
          { label: "Department Groups", href: "/group-management?type=DEPARTMENT", icon: "columns" },
          { label: "Leave Groups", href: "/group-management?type=LEAVE", icon: "columns" }
        ]}
      />
      <MasterDataForm />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label="Select all master data" type="checkbox" /></th><th>Type</th><th className="freeze-col">Code</th><th>Name</th><th>Arabic</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td><input aria-label={`Select ${record.code}`} type="checkbox" /></td>
                <td>{record.type}</td>
                <td className="freeze-col">{record.code}</td>
                <td>{record.name}</td>
                <td>{record.nameArabic ?? "-"}</td>
                <td><span className="status">{record.active ? "ACTIVE" : "INACTIVE"}</span></td>
                <td>
                  <MasterDataEditForm record={record} />
                  <RowActionMenu actions={[{ label: "Open related groups", href: `/group-management?type=${encodeURIComponent(record.type)}` }]} />
                  <ArchiveRecordButton endpoint={`/api/backend/master-data/${record.id}`} label="Delete" confirmLabel={`Delete / archive ${record.code}?`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
