import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Role } from "@prisma/client";
import { Router, type Request } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { audit } from "../utils/audit.js";

const router = Router();
const uploadRoot = path.resolve(process.cwd(), "uploads");
const allowedExtensions = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"]);
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png"
]);
const defaultMaxBytes = 10 * 1024 * 1024;

router.use(requireAuth);

async function requestBuffer(req: Request) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function parseContentDisposition(value: string) {
  const result: Record<string, string> = {};
  for (const part of value.split(";")) {
    const [key, raw] = part.trim().split("=");
    if (key && raw) result[key] = raw.replace(/^"|"$/g, "");
  }
  return result;
}

function parseMultipart(buffer: Buffer, contentType: string) {
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] ?? contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
  if (!boundary) throw new AppError(400, "Upload failed. Please try again.");
  const delimiter = Buffer.from(`--${boundary}`);
  const fields: Record<string, string> = {};
  let file: { fieldName: string; originalFileName: string; mimeType: string; buffer: Buffer } | undefined;
  let start = buffer.indexOf(delimiter);
  while (start !== -1) {
    const next = buffer.indexOf(delimiter, start + delimiter.length);
    if (next === -1) break;
    let part = buffer.subarray(start + delimiter.length, next);
    if (part.subarray(0, 2).toString() === "\r\n") part = part.subarray(2);
    if (part.subarray(part.length - 2).toString() === "\r\n") part = part.subarray(0, part.length - 2);
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd > -1) {
      const headerText = part.subarray(0, headerEnd).toString("utf8");
      const body = part.subarray(headerEnd + 4);
      const disposition = headerText.split("\r\n").find((line) => line.toLowerCase().startsWith("content-disposition"));
      if (disposition) {
        const values = parseContentDisposition(disposition.split(":").slice(1).join(":"));
        const name = values.name;
        const filename = values.filename;
        const mimeType = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() ?? "application/octet-stream";
        if (name && filename) file = { fieldName: name, originalFileName: path.basename(filename), mimeType, buffer: body };
        else if (name) fields[name] = body.toString("utf8");
      }
    }
    start = next;
  }
  return { fields, file };
}

async function maxUploadBytes() {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "ATTACHMENT_MAX_UPLOAD_MB" } }).catch(() => null);
  const value = Number(setting?.value ?? 10);
  return Number.isFinite(value) && value > 0 ? value * 1024 * 1024 : defaultMaxBytes;
}

function canAccess(req: Request, attachment: { employeeId?: string | null; uploadedBy?: string | null; confidential: boolean }) {
  const privilegedRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR, Role.FINANCE, Role.ACCOUNTANT, Role.DEPARTMENT_MANAGER, Role.OPERATIONS_MANAGER, Role.PAYROLL_OFFICER];
  const privileged = privilegedRoles.includes(req.user?.role as Role);
  if (privileged) return true;
  if (req.user?.role === Role.EMPLOYEE) return attachment.employeeId === req.user.employeeId || attachment.uploadedBy === req.user.id;
  return false;
}

