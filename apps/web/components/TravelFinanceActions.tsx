"use client";

import { Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AttachmentManager } from "./AttachmentManager";

type LeaveOption = { id: string; requestNumber: string; startDate: string; endDate: string; returnToWorkDate?: string; destinationCountry?: string; destinationCity?: string; status: string };

async function postJson(path: string, payload: object, method = "POST") {
  const response = await fetch(`/api/backend${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

export function TicketRequestForm({ leaves }: { leaves: LeaveOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    const payload = {
      leaveRequestId: formData.get("leaveRequestId"),
      departureCountry: optionalText(formData.get("departureCountry")),
      departureCity: optionalText(formData.get("departureCity")),
      arrivalCountry: formData.get("arrivalCountry"),
      arrivalCity: formData.get("arrivalCity"),
      preferredDepartureDate: formData.get("preferredDepartureDate"),
      preferredReturnDate: optionalText(formData.get("preferredReturnDate")),
      preferredAirline: optionalText(formData.get("preferredAirline")),
      preferredFlightTime: optionalText(formData.get("preferredFlightTime")),
      passportNumber: optionalText(formData.get("passportNumber")),
      passportExpiryDate: optionalText(formData.get("passportExpiryDate")),
      iqamaNumber: optionalText(formData.get("iqamaNumber")),
      iqamaExpiryDate: optionalText(formData.get("iqamaExpiryDate")),
      visaRequirement: optionalText(formData.get("visaRequirement")),
      travelClass: optionalText(formData.get("travelClass")),
      ticketType: formData.get("ticketType"),
      familyTicketRequired: formData.get("familyTicketRequired") === "on",
      familyMemberDetails: { details: optionalText(formData.get("familyMemberDetails")) },
      estimatedTicketCost: formData.get("estimatedTicketCost") || 0,
      costCenter: optionalText(formData.get("costCenter")),
      projectCode: optionalText(formData.get("projectCode")),
      remarks: optionalText(formData.get("remarks")),
      attachments: [{ type: formData.get("attachmentType"), name: formData.get("attachmentName") }]
    };
    const { response, data } = await postJson("/ticket-requests", payload);
    setMessage(response.ok ? "Ticket request saved." : data.message ?? "Unable to save ticket request.");
    router.refresh();
  }
  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field"><span>Linked annual leave</span><select name="leaveRequestId" required><option value="">Select leave</option>{leaves.map((leave) => <option key={leave.id} value={leave.id}>{leave.requestNumber} - {new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()} ({leave.status})</option>)}</select></label>
        <label className="field"><span>Departure country</span><input name="departureCountry" /></label>
        <label className="field"><span>Departure city</span><input name="departureCity" /></label>
        <label className="field"><span>Arrival country</span><input name="arrivalCountry" required /></label>
        <label className="field"><span>Arrival city</span><input name="arrivalCity" required /></label>
        <label className="field"><span>Preferred departure date</span><input name="preferredDepartureDate" type="date" required /></label>
        <label className="field"><span>Preferred return date</span><input name="preferredReturnDate" type="date" /></label>
        <label className="field"><span>Preferred airline</span><input name="preferredAirline" /></label>
        <label className="field"><span>Preferred flight time</span><input name="preferredFlightTime" /></label>
        <label className="field"><span>Passport number</span><input name="passportNumber" /></label>
        <label className="field"><span>Passport expiry</span><input name="passportExpiryDate" type="date" /></label>
        <label className="field"><span>Iqama number</span><input name="iqamaNumber" /></label>
        <label className="field"><span>Iqama expiry</span><input name="iqamaExpiryDate" type="date" /></label>
        <label className="field"><span>Visa requirement</span><input name="visaRequirement" /></label>
        <label className="field"><span>Travel class</span><select name="travelClass"><option>Economy</option><option>Business</option><option>First</option></select></label>
        <label className="field"><span>Ticket type</span><select name="ticketType"><option value="RETURN">Return</option><option value="ONE_WAY">One Way</option></select></label>
        <label className="field"><span>Estimated ticket cost</span><input name="estimatedTicketCost" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="field"><span>Cost center</span><input name="costCenter" /></label>
        <label className="field"><span>Project code</span><input name="projectCode" /></label>
        <label className="field"><span>Attachment type</span><select name="attachmentType"><option>Passport copy</option><option>Iqama copy</option><option>Visa copy</option><option>Leave request reference</option><option>Other travel document</option></select></label>
        <label className="field attachment-field"><span>Attachment</span><AttachmentManager relatedModule="TicketRequest" attachmentType="Travel document" required compact /></label>
        <label className="status"><input name="familyTicketRequired" type="checkbox" /> Family ticket required</label>
      </div>
      <label className="field"><span>Family member details</span><textarea name="familyMemberDetails" /></label>
      <label className="field"><span>Remarks</span><textarea name="remarks" /></label>
      <div className="actions"><Save size={16} /><button className="button" type="submit"><Send size={16} /> Save Ticket Request</button>{message ? <span className="status">{message}</span> : null}</div>
    </form>
  );
}

export function PettyCashRequestForm({ leaves }: { leaves: LeaveOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    const payload = {
      requestType: formData.get("requestType"),
      purpose: formData.get("purpose"),
      businessTripReference: optionalText(formData.get("businessTripReference")),
      linkedLeaveRequestId: optionalText(formData.get("linkedLeaveRequestId")),
      costCenter: optionalText(formData.get("costCenter")),
      projectCode: optionalText(formData.get("projectCode")),
      requestedAmount: formData.get("requestedAmount"),
      currency: formData.get("currency"),
      exchangeRate: formData.get("exchangeRate") || 1,
      requiredDate: formData.get("requiredDate"),
      paymentMethod: optionalText(formData.get("paymentMethod")),
      bankName: optionalText(formData.get("bankName")),
      iban: optionalText(formData.get("iban")),
      cashCollectionLocation: optionalText(formData.get("cashCollectionLocation")),
      detailedJustification: formData.get("detailedJustification"),
      remarks: optionalText(formData.get("remarks")),
      attachments: [{ type: formData.get("attachmentType"), name: formData.get("attachmentName") }]
    };
    const { response, data } = await postJson("/petty-cash", payload);
    setMessage(response.ok ? "Petty cash request saved." : data.message ?? "Unable to save petty cash request.");
    router.refresh();
  }
  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field"><span>Request type</span><select name="requestType"><option>Office Expense</option><option>Site Expense</option><option>Emergency Purchase</option><option>Travel Expense</option><option>Business Trip Advance</option><option>Employee Reimbursement</option><option>Other</option></select></label>
        <label className="field"><span>Purpose</span><input name="purpose" required /></label>
        <label className="field"><span>Business trip reference</span><input name="businessTripReference" /></label>
        <label className="field"><span>Linked leave request</span><select name="linkedLeaveRequestId"><option value="">None</option>{leaves.map((leave) => <option key={leave.id} value={leave.id}>{leave.requestNumber}</option>)}</select></label>
        <label className="field"><span>Cost center</span><input name="costCenter" /></label>
        <label className="field"><span>Project code</span><input name="projectCode" /></label>
        <label className="field"><span>Requested amount</span><input name="requestedAmount" type="number" min="1" step="0.01" required /></label>
        <label className="field"><span>Currency</span><input name="currency" defaultValue="SAR" required /></label>
        <label className="field"><span>Exchange rate</span><input name="exchangeRate" type="number" min="0.0001" step="0.0001" defaultValue="1" /></label>
        <label className="field"><span>Required date</span><input name="requiredDate" type="date" required /></label>
        <label className="field"><span>Payment method</span><select name="paymentMethod"><option>Cash</option><option>Bank Transfer</option></select></label>
        <label className="field"><span>Bank name</span><input name="bankName" /></label>
        <label className="field"><span>IBAN</span><input name="iban" /></label>
        <label className="field"><span>Cash collection location</span><input name="cashCollectionLocation" /></label>
        <label className="field"><span>Attachment type</span><select name="attachmentType"><option>Quotation</option><option>Receipt</option><option>Justification</option><option>Invoice</option><option>Supporting document</option></select></label>
        <label className="field attachment-field"><span>Attachment</span><AttachmentManager relatedModule="PettyCashRequest" attachmentType="Supporting document" required compact /></label>
      </div>
      <label className="field"><span>Detailed justification</span><textarea name="detailedJustification" required /></label>
      <label className="field"><span>Remarks</span><textarea name="remarks" /></label>
      <div className="actions"><Save size={16} /><button className="button" type="submit"><Send size={16} /> Save Petty Cash</button>{message ? <span className="status">{message}</span> : null}</div>
    </form>
  );
}
