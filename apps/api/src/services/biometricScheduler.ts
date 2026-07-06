import { BiometricDeviceStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { pullDeviceLogs, saveAndProcessPunches } from "./zktecoService.js";

let scheduler: NodeJS.Timeout | undefined;
let running = false;

export function startBiometricScheduler() {
  if (scheduler) return;
  scheduler = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const now = new Date();
      const devices = await prisma.biometricDevice.findMany({
        where: { archivedAt: null, status: BiometricDeviceStatus.ACTIVE }
      });
      for (const device of devices) {
        const intervalMs = Math.max(1, device.syncIntervalMinutes) * 60_000;
        if (device.lastSyncAt && now.getTime() - device.lastSyncAt.getTime() < intervalMs) continue;
        const history = await prisma.biometricSyncHistory.create({
          data: { deviceId: device.id, connectionType: device.connectionType, triggeredBy: "SCHEDULER" }
        });
        try {
          const punches = await pullDeviceLogs(device);
          const result = await saveAndProcessPunches(device, punches);
          await prisma.biometricSyncHistory.update({
            where: { id: history.id },
            data: { ...result, status: "COMPLETED", finishedAt: new Date() }
          });
          await prisma.biometricDevice.update({ where: { id: device.id }, data: { lastSyncAt: new Date() } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Scheduled biometric sync failed";
          await prisma.biometricSyncHistory.update({
            where: { id: history.id },
            data: { status: "FAILED", finishedAt: new Date(), errorMessage: message }
          });
          await prisma.biometricErrorLog.create({ data: { deviceId: device.id, action: "SCHEDULED_SYNC", message } });
        }
      }
    } catch (error) {
      console.error("Biometric scheduler error", error);
    } finally {
      running = false;
    }
  }, 60_000);
}
