"use client";

import { Check, RotateCcw, Save, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AttachmentManager } from "./AttachmentManager";

type EmployeeOption = {
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

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

async function postJson(path: string, payload: object, method = "POST") {
  const response = await fetch(`/api/backend${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export function BusinessTripForm({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    const payload = {
      employeeId: optionalText(formData.get("employeeId")),
      tripType: formData.get("tripType"),
      purpose: formData.get("purpose"),
      destinationCountry: optionalText(formData.get("destinationCountry")),
      destinationCity: optionalText(formData.get("destinationCity")),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      travelMethod: optionalText(formData.get("travelMethod")),
      transportDetails: optionalText(formData.get("transportDetails")),
      estimatedTicketCost: formData.get("estimatedTicketCost") || 0,
      estimatedHotelCost: formData.get("estimatedHotelCost") || 0,
      estimatedDailyAllowance: formData.get("estimatedDailyAllowance") || 0,
      estimatedOtherExpenses: formData.get("estimatedOtherExpenses") || 0,
      costCenter: optionalText(formData.get("costCenter")),
      projectCode: optionalText(formData.get("projectCode")),
      clientSiteName: optionalText(formData.get("clientSiteName")),
      advanceRequired: formData.get("advanceRequired") === "on",
      requestedAdvanceAmount: formData.get("requestedAdvanceAmount") || 0,
      remarks: optionalText(formData.get("remarks")),
      attachmentName: optionalText(formData.get("attachmentName"))
    };
    const { response, data } = await postJson("/business-trips", payload);
    setMessage(response.ok ? "Trip request saved." : data.message ?? "Unable to save trip.");
    router.refresh();
  }
  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field"><span>Employee</span><select name="employeeId"><option value="">Current employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} - {employee.firstName} {employee.lastName}</option>)}</select></label>
        <label className="field"><span>Trip type</span><select name="tripType"><option>Local</option><option>International</option></select></label>
        <label className="field"><span>Purpose</span><input name="purpose" required /></label>
        <label className="field"><span>Destination country</span><input name="destinationCountry" /></label>
        <label className="field"><span>Destination city</span><input name="destinationCity" /></label>
        <label className="field"><span>Start date</span><input name="startDate" type="date" required /></label>
        <label className="field"><span>End date</span><input name="endDate" type="date" required /></label>
        <label className="field"><span>Travel method</span><input name="travelMethod" /></label>
        <label className="field"><span>Airline / transport details</span><input name="transportDetails" /></label>
        <label className="field"><span>Ticket cost</span><input name="estimatedTicketCost" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Hotel cost</span><input name="estimatedHotelCost" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Daily allowance</span><input name="estimatedDailyAllowance" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Other expenses</span><input name="estimatedOtherExpenses" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Cost center</span><input name="costCenter" /></label>
        <label className="field"><span>Project code</span><input name="projectCode" /></label>
        <label className="field"><span>Client / site</span><input name="clientSiteName" /></label>
        <label className="field"><span>Requested advance</span><input name="requestedAdvanceAmount" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field attachment-field"><span>Attachment</span><AttachmentManager relatedModule="BusinessTripRequest" attachmentType="Trip supporting document" compact /></label>
        <label className="status"><input name="advanceRequired" type="checkbox" /> Advance required</label>
      </div>
      <label className="field"><span>Remarks</span><textarea name="remarks" /></label>
      <div className="actions"><button className="button" type="submit"><Save size={16} /> Save Trip</button>{message ? <span className="status">{message}</span> : null}</div>
    </form>
  );
}

export function LoanRequestForm({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    const payload = {
      employeeId: optionalText(formData.get("employeeId")),
      loanType: formData.get("loanType"),
      requestedAmount: formData.get("requestedAmount"),
      reason: formData.get("reason"),
      requestedDisbursementDate: optionalText(formData.get("requestedDisbursementDate")),
      numberOfInstallments: formData.get("numberOfInstallments"),
      monthlyInstallmentAmount: formData.get("monthlyInstallmentAmount"),
      firstDeductionDate: optionalText(formData.get("firstDeductionDate")),
      existingLoanBalance: formData.get("existingLoanBalance") || 0,
      salaryAdvanceDeductionOption: optionalText(formData.get("salaryAdvanceDeductionOption")),
      bankName: optionalText(formData.get("bankName")),
      iban: optionalText(formData.get("iban")),
      attachmentName: optionalText(formData.get("attachmentName")),
      remarks: optionalText(formData.get("remarks"))
    };
    const { response, data } = await postJson("/loans", payload);
    setMessage(response.ok ? "Loan request saved." : data.message ?? "Unable to save loan.");
    router.refresh();
  }
  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field"><span>Employee</span><select name="employeeId"><option value="">Current employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} - {employee.firstName} {employee.lastName}</option>)}</select></label>
        <label className="field"><span>Loan type</span><select name="loanType"><option>Employee Loan</option><option>Salary Advance</option><option>Emergency Loan</option><option>Housing Loan</option><option>Medical Loan</option><option>Education Loan</option><option>Custom Loan Type</option></select></label>
        <label className="field"><span>Requested amount</span><input name="requestedAmount" type="number" min="1" step="0.01" required /></label>
        <label className="field"><span>Installments</span><input name="numberOfInstallments" type="number" min="1" defaultValue="12" required /></label>
        <label className="field"><span>Monthly installment</span><input name="monthlyInstallmentAmount" type="number" min="1" step="0.01" required /></label>
        <label className="field"><span>Requested disbursement</span><input name="requestedDisbursementDate" type="date" /></label>
        <label className="field"><span>First deduction</span><input name="firstDeductionDate" type="date" /></label>
        <label className="field"><span>Existing balance</span><input name="existingLoanBalance" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Deduction option</span><input name="salaryAdvanceDeductionOption" /></label>
        <label className="field"><span>Bank name</span><input name="bankName" /></label>
        <label className="field"><span>IBAN</span><input name="iban" /></label>
        <label className="field attachment-field"><span>Attachment</span><AttachmentManager relatedModule="EmployeeLoanRequest" attachmentType="Loan supporting document" compact /></label>
      </div>
      <label className="field"><span>Reason</span><textarea name="reason" required /></label>
      <label className="field"><span>Remarks</span><textarea name="remarks" /></label>
      <div className="actions"><button className="button" type="submit"><Save size={16} /> Save Loan</button>{message ? <span className="status">{message}</span> : null}</div>
    </form>
  );
}

export function AppraisalCreateForm({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    const payload = {
      employeeId: formData.get("employeeId"),
      periodCode: formData.get("periodCode"),
      finalScore: formData.get("finalScore") || 0,
      finalRating: optionalText(formData.get("finalRating")),
      recommendation: optionalText(formData.get("recommendation")),
      selfAssessment: { comments: optionalText(formData.get("selfComments")), kpis: [] }
    };
    const { response, data } = await postJson("/appraisals", payload);
    setMessage(response.ok ? "Appraisal assigned." : data.message ?? "Unable to assign appraisal.");
    router.refresh();
  }
  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field"><span>Employee</span><select name="employeeId" required>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} - {employee.firstName} {employee.lastName}</option>)}</select></label>
        <label className="field"><span>Appraisal period</span><input name="periodCode" placeholder="2026-ANNUAL" required /></label>
        <label className="field"><span>Initial score</span><input name="finalScore" type="number" min="0" max="5" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Initial rating</span><input name="finalRating" /></label>
      </div>
      <label className="field"><span>Employee self-assessment / notes</span><textarea name="selfComments" /></label>
      <label className="field"><span>Recommendation</span><textarea name="recommendation" /></label>
      <div className="actions"><button className="button" type="submit"><Save size={16} /> Assign Appraisal</button>{message ? <span className="status">{message}</span> : null}</div>
    </form>
  );
}

function employeeDisplay(employee: EmployeeOption) {
  return employee.employeeName || `${employee.employeeCode} - ${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim();
}

function departmentName(employee?: EmployeeOption) {
  if (!employee?.department) return "";
  return typeof employee.department === "string" ? employee.department : employee.department.name;
}

export function ManualAppraisalForm({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [method, setMethod] = useState("Percentage");
  const [salaryBase, setSalaryBase] = useState("Basic Salary");
  const [applyTo, setApplyTo] = useState("Basic Salary");
  const [percentage, setPercentage] = useState("0");
  const [amount, setAmount] = useState("0");
  const [reason, setReason] = useState("Annual Performance Appraisal");
  const selected = employees.find((employee) => employee.id === employeeId);
  const basic = Number(selected?.currentBasicSalary ?? 0);
  const housing = Number(selected?.currentHousingAllowance ?? 0);
  const transport = Number(selected?.currentTransportAllowance ?? 0);
  const other = Number(selected?.currentOtherAllowance ?? 0);
  const gross = Number(selected?.currentGrossSalary ?? basic + housing + transport + other);
  const baseValue = salaryBase === "Gross Salary" ? gross : basic;
  const increase = method === "Percentage" ? baseValue * (Number(percentage || 0) / 100) : Number(amount || 0);
  const newBasic = applyTo === "Basic Salary" || applyTo === "Gross Salary adjustment" ? basic + increase : basic;
  const newHousing = applyTo === "Housing Allowance" ? housing + increase : housing;
  const newTransport = applyTo === "Transportation Allowance" ? transport + increase : transport;
  const newOther = applyTo === "Other Allowance" || applyTo === "Custom payroll component" ? other + increase : other;
  const newGross = newBasic + newHousing + newTransport + newOther;

  async function submit(formData: FormData) {
    const payload = {
      employeeId,
      appraisalType: formData.get("appraisalType"),
      effectiveDate: formData.get("effectiveDate"),
      appraisalMethod: method,
      salaryBase,
      applyToComponent: applyTo,
      appraisalPercentage: percentage,
      appraisalAmount: increase,
      newBasicSalary: newBasic,
      newHousingAllowance: newHousing,
      newTransportAllowance: newTransport,
      newOtherAllowance: newOther,
      reason,
      customReason: optionalText(formData.get("customReason")),
      performanceRating: optionalText(formData.get("performanceRating")),
      managerRecommendation: optionalText(formData.get("managerRecommendation")),
      hrRemarks: optionalText(formData.get("hrRemarks")),
      attachmentName: optionalText(formData.get("attachmentName")),
      status: formData.get("saveAction") === "submit" ? "SUBMITTED" : "DRAFT"
    };
    const { response, data } = await postJson("/appraisals/manual", payload);
    setMessage(response.ok ? "Manual appraisal saved." : data.message ?? "Unable to save manual appraisal.");
    if (response.ok) router.refresh();
  }

  return (
    <form action={submit} className="form-panel grid" id="manual-appraisal">
      <div className="section-title">Create Manual Salary Appraisal</div>
      <div className="form-grid">
        <label className="field"><span>Employee</span><select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employeeDisplay(employee)}</option>)}</select></label>
        <label className="field"><span>Appraisal type</span><select name="appraisalType"><option>Salary Increase</option><option>Promotion</option><option>Increment</option><option>Adjustment</option><option>Allowance Change</option><option>Performance Appraisal</option><option>Special Increment</option></select></label>
        <label className="field"><span>Effective date</span><input name="effectiveDate" type="date" required /></label>
        <label className="field"><span>Appraisal method</span><select value={method} onChange={(event) => setMethod(event.target.value)}><option>Percentage</option><option>Fixed Amount</option></select></label>
      </div>
      {selected ? (
        <details className="friendly-subsection" open>
          <summary>Employee salary details loaded from database</summary>
          <div className="manual-appraisal-profile">
            {[
              ["Employee ID", selected.employeeCode],
              ["Employee Name", employeeDisplay(selected)],
              ["Department", departmentName(selected)],
              ["Designation", selected.designation ?? selected.jobTitle ?? ""],
              ["Branch", selected.branch ?? ""],
              ["Location", selected.location ?? ""],
              ["Reporting Manager", selected.reportingManager ?? ""],
              ["Joining Date", selected.joiningDate ? new Date(selected.joiningDate).toLocaleDateString() : ""],
              ["Current Basic Salary", basic.toFixed(2)],
              ["Current Housing Allowance", housing.toFixed(2)],
              ["Current Transportation Allowance", transport.toFixed(2)],
              ["Current Other Allowance", other.toFixed(2)],
              ["Current Gross Salary", gross.toFixed(2)],
              ["Current Payroll Group", selected.currentPayrollGroup ?? ""],
              ["Last Appraisal Date", selected.lastAppraisalDate ? new Date(selected.lastAppraisalDate).toLocaleDateString() : "-"],
              ["Last Appraisal Amount", Number(selected.lastAppraisalAmount ?? 0).toFixed(2)],
              ["Last Appraisal Percentage", `${Number(selected.lastAppraisalPercentage ?? 0).toFixed(2)}%`]
            ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || "-"}</strong></div>)}
          </div>
        </details>
      ) : null}
      <div className="form-grid">
        <label className="field"><span>Salary base</span><select value={salaryBase} onChange={(event) => setSalaryBase(event.target.value)}><option>Basic Salary</option><option>Gross Salary</option><option>Selected Salary Components</option></select></label>
        <label className="field"><span>Apply increase to</span><select value={applyTo} onChange={(event) => setApplyTo(event.target.value)}><option>Basic Salary</option><option>Housing Allowance</option><option>Transportation Allowance</option><option>Other Allowance</option><option>Gross Salary adjustment</option><option>Custom payroll component</option></select></label>
        <label className="field"><span>Appraisal percentage</span><input value={percentage} onChange={(event) => setPercentage(event.target.value)} type="number" min="0" step="0.01" disabled={method !== "Percentage"} /></label>
        <label className="field"><span>Appraisal amount</span><input value={method === "Fixed Amount" ? amount : increase.toFixed(2)} onChange={(event) => setAmount(event.target.value)} type="number" min="0" step="0.01" disabled={method !== "Fixed Amount"} /></label>
        <label className="field"><span>New basic salary</span><input readOnly value={newBasic.toFixed(2)} /></label>
        <label className="field"><span>New housing allowance</span><input readOnly value={newHousing.toFixed(2)} /></label>
        <label className="field"><span>New transportation allowance</span><input readOnly value={newTransport.toFixed(2)} /></label>
        <label className="field"><span>New other allowance</span><input readOnly value={newOther.toFixed(2)} /></label>
        <label className="field"><span>New gross salary</span><input readOnly value={newGross.toFixed(2)} /></label>
        <label className="field"><span>Salary difference</span><input readOnly value={(newGross - gross).toFixed(2)} /></label>
        <label className="field"><span>Reason for appraisal</span><select value={reason} onChange={(event) => setReason(event.target.value)}><option>Annual Performance Appraisal</option><option>Promotion</option><option>Salary Adjustment</option><option>Market Adjustment</option><option>Contract Renewal</option><option>Position Change</option><option>Management Decision</option><option>Correction</option><option>Special Increment</option><option>Other</option></select></label>
        <label className="field"><span>Custom reason</span><input name="customReason" required={reason === "Other"} /></label>
        <label className="field"><span>Performance rating</span><input name="performanceRating" /></label>
        <label className="field"><span>Attachment reference</span><input name="attachmentName" /></label>
      </div>
      <label className="field"><span>Manager recommendation</span><textarea name="managerRecommendation" /></label>
      <label className="field"><span>HR remarks</span><textarea name="hrRemarks" /></label>
      <div className="actions">
        <button className="button secondary" name="saveAction" value="draft" type="submit"><Save size={16} /> Save Draft</button>
        <button className="button" name="saveAction" value="submit" type="submit"><Send size={16} /> Save and Submit</button>
        {message ? <span className="status">{message}</span> : null}
      </div>
    </form>
  );
}

