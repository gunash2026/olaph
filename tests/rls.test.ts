import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
let db: PGlite;
const tenantA = "10000000-0000-4000-8000-000000000001",
  tenantB = "10000000-0000-4000-8000-000000000002";
const materialA = "20000000-0000-4000-8000-000000000001",
  materialB = "20000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    await readFile("packages/database/migrations/0001_foundation.sql", "utf8"),
  );
  await db.query("INSERT INTO tenants(id,name) VALUES($1,$2),($3,$4)", [
    tenantA,
    "Company A",
    tenantB,
    "Company B",
  ]);
  await db.query(
    "INSERT INTO memberships(tenant_id,user_id,role,permissions) VALUES($1,'user-a','admin',ARRAY['catalog:read','catalog:write','stock:read','stock:write','audit:read']),($2,'user-b','admin',ARRAY['catalog:read','catalog:write']),($1,'read-only','reader',ARRAY['catalog:read'])",
    [tenantA, tenantB],
  );
  await db.query(
    "INSERT INTO materials(id,tenant_id,code,name,unit) VALUES($1,$2,'MAT-1','A material','unit'),($3,$4,'MAT-1','B material','unit')",
    [materialA, tenantA, materialB, tenantB],
  );
});
afterAll(async () => await db.close());
async function asUser(user: string, tenant: string, fn: () => Promise<void>) {
  await db.exec("BEGIN; SET LOCAL ROLE olaph_runtime;");
  try {
    await db.query(
      "SELECT set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true)",
      [user, tenant],
    );
    await fn();
  } finally {
    await db.exec("ROLLBACK");
  }
}
it("uses a non-superuser without RLS bypass", async () => {
  const r = await db.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
    "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname='olaph_runtime'",
  );
  expect(r.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
});
it("only returns the signed-in company material", async () => {
  await asUser("user-a", tenantA, async () => {
    const r = await db.query<{ id: string }>("SELECT id FROM materials");
    expect(r.rows).toEqual([{ id: materialA }]);
  });
});
it("rejects forged tenant context", async () => {
  await asUser("user-a", tenantB, async () => {
    expect((await db.query("SELECT * FROM materials")).rows).toEqual([]);
  });
});
it("rejects cross-tenant inserts", async () => {
  await asUser("user-a", tenantA, async () => {
    await expect(
      db.query(
        "INSERT INTO materials(tenant_id,code,name,unit) VALUES($1,'BAD','Invalid','unit')",
        [tenantB],
      ),
    ).rejects.toThrow();
  });
});
it("cannot reassign a record to another tenant", async () => {
  await asUser("user-a", tenantA, async () => {
    await expect(
      db.query("UPDATE materials SET tenant_id=$1 WHERE id=$2", [
        tenantB,
        materialA,
      ]),
    ).rejects.toThrow();
  });
});
it("rejects cross-tenant references", async () => {
  await asUser("user-a", tenantA, async () => {
    await expect(
      db.query(
        "INSERT INTO stock_movements(tenant_id,material_id,quantity,idempotency_key) VALUES($1,$2,1,gen_random_uuid())",
        [tenantA, materialB],
      ),
    ).rejects.toThrow();
  });
});
it("denies writes for a read-only role", async () => {
  await asUser("read-only", tenantA, async () => {
    expect(
      (await db.query("UPDATE materials SET quantity=9 RETURNING id")).rows,
    ).toEqual([]);
  });
});
it("records a mutation under the verified actor", async () => {
  await asUser("user-a", tenantA, async () => {
    await db.query("UPDATE materials SET quantity=2 WHERE id=$1", [materialA]);
    const r = await db.query<{ actor_id: string }>(
      "SELECT actor_id FROM audit_log WHERE actor_id=$1",
      ["user-a"],
    );
    expect(r.rows).toEqual([{ actor_id: "user-a" }]);
  });
});
it("denies audit deletion to runtime", async () => {
  await asUser(
    "user-a",
    tenantA,
    async () =>
      await expect(db.query("DELETE FROM audit_log")).rejects.toThrow(),
  );
});
it("denies reads with missing session context", async () => {
  await asUser("", tenantA, async () =>
    expect((await db.query("SELECT * FROM materials")).rows).toEqual([]),
  );
});
