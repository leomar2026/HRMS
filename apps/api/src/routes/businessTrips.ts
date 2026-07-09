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

const router = Router();
const adminRoles = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR, Role.FINANCE, Role.ACCOUNTANT];
const approvalRoles = [...adminRoles, Role.DEPARTMENT_MANAGER, Role.OPERATIONS_MANAGER];

const tripSchema = z.object({
  employeeId: z.string().optional(),
  tripType: z.string().min(2),
  purpose: z.string().min(3),
  destinationCountry: z.string().optional(),
  destinationCity: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  travelMethod: z.string().optional(),
  transportDetails: z.string().optional(),
  estimatedTicketCost: z.coerce.number().default(0),
  estimatedHotelCost: z.coerce.number().default(0),
  estimatedDailyAllowance: z.coerce.number().default(0),
  estimatedOtherExpenses: z.coerce.number().default(0),
  costCenter: z.string().optional(),
  projectCode: z.string().optional(),
  clientSiteName: z.string().optional(),
  advanceRequired: z.coerce.boolean().default(false),
  requestedAdvanceAmount: z.coerce.number().default(0),
  remarks: z.string().optional(),
  attachmentName: z.string().optional(),
  changeReason: z.string().optional()
});

const decisionSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "REJECT", "RETURN_FOR_CORRECTION", "CANCEL"]),
  comments: z.string().optional()
});

const expenseSchema = z.object({
  tripRequestId: z.string(),
  expenseDate: z.coerce.date(),
  expenseCategory: z.string().min(2),
  amount: z.coerce.number(),
  currency: z.string().default("SAR"),
  exchangeRate: z.coerce.number().default(1),
  description: z.string().optional(),
  receiptAttachment: z.string().optional(),
  advanceReceived: z.coerce.number().default(0)
});

router.use(requireAuth);

function daysBetween(start: Date, end: Date) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
}

function nextStatus(current: WorkflowStatus, action: z.infer<typeof decisionSchema>["action"], role?: Role) {
  if (action === "SUBMIT") return WorkflowStatus.PENDING_MANAGER;
  if (action === "CANCEL") return WorkflowStatus.CANCELLED;
  if (action === "REJECT") return WorkflowStatus.REJECTED;
  if (action === "RETURN_FOR_CORRECTION") return WorkflowStatus.RETURNED_FOR_CORRECTION;
  if (current === WorkflowStatus.PENDING_MANAGER) return WorkflowStatus.PENDING_OM;
  if (current === WorkflowStatus.PENDING_OM) return WorkflowStatus.PENDING_HR_MANAGER;
  if (current === WorkflowStatus.PENDING_HR_MANAGER) return WorkflowStatus.PENDING_FINANCE;
  if (current === WorkflowStatus.PENDING_FINANCE || role === Role.FINANCE || role === Role.ACCOUNTANT) return WorkflowStatus.FINAL_APPROVED;
  return WorkflowStatus.PENDING_MANAGER;
}

function timeline(previous: unknown, entry: object) {
  return [...(Array.isArray(previous) ? previous : []), entry] as Prisma.InputJsonValue;
}

