import { apiFetch } from "@/lib/api";

type Balance = {
  id: string;
  leaveType: string;
  leaveYear: number;
  openingBalance: string;
  accruedLeave: string;
  carriedForwardBalance: string;
  usedLeave: string;
  pendingLeave: string;
  adjustmentBalance: string;
  encashmentBalance: string;
  finalAvailableBalance: string;
  carryForwardExpiryDate?: string | null;
  updatedAt: string;
};

export default async function VacationBalancePage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const params = await searchParams;
  const balances = await apiFetch<Balance[]>(`/employee/me/vacation-balance${params.year ? `?year=${encodeURIComponent(params.year)}` : ""}`);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">My Vacation Balance</h1>
          <p className="muted">View-only leave balances, transaction totals, and expiry dates.</p>
        </div>
        <form className="actions">
          <input name="year" placeholder="Leave year" defaultValue={params.year ?? ""} />
          <button className="button" type="submit">Filter</button>
        </form>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Leave Type</th><th>Year</th><th>Opening</th><th>Accrued</th><th>Carried Forward</th><th>Used</th><th>Pending</th><th>Adjustment</th><th>Encashment</th><th>Available</th><th>Expiry Date</th><th>Last Updated</th></tr></thead>
          <tbody>
            {balances.map((balance) => (
              <tr key={balance.id}>
                <td>{balance.leaveType}</td>
                <td>{balance.leaveYear}</td>
                <td>{balance.openingBalance}</td>
                <td>{balance.accruedLeave}</td>
                <td>{balance.carriedForwardBalance}</td>
                <td>{balance.usedLeave}</td>
                <td>{balance.pendingLeave}</td>
                <td>{balance.adjustmentBalance}</td>
                <td>{balance.encashmentBalance}</td>
                <td><span className="status">{balance.finalAvailableBalance}</span></td>
                <td>{balance.carryForwardExpiryDate ? new Date(balance.carryForwardExpiryDate).toLocaleDateString() : "-"}</td>
                <td>{new Date(balance.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
