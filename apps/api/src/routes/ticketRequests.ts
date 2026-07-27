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

const ticketSchema = z.object({
  leaveRequestId: z.string(),
  departureCountry: z.string().optional(),
  departureCity: z.string().optional(),
  arrivalCountry: z.string().min(2),
  arrivalCity: z.string().min(2),
  preferredDepartureDate: z.coerce.date(),
  preferredReturnDate: z.coerce.date().optional(),
  preferredAirline: z.string().optional(),
  preferredFlightTime: z.string().optional(),
  passportNumber: z.string().optional(),
  passportExpiryDate: z.coerce.date().optional(),
  iqamaNumber: z.string().optional(),
  iqamaExpiryDate: z.coerce.date().optional(),
  visaRequirement: z.string().optional(),
  travelClass: z.string().optional(),
  ticketType: z.enum(["ONE_WAY", "RETURN"]).default("RETURN"),
  familyTicketRequired: z.coerce.boolean().default(false),
  familyMemberDetails: z.unknown().optional(),
  estimatedTicketCost: z.coerce.number().default(0),
  costCenter: z.string().optional(),
  projectCode: z.string().optional(),
  remarks: z.string().optional(),
  attachments: z.array(z.object({ type: z.string(), name: z.string(), reference: z.string().optional() })).min(1)
});

const decisionSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "REJECT", "RETURN_FOR_CORRECTION", "CANCEL", "BOOK", "PROCESS"]),
  comments: z.string().optional(),
  bookingReference: z.string().optional(),
  ticketCopyReference: z.string().optional()
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
  if (action === "PROCESS") return WorkflowStatus.PENDING_ADMIN;
  if (action === "BOOK") return WorkflowStatus.FINAL_APPROVED;
  if (current === WorkflowStatus.PENDING_MANAGER) return WorkflowStatus.PENDING_OM;
  if (current === WorkflowStatus.PENDING_OM) return WorkflowStatus.PENDING_HR_MANAGER;
  if (current === WorkflowStatus.PENDING_HR_MANAGER) return WorkflowStatus.PENDING_ADMIN;
  if (current === WorkflowStatus.PENDING_ADMIN) return WorkflowStatus.FINAL_APPROVED;
  return WorkflowStatus.PENDING_MANAGER;
}

function employeeScopedWhere(role?: Role, employeeId?: string | null) {
  if (role === Role.EMPLOYEE) return { employeeId: employeeId ?? "__none__" };
  if (role === Role.DEPARTMENT_MANAGER || role === Role.OPERATIONS_MANAGER) return { employee: { managerId: employeeId ?? "__none__" } };
  return {};
}

