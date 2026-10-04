import { HttpException, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { authPool } from "./db.js";
export async function verifyRecentIdentity(
  req: Request,
  userId: string,
  sessionId: string,
  password: string,
  code: string,
) {
  const db = await authPool.connect();
  let committed = false;
  try {
    await db.query("BEGIN");
    await db.query(
      "INSERT INTO app_reauth_attempts(user_id) VALUES($1) ON CONFLICT DO NOTHING",
      [userId],
    );
    const state = (
      await db.query(
        "SELECT * FROM app_reauth_attempts WHERE user_id=$1 FOR UPDATE",
        [userId],
      )
    ).rows[0];
    if (
      state.locked_until &&
      new Date(state.locked_until).getTime() > Date.now()
    )
      throw new HttpException("REAUTHENTICATION_LOCKED", 429);
    if (state.locked_until)
      await db.query(
        "UPDATE app_reauth_attempts SET failures=0,locked_until=NULL WHERE user_id=$1",
        [userId],
      );
    try {
      const headers = fromNodeHeaders(req.headers);
      await auth.api.verifyPassword({ headers, body: { password } });
      await auth.api.verifyTOTP({
        headers,
        body: { code, trustDevice: false },
      });
    } catch {
      await db.query(
        "UPDATE app_reauth_attempts SET failures=failures+1,locked_until=CASE WHEN failures+1>=5 THEN now()+interval '15 minutes' ELSE NULL END WHERE user_id=$1",
        [userId],
      );
      await db.query("COMMIT");
      committed = true;
      throw new UnauthorizedException("REAUTHENTICATION_FAILED");
    }
    await db.query(
      "INSERT INTO app_reauth(session_id,user_id,expires_at) VALUES($1,$2,now()+interval '5 minutes') ON CONFLICT(session_id) DO UPDATE SET expires_at=EXCLUDED.expires_at",
      [sessionId, userId],
    );
    await db.query("DELETE FROM app_reauth_attempts WHERE user_id=$1", [
      userId,
    ]);
    await db.query("COMMIT");
    committed = true;
  } finally {
    if (!committed) await db.query("ROLLBACK");
    db.release();
  }
}
