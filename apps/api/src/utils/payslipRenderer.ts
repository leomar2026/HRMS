import type { Response } from "express";
import PDFDocument from "pdfkit";

type MoneyValue = string | number | { toString(): string };

export type PayslipComponent = {
  name: string;
  value: MoneyValue;
};

export type PayslipInput = {
  company: {
    name: string;
    nameArabic?: string;
    registration?: string;
    vatNumber?: string;
    address?: string;
    cityCountry?: string;
    telephone?: string;
    fax?: string;
    email?: string;
    website?: string;
    gosiNumber?: string;
    qiwaReference?: string;
    bankDetails?: string;
    authorizedSignatory?: string;
    logoDataUrl?: string;
    logoVersion?: number;
  };
  employee: {
    name: string;
    code: string;
    department?: string;
    designation?: string;
    nationalId?: string;
    gosiNumber?: string;
    branch?: string;
    costCenter?: string;
    bankName?: string;
    iban?: string;
    joiningDate?: Date | string;
    managerName?: string;
    status?: string;
  };
  payroll: {
    month: number;
    year: number;
    period?: string;
    reference: string;
    batchNumber?: string;
    currency?: string;
    paymentDate?: Date | string;
    paymentMethod?: string;
    status?: string;
    printedBy?: string;
  };
  attendance?: {
    payrollDays?: number;
    presentDays?: number;
    absentDays?: number;
    weeklyOffDays?: number;
    publicHolidays?: number;
    normalOvertimeHours?: number;
    holidayOvertimeHours?: number;
  };
  earnings: PayslipComponent[];
  deductions: PayslipComponent[];
  netSalary: MoneyValue;
  remarks?: string;
};

const page = { width: 595.28, height: 841.89 };
const margin = 30;

function money(value: MoneyValue) {
  return Number(value?.toString?.() ?? value ?? 0);
}

