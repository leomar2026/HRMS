import type { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { AppError } from "./error.js";

export function requireRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, "Authentication required"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "Insufficient permissions"));
    }

    return next();
  };
}
