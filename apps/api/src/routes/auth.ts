import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "node:fs";
import path from "node:path";
import { EmploymentStatus, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, signAccessToken } from "../middleware/auth.js";
import { requireRoles } from "../middleware/rbac.js";
import { AppError } from "../middleware/error.js";
import { audit } from "../utils/audit.js";
import { env } from "../config/env.js";

const router = Router();
const previewImportedEmployeesPath = path.join(process.cwd(), ".preview", "imported-employees.json");

const loginSchema = z.object({
  loginId: z.string().min(2).optional(),
  email: z.string().optional(),
  password: z.string().min(8),
  rememberMe: z.boolean().optional()
});

const forgotPasswordSchema = z.object({ loginId: z.string().min(2), contact: z.string().min(3).optional() });
const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
  confirmPassword: z.string().min(8)
});
const firstTimeStartSchema = z.object({
  employeeCode: z.string().min(2),
  contact: z.string().min(3),
  verification: z.string().min(4).max(20)
});
const firstTimeCompleteSchema = z.object({
  employeeCode: z.string().min(2),
  otp: z.string().min(4),
  password: z.string().min(8),
  confirmPassword: z.string().min(8)
});
const adminResetSchema = z.object({
  userId: z.string(),
  password: z.string().min(8),
  forceChange: z.boolean().default(true),
  reason: z.string().optional()
});
const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8)
});
const portalStatusSchema = z.object({ userId: z.string(), portalStatus: z.enum(["PENDING_FIRST_LOGIN", "ACTIVE", "PASSWORD_RESET_REQUIRED", "LOCKED", "DISABLED", "ARCHIVED"]) });

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function validatePassword(password: string) {
  if (password.length < env.PASSWORD_MIN_LENGTH) throw new AppError(400, `Password must be at least ${env.PASSWORD_MIN_LENGTH} characters`);
  if (env.PASSWORD_COMPLEXITY_ENABLED && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(password)) {
    throw new AppError(400, "Password must include uppercase, lowercase, number, and special character");
  }
}

function assertStrongPassword(password: string, employeeCode?: string) {
  validatePassword(password);
  const common = ["Password@123", "Admin123!", "Employee@123", "Welcome@123", "Qwerty@123"];
  if (common.includes(password)) throw new AppError(400, "Password is too common");
  if (employeeCode && password.toLowerCase().includes(employeeCode.toLowerCase())) throw new AppError(400, "Password cannot contain Employee ID");
}

async function logLogin(req: { ip?: string; headers: Record<string, unknown> }, username: string, result: string, reason?: string, userId?: string) {
  await prisma.loginAttempt.create({
    data: {
      username,
      userId,
      result,
      reason,
      ipAddress: req.ip,
      device: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined
    }
  });
}

function dashboardForRole(role: Role) {
  if (role === Role.EMPLOYEE) return "/employee/dashboard";
  if (role === Role.DEPARTMENT_MANAGER) return "/manager/dashboard";
  if (role === Role.OPERATIONS_MANAGER) return "/om/leave-approvals";
  if (([Role.HR, Role.HR_MANAGER, Role.HR_OFFICER] as Role[]).includes(role)) return "/dashboard";
  if (([Role.PAYROLL_OFFICER, Role.ACCOUNTANT, Role.FINANCE] as Role[]).includes(role)) return "/payroll";
  return "/dashboard";
}

function previewImportedEmployeeLogin(loginId: string) {
  try {
    if (!fs.existsSync(previewImportedEmployeesPath)) return null;
    const parsed = JSON.parse(fs.readFileSync(previewImportedEmployeesPath, "utf8"));
    if (!Array.isArray(parsed)) return null;
    return (parsed as Array<Record<string, unknown>>).find((employee) => {
      const code = String(employee.employeeCode ?? "");
      const email = String(employee.email ?? employee.companyEmail ?? "");
      return [code, email].filter(Boolean).includes(loginId);
    }) ?? null;
  } catch {
    return null;
  }
}

