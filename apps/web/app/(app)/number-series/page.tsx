import { RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { InitializeNumberSeriesButton, NumberSeriesEditForm, type NumberSeriesRow } from "@/components/NumberSeriesActions";
import { apiFetch } from "@/lib/api";

export default async function NumberSeriesPage() {
  const rows = await apiFetch<NumberSeriesRow[]>("/number-series");

  return (
    <>
      <TableToolbar
        title="Number Series"
        count={`${rows.length} series`}
        searchPlaceholder="Search number series"
        actions={[
          { label: "Audit Logs", href: "/audit-logs?entity=NumberSeries", icon: "more" },
          { label: "Refresh", href: "/number-series", icon: "refresh" }
        ]}
      />
      <div className="actions"><InitializeNumberSeriesButton /></div>
      <div style={{ height: 12 }} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th><input aria-label="Select all number series" type="checkbox" /></th>
              <th className="freeze-col">Code</th>
              <th>Name / Prefix / Counters</th>
              <th>Preview</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const preview = `${row.prefix.replace("{YYYY}", String(new Date().getFullYear())).replace("{YY}", String(new Date().getFullYear()).slice(-2)).replace("{MM}", String(new Date().getMonth() + 1).padStart(2, "0")).replace("{DD}", String(new Date().getDate()).padStart(2, "0"))}${row.separator}${String(row.nextNumber).padStart(row.padding, "0")}`;
              return (
                <tr key={row.id}>
                  <td><input aria-label={`Select ${row.code}`} type="checkbox" /></td>
                  <td className="freeze-col">{row.code}</td>
                  <td><NumberSeriesEditForm row={row} /></td>
                  <td>{preview}</td>
                  <td><span className={row.active ? "status" : "status warn"}>{row.active ? "ACTIVE" : "INACTIVE"}</span></td>
                  <td><RowActionMenu actions={[{ label: "Audit History", href: `/audit-logs?entityId=${row.id}` }]} /></td>
                </tr>
              );
            })}
            {rows.length === 0 ? <tr><td colSpan={6}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
