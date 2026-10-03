import { betterAuth } from "better-auth";
import { captcha, twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { hash, verify, Algorithm } from "@node-rs/argon2";
import { createHash } from "node:crypto";
import { config } from "./config.js";
import { authPool } from "./db.js";
import { sendMail } from "./mail.js";
import { loginHooks } from "./login-security.js";
async function hashPassword(password: string) {
  if (config.NODE_ENV === "production") {
    // HIBP's range protocol requires SHA-1 and receives only the first five
    // hex characters. This digest is neither persisted nor used for login.
    // Stored credentials use the Argon2id result returned below.
    const digest = createHash("sha1")
      .update(password)
      .digest("hex")
      .toUpperCase();
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${digest.slice(0, 5)}`,
      { headers: { "Add-Padding": "true" }, signal: AbortSignal.timeout(7000) },
    );
    if (!response.ok) throw Error("PASSWORD_CHECK_UNAVAILABLE");
    if (
      (await response.text())
        .split(/\r?\n/)
        .some(
          (line) =>
            line.split(":")[0] === digest.slice(5) &&
            Number(line.split(":")[1]) > 0,
        )
    )
      throw Error("PASSWORD_COMPROMISED");
  }
  return hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}
export const auth = betterAuth({
  appName: "OLAPH",
  baseURL: config.APP_URL,
  basePath: "/api/auth",
  secret: config.BETTER_AUTH_SECRET,
  database: authPool,
  trustedOrigins: [config.APP_URL],
  hooks: loginHooks,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: hashPassword,
      verify: ({ hash: encoded, password }) => verify(encoded, password),
    },
    sendResetPassword: async ({ user, url }) => {
      await sendMail(
        user.email,
        "OLAPH · Parolanızı yenileyin",
        `Parolanızı yenilemek için bu bağlantıyı açın: ${url}`,
      );
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail(
        user.email,
        "OLAPH · E-posta adresinizi doğrulayın",
        `Hesabınızı doğrulamak için bu bağlantıyı açın: ${url}`,
      );
    },
  },
  session: {
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 15,
    freshAge: 60 * 5,
    cookieCache: { enabled: false },
  },
  advanced: {
    useSecureCookies: config.NODE_ENV === "production",
    cookiePrefix: "olaph",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.NODE_ENV === "production",
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 900, max: 20 },
      "/sign-up/email": { window: 3600, max: 5 },
      "/request-password-reset": { window: 900, max: 3 },
    },
  },
  plugins: [
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: config.TURNSTILE_SECRET || "",
      endpoints: config.TURNSTILE_SECRET
        ? ["/sign-up/email", "/sign-in/email", "/request-password-reset"]
        : ["/__captcha_disabled_in_development"],
      allowedHostnames: [new URL(config.APP_URL).hostname],
      expectedAction: "auth",
    }),
    twoFactor({
      issuer: "OLAPH",
      skipVerificationOnEnable: false,
      accountLockout: {
        enabled: true,
        maxFailedAttempts: 5,
        durationSeconds: 900,
      },
    }),
    passkey({
      rpID: new URL(config.APP_URL).hostname,
      rpName: "OLAPH",
      origin: config.APP_URL,
    }),
  ],
});
