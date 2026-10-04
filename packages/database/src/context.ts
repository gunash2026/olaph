import type { Pool, PoolClient } from "pg";
export type VerifiedIdentity = { userId: string; tenantId: string };
// Identity MUST come from a verified server session, never a browser header.
export async function withTenant<T>(
  pool: Pool,
  identity: VerifiedIdentity,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "select set_config('app.user_id',$1,true), set_config('app.tenant_id',$2,true)",
      [identity.userId, identity.tenantId],
    );
    const membership = await client.query(
      "select 1 from memberships where user_id=$1 and tenant_id=$2 and active=true",
      [identity.userId, identity.tenantId],
    );
    if (!membership.rowCount) throw Error("FORBIDDEN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
