import { createHmac } from "node:crypto";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { authPool } from "./db.js";
import { config } from "./config.js";
const keyFor = (email: string) =>
  createHmac("sha256", config.BETTER_AUTH_SECRET)
    .update(email.trim().toLowerCase())
    .digest("hex");
export const loginHooks = {
  before: createAuthMiddleware(async (ctx) => {
    if (ctx.path !== "/sign-in/email" || typeof ctx.body?.email !== "string")
      return;
    if (ctx.body.email.length > 320)
      throw new APIError("BAD_REQUEST", { message: "INVALID_EMAIL" });
    // Reserve an attempt atomically before the expensive password check. A
    // successful login clears it; concurrent requests cannot exceed the cap.
    const attempt = await authPool.query(
      `INSERT INTO app_login_attempts(email_key,attempts,window_ends_at) VALUES($1,1,now()+interval '15 minutes')
      ON CONFLICT(email_key) DO UPDATE SET
        attempts=CASE WHEN app_login_attempts.window_ends_at<=now() THEN 1 ELSE app_login_attempts.attempts+1 END,
        window_ends_at=CASE WHEN app_login_attempts.window_ends_at<=now() OR app_login_attempts.attempts=4 THEN now()+interval '15 minutes' ELSE app_login_attempts.window_ends_at END
      WHERE app_login_attempts.window_ends_at<=now() OR app_login_attempts.attempts<5 RETURNING email_key`,
      [keyFor(ctx.body.email)],
    );
    if (!attempt.rowCount)
      throw new APIError("TOO_MANY_REQUESTS", {
        code: "LOGIN_TEMPORARILY_LOCKED",
        message: "LOGIN_TEMPORARILY_LOCKED",
      });
    await authPool.query(
      "DELETE FROM app_login_attempts WHERE window_ends_at<now()-interval '1 day'",
    );
  }),
  after: createAuthMiddleware(async (ctx) => {
    if (ctx.path !== "/sign-in/email" || typeof ctx.body?.email !== "string")
      return;
    const result = ctx.context.returned;
    if (
      !isAPIError(result) &&
      result &&
      typeof result === "object" &&
      ("token" in result || "twoFactorRedirect" in result)
    )
      await authPool.query(
        "DELETE FROM app_login_attempts WHERE email_key=$1",
        [keyFor(ctx.body.email)],
      );
  }),
};