export function BulkAppraisalUploadForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const sample = "Employee ID,Employee Name,Department,Current Basic Salary,Current Gross Salary,Appraisal Type,Effective Date,Appraisal Method,Appraisal Percentage,Appraisal Amount,Apply To Component,New Basic Salary,New Housing Allowance,New Transportation Allowance,New Other Allowance,New Gross Salary,Reason for Appraisal,Performance Rating,Remarks\n";
  async function submit(formData: FormData) {
    const file = formData.get("file");
    const payload: { fileName: FormDataEntryValue | string; content?: FormDataEntryValue | string | null; contentBase64?: string } = { fileName: formData.get("fileName") || "bulk-appraisal.csv", content: formData.get("content") || sample };
    if (file instanceof File && file.size > 0) {
      payload.fileName = file.name;
      if (file.name.toLowerCase().endsWith(".csv")) payload.content = await file.text();
      else {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        payload.contentBase64 = btoa(binary);
        payload.content = undefined;
      }
    }
    const { response, data } = await postJson("/appraisals/bulk", payload);
    setMessage(response.ok ? "Bulk appraisal batch saved." : data.message ?? "Unable to upload bulk appraisal.");
    if (response.ok) router.refresh();
  }
  return (
    <form action={submit} className="form-panel grid" id="bulk-appraisal-upload">
      <div className="section-title">Upload Appraisal File</div>
      <div className="actions">
        <a className="button secondary" href="/api/backend/appraisals/bulk/template.csv">CSV Template</a>
        <a className="button secondary" href="/api/backend/appraisals/bulk/template.xlsx">Excel Template</a>
      </div>
      <div className="form-grid">
        <label className="field"><span>Upload file name</span><input name="fileName" defaultValue="bulk-appraisal.csv" /></label>
        <label className="field"><span>Browse bulk appraisal CSV/Excel file</span><div className="upload-browse-row"><input name="file" type="file" accept=".csv,.xlsx,.xls" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")} /><span className="muted">{fileName || "No file selected"}</span></div></label>
        <label className="field attachment-field"><span>CSV content fallback</span><textarea name="content" rows={5} defaultValue={sample} /></label>
      </div>
      <div className="actions"><button className="button" type="submit"><Save size={16} /> Save Draft Batch</button>{message ? <span className="status">{message}</span> : null}</div>
    </form>
  );
}

