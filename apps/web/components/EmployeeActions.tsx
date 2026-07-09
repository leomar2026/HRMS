"use client";

import { Send, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AutoSaveDraft, SaveButtonGroup } from "./SaveControls";
import { AttachmentManager } from "./AttachmentManager";

type Contact = {
  email: string;
  phone?: string;
  emergencyContact?: string;
  address?: string;
};

type RelieverOption = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  branch?: string;
  location?: string;
  department: { name: string };
  manager?: { firstName: string; lastName: string } | null;
};

export function ContactForm({ employee }: { employee: Contact }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    const intent = formData.get("intent");
    if (intent === "draft") {
      const response = await fetch("/api/backend/drafts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: "Employee Contact", draftKey: "employee-contact", data: Object.fromEntries(formData.entries()) })
      });
      setMessage(response.ok ? "Draft Saved" : "Save Failed");
      return;
    }
    const response = await fetch("/api/backend/employee/me/contact", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        phone: formData.get("phone"),
        emergencyContact: formData.get("emergencyContact"),
        address: formData.get("address")
      })
    });

    setMessage(response.ok ? "Contact details updated." : "Update failed.");
    router.refresh();
    if (intent === "addAnother") router.push("/employee/profile");
  }

  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" defaultValue={employee.email} required />
        </label>
        <label className="field">
          <span>Mobile number</span>
          <input name="phone" defaultValue={employee.phone ?? ""} required />
        </label>
        <label className="field">
          <span>Emergency contact</span>
          <input name="emergencyContact" defaultValue={employee.emergencyContact ?? ""} />
        </label>
        <label className="field">
          <span>Address</span>
          <input name="address" defaultValue={employee.address ?? ""} />
        </label>
      </div>
      <div className="actions"><Save size={18} /><SaveButtonGroup submitLabel="Save contact details" approvalLabel="Submit contact update" />{message ? <span className="status">{message}</span> : null}<AutoSaveDraft module="Employee Contact" draftKey="employee-contact" /></div>
    </form>
  );
}