router.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const loginId = body.loginId ?? body.email ?? "";
    if (env.HRMS_PREVIEW_MODE && loginId === "admin@company.sa" && body.password === "Admin123!") {
      const user = { id: "preview-admin", email: loginId, role: "ADMIN" as const, employeeId: "preview-employee-1" };
      const token = signAccessToken({ sub: user.id, email: user.email, role: user.role, employeeId: user.employeeId });
      return res.json({ token, user, redirectTo: "/dashboard" });
    }

    const previewImportedEmployee = env.HRMS_PREVIEW_MODE && body.password === "Employee@123" ? previewImportedEmployeeLogin(loginId) : null;
    if (previewImportedEmployee) {
      const employeeCode = String(previewImportedEmployee.employeeCode ?? loginId);
      const user = {
        id: `preview-user-${employeeCode}`,
        email: String(previewImportedEmployee.email ?? previewImportedEmployee.companyEmail ?? `${employeeCode}@company.local`),
        role: "EMPLOYEE" as const,
        employeeId: String(previewImportedEmployee.id ?? `preview-${employeeCode}`)
      };
      const token = signAccessToken({ sub: user.id, email: user.email, role: user.role, employeeId: user.employeeId });
      return res.json({ token, user, redirectTo: "/employee/dashboard" });
    }

    if (env.HRMS_PREVIEW_MODE && ["EMP-002", "employee@company.com"].includes(loginId) && body.password === "Employee@123") {
      const user = { id: "preview-employee-user", email: "employee@company.com", role: "EMPLOYEE" as const, employeeId: "preview-employee-2" };
      const token = signAccessToken({ sub: user.id, email: user.email, role: user.role, employeeId: user.employeeId });
      return res.json({ token, user, redirectTo: "/employee/dashboard" });
    }

    if (env.HRMS_PREVIEW_MODE && ["EMP-010", "manager@company.com"].includes(loginId) && body.password === "Manager@123") {
      const user = { id: "preview-manager-user", email: "manager@company.com", role: "DEPARTMENT_MANAGER" as const, employeeId: "preview-manager-1" };
      const token = signAccessToken({ sub: user.id, email: user.email, role: user.role, employeeId: user.employeeId });
      return res.json({ token, user, redirectTo: "/manager/dashboard" });
    }

    if (env.HRMS_PREVIEW_MODE && ["EMP-020", "om@company.com"].includes(loginId) && body.password === "Om@12345") {
      const user = { id: "preview-om-user", email: "om@company.com", role: "OPERATIONS_MANAGER" as const, employeeId: "preview-om-1" };
      const token = signAccessToken({ sub: user.id, email: user.email, role: user.role, employeeId: user.employeeId });
      return res.json({ token, user, redirectTo: "/om/leave-approvals" });
    }

    const user = loginId.includes("@")
      ? await prisma.user.findUnique({ where: { email: loginId }, include: { employee: true } })
      : await prisma.user.findFirst({ where: { employee: { employeeCode: loginId } }, include: { employee: true } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      if (user) {
        const failedLoginAttempts = user.failedLoginAttempts + 1;
        const lockedUntil = failedLoginAttempts >= env.MAX_FAILED_LOGIN_ATTEMPTS ? new Date(Date.now() + env.LOCKOUT_MINUTES * 60 * 1000) : null;
        await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts, lockedUntil } });
      }
      await logLogin(req, loginId, "FAILED", "Invalid credentials", user?.id);
      throw new AppError(401, "Invalid email or password");
    }
    if (["DISABLED", "ARCHIVED"].includes(user.portalStatus)) {
      await logLogin(req, loginId, "BLOCKED", `Portal status ${user.portalStatus}`, user.id);
      throw new AppError(403, `Portal account status is ${user.portalStatus}`);
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await logLogin(req, loginId, "LOCKED", "Account locked", user.id);
      throw new AppError(423, "Account is temporarily locked after repeated failed attempts");
    }
    if (user.employee && ([EmploymentStatus.INACTIVE, EmploymentStatus.TERMINATED, EmploymentStatus.ARCHIVED, EmploymentStatus.RESIGNED, EmploymentStatus.EXPIRED_CONTRACT] as EmploymentStatus[]).includes(user.employee.status)) {
      await logLogin(req, loginId, "BLOCKED", `Employee status ${user.employee.status}`, user.id);
      throw new AppError(403, "Employee account is inactive or blocked");
    }

    if (!env.ALLOW_MULTIPLE_SESSIONS) {
      await prisma.userSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    }

    const sessionId = crypto.randomUUID();
    await prisma.userSession.create({
      data: {
        userId: user.id,
        tokenId: sessionId,
        device: req.headers["user-agent"],
        ipAddress: req.ip,
        expiresAt: new Date(Date.now() + (body.rememberMe ? 8 * 60 : env.SESSION_TIMEOUT_MINUTES) * 60 * 1000)
      }
    });

    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      sessionId
    });

    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    req.user = { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId, sessionId };
    await logLogin(req, loginId, "SUCCESS", undefined, user.id);
    await audit(req, "LOGIN", "User", user.id);
    const mustChangePassword = user.forcePasswordChange || user.firstLoginRequired || user.passwordResetRequired || ["PENDING_FIRST_LOGIN", "PASSWORD_RESET_REQUIRED"].includes(user.portalStatus);
    res.json({
      token,
      user: req.user,
      redirectTo: mustChangePassword ? "/change-password" : dashboardForRole(user.role),
      forcePasswordChange: mustChangePassword
    });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (token) {
      const payload = JSON.parse(Buffer.from(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()) as { sessionId?: string; sub?: string; email?: string; role?: Role };
      if (payload.sessionId) await prisma.userSession.updateMany({ where: { tokenId: payload.sessionId }, data: { revokedAt: new Date() } });
      req.user = payload.sub && payload.email && payload.role ? { id: payload.sub, email: payload.email, role: payload.role, sessionId: payload.sessionId } : undefined;
      if (req.user) await audit(req, "LOGOUT", "User", req.user.id);
    }
    res.json({ ok: true, message: "You have been logged out successfully." });
  } catch (error) {
    next(error);
  }
});

