import PDFDocument from "pdfkit";
import { Role } from "@prisma/client";
import { Router, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { audit } from "../utils/audit.js";
import { companyPrintHeader, getCurrentCompanyProfile } from "../utils/companyProfile.js";

const router = Router();

type DocumentRecord = {
  id: string;
  number: string;
  title: string;
  employeeId?: string | null;
  employeeCode?: string;
  employeeName?: string;
  status?: string;
  fields: Array<[string, unknown]>;
  timeline?: unknown;
  attachments?: unknown;
};

const privilegedRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR, Role.FINANCE, Role.ACCOUNTANT, Role.PAYROLL_OFFICER, Role.DEPARTMENT_MANAGER, Role.OPERATIONS_MANAGER, Role.AUDITOR];

router.use(requireAuth);

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function canPrint(req: Express.Request, record: DocumentRecord) {
  if (privilegedRoles.includes(req.user?.role as Role)) return true;
  if (req.user?.role === Role.EMPLOYEE) return !record.employeeId || record.employeeId === req.user.employeeId;
  return false;
}

function htmlEscape(value: unknown) {
  return text(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}

async function loadRecord(module: string, id: string): Promise<DocumentRecord | null> {
  switch (module) {
    case "employees": {
      const row = await prisma.employee.findUnique({ where: { id }, include: { department: true, manager: true, documents: true } });
      if (!row) return null;
      return {
        id: row.id,
        number: row.employeeCode,
        title: "Employee Profile",
        employeeId: row.id,
        employeeCode: row.employeeCode,
        employeeName: `${row.firstName} ${row.lastName}`,
        status: row.status,
        attachments: row.documents,
        fields: [["Employee ID", row.employeeCode], ["Name", `${row.firstName} ${row.lastName}`], ["Department", row.department.name], ["Designation", row.jobTitle], ["Branch", row.branch], ["Location", row.location], ["Manager", row.manager ? `${row.manager.firstName} ${row.manager.lastName}` : ""], ["Email", row.email], ["Mobile", row.phone], ["Joining Date", row.joiningDate]]
      };
    }
    case "leaves": {
      const row = await prisma.leaveRequest.findUnique({ where: { id }, include: { employee: { include: { department: true, manager: true } }, approvalHistory: true } });
      if (!row) return null;
      return {
        id: row.id,
        number: row.requestNumber,
        title: row.type === "ANNUAL" ? "Annual Vacation Leave Form" : "Leave Request Form",
        employeeId: row.employeeId,
        employeeCode: row.employee.employeeCode,
        employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
        status: row.workflowStage,
        timeline: row.approvalHistory,
        attachments: row.attachments ?? row.attachmentName,
        fields: [["Leave Request No.", row.requestNumber], ["Employee", `${row.employee.employeeCode} - ${row.employee.firstName} ${row.employee.lastName}`], ["Department", row.employee.department.name], ["Designation", row.employee.jobTitle], ["Branch", row.employee.branch], ["Manager", row.employee.manager ? `${row.employee.manager.firstName} ${row.employee.manager.lastName}` : ""], ["Leave Type", row.type], ["Start Date", row.startDate], ["End Date", row.endDate], ["Total Days", row.days], ["Last Working Day", row.lastWorkingDay], ["Return to Work Date", row.returnToWorkDate], ["Destination", [row.destinationCity, row.destinationCountry].filter(Boolean).join(", ")], ["Reliever", row.relieverName], ["Handover", row.handoverDetails], ["Status", row.workflowStage]]
      };
    }
    case "ticket-requests": {
      const row = await prisma.ticketRequest.findUnique({ where: { id }, include: { employee: { include: { department: true } }, leaveRequest: true } });
      if (!row) return null;
      return {
        id: row.id,
        number: row.requestNumber,
        title: "Ticket Request Form",
        employeeId: row.employeeId,
        employeeCode: row.employee.employeeCode,
        employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
        status: row.status,
        timeline: row.approvalTimeline,
        attachments: row.attachments,
        fields: [["Ticket Request No.", row.requestNumber], ["Linked Leave", row.leaveRequest.requestNumber], ["Employee", `${row.employee.employeeCode} - ${row.employee.firstName} ${row.employee.lastName}`], ["Department", row.employee.department.name], ["Destination", `${row.arrivalCity}, ${row.arrivalCountry}`], ["Departure Date", row.preferredDepartureDate], ["Return Date", row.preferredReturnDate], ["Ticket Type", row.ticketType], ["Estimated Cost", row.estimatedTicketCost], ["Booking Reference", row.bookingReference], ["Status", row.status]]
      };
    }
    case "business-trips": {
      const row = await prisma.businessTripRequest.findUnique({ where: { id }, include: { employee: { include: { department: true, manager: true } } } });
      if (!row) return null;
      return { id: row.id, number: row.requestNumber, title: "Business Trip Request Form", employeeId: row.employeeId, employeeCode: row.employee.employeeCode, employeeName: `${row.employee.firstName} ${row.employee.lastName}`, status: row.status, timeline: row.approvalTimeline, attachments: row.attachmentName, fields: [["Request No.", row.requestNumber], ["Employee", `${row.employee.employeeCode} - ${row.employee.firstName} ${row.employee.lastName}`], ["Department", row.employee.department.name], ["Purpose", row.purpose], ["Destination", [row.destinationCity, row.destinationCountry].filter(Boolean).join(", ")], ["Start Date", row.startDate], ["End Date", row.endDate], ["Total Days", row.totalDays], ["Estimated Cost", row.totalEstimatedCost], ["Advance", row.requestedAdvanceAmount], ["Status", row.status]] };
    }
    case "loans": {
      const row = await prisma.employeeLoanRequest.findUnique({ where: { id }, include: { employee: { include: { department: true } }, repaymentSchedule: true } });
      if (!row) return null;
      return { id: row.id, number: row.requestNumber, title: "Loan Agreement", employeeId: row.employeeId, employeeCode: row.employee.employeeCode, employeeName: `${row.employee.firstName} ${row.employee.lastName}`, status: row.status, timeline: row.approvalTimeline, attachments: row.attachmentName, fields: [["Request No.", row.requestNumber], ["Employee", `${row.employee.employeeCode} - ${row.employee.firstName} ${row.employee.lastName}`], ["Department", row.employee.department.name], ["Loan Type", row.loanType], ["Requested Amount", row.requestedAmount], ["Approved Amount", row.approvedAmount], ["Installments", row.numberOfInstallments], ["Monthly Deduction", row.monthlyInstallmentAmount], ["Outstanding", row.outstandingBalance], ["Status", row.status]] };
    }
    case "petty-cash": {
      const row = await prisma.pettyCashRequest.findUnique({ where: { id }, include: { employee: { include: { department: true } }, linkedLeaveRequest: true } });
      if (!row) return null;
      return { id: row.id, number: row.requestNumber, title: "Petty Cash Request Form", employeeId: row.employeeId, employeeCode: row.employee.employeeCode, employeeName: `${row.employee.firstName} ${row.employee.lastName}`, status: row.status, timeline: row.approvalTimeline, attachments: row.attachments, fields: [["Request No.", row.requestNumber], ["Employee", `${row.employee.employeeCode} - ${row.employee.firstName} ${row.employee.lastName}`], ["Department", row.employee.department.name], ["Request Type", row.requestType], ["Purpose", row.purpose], ["Linked Reference", row.businessTripReference ?? row.linkedLeaveRequest?.requestNumber], ["Requested", row.requestedAmount], ["Approved", row.approvedAmount], ["Paid", row.paidAmount], ["Settled", row.settledAmount], ["Outstanding", row.outstandingAmount], ["Status", row.status]] };
    }
    case "resignations": {
      const row = await prisma.resignationRequest.findUnique({ where: { id }, include: { employee: { include: { department: true, manager: true } }, clearanceItems: true, finalSettlement: true } });
      if (!row) return null;
      return { id: row.id, number: row.requestNumber, title: "Resignation Acknowledgement Letter", employeeId: row.employeeId, employeeCode: row.employee.employeeCode, employeeName: `${row.employee.firstName} ${row.employee.lastName}`, status: row.status, timeline: row.approvalTimeline, attachments: row.attachmentName, fields: [["Request No.", row.requestNumber], ["Employee", `${row.employee.employeeCode} - ${row.employee.firstName} ${row.employee.lastName}`], ["Department", row.employee.department.name], ["Designation", row.employee.jobTitle], ["Manager", row.employee.manager ? `${row.employee.manager.firstName} ${row.employee.manager.lastName}` : ""], ["Proposed Last Working Date", row.proposedLastWorkingDate], ["Notice Required", row.noticePeriodRequired], ["Notice Served", row.noticePeriodServed], ["Reason", row.resignationReason], ["Status", row.status]] };
    }
    case "appraisals": {
      const row = await prisma.performanceAppraisal.findUnique({ where: { id }, include: { employee: { include: { department: true, manager: true } } } });
      if (!row) return null;
      return { id: row.id, number: row.referenceNumber, title: "Performance Appraisal", employeeId: row.employeeId, employeeCode: row.employee.employeeCode, employeeName: `${row.employee.firstName} ${row.employee.lastName}`, status: row.status, timeline: row.approvalTimeline, fields: [["Reference", row.referenceNumber], ["Employee", `${row.employee.employeeCode} - ${row.employee.firstName} ${row.employee.lastName}`], ["Department", row.employee.department.name], ["Period", row.periodCode], ["Final Score", row.finalScore], ["Final Rating", row.finalRating], ["Recommendation", row.recommendation], ["Status", row.status]] };
    }
    case "departments": {
      const row = await prisma.department.findUnique({ where: { id }, include: { _count: { select: { employees: true } } } });
      if (!row) return null;
      return { id: row.id, number: row.code, title: "Department Master Details", status: "ACTIVE", fields: [["Code", row.code], ["Name", row.name], ["Employees", row._count.employees], ["Status", "ACTIVE"]] };
    }
    default:
      return null;
  }
}

function renderHtml(company: Awaited<ReturnType<typeof getCurrentCompanyProfile>>, record: DocumentRecord, printedBy?: string, mode = "preview") {
  const rows = record.fields.map(([label, value]) => `<tr><td>${htmlEscape(label)}</td><td>${htmlEscape(value)}</td></tr>`).join("");
  const timeline = record.timeline ? `<h2>Approval Timeline</h2><pre>${htmlEscape(record.timeline)}</pre>` : "";
  const attachments = record.attachments ? `<h2>Attachments</h2><pre>${htmlEscape(record.attachments)}</pre>` : "";
  const actions = mode === "preview" ? `<div class="screen-actions"><button onclick="window.print()">Print</button><a href="./pdf">Download PDF</a><a href="./email">Email Document</a><a href="./history">Reprint History</a></div>` : "";
  return `<!doctype html><html><head><title>${htmlEscape(record.title)} ${htmlEscape(record.number)}</title><style>@page{size:A4 portrait;margin:12mm}body{font-family:Arial,sans-serif;font-size:12px;margin:24px;color:#111}html[dir=rtl] body{direction:rtl}.head{border-bottom:2px solid #0f766e;margin-bottom:16px;padding-bottom:10px}.brand-line{display:flex;gap:14px;align-items:center}.brand-line img{max-width:110px;max-height:60px}h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:14px 0 8px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #d1d5db;padding:6px;text-align:left;vertical-align:top}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}.box{border:1px solid #d1d5db;padding:6px}.signature{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:32px}.sig{border-top:1px solid #111;padding-top:6px;text-align:center}.screen-actions{display:flex;gap:8px;margin:12px 0}.screen-actions a,.screen-actions button{border:1px solid #aaa;background:#f8fafc;padding:6px 10px;text-decoration:none;color:#111;border-radius:4px}@media print{.screen-actions{display:none}}</style></head><body>${companyPrintHeader(company, record.title)}${actions}<div class="meta"><div class="box">Document No.<br><strong>${htmlEscape(record.number)}</strong></div><div class="box">Status<br><strong>${htmlEscape(record.status)}</strong></div><div class="box">Printed By<br><strong>${htmlEscape(printedBy)}</strong></div><div class="box">Print Date<br><strong>${new Date().toLocaleString()}</strong></div></div><table><tbody>${rows}</tbody></table>${timeline}${attachments}<div class="signature"><div class="sig">Employee Signature</div><div class="sig">Manager Signature</div><div class="sig">HR / Finance Signature</div><div class="sig">Authorized Signatory / Stamp</div></div></body></html>`;
}

function renderPdf(res: Response, company: Awaited<ReturnType<typeof getCurrentCompanyProfile>>, record: DocumentRecord, printedBy?: string) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  res.header("Content-Type", "application/pdf");
  res.attachment(`${record.number}-${record.title.replace(/\s+/g, "-")}.pdf`);
  doc.pipe(res);
  doc.fontSize(16).text(company.companyName ?? "Company", { align: "left" });
  doc.fontSize(12).text(`${company.address ?? ""} ${company.city ?? ""} ${company.country ?? ""}`);
  doc.moveDown();
  doc.fontSize(15).text(record.title, { underline: true });
  doc.fontSize(10).text(`Document No: ${record.number} | Status: ${record.status ?? "-"} | Printed By: ${printedBy ?? "-"} | Print Date: ${new Date().toLocaleString()}`);
  doc.moveDown();
  record.fields.forEach(([label, value]) => doc.fontSize(10).text(`${label}: ${text(value)}`));
  if (record.timeline) {
    doc.moveDown().fontSize(12).text("Approval Timeline", { underline: true });
    doc.fontSize(9).text(text(record.timeline));
  }
  if (record.attachments) {
    doc.moveDown().fontSize(12).text("Attachments", { underline: true });
    doc.fontSize(9).text(text(record.attachments));
  }
  doc.moveDown(3).fontSize(10).text("Employee Signature        Manager Signature        HR/Finance Signature        Authorized Signatory", { align: "center" });
  doc.end();
}