export function ManualAppraisalDecisionButtons({ id }: { id: string }) {
  const router = useRouter();
  const [comments, setComments] = useState("");
  const [action, setAction] = useState("HR_MANAGER_APPROVE");
  const [message, setMessage] = useState("");
  async function decide() {
    const { response, data } = await postJson(`/appraisals/manual/${id}/decision`, { action, comments: comments || undefined }, "PATCH");
    setMessage(response.ok ? "Action saved." : data.message ?? "Action failed.");
    if (response.ok) router.refresh();
  }
  return (
    <div className="manual-appraisal-actions">
      <input value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Comments" />
      <select value={action} onChange={(event) => setAction(event.target.value)} aria-label="Appraisal action">
        <option value="SUBMIT">Submit</option>
        <option value="HR_MANAGER_APPROVE">HR Manager</option>
        <option value="FINANCE_APPROVE">Finance</option>
        <option value="ADMIN_FINAL_APPROVE">Final</option>
        <option value="RETURN_FOR_CORRECTION">Return</option>
        <option value="REJECT">Reject</option>
      </select>
      <button className="button compact-save" type="button" onClick={decide}><Check size={14} /> Save</button>
      {message ? <span className="status">{message}</span> : null}
    </div>
  );
}

export function WorkflowDecisionButtons({ modulePath, id, canPublish = false }: { modulePath: string; id: string; canPublish?: boolean }) {
  const router = useRouter();
  const [comments, setComments] = useState("");
  const [message, setMessage] = useState("");
  async function decide(action: string) {
    const { response, data } = await postJson(`/${modulePath}/${id}/decision`, { action, comments: comments || undefined }, "PATCH");
    setMessage(response.ok ? "Action saved." : data.message ?? "Action failed.");
    router.refresh();
  }
  return (
    <div className="grid">
      <input value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Approval comments" />
      <div className="actions">
        <button className="button" type="button" onClick={() => decide("APPROVE")}><Check size={16} /> Approve</button>
        <button className="button warn" type="button" onClick={() => decide("RETURN_FOR_CORRECTION")}><RotateCcw size={16} /> Return</button>
        <button className="button secondary" type="button" onClick={() => decide("REJECT")}><X size={16} /> Reject</button>
        {canPublish ? <button className="button secondary" type="button" onClick={() => decide("PUBLISH")}><Send size={16} /> Publish</button> : null}
        {message ? <span className="status">{message}</span> : null}
      </div>
    </div>
  );
}

