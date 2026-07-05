import type { Request } from "express";
import { prisma } from "../lib/prisma.js";

export async function audit(
  req: Request,
  action: string,
  entity: string,
  entityId?: string,
  metadata?: object,
  previousValue?: object,
  newValue?: object
) {
  await prisma.auditLog.create({
    data: {
      userId: req.user?.id,
      action,
      entity,
      entityId,
      metadata: metadata ?? undefined,
      previousValue: previousValue ?? undefined,
      newValue: newValue ?? undefined,
      device: req.headers["user-agent"],
      ipAddress: req.ip
    }
  });
}
