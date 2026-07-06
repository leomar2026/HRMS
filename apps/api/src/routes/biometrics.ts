import { BiometricConnectionType, BiometricDeviceStatus, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { audit } from "../utils/audit.js";
import { parseBiometricCsv, pullDeviceLogs, saveAndProcessPunches, testZktecoConnection } from "../services/zktecoService.js";
import { csvFile, xlsxFile } from "../utils/uploadParsers.js";

const router = Router();
const manageRoles = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.HR_OFFICER, Role.HR];

const deviceSchema = z.object({
  deviceName: z.string().min(2),
  deviceCode: z.string().min(1),
  brand: z.string().default("ZKTeco"),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  ipAddress: z.string().optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  connectionType: z.nativeEnum(BiometricConnectionType),
  deviceLocation: z.string().optional(),
  branch: z.string().optional(),
  departmentId: z.string().optional(),
  timezone: z.string().default("Asia/Riyadh"),
  status: z.nativeEnum(BiometricDeviceStatus).default(BiometricDeviceStatus.ACTIVE),
  syncIntervalMinutes: z.coerce.number().int().min(1).default(15),
  remarks: z.string().optional()
});

const mappingSchema = z.object({
  employeeId: z.string().min(1),
  deviceId: z.string().optional(),
  biometricId: z.string().optional(),
  deviceUserId: z.string().min(1),
  cardNumber: z.string().optional(),
  active: z.boolean().default(true),
  remarks: z.string().optional()
});

const importSchema = z.object({
  deviceId: z.string().min(1),
  content: z.string().min(1)
});

const adjustmentSchema = z.object({
  attendanceRecordId: z.string().optional(),
  reasonType: z.string().min(2),
  requestedCheckIn: z.coerce.date().optional(),
  requestedCheckOut: z.coerce.date().optional(),
  requestedShift: z.string().optional(),
  comments: z.string().max(1000).optional()
});

router.use(requireAuth);

router.get("/devices", requireRoles(...manageRoles), async (_req, res) => {
  const devices = await prisma.biometricDevice.findMany({
    where: { archivedAt: null },
    include: { department: true, _count: { select: { logs: true, mappings: true } } },
    orderBy: { deviceCode: "asc" }
  });
  res.json(devices);
});

router.post("/devices", requireRoles(...manageRoles), async (req, res, next) => {
  try {
    const body = deviceSchema.parse(req.body);
    const device = await prisma.biometricDevice.create({ data: { ...body, createdBy: req.user?.id } });
    await audit(req, "CREATE", "BiometricDevice", device.id, { deviceCode: device.deviceCode }, undefined, device);
    res.status(201).json(device);
  } catch (error) {
    next(error);
  }
});

router.patch("/devices/:id", requireRoles(...manageRoles), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = deviceSchema.partial().parse(req.body);
    const previous = await prisma.biometricDevice.findUnique({ where: { id } });
    const device = await prisma.biometricDevice.update({ where: { id }, data: body });
    await audit(req, "UPDATE", "BiometricDevice", id, undefined, previous ?? undefined, device);
    res.json(device);
  } catch (error) {
    next(error);
  }
});

router.delete("/devices/:id", requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const previous = await prisma.biometricDevice.findUnique({ where: { id } });
    const device = await prisma.biometricDevice.update({ where: { id }, data: { archivedAt: new Date(), status: BiometricDeviceStatus.INACTIVE } });
    await audit(req, "ARCHIVE", "BiometricDevice", id, undefined, previous ?? undefined, device);
    res.json(device);
  } catch (error) {
    next(error);
  }
});

router.post("/devices/:id/test-connection", requireRoles(...manageRoles), async (req, res, next) => {
  try {
    const device = await prisma.biometricDevice.findUnique({ where: { id: String(req.params.id) } });
    if (!device) return res.status(404).json({ message: "Device not found" });
    const result = await testZktecoConnection(device);
    const updated = await prisma.biometricDevice.update({
      where: { id: device.id },
      data: { connectionStatus: result.ok ? "CONNECTED" : "FAILED" }
    });
    await prisma.biometricErrorLog.create({
      data: { deviceId: device.id, action: "TEST_CONNECTION", message: result.message }
    });
    await audit(req, "TEST_CONNECTION", "BiometricDevice", device.id, result, device, updated);
    res.json({ ...result, device: updated });
  } catch (error) {
    next(error);
  }
});