export function ResignationForm({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    const action = String(formData.get("action") ?? "save");
    const payload = {
      employeeId: optionalText(formData.get("employeeId")),
      proposedLastWorkingDate: formData.get("proposedLastWorkingDate"),
      noticePeriodRequired: formData.get("noticePeriodRequired") || 30,
      noticePeriodServed: formData.get("noticePeriodServed") || 0,
      resignationReason: formData.get("resignationReason"),
      detailedRemarks: optionalText(formData.get("detailedRemarks")),
      attachmentName: optionalText(formData.get("attachmentName")),
      employeeContactNumber: optionalText(formData.get("employeeContactNumber")),
      personalEmail: optionalText(formData.get("personalEmail")),
      forwardingAddress: optionalText(formData.get("forwardingAddress")),
      employeeConfirmed: formData.get("employeeConfirmed") === "on"
    };
    const { response, data } = await postJson("/resignations", payload);
    if (response.ok && action === "submit") {
      const decision = await postJson(`/resignations/${data.id}/decision`, { action: "SUBMIT", comments: "Submitted by employee" }, "PATCH");
      setMessage(decision.response.ok ? "Resignation submitted." : decision.data.message ?? "Saved draft, but submit failed.");
    } else {
      setMessage(response.ok ? "Resignation draft saved." : data.message ?? "Unable to save resignation.");
    }
    router.refresh();
  }
  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field"><span>Employee</span><select name="employeeId"><option value="">Current employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} - {employee.firstName} {employee.lastName}</option>)}</select></label>
        <label className="field"><span>Proposed last working date</span><input name="proposedLastWorkingDate" type="date" required /></label>
        <label className="field"><span>Notice period required</span><input name="noticePeriodRequired" type="number" min="0" defaultValue="30" /></label>
        <label className="field"><span>Notice period served</span><input name="noticePeriodServed" type="number" min="0" defaultValue="0" /></label>
        <label className="field"><span>Employee contact number</span><input name="employeeContactNumber" /></label>
        <label className="field"><span>Personal email</span><input name="personalEmail" type="email" /></label>
        <label className="field attachment-field"><span>Attachment</span><AttachmentManager relatedModule="ResignationRequest" attachmentType="Resignation document" compact /></label>
        <label className="status"><input name="employeeConfirmed" type="checkbox" required /> Employee confirmation</label>
      </div>
      <label className="field"><span>Resignation reason</span><textarea name="resignationReason" required /></label>
      <label className="field"><span>Detailed remarks</span><textarea name="detailedRemarks" /></label>
      <label className="field"><span>Forwarding address</span><textarea name="forwardingAddress" /></label>
      <div className="actions">
        <button className="button secondary" type="submit" name="action" value="save"><Save size={16} /> Save Draft</button>
        <button className="button" type="submit" name="action" value="submit"><Send size={16} /> Submit Resignation</button>
        {message ? <span className="status">{message}</span> : null}
      </div>
    </form>
  );
}

