import { AppraisalCreateForm, BulkAppraisalUploadForm, ManualAppraisalDecisionButtons, ManualAppraisalForm, WorkflowDecisionButtons } from "@/components/ExtendedHrmsActions";
import { PrintDocumentActions, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Employee = {
  id: string;
  employeeCode: string;
  firstName?: string;
  lastName?: string;
  employeeName?: string;
  department?: string | { name: string };
  designation?: string;
  jobTitle?: string;
  branch?: string;
  location?: string;
  reportingManager?: string;
  joiningDate?: string;
  currentBasicSalary?: number;
  currentHousingAllowance?: number;
  currentTransportAllowance?: number;
  currentOtherAllowance?: number;
  currentGrossSalary?: number;
  currentPayrollGroup?: string;
  lastAppraisalDate?: string;
  lastAppraisalAmount?: number;
  lastAppraisalPercentage?: number;
};
type EmployeeResponse = { items: Employee[] };
type Appraisal = {
  id: string;
  referenceNumber: string;
  periodCode: string;
  status: string;
  finalScore: string;
  finalRating?: string;
  publishedAt?: string;
  employee: { employeeCode: string; firstName: string; lastName: string; jobTitle: string; department: { name: string }; manager?: { firstName: string; lastName: string } };
};
type ManualAppraisal = {
  id: string;
  referenceNumber: string;
  appraisalType: string;
  effectiveDate: string;
  currentGrossSalary: string;
  salaryDifference: string;
  newGrossSalary: string;
  reason: string;
  customReason?: string;
  performanceRating?: string;
  status: string;
  currentApprover?: string;
  employee: { employeeCode: string; firstName: string; lastName: string; jobTitle: string; department: { name: string }; manager?: { firstName: string; lastName: string } };
};
type AppraisalBatch = {
  id: string;
  batchNumber: string;
  uploadFileName: string;
  numberOfEmployees: number;
  totalCurrentSalary: string;
  totalIncreaseAmount: string;
  totalNewSalary: string;
  status: string;
  currentApprover?: string;
  createdAt: string;
};

export default async function PerformanceAppraisalsPage() {
  const [appraisals, employeesResponse] = await Promise.all([
    apiFetch<Appraisal[]>("/appraisals"),
    apiFetch<EmployeeResponse | Employee[]>("/employees?pageSize=100")
  ]);
  const employees = Array.isArray(employeesResponse) ? employeesResponse : employeesResponse.items;
  const [manualAppraisals, bulkBatches, eligibleEmployees] = await Promise.all([
    apiFetch<ManualAppraisal[]>("/appraisals/manual"),
    apiFetch<AppraisalBatch[]>("/appraisals/bulk"),
    apiFetch<Employee[]>("/appraisals/eligible-employees").catch(() => employees)
  ]);

  return (
    <>
      <TableToolbar
        title="Salary Appraisal"
        count={`${appraisals.length + manualAppraisals.length} records`}
        searchPlaceholder="Search salary appraisals"
        actions={[
          { label: "New Manual Appraisal", href: "#manual-appraisal", icon: "add", primary: true },
          { label: "Bulk Upload", href: "#bulk-appraisal-upload", icon: "import" },
          { label: "Export Appraisals", href: "/api/backend/appraisals/manual/export.xlsx", icon: "export" }
        ]}
      />
      <section className="appraisal-flow">
        <div><strong>1</strong><span>Select employee</span></div>
        <div><strong>2</strong><span>Enter increase</span></div>
        <div><strong>3</strong><span>Save draft or submit</span></div>
        <div><strong>4</strong><span>Approve and apply</span></div>
      </section>
      <ManualAppraisalForm employees={eligibleEmployees} />
      <div style={{ height: 16 }} />
      <details className="appraisal-collapsible" id="bulk-appraisal-upload">
        <summary>Bulk Appraisal Upload</summary>
        <BulkAppraisalUploadForm />
      </details>
      <h2 className="section-title">Manual Appraisal Records</h2>
      <div className="table-actions-line">
        <a className="button secondary" href="/api/backend/appraisals/manual/export.csv">CSV</a>
        <a className="button secondary" href="/api/backend/appraisals/manual/export.xlsx">Excel</a>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label="Select manual appraisals" type="checkbox" /></th><th className="freeze-col">Reference</th><th>Employee</th><th>Department</th><th>Type</th><th>Effective Date</th><th>Current Salary</th><th>Increase</th><th>New Salary</th><th>Reason</th><th>Status</th><th>Approver</th><th>Actions</th></tr></thead>
          <tbody>
            {manualAppraisals.map((appraisal) => (
              <tr key={appraisal.id}>
                <td><input aria-label={`Select ${appraisal.referenceNumber}`} type="checkbox" /></td>
                <td className="freeze-col">{appraisal.referenceNumber}</td>
                <td>{appraisal.employee.employeeCode} - {appraisal.employee.firstName} {appraisal.employee.lastName}</td>
                <td>{appraisal.employee.department.name}</td>
                <td>{appraisal.appraisalType}</td>
                <td>{new Date(appraisal.effectiveDate).toLocaleDateString()}</td>
                <td>{appraisal.currentGrossSalary}</td>
                <td>{appraisal.salaryDifference}</td>
                <td>{appraisal.newGrossSalary}</td>
                <td className="compact-text">{appraisal.customReason || appraisal.reason}</td>
                <td><span className="status">{appraisal.status}</span></td>
                <td>{appraisal.currentApprover ?? "-"}</td>
                <td className="manual-action-cell">
                  <div className="manual-print-actions">
                    <a className="button secondary" href={`/api/backend/appraisals/manual/${appraisal.id}/print`}>Print</a>
                    <a className="button secondary" href={`/api/backend/appraisals/manual/${appraisal.id}/pdf`}>PDF</a>
                  </div>
                  <ManualAppraisalDecisionButtons id={appraisal.id} />
                </td>
              </tr>
            ))}
            {manualAppraisals.length === 0 ? <tr><td colSpan={13}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div style={{ height: 16 }} />
      <details className="appraisal-collapsible">
        <summary>Bulk upload batches</summary>
        <div className="table-actions-line">
          <a className="button secondary" href="/api/backend/appraisals/bulk/export.csv">CSV</a>
          <a className="button secondary" href="/api/backend/appraisals/bulk/export.xlsx">Excel</a>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Batch Number</th><th>Upload File Name</th><th>Uploaded Date</th><th>Employees</th><th>Total Current Salary</th><th>Total Increase</th><th>Total New Salary</th><th>Status</th><th>Current Approver</th></tr></thead>
            <tbody>
              {bulkBatches.map((batch) => <tr key={batch.id}><td>{batch.batchNumber}</td><td>{batch.uploadFileName}</td><td>{new Date(batch.createdAt).toLocaleDateString()}</td><td>{batch.numberOfEmployees}</td><td>{batch.totalCurrentSalary}</td><td>{batch.totalIncreaseAmount}</td><td>{batch.totalNewSalary}</td><td><span className="status">{batch.status}</span></td><td>{batch.currentApprover ?? "-"}</td></tr>)}
              {bulkBatches.length === 0 ? <tr><td colSpan={9}>No records found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </details>
      <details className="appraisal-collapsible">
        <summary>More options: performance review assignments</summary>
        <AppraisalCreateForm employees={eligibleEmployees} />
        <div style={{ height: 16 }} />
        <div className="table-actions-line">
          <a className="button secondary" href="/api/backend/appraisals/export.csv">CSV</a>
          <a className="button secondary" href="/api/backend/appraisals/export.xlsx">Excel</a>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th><input aria-label="Select appraisals" type="checkbox" /></th><th className="freeze-col">Reference</th><th>Employee</th><th>Department</th><th>Designation</th><th>Period</th><th>Manager</th><th>Status</th><th>Final Score</th><th>Final Rating</th><th>Published Date</th><th>Actions</th></tr></thead>
            <tbody>
              {appraisals.map((appraisal) => (
                <tr key={appraisal.id}>
                  <td><input aria-label={`Select ${appraisal.referenceNumber}`} type="checkbox" /></td>
                  <td className="freeze-col">{appraisal.referenceNumber}</td>
                  <td>{appraisal.employee.employeeCode} - {appraisal.employee.firstName} {appraisal.employee.lastName}</td>
                  <td>{appraisal.employee.department.name}</td>
                  <td>{appraisal.employee.jobTitle}</td>
                  <td>{appraisal.periodCode}</td>
                  <td>{appraisal.employee.manager ? `${appraisal.employee.manager.firstName} ${appraisal.employee.manager.lastName}` : "-"}</td>
                  <td><span className="status">{appraisal.status}</span></td>
                  <td>{appraisal.finalScore}</td>
                  <td>{appraisal.finalRating ?? "-"}</td>
                  <td>{appraisal.publishedAt ? new Date(appraisal.publishedAt).toLocaleDateString() : "-"}</td>
                  <td>
                    <PrintDocumentActions module="appraisals" id={appraisal.id} />
                    <WorkflowDecisionButtons modulePath="appraisals" id={appraisal.id} canPublish />
                  </td>
                </tr>
              ))}
              {appraisals.length === 0 ? <tr><td colSpan={12}>No records found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