router.get("/", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const ownOnly = req.user?.role === Role.EMPLOYEE;
  const trips = await prisma.businessTripRequest.findMany({
    where: {
      archivedAt: null,
      ...(ownOnly ? { employeeId: req.user?.employeeId ?? "" } : {}),
      ...(search ? { OR: [{ requestNumber: { contains: search, mode: "insensitive" } }, { destinationCity: { contains: search, mode: "insensitive" } }, { destinationCountry: { contains: search, mode: "insensitive" } }] } : {})
    },
    include: { employee: { include: { department: true, manager: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json(trips);
});

router.post("/", async (req, res, next) => {
  try {
    const body = tripSchema.parse(req.body);
    const employeeId = req.user?.role === Role.EMPLOYEE ? req.user.employeeId : body.employeeId;
    if (!employeeId) throw new AppError(400, "employeeId is required");
    const totalDays = daysBetween(body.startDate, body.endDate);
    const totalEstimatedCost = body.estimatedTicketCost + body.estimatedHotelCost + body.estimatedDailyAllowance + body.estimatedOtherExpenses;
    const trip = await prisma.businessTripRequest.create({
      data: {
        requestNumber: `TRIP-${Date.now()}`,
        employeeId,
        tripType: body.tripType,
        purpose: body.purpose,
        destinationCountry: body.destinationCountry,
        destinationCity: body.destinationCity,
        startDate: body.startDate,
        endDate: body.endDate,
        totalDays,
        travelMethod: body.travelMethod,
        transportDetails: body.transportDetails,
        estimatedTicketCost: body.estimatedTicketCost,
        estimatedHotelCost: body.estimatedHotelCost,
        estimatedDailyAllowance: body.estimatedDailyAllowance,
        estimatedOtherExpenses: body.estimatedOtherExpenses,
        totalEstimatedCost,
        costCenter: body.costCenter,
        projectCode: body.projectCode,
        clientSiteName: body.clientSiteName,
        advanceRequired: body.advanceRequired,
        requestedAdvanceAmount: body.requestedAdvanceAmount,
        remarks: body.remarks,
        attachmentName: body.attachmentName,
        createdBy: req.user?.id,
        approvalTimeline: timeline([], { action: "CREATE_DRAFT", by: req.user?.email, at: new Date().toISOString() })
      },
      include: { employee: { include: { department: true } } }
    });
    await audit(req, "CREATE", "BusinessTripRequest", trip.id, { requestNumber: trip.requestNumber }, undefined, trip);
    res.status(201).json(trip);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireRoles(...adminRoles), async (req, res, next) => {
  try {
    const body = tripSchema.partial().parse(req.body);
    if (!body.changeReason) throw new AppError(400, "Reason is required for admin trip override.");
    const previous = await prisma.businessTripRequest.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) throw new AppError(404, "Trip request not found");
    if (previous.status === WorkflowStatus.FINAL_APPROVED) throw new AppError(409, "Final approved trip is locked. Use admin override workflow.");
    const { changeReason, ...data } = body;
    const totalDays = data.startDate && data.endDate ? daysBetween(data.startDate, data.endDate) : undefined;
    const updated = await prisma.businessTripRequest.update({
      where: { id: previous.id },
      data: { ...data, totalDays, approvalTimeline: timeline(previous.approvalTimeline, { action: "ADMIN_EDIT", by: req.user?.email, role: req.user?.role, reason: changeReason, at: new Date().toISOString() }) }
    });
    await audit(req, "ADMIN_EDIT", "BusinessTripRequest", updated.id, { reason: changeReason, fields: Object.keys(data) }, previous, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/decision", requireRoles(...approvalRoles), async (req, res, next) => {
  try {
    const body = decisionSchema.parse(req.body);
    if (["REJECT", "RETURN_FOR_CORRECTION"].includes(body.action) && !body.comments) throw new AppError(400, "Comments are required.");
    const previous = await prisma.businessTripRequest.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) throw new AppError(404, "Trip request not found");
    const status = nextStatus(previous.status, body.action, req.user?.role);
    const updated = await prisma.businessTripRequest.update({
      where: { id: previous.id },
      data: { status, currentApprover: status.replace("PENDING_", ""), approvalTimeline: timeline(previous.approvalTimeline, { action: body.action, previousStatus: previous.status, newStatus: status, by: req.user?.email, role: req.user?.role, comments: body.comments, at: new Date().toISOString() }) }
    });
    await audit(req, body.action, "BusinessTripRequest", updated.id, { comments: body.comments, status }, previous, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/expense-claims", async (req, res, next) => {
  try {
    const body = expenseSchema.parse(req.body);
    const trip = await prisma.businessTripRequest.findUnique({ where: { id: body.tripRequestId } });
    if (!trip) throw new AppError(404, "Trip request not found");
    if (trip.employeeId !== req.user?.employeeId && req.user?.role === Role.EMPLOYEE) throw new AppError(403, "You can only claim your own trip.");
    if (trip.status !== WorkflowStatus.FINAL_APPROVED) throw new AppError(400, "Expense claim requires final approved trip.");
    const amountSar = body.amount * body.exchangeRate;
    const claim = await prisma.tripExpenseClaim.create({
      data: { claimNumber: `TEXP-${Date.now()}`, tripRequestId: body.tripRequestId, employeeId: trip.employeeId, expenseDate: body.expenseDate, expenseCategory: body.expenseCategory, amount: body.amount, currency: body.currency, exchangeRate: body.exchangeRate, amountSar, description: body.description, receiptAttachment: body.receiptAttachment, totalClaimedAmount: amountSar, advanceReceived: body.advanceReceived, finalReimbursement: amountSar - body.advanceReceived, approvalTimeline: timeline([], { action: "SUBMIT", by: req.user?.email, at: new Date().toISOString() }) }
    });
    await audit(req, "CREATE", "TripExpenseClaim", claim.id, { claimNumber: claim.claimNumber }, undefined, claim);
    res.status(201).json(claim);
  } catch (error) {
    next(error);
  }
});

router.get("/export.csv", requireRoles(...adminRoles, Role.AUDITOR), async (req, res) => {
  const trips = await prisma.businessTripRequest.findMany({ include: { employee: { include: { department: true } } }, orderBy: { createdAt: "desc" } });
  const headers = ["Request Number", "Employee ID", "Employee Name", "Department", "Destination", "Trip Type", "Start Date", "End Date", "Total Days", "Estimated Cost", "Advance Amount", "Status", "Request Date"];
  await audit(req, "EXPORT", "BusinessTripRequest", undefined, { format: "CSV", count: trips.length });
  csvFile(res, "business-trips.csv", headers, trips.map((trip) => [trip.requestNumber, trip.employee.employeeCode, `${trip.employee.firstName} ${trip.employee.lastName}`, trip.employee.department.name, [trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", "), trip.tripType, trip.startDate.toISOString().slice(0, 10), trip.endDate.toISOString().slice(0, 10), trip.totalDays, trip.totalEstimatedCost, trip.requestedAdvanceAmount, trip.status, trip.createdAt.toISOString()]));
});

router.get("/export.xlsx", requireRoles(...adminRoles, Role.AUDITOR), async (req, res) => {
  const trips = await prisma.businessTripRequest.findMany({ include: { employee: { include: { department: true } } }, orderBy: { createdAt: "desc" } });
  const headers = ["Request Number", "Employee ID", "Employee Name", "Department", "Destination", "Trip Type", "Start Date", "End Date", "Total Days", "Estimated Cost", "Advance Amount", "Status", "Request Date"];
  await audit(req, "EXPORT", "BusinessTripRequest", undefined, { format: "XLSX", count: trips.length });
  await xlsxFile(res, "business-trips.xlsx", headers, trips.map((trip) => [trip.requestNumber, trip.employee.employeeCode, `${trip.employee.firstName} ${trip.employee.lastName}`, trip.employee.department.name, [trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", "), trip.tripType, trip.startDate.toISOString().slice(0, 10), trip.endDate.toISOString().slice(0, 10), trip.totalDays, String(trip.totalEstimatedCost), String(trip.requestedAdvanceAmount), trip.status, trip.createdAt.toISOString()]), "Business Trips");
});

router.get("/:id/print", async (req, res, next) => {
  try {
    const trip = await prisma.businessTripRequest.findUnique({ where: { id: String(req.params.id) }, include: { employee: { include: { department: true, manager: true } } } });
    if (!trip) return res.status(404).send("Trip request not found");
    if (req.user?.role === Role.EMPLOYEE && trip.employeeId !== req.user.employeeId) return res.status(403).send("Forbidden");
    const company = await getCurrentCompanyProfile();
    await audit(req, "PRINT", "BusinessTripRequest", trip.id, { requestNumber: trip.requestNumber });
    res.header("Content-Type", "text/html");
    res.send(`<!doctype html><html><head><title>${trip.requestNumber}</title><style>body{font-family:Arial;margin:32px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}.head{border-bottom:2px solid #0f766e;margin-bottom:20px;padding-bottom:12px}.brand-line{display:flex;gap:16px;align-items:center}</style></head><body>${companyPrintHeader(company, "Business Trip Authorization")}<table><tbody><tr><td>Request</td><td>${trip.requestNumber}</td><td>Status</td><td>${trip.status}</td></tr><tr><td>Employee</td><td>${trip.employee.employeeCode} - ${trip.employee.firstName} ${trip.employee.lastName}</td><td>Department</td><td>${trip.employee.department.name}</td></tr><tr><td>Destination</td><td>${trip.destinationCity ?? ""}, ${trip.destinationCountry ?? ""}</td><td>Dates</td><td>${trip.startDate.toISOString().slice(0, 10)} to ${trip.endDate.toISOString().slice(0, 10)}</td></tr><tr><td>Purpose</td><td colspan="3">${trip.purpose}</td></tr><tr><td>Total Estimated Cost</td><td>${trip.totalEstimatedCost}</td><td>Advance</td><td>${trip.requestedAdvanceAmount}</td></tr></tbody></table><script>window.print()</script></body></html>`);
  } catch (error) {
    next(error);
  }
});

export default router;