router.get("/:module/:id/preview", async (req, res, next) => {
  try {
    const record = await loadRecord(String(req.params.module), String(req.params.id));
    if (!record) throw new AppError(404, "Document not found");
    if (!canPrint(req, record)) throw new AppError(403, "Insufficient permissions");
    const company = await getCurrentCompanyProfile();
    await audit(req, "PRINT_PREVIEW", "PrintDocument", record.id, { module: req.params.module, recordNumber: record.number, documentType: record.title });
    res.header("Content-Type", "text/html");
    res.send(renderHtml(company, record, req.user?.email));
  } catch (error) {
    next(error);
  }
});

router.get("/:module/:id/pdf", async (req, res, next) => {
  try {
    const record = await loadRecord(String(req.params.module), String(req.params.id));
    if (!record) throw new AppError(404, "Document not found");
    if (!canPrint(req, record)) throw new AppError(403, "Insufficient permissions");
    await audit(req, "PDF_DOWNLOAD", "PrintDocument", record.id, { module: req.params.module, recordNumber: record.number, documentType: record.title, exportFormat: "PDF" });
    renderPdf(res, await getCurrentCompanyProfile(), record, req.user?.email);
  } catch (error) {
    next(error);
  }
});

router.get("/:module/:id/email", async (req, res, next) => {
  try {
    const record = await loadRecord(String(req.params.module), String(req.params.id));
    if (!record) throw new AppError(404, "Document not found");
    if (!canPrint(req, record)) throw new AppError(403, "Insufficient permissions");
    await prisma.emailLog.create({
      data: {
        notificationKey: `DOC-${record.id}-${Date.now()}`,
        recipient: req.user?.email ?? "preview@company.local",
        subject: `${record.title} ${record.number}`,
        templateCode: "DOCUMENT_EMAIL",
        status: "QUEUED",
        payload: { module: req.params.module, recordId: record.id, recordNumber: record.number }
      }
    });
    await audit(req, "EMAIL_DOCUMENT", "PrintDocument", record.id, { module: req.params.module, recordNumber: record.number, documentType: record.title });
    res.json({ ok: true, message: "Document email queued." });
  } catch (error) {
    next(error);
  }
});

router.get("/:module/:id/history", async (req, res, next) => {
  try {
    const record = await loadRecord(String(req.params.module), String(req.params.id));
    if (!record) throw new AppError(404, "Document not found");
    if (!canPrint(req, record)) throw new AppError(403, "Insufficient permissions");
    const history = await prisma.auditLog.findMany({
      where: { entity: "PrintDocument", entityId: record.id },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    await audit(req, "REPRINT_HISTORY", "PrintDocument", record.id, { module: req.params.module, recordNumber: record.number });
    res.json(history);
  } catch (error) {
    next(error);
  }
});

export default router;