router.get("/", async (req, res) => {
  const rows = await prisma.ticketRequest.findMany({
    where: { archivedAt: null, ...employeeScopedWhere(req.user?.role as Role | undefined, req.user?.employeeId) },
    include: { employee: { include: { department: true } }, leaveRequest: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(rows);
});

router.post("/", async (req, res, next) => {
  try {
    const body = ticketSchema.parse(req.body);
    const leave = await prisma.leaveRequest.findUnique({ where: { id: body.leaveRequestId }, include: { employee: { include: { department: true } } } });
    if (!leave) throw new AppError(404, "Linked leave request not found");
    if (req.user?.role === Role.EMPLOYEE && leave.employeeId !== req.user.employeeId) throw new AppError(403, "You can only create tickets for your own leave.");
    if (leave.type !== "ANNUAL") throw new AppError(400, "Ticket request must be linked to Annual Vacation Leave.");
    if (body.preferredDepartureDate < leave.startDate || (body.preferredReturnDate && body.preferredReturnDate > leave.returnToWorkDate! && req.user?.role === Role.EMPLOYEE)) {
      throw new AppError(400, "Ticket dates must align with leave dates.");
    }
    const ticket = await prisma.ticketRequest.create({
      data: {
        requestNumber: await generateDocumentNumber("TICKET_REQUEST"),
        leaveRequestId: leave.id,
        employeeId: leave.employeeId,
        departureCountry: body.departureCountry,
        departureCity: body.departureCity,
        arrivalCountry: body.arrivalCountry,
        arrivalCity: body.arrivalCity,
        preferredDepartureDate: body.preferredDepartureDate,
        preferredReturnDate: body.preferredReturnDate,
        preferredAirline: body.preferredAirline,
        preferredFlightTime: body.preferredFlightTime,
        passportNumber: body.passportNumber,
        passportExpiryDate: body.passportExpiryDate,
        iqamaNumber: body.iqamaNumber,
        iqamaExpiryDate: body.iqamaExpiryDate,
        visaRequirement: body.visaRequirement,
        travelClass: body.travelClass,
        ticketType: body.ticketType,
        familyTicketRequired: body.familyTicketRequired,
        familyMemberDetails: body.familyMemberDetails as Prisma.InputJsonValue,
        estimatedTicketCost: body.estimatedTicketCost,
        costCenter: body.costCenter,
        projectCode: body.projectCode,
        remarks: body.remarks,
        attachments: body.attachments as Prisma.InputJsonValue,
        createdBy: req.user?.id,
        approvalTimeline: timeline([], { action: "CREATE_DRAFT", by: req.user?.email, at: new Date().toISOString() })
      },
      include: { employee: { include: { department: true } }, leaveRequest: true }
    });
    await audit(req, "CREATE", "TicketRequest", ticket.id, { requestNumber: ticket.requestNumber }, undefined, ticket);
    res.status(201).json(ticket);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/decision", requireRoles(...approvalRoles, Role.EMPLOYEE), async (req, res, next) => {
  try {
    const body = decisionSchema.parse(req.body);
    if (["REJECT", "RETURN_FOR_CORRECTION"].includes(body.action) && !body.comments) throw new AppError(400, "Comments are required.");
    const previous = await prisma.ticketRequest.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) throw new AppError(404, "Ticket request not found");
    if (req.user?.role === Role.EMPLOYEE && (previous.employeeId !== req.user.employeeId || !["SUBMIT", "CANCEL"].includes(body.action))) throw new AppError(403, "Employees can only submit or cancel their own ticket request.");
    const status = nextStatus(previous.status, body.action);
    const updated = await prisma.ticketRequest.update({
      where: { id: previous.id },
      data: {
        status,
        currentApprover: status.replace("PENDING_", ""),
        bookingReference: body.bookingReference ?? previous.bookingReference,
        ticketCopyReference: body.ticketCopyReference ?? previous.ticketCopyReference,
        approvalTimeline: timeline(previous.approvalTimeline, { action: body.action, previousStatus: previous.status, newStatus: status, by: req.user?.email, role: req.user?.role, comments: body.comments, at: new Date().toISOString() })
      }
    });
    await audit(req, body.action, "TicketRequest", updated.id, { comments: body.comments, status }, previous, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get("/export.csv", requireRoles(...adminRoles, Role.AUDITOR), async (req, res) => {
  const rows = await prisma.ticketRequest.findMany({ include: { employee: { include: { department: true } }, leaveRequest: true }, orderBy: { createdAt: "desc" } });
  await audit(req, "EXPORT", "TicketRequest", undefined, { format: "CSV", count: rows.length });
  csvFile(res, "ticket-requests.csv", ["Ticket Request No", "Leave Request No", "Employee ID", "Employee Name", "Department", "Destination", "Departure Date", "Return Date", "Ticket Type", "Estimated Cost", "Status", "Approver", "Booking Reference"], rows.map((row) => [row.requestNumber, row.leaveRequest.requestNumber, row.employee.employeeCode, `${row.employee.firstName} ${row.employee.lastName}`, row.employee.department.name, `${row.arrivalCity}, ${row.arrivalCountry}`, row.preferredDepartureDate.toISOString().slice(0, 10), row.preferredReturnDate?.toISOString().slice(0, 10) ?? "", row.ticketType, String(row.estimatedTicketCost), row.status, row.currentApprover ?? "", row.bookingReference ?? ""]));
});

router.get("/export.xlsx", requireRoles(...adminRoles, Role.AUDITOR), async (req, res) => {
  const rows = await prisma.ticketRequest.findMany({ include: { employee: { include: { department: true } }, leaveRequest: true }, orderBy: { createdAt: "desc" } });
  await xlsxFile(res, "ticket-requests.xlsx", ["Ticket Request No", "Leave Request No", "Employee ID", "Employee Name", "Department", "Destination", "Departure Date", "Return Date", "Ticket Type", "Estimated Cost", "Status", "Approver", "Booking Reference"], rows.map((row) => [row.requestNumber, row.leaveRequest.requestNumber, row.employee.employeeCode, `${row.employee.firstName} ${row.employee.lastName}`, row.employee.department.name, `${row.arrivalCity}, ${row.arrivalCountry}`, row.preferredDepartureDate.toISOString().slice(0, 10), row.preferredReturnDate?.toISOString().slice(0, 10) ?? "", row.ticketType, String(row.estimatedTicketCost), row.status, row.currentApprover ?? "", row.bookingReference ?? ""]), "Ticket Requests");
});

router.get("/:id/print", async (req, res, next) => {
  try {
    const row = await prisma.ticketRequest.findUnique({ where: { id: String(req.params.id) }, include: { employee: { include: { department: true } }, leaveRequest: true } });
    if (!row) return res.status(404).send("Ticket request not found");
    if (req.user?.role === Role.EMPLOYEE && row.employeeId !== req.user.employeeId) return res.status(403).send("Forbidden");
    const company = await getCurrentCompanyProfile();
    await audit(req, "PRINT", "TicketRequest", row.id, { requestNumber: row.requestNumber });
    res.header("Content-Type", "text/html");
    res.send(`<!doctype html><html><head><title>${row.requestNumber}</title><style>body{font-family:Arial;margin:32px}table{width:100%;border-collapse:collapse}td{border:1px solid #ddd;padding:8px}.head{border-bottom:2px solid #0f766e;margin-bottom:20px;padding-bottom:12px}.brand-line{display:flex;gap:16px;align-items:center}</style></head><body>${companyPrintHeader(company, "Ticket Request")}<table><tbody><tr><td>Ticket Request</td><td>${row.requestNumber}</td><td>Status</td><td>${row.status}</td></tr><tr><td>Linked Leave</td><td>${row.leaveRequest.requestNumber}</td><td>Employee</td><td>${row.employee.employeeCode} - ${row.employee.firstName} ${row.employee.lastName}</td></tr><tr><td>Destination</td><td>${row.arrivalCity}, ${row.arrivalCountry}</td><td>Ticket Type</td><td>${row.ticketType}</td></tr><tr><td>Departure</td><td>${row.preferredDepartureDate.toISOString().slice(0, 10)}</td><td>Return</td><td>${row.preferredReturnDate?.toISOString().slice(0, 10) ?? ""}</td></tr></tbody></table><script>window.print()</script></body></html>`);
  } catch (error) {
    next(error);
  }
});

export default router;
