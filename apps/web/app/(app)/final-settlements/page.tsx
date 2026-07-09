import { FinalSettlementForm } from "@/components/ExtendedHrmsActions";
import { RowActionMenu, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Resignation = { id: string; requestNumber: string; employee: { employeeCode: string; firstName: string; lastName: string }; finalSettlement?: Settlement | null };
type Settlement = { id: string; settlementNumber: string; lastWorkingDate: string; endOfServiceBenefit: string; totalEarnings: string; totalDeductions: string; netFinalSettlement: string; status: string; paymentDate?: string; employee: { employeeCode: string; firstName: string; lastName: string } };

export default async function FinalSettlementsPage() {
  const resignations = await apiFetch<Resignation[]>("/resignations");
  const settlements = resignations.map((row) => row.finalSettlement).filter(Boolean) as Settlement[];
  return (
    <>
      <TableToolbar title="Final Settlements" count={`${settlements.length} records`} searchPlaceholder="Search settlements" actions={[{ label: "Export Excel", href: "/api/backend/resignations/final-settlements/export.xlsx", icon: "export" }]} />
      <div className="form-panel grid">
        <h2>Create / Update Settlement</h2>
        {resignations.map((row) => <div key={row.id} className="grid"><strong>{row.requestNumber} - {row.employee.employeeCode} {row.employee.firstName} {row.employee.lastName}</strong><FinalSettlementForm resignationId={row.id} /></div>)}
      </div>
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label="Select settlements" type="checkbox" /></th><th className="freeze-col">Settlement No.</th><th>Employee</th><th>Last Working Date</th><th>EOSB</th><th>Total Earnings</th><th>Total Deductions</th><th>Net Settlement</th><th>Status</th><th>Payment Date</th><th>Actions</th></tr></thead>
          <tbody>
            {settlements.map((row) => (
              <tr key={row.id}>
                <td><input aria-label={`Select ${row.settlementNumber}`} type="checkbox" /></td>
                <td className="freeze-col">{row.settlementNumber}</td>
                <td>{row.employee.employeeCode} - {row.employee.firstName} {row.employee.lastName}</td>
                <td>{new Date(row.lastWorkingDate).toLocaleDateString()}</td>
                <td>{row.endOfServiceBenefit}</td>
                <td>{row.totalEarnings}</td>
                <td>{row.totalDeductions}</td>
                <td>{row.netFinalSettlement}</td>
                <td><span className="status">{row.status}</span></td>
                <td>{row.paymentDate ? new Date(row.paymentDate).toLocaleDateString() : "-"}</td>
                <td><RowActionMenu actions={[{ label: "Print Settlement", href: `/api/backend/resignations/final-settlements/${row.id}/print` }]} /></td>
              </tr>
            ))}
            {settlements.length === 0 ? <tr><td colSpan={11}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