router.post("/devices/:id/sync", requireRoles(...manageRoles), async (req, res, next) => {
  try {
    const device = await prisma.biometricDevice.findUnique({ where: { id: String(req.params.id) } });
    if (!device) return res.status(404).json({ message: "Device not found" });
    const history = await prisma.biometricSyncHistory.create({ data: { deviceId: device.id, connectionType: device.connectionType, triggeredBy: req.user?.id } });
    try {
      const punches = await pullDeviceLogs(device);
      const result = await saveAndProcessPunches(device, punches);
      const completed = await prisma.biometricSyncHistory.update({
        where: { id: history.id },
        data: { ...result, status: "COMPLETED", finishedAt: new Date() }
      });
      await prisma.biometricDevice.update({ where: { id: device.id }, data: { lastSyncAt: new Date() } });
      await audit(req, "SYNC", "BiometricDevice", device.id, result);
      res.json(completed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Biometric sync failed";
      const failed = await prisma.biometricSyncHistory.update({
        where: { id: history.id },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: message }
      });
      await prisma.biometricErrorLog.create({ data: { deviceId: device.id, action: "SYNC", message } });
      res.status(400).json(failed);
    }
  } catch (error) {
    next(error);
  }
});

router.post("/import", requireRoles(...manageRoles), async (req, res, next) => {
  try {
    const body = importSchema.parse(req.body);
    const device = await prisma.biometricDevice.findUnique({ where: { id: body.deviceId } });
    if (!device) return res.status(404).json({ message: "Device not found" });
    const punches = parseBiometricCsv(body.content);
    const history = await prisma.biometricSyncHistory.create({ data: { deviceId: device.id, connectionType: device.connectionType, triggeredBy: req.user?.id } });
    const result = await saveAndProcessPunches(device, punches);
    const completed = await prisma.biometricSyncHistory.update({
      where: { id: history.id },
      data: { ...result, status: "COMPLETED", finishedAt: new Date() }
    });
    await prisma.biometricDevice.update({ where: { id: device.id }, data: { lastSyncAt: new Date() } });
    await audit(req, "IMPORT", "BiometricDeviceLog", device.id, result);
    res.status(201).json(completed);
  } catch (error) {
    next(error);
  }
});

router.get("/mappings", requireRoles(...manageRoles), async (_req, res) => {
  const mappings = await prisma.biometricEmployeeMapping.findMany({
    where: { archivedAt: null },
    include: { employee: { include: { department: true } }, device: true },
    orderBy: { updatedAt: "desc" }
  });
  res.json(mappings);
});

router.post("/mappings", requireRoles(...manageRoles), async (req, res, next) => {
  try {
    const body = mappingSchema.parse(req.body);
    const mapping = await prisma.biometricEmployeeMapping.create({ data: { ...body, createdBy: req.user?.id }, include: { employee: true, device: true } });
    await prisma.employee.update({
      where: { id: body.employeeId },
      data: { biometricId: body.biometricId, deviceUserId: body.deviceUserId, cardNumber: body.cardNumber, deviceAssignment: body.deviceId, biometricActive: body.active }
    });
    await audit(req, "CREATE", "BiometricEmployeeMapping", mapping.id, undefined, undefined, mapping);
    res.status(201).json(mapping);
  } catch (error) {
    next(error);
  }
});

