import { z } from "zod";
const env = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.string().min(1),
    AUTH_DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    APP_URL: z.string().url(),
    PORT: z.coerce.number().default(4000),
    HOST: z.string().default("127.0.0.1"),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().default(1025),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().default("OLAPH <noreply@localhost>"),
    TURNSTILE_SECRET: z.string().optional(),
    CLAMAV_HOST: z.string().optional(),
    CLAMAV_PORT: z.coerce.number().default(3310),
    S3_ENDPOINT: z.string().url().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().optional(),
  })
  .parse(process.env);
if (
  env.NODE_ENV === "production" &&
  (!env.APP_URL.startsWith("https://") ||
    !env.TURNSTILE_SECRET ||
    !env.CLAMAV_HOST)
)
  throw Error("Production requires HTTPS, Turnstile and ClamAV.");
export const config = env;
