import type { PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

type SeriesClient = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

type SeriesDefault = {
  code: string;
  name: string;
  prefix: string;
  padding?: number;
  separator?: string;
  resetFrequency?: string;
};

export const defaultNumberSeries: SeriesDefault[] = [
  { code: "LEAVE_REQUEST", name: "Leave Request", prefix: "LR-{YYYY}", padding: 5 },
  { code: "BUSINESS_TRIP", name: "Business Trip Request", prefix: "TRIP-{YYYY}", padding: 5 },
  { code: "TRIP_EXPENSE", name: "Business Trip Expense Claim", prefix: "TEXP-{YYYY}", padding: 5 },
  { code: "LOAN_REQUEST", name: "Loan / Advance Request", prefix: "LOAN-{YYYY}", padding: 5 },
  { code: "PETTY_CASH", name: "Petty Cash Request", prefix: "PC-{YYYY}", padding: 5 },
  { code: "TICKET_REQUEST", name: "Ticket Request", prefix: "TKT-{YYYY}", padding: 5 },
  { code: "RESIGNATION", name: "Resignation Request", prefix: "RES-{YYYY}", padding: 5 },
  { code: "EXIT_CLEARANCE", name: "Exit Clearance Item", prefix: "CLR-{YYYY}", padding: 5 },
  { code: "FINAL_SETTLEMENT", name: "Final Settlement", prefix: "SET-{YYYY}", padding: 5 },
  { code: "MANUAL_APPRAISAL", name: "Manual Appraisal", prefix: "MAPP-{YYYY}", padding: 5 },
  { code: "APPRAISAL_BATCH", name: "Bulk Appraisal Batch", prefix: "BAPP-{YYYY}", padding: 5 },
  { code: "PERFORMANCE_APPRAISAL", name: "Performance Appraisal", prefix: "APP-{YYYY}", padding: 5 },
  { code: "PAYSLIP", name: "Payslip Reference", prefix: "PAY-{YYYY}-{MM}", padding: 5 },
  { code: "EMPLOYEE_IMPORT_BATCH", name: "Employee Import Batch", prefix: "EMP-IMP-{YYYY}", padding: 5 },
  { code: "MASTER_BRANCH", name: "Branch Master Code", prefix: "BR", padding: 3, resetFrequency: "NEVER" },
  { code: "MASTER_LOCATION", name: "Location Master Code", prefix: "LOC", padding: 3, resetFrequency: "NEVER" },
  { code: "MASTER_JOB_TITLE", name: "Job Title Master Code", prefix: "JOB", padding: 3, resetFrequency: "NEVER" },
  { code: "MASTER_COST_CENTER", name: "Cost Center Master Code", prefix: "CC", padding: 3, resetFrequency: "NEVER" },
  { code: "MASTER_LEAVE_TYPE", name: "Leave Type Master Code", prefix: "LV", padding: 3, resetFrequency: "NEVER" },
  { code: "MASTER_LEAVE_POLICY", name: "Leave Policy Master Code", prefix: "LP", padding: 3, resetFrequency: "NEVER" },
  { code: "MASTER_SHIFT", name: "Shift Master Code", prefix: "SH", padding: 3, resetFrequency: "NEVER" },
  { code: "MASTER_BANK", name: "Bank Master Code", prefix: "BNK", padding: 3, resetFrequency: "NEVER" },
  { code: "MASTER_DOCUMENT_TYPE", name: "Document Type Master Code", prefix: "DOC", padding: 3, resetFrequency: "NEVER" },
  { code: "MASTER_PAYROLL_COMPONENT", name: "Payroll Component Master Code", prefix: "PCOMP", padding: 3, resetFrequency: "NEVER" },
  { code: "MASTER_WORKFLOW", name: "Workflow Master Code", prefix: "WFM", padding: 3, resetFrequency: "NEVER" },
  { code: "MASTER_HOLIDAY", name: "Holiday Master Code", prefix: "HOL", padding: 3, resetFrequency: "NEVER" }
];

function defaultFor(code: string) {
  return defaultNumberSeries.find((item) => item.code === code) ?? { code, name: code.replace(/_/g, " "), prefix: code, padding: 5 };
}

function resetKey(date: Date, resetFrequency: string) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  if (resetFrequency === "YEARLY") return yyyy;
  if (resetFrequency === "MONTHLY") return `${yyyy}-${mm}`;
  if (resetFrequency === "DAILY") return `${yyyy}-${mm}-${String(date.getDate()).padStart(2, "0")}`;
  return "NEVER";
}

function applyDateTokens(value: string, date: Date) {
  const yyyy = String(date.getFullYear());
  const yy = yyyy.slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return value.replaceAll("{YYYY}", yyyy).replaceAll("{YY}", yy).replaceAll("{MM}", mm).replaceAll("{DD}", dd);
}

export async function ensureDefaultNumberSeries(client: SeriesClient = prisma) {
  for (const item of defaultNumberSeries) {
    await client.numberSeries.upsert({
      where: { code: item.code },
      update: {},
      create: {
        code: item.code,
        name: item.name,
        prefix: item.prefix,
        padding: item.padding ?? 5,
        separator: item.separator ?? "-",
        resetFrequency: item.resetFrequency ?? "YEARLY",
        lastResetKey: resetKey(new Date(), item.resetFrequency ?? "YEARLY")
      }
    });
  }
}

export async function generateDocumentNumber(code: string, client: SeriesClient = prisma, date = new Date()) {
  const fallback = defaultFor(code);
  const currentKey = resetKey(date, fallback.resetFrequency ?? "YEARLY");
  const series = await client.numberSeries.upsert({
    where: { code },
    update: {},
    create: {
      code,
      name: fallback.name,
      prefix: fallback.prefix,
      padding: fallback.padding ?? 5,
      separator: fallback.separator ?? "-",
      resetFrequency: fallback.resetFrequency ?? "YEARLY",
      lastResetKey: currentKey
    }
  });

  if (!series.active) {
    return `${applyDateTokens(series.prefix, date)}${series.separator}${Date.now()}`;
  }

  const seriesResetKey = resetKey(date, series.resetFrequency);
  const shouldReset = series.resetFrequency !== "NEVER" && series.lastResetKey !== seriesResetKey;
  const updated = await client.numberSeries.update({
    where: { code },
    data: shouldReset
      ? { nextNumber: series.startNumber + 1, lastResetKey: seriesResetKey }
      : { nextNumber: { increment: 1 }, lastResetKey: series.lastResetKey ?? seriesResetKey }
  });
  const issuedNumber = shouldReset ? series.startNumber : updated.nextNumber - 1;
  return `${applyDateTokens(updated.prefix, date)}${updated.separator}${String(issuedNumber).padStart(updated.padding, "0")}`;
}
