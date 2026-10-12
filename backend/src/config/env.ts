import { config } from "dotenv";
import { z } from "zod";

// Load .env file into process.env
config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    HOST: z.string().default("0.0.0.0"),
    API_PREFIX: z.string().default("/api/v1"),
    CORS_ORIGIN: z.string().default("http://localhost:5173"),

    // Database connection
    DB_HOST: z.string().default("127.0.0.1"),
    DB_PORT: z.coerce.number().int().positive().default(5433),
    DB_USER: z.string().default("postgres"),
    DB_PASSWORD: z.string().default("postgres"),
    DB_NAME: z.string().default("fuelpoint"),
    DB_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
    DB_POOL_MAX: z.coerce.number().int().positive().default(20),
    DB_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

    // Authentication & Tokens
    JWT_ACCESS_SECRET: z
      .string()
      .min(1)
      .default("dev_jwt_access_secret_minimum_32_characters_here"),
    JWT_ACCESS_EXPIRY: z.string().default("15m"),
    ADMIN_REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().int().positive().default(7),
    USER_REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().int().positive().default(30),
    PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: z.coerce.number().int().positive().default(60),

    // OTP Parameters
    OTP_EXPIRY_MINUTES: z.coerce.number().int().positive().default(5),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
    OTP_MAX_PER_HOUR_DESTINATION: z.coerce.number().int().positive().default(5),
    OTP_MAX_PER_HOUR_IP: z.coerce.number().int().positive().default(10),

    // Email Settings
    SMTP_HOST: z.string().default("smtp.gmail.com"),
    SMTP_PORT: z.coerce.number().int().positive().default(465),
    SMTP_SECURE: z
      .string()
      .default("true")
      .transform((val) => val === "true" || val === "1"),
    SMTP_USER: z.string().default(""),
    SMTP_PASSWORD: z.string().default(""),
    EMAIL_FROM: z.string().default("FuelPoint <no-reply@fuelpoint.com>"),

    // SMS Settings
    SMS_PROVIDER: z.string().default("console"),
    SMS_API_KEY: z.string().default(""),

    // Initial Super Admin Seed Settings
    SEED_ADMIN_NAME: z.string().default("Super Admin"),
    SEED_ADMIN_EMAIL: z.string().default(""),
    SEED_ADMIN_INITIAL_PASSWORD: z.string().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      const forbiddenSubstrings = ["secret", "dev", "change_me"];
      const lowerSecret = data.JWT_ACCESS_SECRET.toLowerCase();

      if (
        data.JWT_ACCESS_SECRET.length < 32 ||
        forbiddenSubstrings.some((sub) => lowerSecret.includes(sub))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_ACCESS_SECRET"],
          message:
            "In production, JWT_ACCESS_SECRET must be at least 32 characters long and cannot contain placeholder terms like 'secret', 'dev', or 'change_me'.",
        });
      }

      if (!data.SMTP_USER || data.SMTP_USER.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SMTP_USER"],
          message: "SMTP_USER must be set in production.",
        });
      }

      if (!data.SMTP_PASSWORD || data.SMTP_PASSWORD.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SMTP_PASSWORD"],
          message: "SMTP_PASSWORD must be set in production.",
        });
      }
    }
  });

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error("❌ Invalid environment configuration:");
  for (const issue of parseResult.error.issues) {
    console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parseResult.data;
export type Env = typeof env;
