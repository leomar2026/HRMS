import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";

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
