import { LoanRequestForm, WorkflowDecisionButtons } from "@/components/ExtendedHrmsActions";
import { PrintDocumentActions, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Employee = { id: string; employeeCode: string; firstName: string; lastName: string };
type EmployeeResponse = { items: Employee[] };
type Loan = {
  id: string;
  requestNumber: string;
  loanType: string;
  requestedAmount: string;
  approvedAmount: string;
  numberOfInstallments: number;
  monthlyInstallmentAmount: string;
  outstandingBalance: string;
  createdAt: string;
  disbursementDate?: string;
  status: string;
  loanStatus: string;
  employee: { employeeCode: string; firstName: string; lastName: string; department?: { name: string } };
};

export default async function LoansPage() {
  const [loans, employeesResponse] = await Promise.all([
    apiFetch<Loan[]>("/loans"),
    apiFetch<EmployeeResponse | Employee[]>("/employees?pageSize=100")
  ]);
  const employees = Array.isArray(employeesResponse) ? employeesResponse : employeesResponse.items;

  return (
    <>
      <TableToolbar
        title="Loans & Advances"
        count={`${loans.length} records`}
        searchPlaceholder="Search loans"
        actions={[
          { label: "Export CSV", href: "/api/backend/loans/export.csv", icon: "export" },
          { label: "Export Excel", href: "/api/backend/loans/export.xlsx", icon: "export" }
        ]}
      />
      <LoanRequestForm employees={employees} />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label="Select loans" type="checkbox" /></th><th className="freeze-col">Loan Request Number</th><th>Employee</th><th>Loan Type</th><th>Requested</th><th>Approved</th><th>Installments</th><th>Monthly Deduction</th><th>Outstanding</th><th>Request Date</th><th>Disbursement</th><th>Approval Status</th><th>Loan Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loans.map((loan) => (
              <tr key={loan.id}>
                <td><input aria-label={`Select ${loan.requestNumber}`} type="checkbox" /></td>
                <td className="freeze-col">{loan.requestNumber}</td>
                <td>{loan.employee.employeeCode} - {loan.employee.firstName} {loan.employee.lastName}</td>
                <td>{loan.loanType}</td>
                <td>{loan.requestedAmount}</td>
                <td>{loan.approvedAmount}</td>
                <td>{loan.numberOfInstallments}</td>
                <td>{loan.monthlyInstallmentAmount}</td>
                <td>{loan.outstandingBalance}</td>
                <td>{new Date(loan.createdAt).toLocaleDateString()}</td>
                <td>{loan.disbursementDate ? new Date(loan.disbursementDate).toLocaleDateString() : "-"}</td>
                <td><span className="status">{loan.status}</span></td>
                <td>{loan.loanStatus}</td>
                <td>
                  <PrintDocumentActions module="loans" id={loan.id} />
                  <WorkflowDecisionButtons modulePath="loans" id={loan.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