router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    if (body.newPassword !== body.confirmPassword) throw new AppError(400, "Password confirmation does not match");
    const user = await prisma.user.findUnique({ where: { id: String(req.user?.id) }, include: { employee: true } });
    if (!user) throw new AppError(404, "User not found");
    if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
      await audit(req, "PASSWORD_CHANGE_FAILED", "User", user.id, { reason: "Invalid current password" });
      throw new AppError(400, "Current password is incorrect");
    }
    if (await bcrypt.compare(body.newPassword, user.passwordHash)) throw new AppError(400, "New password cannot match the current password");
    assertStrongPassword(body.newPassword, user.employee?.employeeCode);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(body.newPassword, env.BCRYPT_ROUNDS),
          portalStatus: "ACTIVE",
          firstLoginRequired: false,
          passwordResetRequired: false,
          forcePasswordChange: false,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });
      await tx.userSession.updateMany({
        where: { userId: user.id, tokenId: { not: req.user?.sessionId ?? "" }, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    });
    await audit(req, "PASSWORD_CHANGED", "User", user.id);
    res.json({ ok: true, redirectTo: dashboardForRole(user.role) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res) => {
  if (env.HRMS_PREVIEW_MODE) {
    return res.json({
      id: req.user?.id,
      email: req.user?.email,
      role: req.user?.role,
      employeeId: req.user?.employeeId,
      employee: req.user?.employeeId
        ? {
            id: req.user.employeeId,
            firstName: req.user.email.split("@")[0],
            lastName: "",
            employeeCode: req.user.employeeId,
            department: { name: req.user.role === Role.EMPLOYEE ? "Operations" : "Administration" }
          }
        : null
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user?.id },
    select: {
      id: true,
      email: true,
      role: true,
      employeeId: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          department: { select: { name: true } }
        }
      }
    }
  });
  res.json(user ?? req.user);
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const body = forgotPasswordSchema.parse(req.body);
    if (env.HRMS_PREVIEW_MODE) {
      return res.json({ ok: true, message: "If the account exists, reset instructions have been generated.", resetTokenPreview: crypto.randomBytes(24).toString("hex") });
    }
    const user = await prisma.user.findFirst({ where: { OR: [{ email: body.loginId }, { employee: { employeeCode: body.loginId } }] }, include: { employee: true } });
    if (user && body.contact && ![user.email, user.employee?.email, user.employee?.companyEmail, user.employee?.phone].filter(Boolean).includes(body.contact)) {
      return res.json({ ok: true, message: "If the account exists, reset instructions have been generated." });
    }
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: tokenHash(token),
          expiresAt: new Date(Date.now() + env.PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000)
        }
      });
      await audit({ ...req, user: { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId } } as typeof req, "PASSWORD_RESET_REQUEST", "User", user.id);
      return res.json({ ok: true, message: "If the account exists, reset instructions have been generated.", resetTokenPreview: env.HRMS_PREVIEW_MODE ? token : undefined });
    }
    res.json({ ok: true, message: "If the account exists, reset instructions have been generated." });
  } catch (error) {
    next(error);
  }
});

