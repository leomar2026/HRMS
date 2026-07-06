import net from "node:net";
import { parse } from "csv-parse/sync";
import { BiometricConnectionType, BiometricProcessingStatus, BiometricPunchType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type DeviceConfig = {
  id: string;
  deviceName: string;
  deviceCode: string;
  connectionType: BiometricConnectionType;
  ipAddress?: string | null;
  port?: number | null;
  serialNumber?: string | null;
};

export type RawBiometricPunch = {
  deviceUserId: string;
  punchTime: Date;
  punchType?: BiometricPunchType;
  verificationType?: string;
  workCode?: string;
  rawLogReference: string;
  rawPayload?: Prisma.InputJsonValue;
};

export async function testZktecoConnection(device: DeviceConfig) {
  if (device.connectionType === BiometricConnectionType.MANUAL_IMPORT) {
    return { ok: true, message: "Manual import devices do not require a network connection." };
  }

  if (device.connectionType === BiometricConnectionType.TCP_IP) {
    if (!device.ipAddress || !device.port) return { ok: false, message: "IP address and port are required for TCP/IP devices." };
    const ipAddress = device.ipAddress;
    const port = device.port;
    return new Promise<{ ok: boolean; message: string }>((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ ok: false, message: `Connection timed out for ${ipAddress}:${port}.` });
      }, 5000);

      socket.once("connect", () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ ok: true, message: `TCP/IP device is reachable at ${ipAddress}:${port}.` });
      });
      socket.once("error", (error) => {
        clearTimeout(timeout);
        resolve({ ok: false, message: error.message });
      });
      socket.connect(port, ipAddress);
    });
  }

  if (device.connectionType === BiometricConnectionType.ADMS_PUSH) {
    return { ok: true, message: "ADMS Push is ready to receive logs through the HRMS push endpoint." };
  }

  return {
    ok: false,
    message: `${device.connectionType.replace(/_/g, " ")} requires secure BioTime configuration before connection testing.`
  };
}

export async function pullDeviceLogs(device: DeviceConfig): Promise<RawBiometricPunch[]> {
  if (device.connectionType === BiometricConnectionType.TCP_IP) {
    throw new Error("TCP/IP punch retrieval requires the approved ZKTeco SDK service/agent to be installed on the HRMS server.");
  }
  if (device.connectionType === BiometricConnectionType.BIOTIME_API || device.connectionType === BiometricConnectionType.BIOTIME_DATABASE) {
    throw new Error("BioTime credentials or database connection settings are not configured.");
  }
  if (device.connectionType === BiometricConnectionType.ADMS_PUSH) {
    return [];
  }
  return [];
}

export function parseBiometricCsv(content: string) {
  const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true }) as Array<Record<string, string>>;
  return rows.map((row, index) => {
    const deviceUserId = row.deviceUserId || row.biometricId || row.employeeCode || row["Device User ID"];
    const punchValue = row.punchTime || row.checkIn || row["Punch Time"];
    if (!deviceUserId || !punchValue) throw new Error(`Row ${index + 2}: deviceUserId and punchTime are required.`);
    const punchTime = new Date(punchValue);
    if (Number.isNaN(punchTime.getTime())) throw new Error(`Row ${index + 2}: punchTime is invalid.`);
    const punchType = normalizePunchType(row.punchType || row["Punch Type"]);
    return {
      deviceUserId,
      punchTime,
      punchType,
      verificationType: row.verificationType || row["Verification Type"],
      workCode: row.workCode || row["Work Code"],
      rawLogReference: row.rawLogReference || row.transactionId || `${deviceUserId}-${punchTime.toISOString()}-${index}`,
      rawPayload: row as Prisma.InputJsonObject
    } satisfies RawBiometricPunch;
  });
}

export function normalizePunchType(value?: string): BiometricPunchType {
  const normalized = (value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized in BiometricPunchType) return normalized as BiometricPunchType;
  if (["IN", "CHECKIN"].includes(normalized)) return BiometricPunchType.CHECK_IN;
  if (["OUT", "CHECKOUT"].includes(normalized)) return BiometricPunchType.CHECK_OUT;
  return BiometricPunchType.UNKNOWN;
}