router.patch("/mappings/:id", requireRoles(...manageRoles), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = mappingSchema.partial().parse(req.body);
    const previous = await prisma.biometricEmployeeMapping.findUnique({ where: { id } });
    const mapping = await prisma.biometricEmployeeMapping.update({ where: { id }, data: body, include: { employee: true, device: true } });
    if (body.employeeId || body.biometricId || body.deviceUserId || body.cardNumber || body.deviceId || typeof body.active === "boolean") {
      await prisma.employee.update({
        where: { id: mapping.employeeId },
        data: { biometricId: mapping.biometricId, deviceUserId: mapping.deviceUserId, cardNumber: mapping.cardNumber, deviceAssignment: mapping.deviceId, biometricActive: mapping.active }
      });
    }
    await audit(req, "UPDATE", "BiometricEmployeeMapping", id, undefined, previous ?? undefined, mapping);
    res.json(mapping);
  } catch (error) {
    next(error);
  }
});

router.delete("/mappings/:id", requireRoles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const previous = await prisma.biometricEmployeeMapping.findUnique({ where: { id } });
    const mapping = await prisma.biometricEmployeeMapping.update({ where: { id }, data: { archivedAt: new Date(), active: false } });
    await audit(req, "ARCHIVE", "BiometricEmployeeMapping", id, undefined, previous ?? undefined, mapping);
    res.json(mapping);
  } catch (error) {
    next(error);
  }
});

router.get("/raw-logs", requireRoles(...manageRoles, Role.AUDITOR), async (_req, res) => {
  const logs = await prisma.biometricDeviceLog.findMany({
    include: { device: true, employee: { include: { department: true } } },
    orderBy: { punchTime: "desc" },
    take: 500
  });
  res.json(logs);
});

router.get("/raw-logs/export.csv", requireRoles(...manageRoles, Role.AUDITOR), async (req, res) => {
  const logs = await prisma.biometricDeviceLog.findMany({ include: { device: true, employee: { include: { department: true } } }, orderBy: { punchTime: "desc" }, take: 5000 });
  const headers = ["Device", "Device User ID", "Employee ID", "Employee Name", "Department", "Punch Date", "Punch Time", "Punch Type", "Verification Type", "Work Code", "Serial", "IP", "Sync Time", "Raw Reference", "Processing Status", "Error"];
  await audit(req, "EXPORT", "BiometricDeviceLog", undefined, { format: "CSV", count: logs.length });
  csvFile(res, "biometric-raw-logs.csv", headers, logs.map((log) => [log.deviceName, log.deviceUserId, log.employee?.employeeCode ?? "", log.employeeName ?? "", log.employee?.department.name ?? "", log.punchDate.toISOString().slice(0, 10), log.punchTime.toISOString(), log.punchType, log.verificationType ?? "", log.workCode ?? "", log.deviceSerialNumber ?? "", log.deviceIp ?? "", log.syncAt.toISOString(), log.rawLogReference, log.processingStatus, log.errorMessage ?? ""]));
});

router.get("/raw-logs/export.xlsx", requireRoles(...manageRoles, Role.AUDITOR), async (req, res) => {
  const logs = await prisma.biometricDeviceLog.findMany({ include: { device: true, employee: { include: { department: true } } }, orderBy: { punchTime: "desc" }, take: 5000 });
  const headers = ["Device", "Device User ID", "Employee ID", "Employee Name", "Department", "Punch Date", "Punch Time", "Punch Type", "Verification Type", "Work Code", "Serial", "IP", "Sync Time", "Raw Reference", "Processing Status", "Error"];
  await audit(req, "EXPORT", "BiometricDeviceLog", undefined, { format: "XLSX", count: logs.length });
  await xlsxFile(res, "biometric-raw-logs.xlsx", headers, logs.map((log) => [log.deviceName, log.deviceUserId, log.employee?.employeeCode ?? "", log.employeeName ?? "", log.employee?.department.name ?? "", log.punchDate.toISOString().slice(0, 10), log.punchTime.toISOString(), log.punchType, log.verificationType ?? "", log.workCode ?? "", log.deviceSerialNumber ?? "", log.deviceIp ?? "", log.syncAt.toISOString(), log.rawLogReference, log.processingStatus, log.errorMessage ?? ""]), "Raw Logs");
});

