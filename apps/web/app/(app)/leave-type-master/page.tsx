import { MasterSpecificEditForm, MasterSpecificForm } from "@/components/MasterSpecificActions";
import { RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type MasterRecord = { id: string; type: string; code: string; name: string; nameArabic?: string; active: boolean; metadata?: Record<string, string | boolean> };

const fields = [
  { name: "leavePolicy", label: "Leave Policy" },
  { name: "category", label: "Leave Category", type: "select" as const, options: ["Annual", "Sick", "Emergency", "Unpaid", "Compensatory", "Other"] },
  { name: "paidUnpaid", label: "Paid or Unpaid", type: "select" as const, options: ["Paid", "Unpaid"] },
  { name: "annualEntitlement", label: "Default Annual Entitlement", type: "number" as const },
  { name: "accrualMethod", label: "Accrual Method" },
  { name: "carryForwardAllowed", label: "Carry Forward Allowed", type: "checkbox" as const },
  { name: "maximumCarryForwardDays", label: "Maximum Carry Forward Days", type: "number" as const },
  { name: "carryForwardExpiry", label: "Carry Forward Expiry", type: "date" as const },
  { name: "encashmentAllowed", label: "Encashment Allowed", type: "checkbox" as const },
  { name: "attachmentRequired", label: "Attachment Required", type: "checkbox" as const },
  { name: "attachmentMandatory", label: "Attachment Mandatory", type: "checkbox" as const },
  { name: "approvalRequired", label: "Approval Required", type: "checkbox" as const },
  { name: "genderRestriction", label: "Gender Restriction" },
  { name: "minimumServiceDays", label: "Minimum Service Days", type: "number" as const },
  { name: "maximumDaysPerRequest", label: "Maximum Days Per Request", type: "number" as const },
  { name: "allowNegativeBalance", label: "Allow Negative Balance", type: "checkbox" as const },
  { name: "remarks", label: "Remarks" }
];

export default async function LeaveTypeMasterPage() {
  const records = await apiFetch<MasterRecord[]>("/master-data?type=LEAVE_TYPE");
  return (
    <>
      <TableToolbar title="Leave Type Master" count={`${records.length} records`} searchPlaceholder="Search leave type" actions={[
        { label: "Import", href: "/api/backend/master-data/template.xlsx", icon: "import" },
        { label: "Export Excel", href: "/api/backend/master-data/export.xlsx?type=LEAVE_TYPE", icon: "export" },
        { label: "Export PDF", href: "/api/backend/master-data/export.pdf?type=LEAVE_TYPE", icon: "export" },
        { label: "Print", href: "/api/backend/master-data/print?type=LEAVE_TYPE", icon: "print" },
        { label: "Refresh", href: "/leave-type-master", icon: "refresh" },
        { label: "Columns", icon: "columns" }
      ]} />
      <MasterSpecificForm masterType="LEAVE_TYPE" fields={fields} />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label="Select leave types" type="checkbox" /></th><th className="freeze-col">Leave Code</th><th>Leave Name English</th><th>Leave Name Arabic</th><th>Leave Category</th><th>Paid / Unpaid</th><th>Annual Entitlement</th><th>Accrual Rule</th><th>Carry Forward</th><th>Encashment</th><th>Attachment Required</th><th>Approval Required</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {records.map((row) => <tr key={row.id}><td><input aria-label={`Select ${row.code}`} type="checkbox" /></td><td className="freeze-col">{row.code}</td><td>{row.name}</td><td>{row.nameArabic ?? "-"}</td><td>{String(row.metadata?.category ?? "-")}</td><td>{String(row.metadata?.paidUnpaid ?? "-")}</td><td>{String(row.metadata?.annualEntitlement ?? "-")}</td><td>{String(row.metadata?.accrualMethod ?? "-")}</td><td>{row.metadata?.carryForwardAllowed ? "Yes" : "No"}</td><td>{row.metadata?.encashmentAllowed ? "Yes" : "No"}</td><td>{row.metadata?.attachmentRequired ? "Yes" : "No"}</td><td>{row.metadata?.approvalRequired ? "Yes" : "No"}</td><td><span className="status">{row.active ? "ACTIVE" : "INACTIVE"}</span></td><td><MasterSpecificEditForm record={row as never} fields={fields} /><RowActionMenu actions={[{ label: "View", href: "/api/backend/master-data/print?type=LEAVE_TYPE" }, { label: "Audit History", href: `/audit-logs?entityId=${row.id}` }]} /></td></tr>)}
            {records.length === 0 ? <tr><td colSpan={14}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
