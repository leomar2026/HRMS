import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
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
};

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
      sessionId: payload.sessionId
    };
    return next();
  } catch {
    return next(new AppError(401, "Invalid or expired token"));
  }
}

export function signAccessToken(payload: JwtPayload) {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.JWT_SECRET, options);
}