router.get("/attendance-records", requireRoles(...manageRoles, Role.ACCOUNTANT, Role.AUDITOR), async (_req, res) => {
  const records = await prisma.attendanceRecord.findMany({
    include: { employee: { include: { department: true } }, device: true },
    orderBy: [{ workDate: "desc" }, { employee: { employeeCode: "asc" } }],
    take: 500
  });
  res.json(records);
});

router.get("/attendance-records/export.csv", requireRoles(...manageRoles, Role.ACCOUNTANT, Role.AUDITOR), async (req, res) => {
  const records = await prisma.attendanceRecord.findMany({ include: { employee: { include: { department: true } }, device: true }, orderBy: [{ workDate: "desc" }, { employee: { employeeCode: "asc" } }], take: 5000 });
  const headers = ["Employee ID", "Employee Name", "Department", "Date", "Shift", "First In", "Last Out", "Working Hours", "Late Minutes", "Early Out Minutes", "Overtime Hours", "Status", "Device", "Source", "Approval"];
  await audit(req, "EXPORT", "AttendanceRecord", undefined, { format: "CSV", count: records.length });
  csvFile(res, "biometric-attendance-records.csv", headers, records.map((record) => [record.employee.employeeCode, `${record.employee.firstName} ${record.employee.lastName}`, record.employee.department.name, record.workDate.toISOString().slice(0, 10), record.shift ?? "", record.firstIn?.toISOString() ?? "", record.lastOut?.toISOString() ?? "", record.workingHours, record.lateMinutes, record.earlyOutMinutes, record.overtimeHours, record.attendanceStatus, record.device?.deviceName ?? "", record.source, record.approvalStatus]));
});

router.get("/attendance-records/export.xlsx", requireRoles(...manageRoles, Role.ACCOUNTANT, Role.AUDITOR), async (req, res) => {
  const records = await prisma.attendanceRecord.findMany({ include: { employee: { include: { department: true } }, device: true }, orderBy: [{ workDate: "desc" }, { employee: { employeeCode: "asc" } }], take: 5000 });
  const headers = ["Employee ID", "Employee Name", "Department", "Date", "Shift", "First In", "Last Out", "Working Hours", "Late Minutes", "Early Out Minutes", "Overtime Hours", "Status", "Device", "Source", "Approval"];
  await audit(req, "EXPORT", "AttendanceRecord", undefined, { format: "XLSX", count: records.length });
  await xlsxFile(res, "biometric-attendance-records.xlsx", headers, records.map((record) => [record.employee.employeeCode, `${record.employee.firstName} ${record.employee.lastName}`, record.employee.department.name, record.workDate.toISOString().slice(0, 10), record.shift ?? "", record.firstIn?.toISOString() ?? "", record.lastOut?.toISOString() ?? "", String(record.workingHours), record.lateMinutes, record.earlyOutMinutes, String(record.overtimeHours), record.attendanceStatus, record.device?.deviceName ?? "", record.source, record.approvalStatus]), "Attendance");
});

router.get("/sync-history", requireRoles(...manageRoles, Role.AUDITOR), async (_req, res) => {
  const history = await prisma.biometricSyncHistory.findMany({ include: { device: true }, orderBy: { startedAt: "desc" }, take: 200 });
  res.json(history);
});

router.get("/error-logs", requireRoles(...manageRoles, Role.AUDITOR), async (_req, res) => {
  const logs = await prisma.biometricErrorLog.findMany({ include: { device: true }, orderBy: { createdAt: "desc" }, take: 200 });
  res.json(logs);
});

router.post("/adjustments", requireRoles(Role.EMPLOYEE, Role.DEPARTMENT_MANAGER, ...manageRoles), async (req, res, next) => {
  try {
    const body = adjustmentSchema.parse(req.body);
    if (!req.user?.employeeId) return res.status(403).json({ message: "Employee profile is required" });
    const employee = await prisma.employee.findUnique({ where: { id: req.user.employeeId } });
    const request = await prisma.attendanceAdjustmentRequest.create({
      data: { ...body, employeeId: req.user.employeeId, managerId: employee?.managerId }
    });
    await audit(req, "SUBMIT", "AttendanceAdjustmentRequest", request.id, undefined, undefined, request);
    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
});

export default router;
