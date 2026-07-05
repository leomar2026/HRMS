import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  SESSION_TIMEOUT_MINUTES: z.coerce.number().int().min(5).default(30),
  SESSION_WARNING_MINUTES: z.coerce.number().int().min(1).default(5),
  PASSWORD_RESET_EXPIRY_MINUTES: z.coerce.number().int().min(5).default(30),
  PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).default(8),
  PASSWORD_COMPLEXITY_ENABLED: z.coerce.boolean().default(true),
  MAX_FAILED_LOGIN_ATTEMPTS: z.coerce.number().int().min(3).default(5),
  LOCKOUT_MINUTES: z.coerce.number().int().min(5).default(15),
  ALLOW_MULTIPLE_SESSIONS: z.coerce.boolean().default(true),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).default(12),
  API_PORT: z.coerce.number().int().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  HRMS_PREVIEW_MODE: z.coerce.boolean().default(false),
  GOSI_API_URL: z.string().optional().default(""),
  GOSI_CLIENT_ID: z.string().optional().default(""),
  GOSI_CLIENT_SECRET: z.string().optional().default(""),
  MUDAD_API_URL: z.string().optional().default(""),
  MUDAD_CLIENT_ID: z.string().optional().default(""),
  MUDAD_CLIENT_SECRET: z.string().optional().default(""),
  QIWA_API_URL: z.string().optional().default(""),
  QIWA_CLIENT_ID: z.string().optional().default(""),
  QIWA_CLIENT_SECRET: z.string().optional().default("")
});

export const env = envSchema.parse(process.env);
