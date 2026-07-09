import { Router } from "express";
import { LeaveType, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";
import { csvFile, csvTemplate, numberValue, rowsFromUpload, xlsxFile, xlsxTemplate } from "../utils/uploadParsers.js";

const router = Router();
const uploadRoles = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR];

const headers = [
  "Employee ID",
  "Employee Name",
  "Department",
  "Leave Type",
  "Leave Year",
  "Opening Balance",
  "Accrued Leave",
  "Used Leave",
  "Pending Leave",
  "Carried Forward Balance",
  "Encashment Balance",
  "Adjustment Balance",
  "Final Available Balance",
  "Expiry Date of Carry-Forward Balance",
  "Remarks"
];

const batchSchema = z.object({
  company: z.string().min(2),
  branch: z.string().optional(),
  leaveYear: z.coerce.number().int().min(2020).max(2100),
  leaveType: z.nativeEnum(LeaveType),
  fileName: z.string().optional(),
  content: z.string().optional(),
  contentBase64: z.string().optional()
});

const decisionSchema = z.object({
  status: z.enum(["SUBMITTED", "HR_REVIEW", "APPROVED", "PUBLISHED", "REJECTED", "RETURNED_FOR_CORRECTION"]),
  comments: z.string().min(3).optional()
});

router.use(requireAuth, requireRoles(...uploadRoles));

router.get("/template.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.attachment("leave-balance-upload-template.csv");
  res.send(csvTemplate(headers));
});

router.get("/template.xlsx", async (_req, res) => {
  await xlsxTemplate(res, "leave-balance-upload-template.xlsx", headers, "Leave Balance");
});

async function validateRows(rows: Awaited<ReturnType<typeof rowsFromUpload>>) {
  const errors: Array<{ row: number; column: string; message: string }> = [];
  const employeeCodes = rows.map((row) => row["Employee ID"]).filter(Boolean);
  const employees = await prisma.employee.findMany({ where: { employeeCode: { in: employeeCodes } } });
  const employeeMap = new Map(employees.map((employee) => [employee.employeeCode, employee]));
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    for (const header of ["Employee ID", "Leave Type", "Leave Year", "Final Available Balance"]) {
      if (!row[header]) errors.push({ row: rowNumber, column: header, message: "Required value is missing" });
    }
    const employeeCode = row["Employee ID"];
    const key = `${employeeCode}-${row["Leave Type"]}-${row["Leave Year"]}`;
    if (employeeCode && !employeeMap.has(employeeCode)) errors.push({ row: rowNumber, column: "Employee ID", message: "Employee ID not found" });
    if (seen.has(key)) errors.push({ row: rowNumber, column: "Employee ID", message: "Duplicate employee/leave type/year in upload" });
    seen.add(key);

    const calculated = numberValue(row["Opening Balance"]) + numberValue(row["Accrued Leave"]) + numberValue(row["Carried Forward Balance"]) + numberValue(row["Adjustment Balance"]) - numberValue(row["Used Leave"]) - numberValue(row["Pending Leave"]) - numberValue(row["Encashment Balance"]);
    if (Math.abs(calculated - numberValue(row["Final Available Balance"])) > 0.01) {
      errors.push({ row: rowNumber, column: "Final Available Balance", message: "Final balance formula does not match" });
    }
  });

  return { errors, employeeMap };
}