function formatMoney(value: MoneyValue, currency = "SAR") {
  return `${money(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatDate(value?: Date | string) {
  if (!value) return "-";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "-" : value.toISOString().slice(0, 10);
  const raw = String(value).trim();
  if (!raw) return "-";
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function maskIban(iban?: string) {
  if (!iban) return "-";
  const compact = iban.replace(/\s/g, "");
  if (compact.length <= 4) return compact;
  return `${"*".repeat(Math.max(0, compact.length - 4))}${compact.slice(-4)}`;
}

function componentTotal(items: PayslipComponent[]) {
  return items.reduce((sum, item) => sum + money(item.value), 0);
}

function drawBox(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, title?: string) {
  doc.lineWidth(0.7).strokeColor("#172033").rect(x, y, w, h).stroke();
  if (title) {
    doc.rect(x, y, w, 20).fillAndStroke("#eef6f5", "#172033");
    doc.fillColor("#172033").font("Helvetica-Bold").fontSize(9).text(title, x + 8, y + 6, { width: w - 16 });
  }
}

function drawKeyValueRows(doc: PDFKit.PDFDocument, rows: Array<[string, string]>, x: number, y: number, w: number, rowHeight = 17) {
  rows.forEach(([label, value], index) => {
    const rowY = y + index * rowHeight;
    doc.strokeColor("#dfe4ec").lineWidth(0.4).moveTo(x, rowY + rowHeight).lineTo(x + w, rowY + rowHeight).stroke();
    doc.fillColor("#607089").font("Helvetica").fontSize(7.5).text(label, x + 6, rowY + 5, { width: w * 0.43 });
    doc.fillColor("#172033").font("Helvetica-Bold").fontSize(7.5).text(value || "-", x + w * 0.45, rowY + 5, { width: w * 0.5 });
  });
}

function drawComponentTable(doc: PDFKit.PDFDocument, title: string, rows: PayslipComponent[], totalLabel: string, x: number, y: number, w: number, currency: string) {
  const rowHeight = 18;
  const tableHeight = 24 + (Math.max(rows.length, 10) + 1) * rowHeight;
  drawBox(doc, x, y, w, tableHeight, title);
  const startY = y + 20;
  doc.rect(x, startY, w, 22).fillAndStroke("#f7f8fb", "#172033");
  doc.fillColor("#172033").font("Helvetica-Bold").fontSize(8).text("Component Name", x + 8, startY + 7, { width: w * 0.58 });
  doc.text("Component Value", x + w * 0.62, startY + 7, { width: w * 0.34, align: "right" });

  const paddedRows = [...rows];
  while (paddedRows.length < 10) paddedRows.push({ name: "", value: 0 });
  paddedRows.forEach((row, index) => {
    const rowY = startY + 22 + index * rowHeight;
    doc.strokeColor("#dfe4ec").lineWidth(0.35).moveTo(x, rowY + rowHeight).lineTo(x + w, rowY + rowHeight).stroke();
    doc.fillColor("#172033").font("Helvetica").fontSize(8).text(row.name, x + 8, rowY + 5, { width: w * 0.58 });
    doc.text(row.name ? formatMoney(row.value, currency) : "", x + w * 0.62, rowY + 5, { width: w * 0.34, align: "right" });
  });

  const totalY = startY + 22 + paddedRows.length * rowHeight;
  doc.rect(x, totalY, w, rowHeight + 2).fillAndStroke("#eef6f5", "#172033");
  doc.fillColor("#172033").font("Helvetica-Bold").fontSize(8.5).text(totalLabel, x + 8, totalY + 6, { width: w * 0.58 });
  doc.text(formatMoney(componentTotal(rows), currency), x + w * 0.62, totalY + 6, { width: w * 0.34, align: "right" });
  return tableHeight;
}

function dataUrlImageBuffer(dataUrl?: string) {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[2], "base64");
}

export function renderPayslipPdf(res: Response, input: PayslipInput) {
  const currency = input.payroll.currency ?? "SAR";
  const totalEarnings = componentTotal(input.earnings);
  const totalDeductions = componentTotal(input.deductions);
  const net = money(input.netSalary);
  if (Math.abs(totalEarnings - totalDeductions - net) > 0.01) {
    throw new Error("Payslip validation failed: net salary does not match earnings minus deductions");
  }
  if (!input.employee.code || !input.payroll.month || !input.payroll.year || !input.company.name) {
    throw new Error("Payslip validation failed: employee, payroll, and company details are required");
  }

  const doc = new PDFDocument({ size: "A4", margin });
  res.header("Content-Type", "application/pdf");
  res.attachment(`payslip-${input.employee.code}-${input.payroll.year}-${input.payroll.month}.pdf`);
  doc.pipe(res);

  const contentWidth = page.width - margin * 2;
  const printedAt = new Date();

  drawBox(doc, margin, 24, contentWidth, 94);
  const logoBuffer = dataUrlImageBuffer(input.company.logoDataUrl);
  if (logoBuffer) {
    doc.image(logoBuffer, margin + 12, 36, { fit: [58, 58], align: "center", valign: "center" });
    doc.strokeColor("#172033").rect(margin + 12, 36, 58, 58).stroke();
  } else {
    doc.rect(margin + 12, 38, 58, 58).fillAndStroke("#eef6f5", "#172033");
    doc.fillColor("#0f766e").font("Helvetica-Bold").fontSize(16).text("HR", margin + 29, 57);
  }
  doc.fillColor("#172033").font("Helvetica-Bold").fontSize(14).text(input.company.name, margin + 84, 36, { width: 250 });
  doc.font("Helvetica").fontSize(8).fillColor("#172033")
    .text([input.company.registration, input.company.vatNumber ? `VAT: ${input.company.vatNumber}` : ""].filter(Boolean).join(" | ") || "Company Registration / CR", margin + 84, 56)
    .text(input.company.address ?? "Company Address", margin + 84, 68)
    .text(input.company.cityCountry ?? "Riyadh, Saudi Arabia", margin + 84, 80)
    .text(`Tel: ${input.company.telephone ?? "-"}    Fax: ${input.company.fax ?? "-"}`, margin + 84, 92);
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#172033").text("Employee Payslip", margin + 360, 38, { width: 170, align: "right" });
  doc.font("Helvetica").fontSize(8)
    .text(`Payroll Month: ${input.payroll.month}`, margin + 360, 65, { width: 170, align: "right" })
    .text(`Payroll Year: ${input.payroll.year}`, margin + 360, 78, { width: 170, align: "right" })
    .text(`Reference: ${input.payroll.reference}`, margin + 360, 91, { width: 170, align: "right" })
    .text(`Currency: ${currency}`, margin + 360, 104, { width: 170, align: "right" });

  const infoY = 130;
  const colW = (contentWidth - 12) / 2;
  const leftRows: Array<[string, string]> = [
    ["Employee Name", input.employee.name],
    ["Employee Code", input.employee.code],
    ["Department", input.employee.department ?? "-"],
    ["Designation", input.employee.designation ?? "-"],
    ["Payroll Month", String(input.payroll.month)],
    ["Payroll Year", String(input.payroll.year)],
    ["Present Days", String(input.attendance?.presentDays ?? 30)],
    ["Absent Days", String(input.attendance?.absentDays ?? 0)],
    ["Weekly Off Days", String(input.attendance?.weeklyOffDays ?? 0)]
  ];
  const rightRows: Array<[string, string]> = [
    ["Employee Code", input.employee.code],
    ["Designation", input.employee.designation ?? "-"],
    ["Payroll Days", String(input.attendance?.payrollDays ?? 30)],
    ["Normal OT Hours", String(input.attendance?.normalOvertimeHours ?? 0)],
    ["Holiday OT Hours", String(input.attendance?.holidayOvertimeHours ?? 0)],
    ["Public Holidays", String(input.attendance?.publicHolidays ?? 0)],
    ["Bank Name", input.employee.bankName ?? "-"],
    ["IBAN", maskIban(input.employee.iban)],
    ["Joining Date", formatDate(input.employee.joiningDate)]
  ];
  drawBox(doc, margin, infoY, colW, 178, "Employee Information");
  drawBox(doc, margin + colW + 12, infoY, colW, 178, "Attendance / Payroll Summary");
  drawKeyValueRows(doc, leftRows, margin, infoY + 24, colW);
  drawKeyValueRows(doc, rightRows, margin + colW + 12, infoY + 24, colW);

  const tableY = 322;
  const tableH = Math.max(
    drawComponentTable(doc, "Earning Components", input.earnings, "Total Earnings", margin, tableY, colW, currency),
    drawComponentTable(doc, "Deduction Components", input.deductions, "Total Deductions", margin + colW + 12, tableY, colW, currency)
  );

  const netY = tableY + tableH + 16;
  drawBox(doc, margin, netY, contentWidth, 72);
  doc.rect(margin, netY, contentWidth, 24).fillAndStroke("#0f766e", "#172033");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11).text("Total Payable to Employee", margin + 10, netY + 7);
  doc.text(formatMoney(net, currency), margin + contentWidth - 180, netY + 7, { width: 170, align: "right" });
  doc.fillColor("#172033").font("Helvetica").fontSize(8)
    .text(`Net Salary: ${formatMoney(net, currency)}`, margin + 10, netY + 34)
    .text(`Payment Date: ${formatDate(input.payroll.paymentDate)}`, margin + 10, netY + 48)
    .text(`Payment Method: ${input.payroll.paymentMethod ?? "Bank Transfer"}`, margin + 240, netY + 34)
    .text(`Bank / IBAN: ${input.employee.bankName ?? "-"} / ${maskIban(input.employee.iban)}`, margin + 240, netY + 48);

  const sigY = netY + 92;
  drawBox(doc, margin, sigY, contentWidth, 74, "Signatures");
  const sigW = contentWidth / 3;
  ["Employee Signature", input.company.authorizedSignatory ?? "Authorized Signature", "HR / Payroll Officer"].forEach((label, index) => {
    const x = margin + index * sigW;
    doc.strokeColor("#172033").moveTo(x + 28, sigY + 52).lineTo(x + sigW - 28, sigY + 52).stroke();
    doc.fillColor("#172033").font("Helvetica").fontSize(8).text(label, x, sigY + 56, { width: sigW, align: "center" });
  });

  const footerY = page.height - 82;
  doc.strokeColor("#dfe4ec").moveTo(margin, footerY).lineTo(page.width - margin, footerY).stroke();
  doc.fillColor("#172033").font("Helvetica").fontSize(7.5)
    .text(`Printed: ${printedAt.toLocaleString()} | Printed By: ${input.payroll.printedBy ?? "-"} | Batch: ${input.payroll.batchNumber ?? "-"} | Reference: ${input.payroll.reference}`, margin, footerY + 8, { width: contentWidth })
    .text("This payslip contains confidential salary information and is intended only for the employee.", margin, footerY + 23, { width: contentWidth })
    .text("Page 1 of 1", margin, footerY + 38, { width: contentWidth, align: "right" });

  doc.end();
}