export function ClearanceActionForm({ id }: { id: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    const payload = { status: formData.get("status"), remarks: formData.get("remarks"), attachmentName: optionalText(formData.get("attachmentName")), overrideReason: optionalText(formData.get("overrideReason")) };
    const { response, data } = await postJson(`/resignations/clearance/${id}`, payload, "PATCH");
    setMessage(response.ok ? "Clearance updated." : data.message ?? "Unable to update clearance.");
    router.refresh();
  }
  return (
    <form action={submit} className="grid">
      <select name="status"><option>COMPLETED</option><option>BLOCKED</option><option>WAIVED</option></select>
      <input name="remarks" placeholder="Remarks required" required />
      <AttachmentManager relatedModule="ExitClearanceItem" attachmentType="Clearance attachment" fieldName="attachmentName" compact />
      <input name="overrideReason" placeholder="Override reason if waived" />
      <div className="actions"><button className="button" type="submit"><Check size={16} /> Save</button>{message ? <span className="status">{message}</span> : null}</div>
    </form>
  );
}

export function FinalSettlementForm({ resignationId }: { resignationId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    const payload = Object.fromEntries(formData.entries());
    const { response, data } = await postJson(`/resignations/${resignationId}/final-settlement`, payload);
    setMessage(response.ok ? "Final settlement saved." : data.message ?? "Unable to save settlement.");
    router.refresh();
  }
  return (
    <form action={submit} className="grid">
      <div className="form-grid">
        <label className="field"><span>Leave encashment</span><input name="leaveEncashment" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Pending salary</span><input name="pendingSalary" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Overtime</span><input name="overtime" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Bonus</span><input name="bonus" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Other earnings</span><input name="otherEarnings" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Loan deduction</span><input name="loanDeduction" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Salary advance deduction</span><input name="salaryAdvanceDeduction" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Absence deduction</span><input name="absenceDeduction" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Other deductions</span><input name="otherDeductions" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Payment date</span><input name="paymentDate" type="date" /></label>
        <label className="field"><span>Payment method</span><input name="paymentMethod" /></label>
        <label className="field"><span>Bank name</span><input name="bankName" /></label>
        <label className="field"><span>IBAN</span><input name="iban" /></label>
        <label className="field"><span>Override reason</span><input name="overrideReason" /></label>
      </div>
      <div className="actions"><button className="button" type="submit"><Save size={16} /> Save Settlement</button>{message ? <span className="status">{message}</span> : null}</div>
    </form>
  );
}

