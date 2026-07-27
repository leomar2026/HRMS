import { Prisma, Role, WorkflowStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { AppError } from "../middleware/error.js";
import { audit } from "../utils/audit.js";
import { companyPrintHeader, getCurrentCompanyProfile } from "../utils/companyProfile.js";
import { csvFile, xlsxFile } from "../utils/uploadParsers.js";
import { generateDocumentNumber } from "../utils/numberSeries.js";

const router = Router();
const adminRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR, Role.FINANCE, Role.ACCOUNTANT];
const approvalRoles: Role[] = [...adminRoles, Role.DEPARTMENT_MANAGER, Role.OPERATIONS_MANAGER];

const pettyCashSchema = z.object({
  requestType: z.string().min(2),
  purpose: z.string().min(3),
  businessTripReference: z.string().optional(),
  linkedLeaveRequestId: z.string().optional(),
  costCenter: z.string().optional(),
  projectCode: z.string().optional(),
  requestedAmount: z.coerce.number().positive(),
  approvedAmount: z.coerce.number().min(0).optional(),
  currency: z.string().default("SAR"),
  exchangeRate: z.coerce.number().positive().default(1),
  requiredDate: z.coerce.date(),
  paymentMethod: z.string().optional(),
  bankName: z.string().optional(),
  iban: z.string().optional(),
  cashCollectionLocation: z.string().optional(),
  detailedJustification: z.string().min(3),
  remarks: z.string().optional(),
  attachments: z.array(z.object({ type: z.string(), name: z.string(), reference: z.string().optional() })).min(1)
});

const decisionSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "REJECT", "RETURN_FOR_CORRECTION", "CANCEL", "PAY", "SETTLE"]),
  comments: z.string().optional(),
  approvedAmount: z.coerce.number().optional(),
  paidAmount: z.coerce.number().optional(),
  settledAmount: z.coerce.number().optional(),
  attachmentName: z.string().optional(),
  overrideReason: z.string().optional()
});

router.use(requireAuth);

function timeline(previous: unknown, entry: object) {
  return [...(Array.isArray(previous) ? previous : []), entry] as Prisma.InputJsonValue;
}

function nextStatus(current: WorkflowStatus, action: z.infer<typeof decisionSchema>["action"]) {
  if (action === "SUBMIT") return WorkflowStatus.PENDING_MANAGER;
  if (action === "CANCEL") return WorkflowStatus.CANCELLED;
  if (action === "REJECT") return WorkflowStatus.REJECTED;
  if (action === "RETURN_FOR_CORRECTION") return WorkflowStatus.RETURNED_FOR_CORRECTION;
  if (action === "PAY" || action === "SETTLE") return WorkflowStatus.FINAL_APPROVED;
  if (current === WorkflowStatus.PENDING_MANAGER) return WorkflowStatus.PENDING_OM;
  if (current === WorkflowStatus.PENDING_OM) return WorkflowStatus.PENDING_FINANCE;
  if (current === WorkflowStatus.PENDING_FINANCE) return WorkflowStatus.PENDING_ADMIN;
  if (current === WorkflowStatus.PENDING_ADMIN) return WorkflowStatus.FINAL_APPROVED;
  return WorkflowStatus.PENDING_MANAGER;
}

function employeeScopedWhere(role?: Role, employeeId?: string | null) {
  if (role === Role.EMPLOYEE) return { employeeId: employeeId ?? "__none__" };
  if (role === Role.DEPARTMENT_MANAGER || role === Role.OPERATIONS_MANAGER) return { employee: { managerId: employeeId ?? "__none__" } };
  return {};
}

