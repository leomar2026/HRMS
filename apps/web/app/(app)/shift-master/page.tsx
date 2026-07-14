import { MasterSpecificEditForm, MasterSpecificForm } from "@/components/MasterSpecificActions";
import { RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { ArchiveRecordButton } from "@/components/DeleteActions";
import { apiFetch } from "@/lib/api";

type MasterRecord = { id: string; type: string; code: string; name: string; nameArabic?: string; active: boolean; metadata?: Record<string, string | boolean> };

const fields = [
  { name: "startTime", label: "Start Time", type: "time" as const },
  { name: "endTime", label: "End Time", type: "time" as const },
  { name: "breakStartTime", label: "Break Start Time", type: "time" as const },
  { name: "breakEndTime", label: "Break End Time", type: "time" as const },
  { name: "workingHours", label: "Total Working Hours", type: "number" as const },
  { name: "lateGraceMinutes", label: "Late Grace Minutes", type: "number" as const },
  { name: "earlyOutGraceMinutes", label: "Early Out Grace Minutes", type: "number" as const },
  { name: "overtimeEligible", label: "Overtime Eligible", type: "checkbox" as const },
  { name: "nightShift", label: "Night Shift", type: "checkbox" as const },
  { name: "ramadanShift", label: "Ramadan Shift", type: "checkbox" as const },
  { name: "weeklyOffDays", label: "Weekly Off Days" },
  { name: "applicableBranch", label: "Applicable Branch" },
  { name: "applicableDepartment", label: "Applicable Department" },
  { name: "remarks", label: "Remarks" }
];

export default async function ShiftMasterPage() {
  const records = await apiFetch<MasterRecord[]>("/master-data?type=SHIFT");
  return (
    <>
      <TableToolbar title="Shift Master" count={`${records.length} records`} searchPlaceholder="Search shift" actions={[
        { label: "Import", href: "/api/backend/master-data/template.xlsx", icon: "import" },
        { label: "Export Excel", href: "/api/backend/master-data/export.xlsx?type=SHIFT", icon: "export" },
        { label: "Export PDF", href: "/api/backend/master-data/export.pdf?type=SHIFT", icon: "export" },
        { label: "Print", href: "/api/backend/master-data/print?type=SHIFT", icon: "print" },
        { label: "Refresh", href: "/shift-master", icon: "refresh" },
        { label: "Columns", icon: "columns" }
      ]} />
      <MasterSpecificForm masterType="SHIFT" fields={fields} />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label="Select shifts" type="checkbox" /></th><th className="freeze-col">Shift Code</th><th>Shift Name English</th><th>Shift Name Arabic</th><th>Start Time</th><th>End Time</th><th>Break Time</th><th>Working Hours</th><th>Grace Period</th><th>Weekly Off</th><th>Ramadan Shift</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {records.map((row) => <tr key={row.id}><td><input aria-label={`Select ${row.code}`} type="checkbox" /></td><td className="freeze-col">{row.code}</td><td>{row.name}</td><td>{row.nameArabic ?? "-"}</td><td>{String(row.metadata?.startTime ?? "-")}</td><td>{String(row.metadata?.endTime ?? "-")}</td><td>{[row.metadata?.breakStartTime, row.metadata?.breakEndTime].filter(Boolean).join(" - ") || "-"}</td><td>{String(row.metadata?.workingHours ?? "-")}</td><td>{String(row.metadata?.lateGraceMinutes ?? "0")} / {String(row.metadata?.earlyOutGraceMinutes ?? "0")}</td><td>{String(row.metadata?.weeklyOffDays ?? "-")}</td><td>{row.metadata?.ramadanShift ? "Yes" : "No"}</td><td><span className="status">{row.active ? "ACTIVE" : "INACTIVE"}</span></td><td><MasterSpecificEditForm record={row as never} fields={fields} /><RowActionMenu actions={[{ label: "View", href: "/api/backend/master-data/print?type=SHIFT" }, { label: "Audit History", href: `/audit-logs?entityId=${row.id}` }]} /><ArchiveRecordButton endpoint={`/api/backend/master-data/${row.id}`} label="Delete" confirmLabel={`Delete / archive shift ${row.code}?`} /></td></tr>)}
            {records.length === 0 ? <tr><td colSpan={13}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