export function WorkflowDefinitionForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    const payload = {
      workflowCode: formData.get("workflowCode"),
      workflowName: formData.get("workflowName"),
      processType: formData.get("processType"),
      company: optionalText(formData.get("company")),
      branch: optionalText(formData.get("branch")),
      department: optionalText(formData.get("department")),
      employeeGroup: optionalText(formData.get("employeeGroup")),
      leaveType: optionalText(formData.get("leaveType")),
      amountThreshold: optionalText(formData.get("amountThreshold")),
      effectiveStartDate: optionalText(formData.get("effectiveStartDate")),
      effectiveEndDate: optionalText(formData.get("effectiveEndDate")),
      status: formData.get("status"),
      description: optionalText(formData.get("description")),
      steps: [
        { stepNumber: 1, approverType: formData.get("step1ApproverType"), approverUserOrRole: optionalText(formData.get("step1Approver")), required: true, approvalMode: "SEQUENTIAL", slaDays: formData.get("step1Sla") || 2, reminderDays: 1, finalApprovalStep: false },
        { stepNumber: 2, approverType: formData.get("step2ApproverType"), approverUserOrRole: optionalText(formData.get("step2Approver")), required: true, approvalMode: "SEQUENTIAL", slaDays: formData.get("step2Sla") || 2, reminderDays: 1, finalApprovalStep: true }
      ]
    };
    const { response, data } = await postJson("/workflows", payload);
    setMessage(response.ok ? "Workflow saved." : data.message ?? "Unable to save workflow.");
    router.refresh();
  }
  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field"><span>Workflow code</span><input name="workflowCode" required /></label>
        <label className="field"><span>Workflow name</span><input name="workflowName" required /></label>
        <label className="field"><span>Process type</span><select name="processType"><option>Leave Request</option><option>Loan Request</option><option>Business Trip Request</option><option>Resignation Request</option><option>Final Settlement</option><option>Attendance Adjustment</option><option>Appraisal / Evaluation</option><option>Payroll Approval</option></select></label>
        <label className="field"><span>Status</span><select name="status"><option>DRAFT</option><option>ACTIVE</option><option>INACTIVE</option></select></label>
        <label className="field"><span>Company</span><input name="company" /></label>
        <label className="field"><span>Branch</span><input name="branch" /></label>
        <label className="field"><span>Department</span><input name="department" /></label>
        <label className="field"><span>Employee group</span><input name="employeeGroup" /></label>
        <label className="field"><span>Leave type</span><input name="leaveType" /></label>
        <label className="field"><span>Amount threshold</span><input name="amountThreshold" type="number" min="0" step="0.01" /></label>
        <label className="field"><span>Effective start</span><input name="effectiveStartDate" type="date" /></label>
        <label className="field"><span>Effective end</span><input name="effectiveEndDate" type="date" /></label>
        <label className="field"><span>Step 1 approver type</span><select name="step1ApproverType"><option>Reporting Manager</option><option>OM</option><option>HR Manager</option><option>Finance</option><option>Admin</option><option>Role</option><option>Specific User</option></select></label>
        <label className="field"><span>Step 1 approver</span><input name="step1Approver" /></label>
        <label className="field"><span>Step 1 SLA days</span><input name="step1Sla" type="number" min="0" defaultValue="2" /></label>
        <label className="field"><span>Step 2 approver type</span><select name="step2ApproverType"><option>HR Manager</option><option>Finance</option><option>Admin</option><option>OM</option><option>Role</option><option>Specific User</option></select></label>
        <label className="field"><span>Step 2 approver</span><input name="step2Approver" /></label>
        <label className="field"><span>Step 2 SLA days</span><input name="step2Sla" type="number" min="0" defaultValue="2" /></label>
      </div>
      <label className="field"><span>Description</span><textarea name="description" /></label>
      <div className="actions"><button className="button" type="submit"><Save size={16} /> Save Workflow</button>{message ? <span className="status">{message}</span> : null}</div>
    </form>
  );
}