router.post("/first-time/start", async (req, res, next) => {
  try {
    const body = firstTimeStartSchema.parse(req.body);
    if (env.HRMS_PREVIEW_MODE) {
      return res.json({ ok: true, message: "OTP generated for preview.", otpPreview: "123456" });
    }
    const user = await prisma.user.findFirst({ where: { employee: { employeeCode: body.employeeCode } }, include: { employee: true } });
    if (!user || !user.employee) throw new AppError(404, "Employee account not found");
    if (user.portalStatus !== "PENDING_FIRST_LOGIN" && !user.forcePasswordChange) throw new AppError(400, "Account is not pending first-time setup");
    const registeredContacts = [user.email, user.employee.email, user.employee.companyEmail, user.employee.phone].filter(Boolean);
    if (!registeredContacts.includes(body.contact)) throw new AppError(400, "Verification contact does not match employee record");
    const lastFour = user.employee.nationalId.slice(-4);
    if (body.verification !== lastFour) throw new AppError(400, "Additional verification failed");
    const otp = String(crypto.randomInt(100000, 999999));
    await prisma.portalOtp.create({
      data: {
        userId: user.id,
        purpose: "FIRST_TIME_LOGIN",
        otpHash: tokenHash(otp),
        expiresAt: new Date(Date.now() + env.PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000)
      }
    });
    await audit({ ...req, user: { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId } } as typeof req, "FIRST_TIME_OTP_CREATED", "User", user.id);
    res.json({ ok: true, message: "OTP sent to registered contact.", otpPreview: env.HRMS_PREVIEW_MODE ? otp : undefined });
  } catch (error) {
    next(error);
  }
});

