import { Router } from "express";
import { Role } from "@prisma/client";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";
import { csvFile, csvTemplate, xlsxFile, xlsxTemplate } from "../utils/uploadParsers.js";

const router = Router();
const attendanceHeaders = ["employeeCode", "checkIn", "checkOut"];

const importSchema = z.object({
  content: z.string().optional(),
  fileName: z.string().optional(),
  contentBase64: z.string().optional()
}).refine((value) => value.content || value.contentBase64, {
  message: "CSV content or Excel file content is required"
});

const absenceSchema = z.object({
  workDate: z.coerce.date()
});

function startOfWorkDate(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function lateMinutes(checkIn: Date) {
  const expected = new Date(checkIn);
  expected.setHours(8, 0, 0, 0);
  return Math.max(0, Math.round((checkIn.getTime() - expected.getTime()) / 60000));
}

function overtimeHours(checkOut?: Date) {
  if (!checkOut) return 0;
  const expected = new Date(checkOut);
  expected.setHours(17, 0, 0, 0);
  return Math.max(0, Number(((checkOut.getTime() - expected.getTime()) / 3600000).toFixed(2)));
}

async function parseExcelRows(contentBase64: string) {
  const workbook = new ExcelJS.Workbook();
  const source = Buffer.from(contentBase64, "base64");
  const arrayBuffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values as Array<string | undefined>;
  const headerIndex = new Map<string, number>();
  headers.forEach((header, index) => {
    if (typeof header === "string") headerIndex.set(header.trim(), index);
  });

  const rows: Array<{ employeeCode: string; checkIn: string; checkOut?: string }> = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const employeeCode = String(row.getCell(headerIndex.get("employeeCode") ?? 1).text ?? "").trim();
    const checkIn = String(row.getCell(headerIndex.get("checkIn") ?? 2).text ?? "").trim();
    const checkOut = String(row.getCell(headerIndex.get("checkOut") ?? 3).text ?? "").trim();
    if (employeeCode && checkIn) rows.push({ employeeCode, checkIn, checkOut: checkOut || undefined });
  });
  return rows;
}

router.use(requireAuth);

router.get("/", requireRoles(Role.ADMIN, Role.HR, Role.ACCOUNTANT), async (_req, res) => {
  const records = await prisma.attendance.findMany({ include: { employee: true }, orderBy: { workDate: "desc" }, take: 100 });
  res.json(records);
});

router.get("/template.csv", requireRoles(Role.ADMIN, Role.HR), (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.attachment("attendance-import-template.csv");
  res.send(csvTemplate(attendanceHeaders));
});

router.get("/template.xlsx", requireRoles(Role.ADMIN, Role.HR), async (_req, res) => {
  await xlsxTemplate(res, "attendance-import-template.xlsx", attendanceHeaders, "Attendance");
});

router.get("/export.csv", requireRoles(Role.ADMIN, Role.HR, Role.ACCOUNTANT, Role.AUDITOR), async (req, res) => {
  const records = await prisma.attendance.findMany({ include: { employee: { include: { department: true } } }, orderBy: { workDate: "desc" }, take: 2000 });
  const headers = ["Employee Code", "Employee Name", "Department", "Date", "Check In", "Check Out", "Late Minutes", "Overtime Hours", "Source", "Status"];
  await audit(req, "EXPORT", "Attendance", undefined, { format: "CSV", count: records.length });
  csvFile(res, "attendance-export.csv", headers, records.map((record) => [record.employee.employeeCode, `${record.employee.firstName} ${record.employee.lastName}`, record.employee.department.name, record.workDate.toISOString().slice(0, 10), record.checkIn?.toISOString() ?? "", record.checkOut?.toISOString() ?? "", record.lateMinutes, record.overtimeHours, record.source, record.status]));
});

router.get("/export.xlsx", requireRoles(Role.ADMIN, Role.HR, Role.ACCOUNTANT, Role.AUDITOR), async (req, res) => {
  const records = await prisma.attendance.findMany({ include: { employee: { include: { department: true } } }, orderBy: { workDate: "desc" }, take: 2000 });
  const headers = ["Employee Code", "Employee Name", "Department", "Date", "Check In", "Check Out", "Late Minutes", "Overtime Hours", "Source", "Status"];
  await audit(req, "EXPORT", "Attendance", undefined, { format: "XLSX", count: records.length });
  await xlsxFile(res, "attendance-export.xlsx", headers, records.map((record) => [record.employee.employeeCode, `${record.employee.firstName} ${record.employee.lastName}`, record.employee.department.name, record.workDate.toISOString().slice(0, 10), record.checkIn?.toISOString() ?? "", record.checkOut?.toISOString() ?? "", record.lateMinutes, String(record.overtimeHours), record.source, record.status]), "Attendance");
});

router.post("/import", requireRoles(Role.ADMIN, Role.HR), async (req, res, next) => {
  try {
    const body = importSchema.parse(req.body);
    const rows = body.contentBase64 && body.fileName?.toLowerCase().endsWith(".xlsx")
      ? await parseExcelRows(body.contentBase64)
      : parse(body.content ?? "", { columns: true, skip_empty_lines: true, trim: true }) as Array<{
      employeeCode: string;
      checkIn: string;
      checkOut?: string;
    }>;

    const results = [];
    for (const row of rows) {
      const employee = await prisma.employee.findUnique({ where: { employeeCode: row.employeeCode } });
      if (!employee) {
        results.push({ employeeCode: row.employeeCode, status: "SKIPPED", reason: "Employee not found" });
        continue;
      }

      const checkIn = new Date(row.checkIn);
      const checkOut = row.checkOut ? new Date(row.checkOut) : undefined;
      const attendance = await prisma.attendance.upsert({
        where: { employeeId_workDate: { employeeId: employee.id, workDate: startOfWorkDate(checkIn) } },
        update: {
          checkIn,
          checkOut,
          lateMinutes: lateMinutes(checkIn),
          overtimeHours: overtimeHours(checkOut),
          status: "PRESENT",
          source: "BIOMETRIC"
        },
        create: {
          employeeId: employee.id,
          workDate: startOfWorkDate(checkIn),
          checkIn,
          checkOut,
          lateMinutes: lateMinutes(checkIn),
          overtimeHours: overtimeHours(checkOut),
          status: "PRESENT",
          source: "BIOMETRIC"
        }
      });
      results.push({ employeeCode: row.employeeCode, status: "IMPORTED", id: attendance.id });
    }

    await audit(req, "IMPORT", "Attendance", undefined, { rows: rows.length });
    res.json({ imported: results.filter((r) => r.status === "IMPORTED").length, results });
  } catch (error) {
    next(error);
  }
});

router.post("/detect-absences", requireRoles(Role.ADMIN, Role.HR), async (req, res, next) => {
  try {
    const { workDate } = absenceSchema.parse(req.body);
    const date = startOfWorkDate(workDate);
    const employees = await prisma.employee.findMany({ where: { status: "ACTIVE" } });
    let created = 0;

    for (const employee of employees) {
      const existing = await prisma.attendance.findUnique({ where: { employeeId_workDate: { employeeId: employee.id, workDate: date } } });
      if (!existing) {
        await prisma.attendance.create({ data: { employeeId: employee.id, workDate: date, status: "ABSENT", source: "SYSTEM" } });
        created += 1;
      }
    }

    await audit(req, "DETECT_ABSENCES", "Attendance", undefined, { workDate: date, created });
    res.json({ created });
  } catch (error) {
    next(error);
  }
});

export default router;
