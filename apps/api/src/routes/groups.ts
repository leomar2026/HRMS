import { Prisma, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";
import { csvFile, csvTemplate, rowsFromUpload, xlsxFile, xlsxTemplate } from "../utils/uploadParsers.js";

const router = Router();
const groupRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR, Role.PAYROLL_OFFICER, Role.ACCOUNTANT, Role.FINANCE];
const groupHeaders = ["groupCode", "groupName", "groupType", "description", "company", "branch", "department", "status", "groupOwner"];

const groupSchema = z.object({
  groupCode: z.string().min(2),
  groupName: z.string().min(2),
  description: z.string().optional(),
  groupType: z.enum(["EMPLOYEE", "DEPARTMENT", "PAYROLL", "LEAVE", "ATTENDANCE", "REPORT", "DOCUMENT"]),
  company: z.string().optional(),
  branch: z.string().optional(),
  department: z.string().optional(),
  status: z.string().default("ACTIVE"),
  groupOwner: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

const memberSchema = z.object({
  employeeIds: z.array(z.string()).default([])
});

router.use(requireAuth, requireRoles(...groupRoles));

router.get("/template.csv", (_req, res) => {
  res.header("Content-Type", "text/csv");
  res.attachment("group-import-template.csv");
  res.send(csvTemplate(groupHeaders));
});

router.get("/template.xlsx", async (_req, res) => {
  await xlsxTemplate(res, "group-import-template.xlsx", groupHeaders, "Groups");
});

router.get("/", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const groupType = typeof req.query.groupType === "string" ? req.query.groupType : undefined;
  const groups = await prisma.managementGroup.findMany({
    where: {
      archivedAt: null,
      ...(groupType ? { groupType } : {}),
      ...(search ? { OR: [{ groupCode: { contains: search, mode: "insensitive" } }, { groupName: { contains: search, mode: "insensitive" } }] } : {})
    },
    include: { _count: { select: { members: true } } },
    orderBy: { updatedAt: "desc" }
  });
  res.json(groups);
});

router.get("/export.csv", async (req, res) => {
  const groups = await prisma.managementGroup.findMany({ where: { archivedAt: null }, include: { _count: { select: { members: true } } }, orderBy: { groupCode: "asc" } });
  const headers = ["Group Code", "Group Name", "Group Type", "Company", "Branch", "Department", "Status", "Members"];
  await audit(req, "EXPORT", "ManagementGroup", undefined, { format: "CSV", count: groups.length });
  csvFile(res, "groups.csv", headers, groups.map((group) => [group.groupCode, group.groupName, group.groupType, group.company ?? "", group.branch ?? "", group.department ?? "", group.status, group._count.members]));
});

router.get("/export.xlsx", async (req, res) => {
  const groups = await prisma.managementGroup.findMany({ where: { archivedAt: null }, include: { _count: { select: { members: true } } }, orderBy: { groupCode: "asc" } });
  const headers = ["Group Code", "Group Name", "Group Type", "Company", "Branch", "Department", "Status", "Members"];
  await audit(req, "EXPORT", "ManagementGroup", undefined, { format: "XLSX", count: groups.length });
  await xlsxFile(res, "groups.xlsx", headers, groups.map((group) => [group.groupCode, group.groupName, group.groupType, group.company ?? "", group.branch ?? "", group.department ?? "", group.status, group._count.members]), "Groups");
});

router.get("/export-members.csv", async (_req, res) => {
  const members = await prisma.groupMember.findMany({ include: { group: true, employee: { include: { department: true } } }, orderBy: { createdAt: "desc" } });
  const rows = members.map((member) => [
    member.group.groupCode,
    member.group.groupName,
    member.employee.employeeCode,
    `${member.employee.firstName} ${member.employee.lastName}`,
    member.employee.department.name,
    member.employee.jobTitle,
    member.employee.status
  ].join(","));
  res.header("Content-Type", "text/csv");
  res.attachment("all-group-members.csv");
  res.send(["Group Code,Group Name,Employee Code,Employee Name,Department,Designation,Status", ...rows].join("\n"));
});

router.post("/", async (req, res, next) => {
  try {
    const body = groupSchema.parse(req.body);
    const group = await prisma.managementGroup.create({ data: { ...body, metadata: body.metadata as Prisma.InputJsonValue | undefined, createdBy: req.user?.id } });
    await audit(req, "CREATE", "ManagementGroup", group.id, { groupCode: group.groupCode }, undefined, group);
    res.status(201).json(group);
  } catch (error) {
    next(error);
  }
});

router.post("/import", async (req, res, next) => {
  try {
    const rows = await rowsFromUpload(req.body);
    const errors: Array<{ row: number; column: string; message: string }> = [];
    let saved = 0;
    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const parsed = groupSchema.safeParse({
        groupCode: row.groupCode,
        groupName: row.groupName,
        groupType: row.groupType,
        description: row.description || undefined,
        company: row.company || undefined,
        branch: row.branch || undefined,
        department: row.department || undefined,
        status: row.status || "ACTIVE",
        groupOwner: row.groupOwner || undefined
      });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) errors.push({ row: rowNumber, column: String(issue.path[0] ?? "row"), message: issue.message });
        continue;
      }
      await prisma.managementGroup.upsert({
        where: { groupCode: parsed.data.groupCode },
        update: { ...parsed.data, metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined },
        create: { ...parsed.data, metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined, createdBy: req.user?.id }
      });
      saved += 1;
    }
    await audit(req, "IMPORT", "ManagementGroup", undefined, { totalRows: rows.length, saved, failed: errors.length });
    if (saved === 0) return res.status(400).json({ message: "No valid records found to import.", errors });
    res.json({ message: errors.length ? "Import completed with errors. Download error report." : "Import completed successfully.", saved, errors });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = groupSchema.partial().parse(req.body);
    const previous = await prisma.managementGroup.findUnique({ where: { id } });
    const group = await prisma.managementGroup.update({ where: { id }, data: { ...body, metadata: body.metadata as Prisma.InputJsonValue | undefined } });
    await audit(req, "UPDATE", "ManagementGroup", id, undefined, previous ?? undefined, group);
    res.json(group);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const previous = await prisma.managementGroup.findUnique({ where: { id } });
    const group = await prisma.managementGroup.update({ where: { id }, data: { archivedAt: new Date(), status: "ARCHIVED" } });
    await audit(req, "ARCHIVE", "ManagementGroup", id, undefined, previous ?? undefined, group);
    res.json(group);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/members", async (req, res) => {
  const members = await prisma.groupMember.findMany({ where: { groupId: String(req.params.id) }, include: { employee: { include: { department: true } } }, orderBy: { createdAt: "desc" } });
  res.json(members);
});

router.post("/:id/members", async (req, res, next) => {
  try {
    const groupId = String(req.params.id);
    const body = memberSchema.parse(req.body);
    for (const employeeId of body.employeeIds) {
      await prisma.groupMember.upsert({
        where: { groupId_employeeId: { groupId, employeeId } },
        update: {},
        create: { groupId, employeeId }
      });
    }
    await audit(req, "ADD_MEMBERS", "ManagementGroup", groupId, { count: body.employeeIds.length });
    res.json(await prisma.managementGroup.findUnique({ where: { id: groupId }, include: { _count: { select: { members: true } } } }));
  } catch (error) {
    next(error);
  }
});

router.get("/:id/export-members.csv", async (req, res) => {
  const members = await prisma.groupMember.findMany({ where: { groupId: String(req.params.id) }, include: { employee: { include: { department: true } } } });
  const rows = members.map((member) => [member.employee.employeeCode, `${member.employee.firstName} ${member.employee.lastName}`, member.employee.department.name, member.employee.jobTitle, member.employee.status].join(","));
  res.header("Content-Type", "text/csv");
  res.attachment("group-members.csv");
  res.send(["Employee Code,Employee Name,Department,Designation,Status", ...rows].join("\n"));
});

export default router;