function startOfWorkDate(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function calculateHours(firstIn?: Date | null, lastOut?: Date | null) {
  if (!firstIn || !lastOut || lastOut <= firstIn) return 0;
  return Number(((lastOut.getTime() - firstIn.getTime()) / 3600000).toFixed(2));
}

function lateMinutes(firstIn?: Date | null) {
  if (!firstIn) return 0;
  const expected = new Date(firstIn);
  expected.setHours(8, 0, 0, 0);
  return Math.max(0, Math.round((firstIn.getTime() - expected.getTime()) / 60000));
}

function overtimeHours(lastOut?: Date | null) {
  if (!lastOut) return 0;
  const expected = new Date(lastOut);
  expected.setHours(17, 0, 0, 0);
  return Math.max(0, Number(((lastOut.getTime() - expected.getTime()) / 3600000).toFixed(2)));
}

export async function saveAndProcessPunches(device: DeviceConfig, punches: RawBiometricPunch[]) {
  let pulledCount = 0;
  let processedCount = 0;
  let unmatchedCount = 0;
  let duplicateCount = 0;

  for (const punch of punches) {
    pulledCount += 1;
    const punchDate = startOfWorkDate(punch.punchTime);
    const mapping = await prisma.biometricEmployeeMapping.findFirst({
      where: {
        deviceUserId: punch.deviceUserId,
        active: true,
        archivedAt: null,
        OR: [{ deviceId: device.id }, { deviceId: null }]
      },
      include: { employee: true }
    });
    const employee = mapping?.employee ?? await prisma.employee.findFirst({
      where: {
        archivedAt: null,
        OR: [{ employeeCode: punch.deviceUserId }, { biometricId: punch.deviceUserId }, { deviceUserId: punch.deviceUserId }]
      }
    });

    try {
      const rawLog = await prisma.biometricDeviceLog.create({
        data: {
          deviceId: device.id,
          deviceName: device.deviceName,
          deviceUserId: punch.deviceUserId,
          employeeId: employee?.id,
          employeeName: employee ? `${employee.firstName} ${employee.lastName}` : undefined,
          punchDate,
          punchTime: punch.punchTime,
          punchType: punch.punchType ?? BiometricPunchType.UNKNOWN,
          verificationType: punch.verificationType,
          workCode: punch.workCode,
          deviceSerialNumber: device.serialNumber,
          deviceIp: device.ipAddress,
          rawLogReference: punch.rawLogReference,
          rawPayload: punch.rawPayload,
          processingStatus: employee ? BiometricProcessingStatus.RAW : BiometricProcessingStatus.UNMATCHED,
          errorMessage: employee ? undefined : "No employee mapping found for biometric device user ID."
        }
      });

      if (!employee) {
        unmatchedCount += 1;
        continue;
      }

      const dayLogs = await prisma.biometricDeviceLog.findMany({
        where: { employeeId: employee.id, punchDate, processingStatus: { not: BiometricProcessingStatus.DUPLICATE } },
        orderBy: { punchTime: "asc" }
      });
      const firstIn = dayLogs[0]?.punchTime ?? punch.punchTime;
      const lastOut = dayLogs[dayLogs.length - 1]?.punchTime ?? punch.punchTime;
      const attendanceStatus = !firstIn || !lastOut ? "INCOMPLETE_ATTENDANCE" : lateMinutes(firstIn) > 0 ? "LATE" : "PRESENT";
      const attendanceRecord = await prisma.attendanceRecord.upsert({
        where: { employeeId_workDate: { employeeId: employee.id, workDate: punchDate } },
        update: {
          firstIn,
          lastOut,
          workingHours: calculateHours(firstIn, lastOut),
          lateMinutes: lateMinutes(firstIn),
          overtimeHours: overtimeHours(lastOut),
          attendanceStatus,
          deviceId: device.id,
          source: "BIOMETRIC"
        },
        create: {
          employeeId: employee.id,
          workDate: punchDate,
          firstIn,
          lastOut,
          workingHours: calculateHours(firstIn, lastOut),
          lateMinutes: lateMinutes(firstIn),
          overtimeHours: overtimeHours(lastOut),
          attendanceStatus,
          deviceId: device.id,
          source: "BIOMETRIC"
        }
      });
      await prisma.biometricDeviceLog.update({
        where: { id: rawLog.id },
        data: { attendanceRecordId: attendanceRecord.id, processingStatus: BiometricProcessingStatus.PROCESSED }
      });
      if (mapping) await prisma.biometricEmployeeMapping.update({ where: { id: mapping.id }, data: { syncStatus: "SYNCED", lastPunchAt: punch.punchTime } });
      processedCount += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        duplicateCount += 1;
        continue;
      }
      await prisma.biometricErrorLog.create({
        data: {
          deviceId: device.id,
          action: "PROCESS_PUNCH",
          message: error instanceof Error ? error.message : "Unknown biometric processing error",
          payload: punch.rawPayload
        }
      });
    }
  }

  return { pulledCount, processedCount, unmatchedCount, duplicateCount };
}
