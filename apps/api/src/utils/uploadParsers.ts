import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import type { Response } from "express";

export type UploadRow = Record<string, string>;

export async function rowsFromUpload(input: { content?: string; contentBase64?: string; fileName?: string }) {
  if (input.contentBase64 && input.fileName?.toLowerCase().endsWith(".xlsx")) {
    const workbook = new ExcelJS.Workbook();
    const source = Buffer.from(input.contentBase64, "base64");
    const arrayBuffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];
    const headers = worksheet.getRow(1).values as Array<string | undefined>;
    const rows: UploadRow[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: UploadRow = {};
      headers.forEach((header, index) => {
        if (typeof header === "string") record[header.trim()] = String(row.getCell(index).text ?? "").trim();
      });
      if (Object.values(record).some(Boolean)) rows.push(record);
    });
    return rows;
  }

  return parse(input.content ?? "", { columns: true, skip_empty_lines: true, trim: true }) as UploadRow[];
}

export function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function csvTemplate(headers: string[]) {
  return `${headers.join(",")}\n`;
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvFile(res: Response, fileName: string, headers: string[], rows: Array<Array<unknown>>) {
  res.header("Content-Type", "text/csv");
  res.attachment(fileName);
  res.send([headers.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n"));
}

export async function xlsxFile(res: Response, fileName: string, headers: string[], rows: Array<Array<unknown>>, sheetName = "Export") {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));
  worksheet.getRow(1).font = { bold: true };
  worksheet.columns.forEach((column) => {
    column.width = Math.min(Math.max(12, ...((column.values ?? []).map((value) => String(value ?? "").length + 2))), 40);
  });
  const buffer = await workbook.xlsx.writeBuffer();
  res.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.attachment(fileName);
  res.send(Buffer.from(buffer));
}

export async function xlsxTemplate(res: Response, fileName: string, headers: string[], sheetName = "Template") {
  await xlsxFile(res, fileName, headers, [], sheetName);
}