router.post("/validate", async (req, res, next) => {
  try {
    const body = batchSchema.partial().parse(req.body);
    const rows = await rowsFromUpload(body);
    const validation = await validateRows(rows);
    res.json({ valid: validation.errors.length === 0, rowCount: rows.length, errors: validation.errors });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (_req, res) => {
  const batches = await prisma.leaveBalanceUploadBatch.findMany({ where: { archivedAt: null }, include: { items: true }, orderBy: { createdAt: "desc" } });
  res.json(batches);
});

router.post("/", async (req, res, next) => {
  try {
    const body = batchSchema.parse(req.body);
    const rows = await rowsFromUpload(body);
    const validation = await validateRows(rows);
    if (validation.errors.length) return res.status(400).json({ message: "Leave balance upload validation failed", errors: validation.errors });

    const batch = await prisma.leaveBalanceUploadBatch.create({
      data: {
        company: body.company,
        branch: body.branch,
        leaveYear: body.leaveYear,
        leaveType: body.leaveType,
        originalFileName: body.fileName,
        createdBy: req.user?.id,
        approvalHistory: []
      }
    });

    for (const row of rows) {
      const employee = validation.employeeMap.get(row["Employee ID"]);
      if (!employee) continue;
      await prisma.leaveBalanceUploadItem.create({
        data: {
          batchId: batch.id,
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          employeeName: row["Employee Name"] || `${employee.firstName} ${employee.lastName}`,
          department: row.Department,
          leaveType: body.leaveType,
          leaveYear: body.leaveYear,
          openingBalance: numberValue(row["Opening Balance"]),
          accruedLeave: numberValue(row["Accrued Leave"]),
          usedLeave: numberValue(row["Used Leave"]),
          pendingLeave: numberValue(row["Pending Leave"]),
          carriedForwardBalance: numberValue(row["Carried Forward Balance"]),
          encashmentBalance: numberValue(row["Encashment Balance"]),
          adjustmentBalance: numberValue(row["Adjustment Balance"]),
          finalAvailableBalance: numberValue(row["Final Available Balance"]),
          carryForwardExpiryDate: row["Expiry Date of Carry-Forward Balance"] ? new Date(row["Expiry Date of Carry-Forward Balance"]) : undefined,
          remarks: row.Remarks
        }
      });
    }

    const populated = await prisma.leaveBalanceUploadBatch.findUniqueOrThrow({ where: { id: batch.id }, include: { items: true } });
    await audit(req, "CREATE_DRAFT", "LeaveBalanceUploadBatch", batch.id, { rowCount: rows.length, fileName: body.fileName }, undefined, populated);
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const body = decisionSchema.parse(req.body);
    if (["REJECTED", "RETURNED_FOR_CORRECTION"].includes(body.status) && !body.comments) return res.status(400).json({ message: "Comments are required" });
    const previous = await prisma.leaveBalanceUploadBatch.findUnique({ where: { id: String(req.params.id) }, include: { items: true } });
    if (!previous) return res.status(404).json({ message: "Leave balance batch not found" });
    const history = Array.isArray(previous.approvalHistory) ? previous.approvalHistory : [];
    history.push({ status: body.status, comments: body.comments, actedBy: req.user?.email, actedAt: new Date().toISOString() });

    const batch = await prisma.$transaction(async (tx) => {
      const updated = await tx.leaveBalanceUploadBatch.update({
        where: { id: previous.id },
        data: {
          status: body.status,
          approvalComments: body.comments,
          approvalHistory: history,
          submittedAt: body.status === "SUBMITTED" ? new Date() : previous.submittedAt,
          approvedAt: ["APPROVED", "PUBLISHED"].includes(body.status) ? new Date() : previous.approvedAt,
          publishedAt: body.status === "PUBLISHED" ? new Date() : previous.publishedAt
        },
        include: { items: true }
      });
      if (body.status === "PUBLISHED") {
        for (const item of previous.items) {
          await tx.employee.update({ where: { id: item.employeeId }, data: { leaveBalance: Math.round(Number(item.finalAvailableBalance)) } });
        }
      }
      return updated;
    });
    await audit(req, "LEAVE_BALANCE_STATUS", "LeaveBalanceUploadBatch", batch.id, { status: body.status, comments: body.comments }, previous, batch);
    res.json(batch);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const previous = await prisma.leaveBalanceUploadBatch.findUnique({ where: { id: String(req.params.id) } });
    if (!previous) return res.status(404).json({ message: "Leave balance batch not found" });
    const batch = await prisma.leaveBalanceUploadBatch.update({ where: { id: previous.id }, data: { archivedAt: new Date() } });
    await audit(req, "ARCHIVE", "LeaveBalanceUploadBatch", batch.id, undefined, previous, batch);
    res.json(batch);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/export.csv", async (req, res, next) => {
  try {
    const batch = await prisma.leaveBalanceUploadBatch.findUnique({ where: { id: String(req.params.id) }, include: { items: true } });
    if (!batch) return res.status(404).json({ message: "Leave balance batch not found" });
    const exportHeaders = ["Employee ID", "Employee Name", "Leave Type", "Leave Year", "Final Available Balance", "Remarks"];
    const rows = batch.items.map((item) => [item.employeeCode, item.employeeName, item.leaveType, item.leaveYear, item.finalAvailableBalance, item.remarks ?? ""]);
    await audit(req, "EXPORT", "LeaveBalanceUploadBatch", batch.id, { format: "CSV", count: batch.items.length });
    csvFile(res, `leave-balance-upload-${batch.leaveYear}.csv`, exportHeaders, rows);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/export.xlsx", async (req, res, next) => {
  try {
    const batch = await prisma.leaveBalanceUploadBatch.findUnique({ where: { id: String(req.params.id) }, include: { items: true } });
    if (!batch) return res.status(404).json({ message: "Leave balance batch not found" });
    const exportHeaders = ["Employee ID", "Employee Name", "Leave Type", "Leave Year", "Final Available Balance", "Remarks"];
    const rows = batch.items.map((item) => [item.employeeCode, item.employeeName, item.leaveType, item.leaveYear, item.finalAvailableBalance, item.remarks ?? ""]);
    await audit(req, "EXPORT", "LeaveBalanceUploadBatch", batch.id, { format: "XLSX", count: batch.items.length });
    await xlsxFile(res, `leave-balance-upload-${batch.leaveYear}.xlsx`, exportHeaders, rows, "Leave Balance");
  } catch (error) {
    next(error);
  }
});

export default router;
