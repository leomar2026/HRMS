import { LoanRequestForm, WorkflowDecisionButtons } from "@/components/ExtendedHrmsActions";
import { PrintDocumentActions, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Loan = { id: string; requestNumber: string; loanType: string; requestedAmount: string; approvedAmount: string; numberOfInstallments: number; monthlyInstallmentAmount: string; outstandingBalance: string; status: string; createdAt: string; employee: { employeeCode: string; firstName: string; lastName: string } };

export default async function EmployeeLoansPage() {
  const loans = await apiFetch<Loan[]>("/loans");
  return (
    <>
      <TableToolbar title="My Loan Requests" count={`${loans.length} records`} searchPlaceholder="Search my loans" actions={[]} />
      <LoanRequestForm employees={[]} />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Request No.</th><th>Type</th><th>Requested</th><th>Approved</th><th>Installments</th><th>Monthly</th><th>Outstanding</th><th>Status</th><th>Request Date</th><th>Actions</th></tr></thead>
          <tbody>
            {loans.map((loan) => <tr key={loan.id}><td>{loan.requestNumber}</td><td>{loan.loanType}</td><td>{loan.requestedAmount}</td><td>{loan.approvedAmount}</td><td>{loan.numberOfInstallments}</td><td>{loan.monthlyInstallmentAmount}</td><td>{loan.outstandingBalance}</td><td><span className="status">{loan.status}</span></td><td>{new Date(loan.createdAt).toLocaleDateString()}</td><td><PrintDocumentActions module="loans" id={loan.id} /><WorkflowDecisionButtons modulePath="loans" id={loan.id} /></td></tr>)}
            {loans.length === 0 ? <tr><td colSpan={10}>No loan records found for this employee.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
