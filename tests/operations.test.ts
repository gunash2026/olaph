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
    "0006_membership_controls",
    "0007_stock_counts",
    "0008_stock_transfers",
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
  await db.query("SELECT set_config('app.tenant_id',$1,false)", [other]);
  const delegated = (
    await db.query<{ id: string }>(
      "SELECT save_role(NULL,'delegated',ARRAY['settings:read','settings:write'],true) id",
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO memberships(tenant_id,user_id,role,role_id,permissions) SELECT $1,'limited','delegated',$2,permissions FROM tenant_roles WHERE id=$2",
    [other, delegated],
  );
  await db.query(
    "INSERT INTO memberships(tenant_id,user_id,role,role_id,permissions,active) SELECT $1,'inactive',name,id,permissions,false FROM tenant_roles WHERE tenant_id=$1 AND name='production'",
    [other],
  );
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
it("consumes a reservation once even when its confirmation is retried", async () => {
  await actor(async () => {
    await move("10");
    const reservation = (
      await db.query<{ id: string }>("SELECT reserve_stock($1,$2,$3,3) id", [
        order,
        material,
        warehouse,
      ])
    ).rows[0].id;
    for (let retry = 0; retry < 2; retry++)
      await db.query(
        "SELECT finish_reservation($1,'consumed','70000000-0000-4000-8000-000000000002')",
        [reservation],
      );
    expect(
      (
        await db.query<{ quantity: string; reserved: string }>(
          "SELECT quantity,reserved FROM stock_balances",
        )
      ).rows[0],
    ).toEqual({ quantity: "7.000000", reserved: "0.000000" });
  });
});
async function countStock(
  expected: string,
  counted: string,
  key = "80000000-0000-4000-8000-000000000001",
) {
  return db.query<{ id: string }>(
    "SELECT confirm_stock_count($1,$2,$3,$4,'Physical verification',$5) id",
    [material, warehouse, expected, counted, key],
  );
}
async function destinationWarehouse(owner: string | null = null) {
  return (await db.query<{id:string}>("INSERT INTO warehouses(tenant_id,name,owner_partner_id) VALUES($1,'Destination',$2) RETURNING id",[tenant,owner])).rows[0].id;
}
async function transfer(destination: string, qty = "3", key = "90000000-0000-4000-8000-000000000001") {
  return db.query<{id:string}>("SELECT transfer_stock($1,$2,$3,$4,'Warehouse relocation',$5) id",[material,warehouse,destination,qty,key]);
}
it("transfers between warehouses atomically without changing total stock or repeating on retry", async () => {
  await actor(async () => {
    await move("10");
    const destination = await destinationWarehouse();
    const auditBefore = (await db.query("SELECT * FROM audit_log WHERE entity='materials'")).rows.length;
    const first = await transfer(destination);
    expect((await transfer(destination)).rows[0]).toEqual(first.rows[0]);
    expect((await db.query("SELECT quantity FROM materials")).rows[0]).toEqual({quantity:"10.000000"});
    expect((await db.query("SELECT warehouse_id,quantity FROM stock_balances ORDER BY quantity")).rows).toEqual([
      {warehouse_id:destination,quantity:"3.000000"},{warehouse_id:warehouse,quantity:"7.000000"},
    ]);
    expect((await db.query("SELECT * FROM stock_movements WHERE transfer_id IS NOT NULL")).rows).toHaveLength(2);
    expect((await db.query("SELECT * FROM stock_transfers")).rows).toHaveLength(1);
    expect((await db.query("SELECT * FROM audit_log WHERE entity='materials'")).rows).toHaveLength(auditBefore);
  });
});
it("prevents transferring reserved stock", async () => {
  await actor(async () => {
    await move("10");
    const destination = await destinationWarehouse();
    await db.query("SELECT reserve_stock($1,$2,$3,8)",[order,material,warehouse]);
    await expect(transfer(destination)).rejects.toThrow("INSUFFICIENT_AVAILABLE_STOCK");
  });
});
it("prevents transfers between different stock owners", async () => {
  await actor(async () => {
    await move("10");
    const owner = (await db.query<{id:string}>("INSERT INTO partners(tenant_id,name,kind) VALUES($1,'Customer','customer') RETURNING id",[tenant])).rows[0].id;
    await expect(transfer(await destinationWarehouse(owner))).rejects.toThrow("STOCK_OWNER_MISMATCH");
  });
});
it("rejects changing the owner of a warehouse with stock", async () => {
  await actor(async () => {
    await move("10");
    const owner = (await db.query<{id:string}>("INSERT INTO partners(tenant_id,name,kind) VALUES($1,'Customer','customer') RETURNING id",[tenant])).rows[0].id;
    await expect(db.query("UPDATE warehouses SET owner_partner_id=$1 WHERE id=$2",[owner,warehouse])).rejects.toThrow("OWNER_CHANGE_REQUIRES_EMPTY_WAREHOUSE");
  });
});
it("rejects transfers back into the same warehouse", async () => {
  await actor(async () => {
    await expect(transfer(warehouse)).rejects.toThrow("INVALID_STOCK_TRANSFER");
  });
});
it("rejects modified transfer retries", async () => {
  await actor(async () => {
    await move("10");
    const destination = await destinationWarehouse();
    await transfer(destination);
    await expect(transfer(destination,"4")).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
});
it("does not allow direct transfer tagging to bypass aggregate stock updates", async () => {
  await actor(async () => {
    await expect(db.query("INSERT INTO stock_movements(tenant_id,material_id,warehouse_id,quantity,idempotency_key,transfer_id) VALUES($1,$2,$3,1,gen_random_uuid(),gen_random_uuid())",[tenant,material,warehouse])).rejects.toThrow();
  });
});
it("rejects transfer writes without stock permission", async () => {
  await actor(async () => {
    await expect(transfer("90000000-0000-4000-8000-000000000002")).rejects.toThrow("FORBIDDEN");
  },"limited",other);
});
it("hides transfer history from another firm", async () => {
  await actor(async () => {
    await move("10");
    await transfer(await destinationWarehouse());
    await db.query("SELECT set_config('app.user_id','bob',true),set_config('app.tenant_id',$1,true)",[other]);
    expect((await db.query("SELECT * FROM stock_transfers")).rows).toHaveLength(0);
    await expect(transfer("90000000-0000-4000-8000-000000000002")).rejects.toThrow("STOCK_REFERENCE_NOT_FOUND");
  });
});
it("reconciles an exact stock count once and records the adjustment and actor", async () => {
  await actor(async () => {
    await move("10.125");
    const first = await countStock("10.125", "9.625");
    expect((await countStock("10.125", "9.625")).rows[0]).toEqual(
      first.rows[0],
    );
    expect(
      (await db.query("SELECT quantity FROM stock_balances")).rows[0],
    ).toEqual({ quantity: "9.625000" });
    expect(
      (await db.query("SELECT difference,counted_by FROM stock_counts")).rows,
    ).toEqual([{ difference: "-0.500000", counted_by: "alice" }]);
    expect((await db.query("SELECT * FROM stock_movements")).rows).toHaveLength(
      2,
    );
    expect(
      (await db.query("SELECT * FROM audit_log WHERE entity='stock_counts'"))
        .rows,
    ).toHaveLength(1);
  });
});
it("rejects a stock count if a movement happened after its baseline was read", async () => {
  await actor(async () => {
    await move("10");
    await move("2", "70000000-0000-4000-8000-000000000003");
    await expect(countStock("10", "9")).rejects.toThrow("STALE_STOCK_COUNT");
  });
});
it("does not let physical counts consume stock reserved by an order", async () => {
  await actor(async () => {
    await move("10");
    await db.query("SELECT reserve_stock($1,$2,$3,7)", [
      order,
      material,
      warehouse,
    ]);
    await expect(countStock("10", "6")).rejects.toThrow(
      "INSUFFICIENT_AVAILABLE_STOCK",
    );
  });
});
it("records a matching count without inventing a stock movement", async () => {
  await actor(async () => {
    await move("10");
    await countStock("10", "10");
    expect((await db.query("SELECT * FROM stock_counts")).rows).toHaveLength(1);
    expect((await db.query("SELECT * FROM stock_movements")).rows).toHaveLength(
      1,
    );
  });
});
it("rejects changed stock count data under an already committed request key", async () => {
  await actor(async () => {
    await move("10");
    await countStock("10", "9");
    await expect(countStock("10", "8")).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
});
it("keeps counts immutable and hidden from another company", async () => {
  await actor(async () => {
    await move("10");
    await countStock("10", "9");
    await db.query(
      "SELECT set_config('app.user_id','bob',true),set_config('app.tenant_id',$1,true)",
      [other],
    );
    expect((await db.query("SELECT * FROM stock_counts")).rows).toHaveLength(0);
    await expect(
      db.query("UPDATE stock_counts SET counted_quantity=999"),
    ).rejects.toThrow();
  });
});
it("rejects stock count writes without stock permission", async () => {
  await actor(
    async () => {
      await expect(countStock("0", "1")).rejects.toThrow("FORBIDDEN");
    },
    "limited",
    other,
  );
});
it("rejects a foreign warehouse or material in a stock count", async () => {
  await actor(
    async () => {
      await expect(countStock("0", "1")).rejects.toThrow(
        "STOCK_REFERENCE_NOT_FOUND",
      );
    },
    "bob",
    other,
  );
});
it("rejects stock counts after trial expiry even when called directly in SQL", async () => {
  await db.query(
    "UPDATE subscriptions SET trial_ends_at=now()-interval '1 day' WHERE tenant_id=$1",
    [tenant],
  );
  try {
    await actor(async () => {
      await expect(countStock("0", "1")).rejects.toThrow(
        "SUBSCRIPTION_REQUIRED",
      );
    });
  } finally {
    await db.query(
      "UPDATE subscriptions SET trial_ends_at=now()+interval '14 days' WHERE tenant_id=$1",
      [tenant],
    );
  }
});
it("rejects stock counts with more than six decimal places instead of rounding silently", async () => {
  await actor(async () => {
    await expect(countStock("0", "0.1234567")).rejects.toThrow(
      "INVALID_STOCK_COUNT",
    );
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
it("accepts a valid invitation for its verified recipient", async () => {
  await actor(async () => {
    const role = (
      await db.query<{ id: string }>(
        "SELECT id FROM tenant_roles WHERE name='production'",
      )
    ).rows[0].id;
    await db.query(
      "SELECT invite_member('correct@example.test',$1,'valid-token')",
      [role],
    );
    await db.query("SELECT set_config('app.user_id','invited-user',true)");
    expect(
      (
        await db.query<{ id: string }>(
          "SELECT accept_invitation('valid-token','correct@example.test') id",
        )
      ).rows[0].id,
    ).toBe(tenant);
    expect(
      (await db.query<{ role: string }>("SELECT * FROM workspace_summaries()"))
        .rows[0].role,
    ).toBe("production");
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
it("a delegated manager cannot invite a role exceeding their own permissions", async () => {
  await actor(
    async () => {
      const role = (
        await db.query<{ id: string }>(
          "SELECT id FROM tenant_roles WHERE name='manager'",
        )
      ).rows[0].id;
      await expect(
        db.query(
          "SELECT invite_member('escalation@example.test',$1,'escalation-token')",
          [role],
        ),
      ).rejects.toThrow("FORBIDDEN");
    },
    "limited",
    other,
  );
});
it("a delegated manager cannot assign a stronger role to another member", async () => {
  await actor(
    async () => {
      const role = (
        await db.query<{ id: string }>(
          "SELECT id FROM tenant_roles WHERE name='manager'",
        )
      ).rows[0].id;
      await expect(
        db.query("SELECT set_member('inactive',$1,true)", [role]),
      ).rejects.toThrow("FORBIDDEN");
    },
    "limited",
    other,
  );
});
it("reactivating a member cannot bypass the subscription seat limit", async () => {
  await db.query(
    "INSERT INTO memberships(tenant_id,user_id,role,role_id,permissions) SELECT $1,'seat-'||n,name,id,permissions FROM tenant_roles CROSS JOIN generate_series(1,3) n WHERE tenant_id=$1 AND name='production'",
    [other],
  );
  await actor(
    async () => {
      const role = (
        await db.query<{ id: string }>(
          "SELECT id FROM tenant_roles WHERE name='production'",
        )
      ).rows[0].id;
      await expect(
        db.query("SELECT set_member('inactive',$1,true)", [role]),
      ).rejects.toThrow("SEAT_LIMIT");
    },
    "bob",
    other,
  );
});