export function LeaveRequestForm({ relievers = [] }: { relievers?: RelieverOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [leaveType, setLeaveType] = useState("ANNUAL");

  async function submit(formData: FormData) {
    const intent = formData.get("intent");
    if (intent === "draft") {
      const response = await fetch("/api/backend/drafts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: "Leave Request", draftKey: "employee-leave", data: Object.fromEntries(formData.entries()) })
      });
      setMessage(response.ok ? "Draft Saved" : "Save Failed");
      return;
    }
    const response = await fetch("/api/backend/employee/me/leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: formData.get("type"),
        startDate: formData.get("startDate"),
        endDate: formData.get("endDate"),
        reason: formData.get("reason"),
        contactNumber: formData.get("contactNumber"),
        leaveAddress: formData.get("leaveAddress"),
        emergencyContact: formData.get("emergencyContact"),
        attachmentName: formData.get("attachmentName")
        ,
        destinationCountry: formData.get("destinationCountry"),
        destinationCity: formData.get("destinationCity"),
        mobileWhileOnLeave: formData.get("mobileWhileOnLeave"),
        personalEmailWhileOnLeave: formData.get("personalEmailWhileOnLeave"),
        emergencyContactName: formData.get("emergencyContactName"),
        emergencyContactNumber: formData.get("emergencyContactNumber"),
        emergencyContactRelationship: formData.get("emergencyContactRelationship"),
        lastWorkingDay: formData.get("lastWorkingDay"),
        returnToWorkDate: formData.get("returnToWorkDate"),
        relieverId: formData.get("relieverId"),
        handoverRequired: formData.get("handoverRequired") === "on",
        handoverDetails: formData.get("handoverDetails"),
        handoverAttachment: formData.get("handoverAttachment"),
        annualVacationRemarks: formData.get("annualVacationRemarks"),
        attachments: [
          { type: formData.get("attachmentType") || "Vacation supporting document", name: formData.get("attachmentName") || formData.get("handoverAttachment") || "" }
        ].filter((attachment) => attachment.name)
      })
    });

    setMessage(response.ok ? "Leave request submitted." : "Submission failed.");
    router.refresh();
    if (response.ok && intent === "addAnother") router.push("/employee/leaves");
  }

  return (
    <form action={submit} className="form-panel grid">
      <div className="form-grid">
        <label className="field">
          <span>Leave type</span>
          <select name="type" value={leaveType} onChange={(event) => setLeaveType(event.target.value)}>
            <option value="ANNUAL">Annual leave</option>
            <option value="SICK">Sick leave</option>
            <option value="EMERGENCY">Emergency leave</option>
            <option value="UNPAID">Unpaid leave</option>
            <option value="MATERNITY">Maternity leave</option>
            <option value="PATERNITY">Paternity leave</option>
            <option value="HAJJ">Hajj leave</option>
            <option value="MARRIAGE">Marriage leave</option>
            <option value="BEREAVEMENT">Bereavement leave</option>
            <option value="COMPENSATORY">Compensatory leave</option>
            <option value="CUSTOM">Other HR-configured leave</option>
          </select>
        </label>
        <label className="field">
          <span>Start date</span>
          <input name="startDate" type="date" required />
        </label>
        <label className="field">
          <span>End date</span>
          <input name="endDate" type="date" required />
        </label>
        <label className="field">
          <span>Contact during leave</span>
          <input name="contactNumber" />
        </label>
        <label className="field">
          <span>Emergency contact</span>
          <input name="emergencyContact" />
        </label>
        <label className="field attachment-field">
          <span>Attachment</span>
          <AttachmentManager relatedModule="LeaveRequest" attachmentType="Leave supporting document" required={leaveType === "ANNUAL"} compact />
        </label>
      </div>
      {leaveType === "ANNUAL" ? (
        <>
          <div className="form-grid">
            <label className="field"><span>Last working day</span><input name="lastWorkingDay" type="date" required /></label>
            <label className="field"><span>Return to work date</span><input name="returnToWorkDate" type="date" required /></label>
            <label className="field"><span>Vacation destination country</span><input name="destinationCountry" required /></label>
            <label className="field"><span>Vacation destination city</span><input name="destinationCity" required /></label>
            <label className="field"><span>Mobile while on leave</span><input name="mobileWhileOnLeave" required /></label>
            <label className="field"><span>Personal email while on leave</span><input name="personalEmailWhileOnLeave" type="email" /></label>
            <label className="field"><span>Emergency contact name</span><input name="emergencyContactName" required /></label>
            <label className="field"><span>Emergency contact number</span><input name="emergencyContactNumber" required /></label>
            <label className="field"><span>Emergency relationship</span><input name="emergencyContactRelationship" required /></label>
            <label className="field">
              <span>Reliever</span>
              <select name="relieverId" required>
                <option value="">Select active employee</option>
                {relievers.map((reliever) => <option key={reliever.id} value={reliever.id}>{reliever.employeeCode} - {reliever.firstName} {reliever.lastName} / {reliever.department.name} / {reliever.jobTitle}</option>)}
              </select>
            </label>
            <label className="field"><span>Attachment type</span><select name="attachmentType"><option>Vacation request supporting document</option><option>Travel document</option><option>Handover document</option><option>Other supporting attachment</option></select></label>
            <label className="field attachment-field"><span>Handover attachment</span><AttachmentManager relatedModule="LeaveHandover" attachmentType="Handover document" fieldName="handoverAttachment" compact /></label>
            <label className="status"><input name="handoverRequired" type="checkbox" /> Handover required</label>
          </div>
          <label className="field"><span>Handover details</span><textarea name="handoverDetails" required /></label>
          <label className="field"><span>Annual vacation remarks</span><textarea name="annualVacationRemarks" /></label>
        </>
      ) : null}
      <label className="field">
        <span>Leave address / destination</span>
        <input name="leaveAddress" />
      </label>
      <label className="field">
        <span>Reason</span>
        <textarea name="reason" />
      </label>
      <div className="actions"><Send size={18} /><SaveButtonGroup submitLabel="Save leave request" approvalLabel="Submit leave request" />{message ? <span className="status">{message}</span> : null}<AutoSaveDraft module="Leave Request" draftKey="employee-leave" /></div>
    </form>
  );
}