router.post("/first-time/complete", async (req, res, next) => {
  try {
    const body = firstTimeCompleteSchema.parse(req.body);
    if (body.password !== body.confirmPassword) throw new AppError(400, "Password confirmation does not match");
    assertStrongPassword(body.password, body.employeeCode);
    if (env.HRMS_PREVIEW_MODE) {
      return res.json({ ok: true, redirectTo: "/employee/dashboard" });
    }
    const user = await prisma.user.findFirst({ where: { employee: { employeeCode: body.employeeCode } }, include: { employee: true } });
    if (!user || !user.employee) throw new AppError(404, "Employee account not found");
    const otp = await prisma.portalOtp.findFirst({
      where: { userId: user.id, purpose: "FIRST_TIME_LOGIN", usedAt: null },
      orderBy: { createdAt: "desc" }
    });
    if (!otp || otp.expiresAt < new Date() || otp.otpHash !== tokenHash(body.otp)) throw new AppError(400, "OTP is invalid or expired");
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(body.password, env.BCRYPT_ROUNDS),
          portalStatus: "ACTIVE",
          firstLoginRequired: false,
          passwordResetRequired: false,
          forcePasswordChange: false,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });
      await tx.portalOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
    });
    req.user = { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId };
    await audit(req, "FIRST_TIME_ACCOUNT_ACTIVATED", "User", user.id, { employeeCode: body.employeeCode });
    res.json({ ok: true, redirectTo: "/employee/dashboard" });
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const body = resetPasswordSchema.parse(req.body);
    if (body.password !== body.confirmPassword) throw new AppError(400, "Password confirmation does not match");
    validatePassword(body.password);
    if (env.HRMS_PREVIEW_MODE) {
      return res.json({ ok: true });
    }
    const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash: tokenHash(body.token) }, include: { user: true } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) throw new AppError(400, "Reset token is invalid or expired");
    if (await bcrypt.compare(body.password, reset.user.passwordHash)) throw new AppError(400, "New password cannot match the current password");
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash: await bcrypt.hash(body.password, env.BCRYPT_ROUNDS),
          passwordChangedAt: new Date(),
          portalStatus: "ACTIVE",
          firstLoginRequired: false,
          passwordResetRequired: false,
          forcePasswordChange: false,
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });
      await tx.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
      await tx.userSession.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    req.user = { id: reset.user.id, email: reset.user.email, role: reset.user.role, employeeId: reset.user.employeeId };
    await audit(req, "PASSWORD_RESET", "User", reset.userId);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/sessions", async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new AppError(401, "Authentication required");
    const payload = JSON.parse(Buffer.from(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()) as { sub: string };
    const sessions = await prisma.userSession.findMany({ where: { userId: payload.sub }, orderBy: { lastSeenAt: "desc" } });
    res.json(sessions);
  } catch (error) {
    next(error);
  }
});