router.post("/", async (req, res, next) => {
  try {
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("multipart/form-data")) throw new AppError(400, "Upload failed. Please try again.");
    const { fields, file } = parseMultipart(await requestBuffer(req), contentType);
    if (!file || file.buffer.length === 0) throw new AppError(400, "Please select a file.");
    const extension = path.extname(file.originalFileName).toLowerCase();
    if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(file.mimeType)) throw new AppError(400, "File type is not allowed.");
    const maxBytes = await maxUploadBytes();
    if (file.buffer.length > maxBytes) throw new AppError(400, "File exceeds maximum allowed size.");
    const relatedModule = fields.relatedModule?.trim();
    if (!relatedModule) throw new AppError(400, "Related module is required.");
    const employeeId = req.user?.role === Role.EMPLOYEE ? req.user.employeeId : fields.employeeId || req.user?.employeeId;
    const storedFileName = `${Date.now()}-${randomUUID()}${extension}`;
    const moduleDir = path.join(uploadRoot, relatedModule.replace(/[^a-z0-9_-]/gi, "_"));
    await mkdir(moduleDir, { recursive: true });
    const filePath = path.join(moduleDir, storedFileName);
    await writeFile(filePath, file.buffer);
    const attachment = await prisma.attachment.create({
      data: {
        relatedModule,
        relatedRecordId: fields.relatedRecordId || undefined,
        relatedRecordNumber: fields.relatedRecordNumber || undefined,
        employeeId: employeeId || undefined,
        originalFileName: file.originalFileName,
        storedFileName,
        filePath,
        fileUrl: `/api/attachments/${storedFileName}`,
        mimeType: file.mimeType,
        sizeBytes: file.buffer.length,
        uploadedBy: req.user?.id,
        confidential: fields.confidential === "true",
        metadata: { fieldName: file.fieldName, attachmentType: fields.attachmentType || undefined }
      }
    });
    await audit(req, "UPLOAD_ATTACHMENT", "Attachment", attachment.id, { relatedModule, relatedRecordId: fields.relatedRecordId, fileName: file.originalFileName });
    res.status(201).json({ ...attachment, message: "File uploaded successfully." });
  } catch (error) {
    console.error("Attachment upload failed", error);
    next(error);
  }
});

router.get("/", async (req, res) => {
  const relatedModule = typeof req.query.relatedModule === "string" ? req.query.relatedModule : undefined;
  const relatedRecordId = typeof req.query.relatedRecordId === "string" ? req.query.relatedRecordId : undefined;
  const where = {
    archivedAt: null,
    ...(relatedModule ? { relatedModule } : {}),
    ...(relatedRecordId ? { relatedRecordId } : {}),
    ...(req.user?.role === Role.EMPLOYEE ? { OR: [{ employeeId: req.user.employeeId ?? "" }, { uploadedBy: req.user.id }] } : {})
  };
  const rows = await prisma.attachment.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows);
});

router.get("/:id/download", async (req, res, next) => {
  try {
    const attachment = await prisma.attachment.findFirst({ where: { id: String(req.params.id), archivedAt: null } });
    if (!attachment) throw new AppError(404, "Attachment not found");
    if (!canAccess(req, attachment)) throw new AppError(403, "Insufficient permissions");
    await audit(req, "DOWNLOAD_ATTACHMENT", "Attachment", attachment.id, { fileName: attachment.originalFileName });
    res.header("Content-Type", attachment.mimeType);
    res.attachment(attachment.originalFileName);
    createReadStream(attachment.filePath).pipe(res);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/preview", async (req, res, next) => {
  try {
    const attachment = await prisma.attachment.findFirst({ where: { id: String(req.params.id), archivedAt: null } });
    if (!attachment) throw new AppError(404, "Attachment not found");
    if (!canAccess(req, attachment)) throw new AppError(403, "Insufficient permissions");
    await audit(req, "PREVIEW_ATTACHMENT", "Attachment", attachment.id, { fileName: attachment.originalFileName });
    res.header("Content-Type", attachment.mimeType);
    res.header("Content-Disposition", `inline; filename="${attachment.originalFileName.replace(/"/g, "")}"`);
    createReadStream(attachment.filePath).pipe(res);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const attachment = await prisma.attachment.findFirst({ where: { id: String(req.params.id), archivedAt: null } });
    if (!attachment) throw new AppError(404, "Attachment not found");
    if (!canAccess(req, attachment)) throw new AppError(403, "Insufficient permissions");
    const updated = await prisma.attachment.update({ where: { id: attachment.id }, data: { archivedAt: new Date(), status: "DELETED" } });
    await audit(req, "DELETE_ATTACHMENT", "Attachment", attachment.id, { fileName: attachment.originalFileName }, attachment, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
