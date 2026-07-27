import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import fs from "node:fs";
import path from "node:path";
import { Role } from "@prisma/client";
import { env } from "../config/env.js";
import { AppError } from "./error.js";
import { prisma } from "../lib/prisma.js";

type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  employeeId?: string | null;
  sessionId?: string;
  passwordChangeRequired?: boolean;
};

const passwordRequiredMessage = "Password change required before accessing the system.";
const previewEmployeeStatusPath = path.join(process.cwd(), ".preview", "employee-status-overrides.json");

function readPreviewEmployeeStatusOverrides() {
  try {
    if (!fs.existsSync(previewEmployeeStatusPath)) return {};
    const parsed = JSON.parse(fs.readFileSync(previewEmployeeStatusPath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed as Record<string, { portalStatus?: string }> : {};
  } catch {
    return {};
  }
}

function previewPasswordChangeRequired(payload: JwtPayload) {
  if (payload.passwordChangeRequired) return true;
  if (!String(payload.sub ?? "").startsWith("preview-user-")) return false;
  const overrides = readPreviewEmployeeStatusOverrides();
  const employeeId = String(payload.employeeId ?? "");
  const employeeCode = employeeId.replace(/^preview-imported-/, "").replace(/^preview-/, "");
  const access = overrides[employeeId] ?? overrides[employeeCode];
  return ["PENDING_FIRST_LOGIN", "PASSWORD_RESET_REQUIRED"].includes(String(access?.portalStatus ?? ""));
}

function canAccessWhilePasswordRequired(originalUrl: string) {
  return ["/api/auth/change-password", "/api/auth/logout", "/api/auth/me"].includes(originalUrl) || originalUrl.startsWith("/api/public");
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return next(new AppError(401, "Authentication required"));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (payload.sessionId) {
      const session = await prisma.userSession.findUnique({ where: { tokenId: payload.sessionId } });
      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        return next(new AppError(401, "Session expired"));
      }
      await prisma.userSession.update({
        where: { tokenId: payload.sessionId },
        data: {
          lastSeenAt: new Date(),
          expiresAt: new Date(Date.now() + env.SESSION_TIMEOUT_MINUTES * 60 * 1000)
        }
      });
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      employeeId: payload.employeeId,
      sessionId: payload.sessionId,
      passwordChangeRequired: payload.passwordChangeRequired
    };
    const originalUrl = req.originalUrl.split("?")[0];
    if (env.HRMS_PREVIEW_MODE) {
      if (previewPasswordChangeRequired(payload) && !canAccessWhilePasswordRequired(originalUrl)) {
        return next(new AppError(403, passwordRequiredMessage));
      }
    } else if (!canAccessWhilePasswordRequired(originalUrl)) {
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { portalStatus: true, firstLoginRequired: true, passwordResetRequired: true, forcePasswordChange: true } });
      if (user && (user.firstLoginRequired || user.passwordResetRequired || user.forcePasswordChange || ["PENDING_FIRST_LOGIN", "PASSWORD_RESET_REQUIRED"].includes(user.portalStatus))) {
        return next(new AppError(403, passwordRequiredMessage));
      }
    }
    return next();
  } catch {
    return next(new AppError(401, "Invalid or expired token"));
  }
}

export function signAccessToken(payload: JwtPayload) {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.JWT_SECRET, options);
}
