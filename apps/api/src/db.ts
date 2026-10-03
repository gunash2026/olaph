import pg from "pg";
import { ForbiddenException } from "@nestjs/common";
import { config } from "./config.js";
export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 12,
  statement_timeout: 15000,
});
export const authPool = new pg.Pool({
  connectionString: config.AUTH_DATABASE_URL,
  max: 8,
  options: "-c search_path=auth,public",
  statement_timeout: 15000,
});
export type Database = Pick<pg.PoolClient, "query">;
export async function transaction<T>(
  userId: string,
  tenantId: string | null,
  run: (db: pg.PoolClient) => Promise<T>,
) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query(
      "SELECT set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true)",
      [userId, tenantId || ""],
    );
    const verifiedEmail =
      (
        await authPool.query(
          'SELECT email FROM "user" WHERE id=$1 AND "emailVerified"=true',
          [userId],
        )
      ).rows[0]?.email || "";
    await db.query("SELECT set_config('app.user_email',$1,true)", [
      verifiedEmail,
    ]);
    if (
      tenantId &&
      !(
        await db.query(
          "SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND active",
          [tenantId, userId],
        )
      ).rowCount
    )
      throw new ForbiddenException("WORKSPACE_ACCESS_DENIED");
    const value = await run(db);
    await db.query("COMMIT");
    return value;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export async function assertRuntimeRole() {
  const r = await pool.query(
    "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
  );
  if (r.rows[0]?.rolsuper || r.rows[0]?.rolbypassrls)
    throw Error("DATABASE_URL must use a role without superuser or BYPASSRLS.");
}
