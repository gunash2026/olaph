import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
let db: PGlite,
  tenant: string,
  other: string,
  material: string,
  warehouse: string,
  order: string;
beforeAll(async () => {
  db = new PGlite();
  for (const name of [
    "0001_foundation",
    "0002_operations",
    "0003_identity",
    "0004_entitlements",
    "0005_controls",
  ])
    await db.exec(
      await readFile(`packages/database/migrations/${name}.sql`, "utf8"),
    );
  await db.query("SELECT set_config('app.user_id','alice',false)");
  tenant = (
    await db.query<{ id: string }>("SELECT create_workspace('Workspace A') id")
  ).rows[0].id;
  await db.query("SELECT set_config('app.user_id','bob',false)");
  other = (
    await db.query<{ id: string }>("SELECT create_workspace('Workspace B') id")
  ).rows[0].id;
  await db.query(
    "SELECT set_config('app.user_id','alice',false),set_config('app.tenant_id',$1,false)",
    [tenant],
  );
  material = (
    await db.query<{ id: string }>(
      "INSERT INTO materials(tenant_id,code,name,unit) VALUES($1,'MAT','Material','unit') RETURNING id",
      [tenant],
    )
  ).rows[0].id;
  warehouse = (
    await db.query<{ id: string }>(
      "INSERT INTO warehouses(tenant_id,name) VALUES($1,'Warehouse') RETURNING id",
      [tenant],
    )
  ).rows[0].id;
  order = (
    await db.query<{ id: string }>(
      "INSERT INTO orders(tenant_id,code,due_date) VALUES($1,'ORD','2027-01-01') RETURNING id",
      [tenant],
    )
  ).rows[0].id;
}, 30000);
afterAll(async () => {
  await db?.close();
});
async function actor(work: () => Promise<void>, user = "alice", tid = tenant) {
  await db.exec("BEGIN; SET LOCAL ROLE olaph_runtime");
  try {
    await db.query(
      "SELECT set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true)",
      [user, tid],
    );
    await work();
  } finally {
    await db.exec("ROLLBACK");
  }
}
async function move(qty: string, key = "70000000-0000-4000-8000-000000000001") {
  return db.query(
    "INSERT INTO stock_movements(tenant_id,material_id,warehouse_id,quantity,idempotency_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,idempotency_key) DO NOTHING",
    [tenant, material, warehouse, qty, key],
  );
}
it("creates an empty company and four default roles with a 14 day trial", async () => {
  await actor(async () => {
    expect((await db.query("SELECT * FROM tenant_roles")).rows).toHaveLength(4);
    expect((await db.query("SELECT * FROM products")).rows).toHaveLength(0);
    expect(
      (await db.query<{ status: string }>("SELECT status FROM subscriptions"))
        .rows[0].status,
    ).toBe("trialing");
  });
});
it("updates stock exactly once when a request is retried", async () => {
  await actor(async () => {
    await move("0.1");
    await move("0.1");
    expect(
      (await db.query<{ quantity: string }>("SELECT quantity FROM materials"))
        .rows[0].quantity,
    ).toBe("0.100000");
  });
});
it("prevents a direct balance overwrite", async () => {
  await actor(async () => {
    await expect(
      db.query("UPDATE materials SET quantity=999"),
    ).rejects.toThrow();
  });
});
it("rejects an outbound movement exceeding available stock", async () => {
  await actor(async () => {
    await expect(move("-1")).rejects.toThrow("INSUFFICIENT_AVAILABLE_STOCK");
  });
});
it("holds stock for an order and prevents double allocation", async () => {
  await actor(async () => {
    await move("10");
    await db.query("SELECT reserve_stock($1,$2,$3,7)", [
      order,
      material,
      warehouse,
    ]);
    expect(
      (
        await db.query<{ reserved: string }>(
          "SELECT reserved FROM stock_balances",
        )
      ).rows[0].reserved,
    ).toBe("7.000000");
    await expect(
      db.query("SELECT reserve_stock($1,$2,$3,4)", [
        order,
        material,
        warehouse,
      ]),
    ).rejects.toThrow("INSUFFICIENT_AVAILABLE_STOCK");
  });
});
it("prevents recipes from creating indirect cycles", async () => {
  await actor(async () => {
    const a = (
      await db.query<{ id: string }>(
        "INSERT INTO products(tenant_id,code,name,unit) VALUES($1,'A','A','unit') RETURNING id",
        [tenant],
      )
    ).rows[0].id;
    const b = (
      await db.query<{ id: string }>(
        "INSERT INTO products(tenant_id,code,name,unit) VALUES($1,'B','B','unit') RETURNING id",
        [tenant],
      )
    ).rows[0].id;
    await db.query(
      "INSERT INTO recipes(tenant_id,product_id,component_product_id,quantity) VALUES($1,$2,$3,1)",
      [tenant, a, b],
    );
    await expect(
      db.query(
        "INSERT INTO recipes(tenant_id,product_id,component_product_id,quantity) VALUES($1,$2,$3,1)",
        [tenant, b, a],
      ),
    ).rejects.toThrow("RECIPE_CYCLE");
  });
});
it("cannot self approve a purchase while inserting it", async () => {
  await actor(async () => {
    await expect(
      db.query(
        "INSERT INTO purchase_requests(tenant_id,material_id,quantity,unit_price,currency,status) VALUES($1,$2,1,1,'USD','approved')",
        [tenant, material],
      ),
    ).rejects.toThrow();
  });
});
it("requires the invitation verified email to match", async () => {
  await actor(async () => {
    const role = (
      await db.query<{ id: string }>(
        "SELECT id FROM tenant_roles WHERE name='production'",
      )
    ).rows[0].id;
    await db.query(
      "SELECT invite_member('invite@example.test',$1,'hashed-token')",
      [role],
    );
    await expect(
      db.query("SELECT accept_invitation('hashed-token','wrong@example.test')"),
    ).rejects.toThrow("INVALID_INVITATION");
  });
});
it("all operational tables reject a forged tenant context", async () => {
  await actor(
    async () => {
      for (const table of [
        "tenant_roles",
        "tenant_settings",
        "subscriptions",
        "work_orders",
        "employees",
        "import_jobs",
        "integration_settings",
        "stock_balances",
      ])
        expect((await db.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0);
      await expect(
        db.query("SELECT save_role(null,'owner',ARRAY['settings:write'],true)"),
      ).rejects.toThrow("FORBIDDEN");
    },
    "alice",
    other,
  );
});