router.delete("/sessions/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    await prisma.userSession.update({ where: { id }, data: { revokedAt: new Date() } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/portal-accounts", requireAuth, requireRoles(Role.ADMIN, Role.SUPER_ADMIN), async (req, res, next) => {
  try {
    if (env.HRMS_PREVIEW_MODE) {
      return res.json([
        { id: "preview-employee-user", email: "employee@company.com", role: "EMPLOYEE", portalStatus: "ACTIVE", failedLoginAttempts: 0, lockedUntil: null, employee: { employeeCode: "EMP-002", firstName: "Employee", lastName: "User", branch: "Riyadh", status: "ACTIVE", department: { name: "Operations" } } },
        { id: "preview-manager-user", email: "manager@company.com", role: "DEPARTMENT_MANAGER", portalStatus: "ACTIVE", failedLoginAttempts: 0, lockedUntil: null, employee: { employeeCode: "EMP-010", firstName: "Manager", lastName: "User", branch: "Riyadh", status: "ACTIVE", department: { name: "Operations" } } }
      ]);
    }
    const search = typeof req.query.search === "string" ? req.query.search : "";
    const users = await prisma.user.findMany({
      where: {
        employee: search ? {
          OR: [
            { employeeCode: { contains: search, mode: "insensitive" } },
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { department: { name: { contains: search, mode: "insensitive" } } },
            { branch: { contains: search, mode: "insensitive" } },
            { status: { equals: search as never } }
          ]
        } : { isNot: null }
      },
      include: { employee: { include: { department: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.get("/admin/portal-accounts/:id/history", requireAuth, requireRoles(Role.ADMIN, Role.SUPER_ADMIN), async (req, res, next) => {
  try {
    if (env.HRMS_PREVIEW_MODE) {
      return res.json({
        logins: [{ id: "login-1", username: "EMP-002", result: "SUCCESS", createdAt: new Date().toISOString(), device: "Preview Browser" }],
        resets: [{ id: "reset-1", action: "ADMIN_PASSWORD_RESET", createdAt: new Date().toISOString() }]
      });
    }
    const userId = String(req.params.id);
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { employee: true } });
    const [logins, resets] = await Promise.all([
      prisma.loginAttempt.findMany({ where: { OR: [{ userId }, ...(user?.employee ? [{ username: user.employee.employeeCode }] : [])] }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.auditLog.findMany({ where: { entity: "User", entityId: userId, action: { contains: "PASSWORD" } }, orderBy: { createdAt: "desc" }, take: 50 })
    ]);
    res.json({ logins, resets });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/reset-password", requireAuth, requireRoles(Role.ADMIN, Role.SUPER_ADMIN), async (req, res, next) => {
  try {
    const body = adminResetSchema.parse(req.body);
    if (env.HRMS_PREVIEW_MODE) {
      return res.json({ ok: true, userId: body.userId, portalStatus: "PASSWORD_RESET_REQUIRED" });
    }
    const previous = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!previous) throw new AppError(404, "User not found");
    assertStrongPassword(body.password);
    const updated = await prisma.user.update({
      where: { id: body.userId },
        data: {
          passwordHash: await bcrypt.hash(body.password, env.BCRYPT_ROUNDS),
          passwordChangedAt: new Date(),
          forcePasswordChange: body.forceChange,
          firstLoginRequired: body.forceChange,
          passwordResetRequired: body.forceChange,
          portalStatus: "PASSWORD_RESET_REQUIRED",
          lastPasswordResetBy: req.user?.id,
          lastPasswordResetAt: new Date(),
          failedLoginAttempts: 0,
        lockedUntil: null
      }
    });
    await prisma.userSession.updateMany({ where: { userId: body.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(req, "ADMIN_PASSWORD_RESET", "User", body.userId, { forceChange: body.forceChange, reason: body.reason }, previous, updated);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/portal-status", requireAuth, requireRoles(Role.ADMIN, Role.SUPER_ADMIN), async (req, res, next) => {
  try {
    const body = portalStatusSchema.parse(req.body);
    if (env.HRMS_PREVIEW_MODE) {
      return res.json({ id: body.userId, portalStatus: body.portalStatus });
    }
    const previous = await prisma.user.findUnique({ where: { id: body.userId } });
    const updated = await prisma.user.update({
      where: { id: body.userId },
      data: {
        portalStatus: body.portalStatus,
        lockedUntil: body.portalStatus === "LOCKED" ? new Date(Date.now() + env.LOCKOUT_MINUTES * 60 * 1000) : null,
        failedLoginAttempts: body.portalStatus === "LOCKED" ? env.MAX_FAILED_LOGIN_ATTEMPTS : 0
      }
    });
    if (["DISABLED", "ARCHIVED", "LOCKED", "PASSWORD_RESET_REQUIRED"].includes(body.portalStatus)) {
      await prisma.userSession.updateMany({ where: { userId: body.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await audit(req, "PORTAL_STATUS_CHANGED", "User", body.userId, { portalStatus: body.portalStatus }, previous ?? undefined, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/admin/unlock-user", requireAuth, requireRoles(Role.ADMIN, Role.SUPER_ADMIN), async (req, res, next) => {
  try {
    const body = z.object({ userId: z.string() }).parse(req.body);
    if (env.HRMS_PREVIEW_MODE) {
      return res.json({ ok: true, userId: body.userId });
    }
    const updated = await prisma.user.update({ where: { id: body.userId }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    await audit(req, "UNLOCK_USER", "User", body.userId, undefined, undefined, updated);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