router.get("/", async (req, res) => {
  const rows = await prisma.pettyCashRequest.findMany({
    where: { archivedAt: null, ...employeeScopedWhere(req.user?.role as Role | undefined, req.user?.employeeId) },
    include: { employee: { include: { department: true } }, linkedLeaveRequest: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(rows);
});

router.post("/", async (req, res, next) => {
  try {
    const body = pettyCashSchema.parse(req.body);
    const employeeId = req.user?.employeeId;
    if (req.user?.role === Role.EMPLOYEE && !employeeId) throw new AppError(403, "Employee profile is not linked to this user");
    const employee = await prisma.employee.findUnique({ where: { id: employeeId ?? req.body.employeeId }, include: { department: true } });
    if (!employee) throw new AppError(404, "Employee profile not found");
    const amountSar = body.requestedAmount * body.exchangeRate;
    const row = await prisma.pettyCashRequest.create({
      data: {
        requestNumber: await generateDocumentNumber("PETTY_CASH"),
        employeeId: employee.id,
        requestType: body.requestType,
        purpose: body.purpose,
        businessTripReference: body.businessTripReference,
        linkedLeaveRequestId: body.linkedLeaveRequestId,
        costCenter: body.costCenter,
        projectCode: body.projectCode,
        requestedAmount: body.requestedAmount,
        approvedAmount: body.approvedAmount ?? 0,
        outstandingAmount: body.approvedAmount ?? body.requestedAmount,
        currency: body.currency,
        exchangeRate: body.exchangeRate,
        amountSar,
        requiredDate: body.requiredDate,
        paymentMethod: body.paymentMethod,
        bankName: body.bankName,
        iban: body.iban,
        cashCollectionLocation: body.cashCollectionLocation,
        detailedJustification: body.detailedJustification,
        remarks: body.remarks,
        attachments: body.attachments as Prisma.InputJsonValue,
        createdBy: req.user?.id,
        approvalTimeline: timeline([], { action: "CREATE_DRAFT", by: req.user?.email, at: new Date().toISOString() })
      },
      include: { employee: { include: { department: true } }, linkedLeaveRequest: true }
    });
    await audit(req, "CREATE", "PettyCashRequest", row.id, { requestNumber: row.requestNumber }, undefined, row);
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/decision", requireRoles(...approvalRoles, Role.EMPLOYEE), async (req, res, next) => {
  try {
    const body = decisionSchema.parse(req.body);
    if (["REJECT", "RETURN_FOR_CORRECTION"].includes(body.action) && !body.comments) throw new AppError(400, "Comments are required.");
    const previous = await prisma.pettyCashRequest.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) throw new AppError(404, "Petty cash request not found");
    if (req.user?.role === Role.EMPLOYEE && (previous.employeeId !== req.user.employeeId || !["SUBMIT", "CANCEL", "SETTLE"].includes(body.action))) throw new AppError(403, "Employees can only submit, settle, or cancel their own petty cash request.");
    if (body.action === "PAY" && previous.paymentStatus === "PAID") throw new AppError(409, "Duplicate payment is not allowed.");
    const status = nextStatus(previous.status, body.action);
    const approvedAmount = body.approvedAmount ?? Number(previous.approvedAmount);
    const paidAmount = body.action === "PAY" ? body.paidAmount ?? approvedAmount : Number(previous.paidAmount);
    const settledAmount = body.action === "SETTLE" ? body.settledAmount ?? Number(previous.settledAmount) : Number(previous.settledAmount);
    const updated = await prisma.pettyCashRequest.update({
      where: { id: previous.id },
      data: {
        status,
        currentApprover: status.replace("PENDING_", ""),
        approvedAmount,
        paidAmount,
        settledAmount,
        outstandingAmount: Math.max(0, paidAmount - settledAmount),
        paymentStatus: body.action === "PAY" ? "PAID" : previous.paymentStatus,
        settlementStatus: body.action === "SETTLE" ? "SUBMITTED" : previous.settlementStatus,
        paidAt: body.action === "PAY" ? new Date() : previous.paidAt,
        settlementAttachments: body.attachmentName ? ([{ name: body.attachmentName, uploadedAt: new Date().toISOString() }] as Prisma.InputJsonValue) : previous.settlementAttachments as Prisma.InputJsonValue,
        approvalTimeline: timeline(previous.approvalTimeline, { action: body.action, previousStatus: previous.status, newStatus: status, by: req.user?.email, role: req.user?.role, comments: body.comments, overrideReason: body.overrideReason, at: new Date().toISOString() })
      }
    });
    await audit(req, body.action, "PettyCashRequest", updated.id, { comments: body.comments, status }, previous, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get("/export.csv", requireRoles(...adminRoles, Role.AUDITOR), async (req, res) => {
  const rows = await prisma.pettyCashRequest.findMany({ include: { employee: { include: { department: true } }, linkedLeaveRequest: true }, orderBy: { createdAt: "desc" } });
  await audit(req, "EXPORT", "PettyCashRequest", undefined, { format: "CSV", count: rows.length });
  csvFile(res, "petty-cash-requests.csv", ["Request No", "Employee ID", "Employee Name", "Department", "Request Type", "Linked Reference", "Requested", "Approved", "Paid", "Settled", "Outstanding", "Required Date", "Status", "Approver"], rows.map((row) => [row.requestNumber, row.employee.employeeCode, `${row.employee.firstName} ${row.employee.lastName}`, row.employee.department.name, row.requestType, row.businessTripReference ?? row.linkedLeaveRequest?.requestNumber ?? "", String(row.requestedAmount), String(row.approvedAmount), String(row.paidAmount), String(row.settledAmount), String(row.outstandingAmount), row.requiredDate.toISOString().slice(0, 10), row.status, row.currentApprover ?? ""]));
});

router.get("/export.xlsx", requireRoles(...adminRoles, Role.AUDITOR), async (req, res) => {
  const rows = await prisma.pettyCashRequest.findMany({ include: { employee: { include: { department: true } }, linkedLeaveRequest: true }, orderBy: { createdAt: "desc" } });
  await xlsxFile(res, "petty-cash-requests.xlsx", ["Request No", "Employee ID", "Employee Name", "Department", "Request Type", "Linked Reference", "Requested", "Approved", "Paid", "Settled", "Outstanding", "Required Date", "Status", "Approver"], rows.map((row) => [row.requestNumber, row.employee.employeeCode, `${row.employee.firstName} ${row.employee.lastName}`, row.employee.department.name, row.requestType, row.businessTripReference ?? row.linkedLeaveRequest?.requestNumber ?? "", String(row.requestedAmount), String(row.approvedAmount), String(row.paidAmount), String(row.settledAmount), String(row.outstandingAmount), row.requiredDate.toISOString().slice(0, 10), row.status, row.currentApprover ?? ""]), "Petty Cash");
});

router.get("/:id/print", async (req, res, next) => {
  try {
    const row = await prisma.pettyCashRequest.findUnique({ where: { id: String(req.params.id) }, include: { employee: { include: { department: true } }, linkedLeaveRequest: true } });
    if (!row) return res.status(404).send("Petty cash request not found");
    if (req.user?.role === Role.EMPLOYEE && row.employeeId !== req.user.employeeId) return res.status(403).send("Forbidden");
    const company = await getCurrentCompanyProfile();
    await audit(req, "PRINT", "PettyCashRequest", row.id, { requestNumber: row.requestNumber });
    res.header("Content-Type", "text/html");
    res.send(`<!doctype html><html><head><title>${row.requestNumber}</title><style>body{font-family:Arial;margin:32px}table{width:100%;border-collapse:collapse}td{border:1px solid #ddd;padding:8px}.head{border-bottom:2px solid #0f766e;margin-bottom:20px;padding-bottom:12px}.brand-line{display:flex;gap:16px;align-items:center}</style></head><body>${companyPrintHeader(company, "Petty Cash Request")}<table><tbody><tr><td>Request</td><td>${row.requestNumber}</td><td>Status</td><td>${row.status}</td></tr><tr><td>Employee</td><td>${row.employee.employeeCode} - ${row.employee.firstName} ${row.employee.lastName}</td><td>Department</td><td>${row.employee.department.name}</td></tr><tr><td>Type</td><td>${row.requestType}</td><td>Required Date</td><td>${row.requiredDate.toISOString().slice(0, 10)}</td></tr><tr><td>Requested</td><td>${row.requestedAmount} ${row.currency}</td><td>Outstanding</td><td>${row.outstandingAmount}</td></tr><tr><td>Purpose</td><td colspan="3">${row.purpose}</td></tr></tbody></table><script>window.print()</script></body></html>`);
  } catch (error) {
    next(error);
  }
});

export default router;
