import { beforeAll, afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
let db: PGlite, tenant: string, other: string, material: string;
beforeAll(async () => {
  db = new PGlite();
  for (const file of (await readdir("packages/database/migrations"))
    .filter((file) => file.endsWith(".sql") && !file.startsWith("0011"))
    .sort())
    await db.exec(
      await readFile(`packages/database/migrations/${file}`, "utf8"),
    );
  await db.query("SELECT set_config('app.user_id','owner',false)");
  tenant = (
    await db.query<{ id: string }>(
      "SELECT create_workspace('Custom fields A') id",
    )
  ).rows[0].id;
  await db.query("SELECT set_config('app.user_id','outsider',false)");
  other = (
    await db.query<{ id: string }>(
      "SELECT create_workspace('Custom fields B') id",
    )
  ).rows[0].id;
  await db.query(
    "SELECT set_config('app.user_id','owner',false),set_config('app.tenant_id',$1,false)",
    [tenant],
  );
  material = (
    await db.query<{ id: string }>(
      "INSERT INTO materials(tenant_id,code,name,unit,custom_fields) VALUES($1,'MAT','Material','unit','{\"legacy_note\":\"preserved\"}') RETURNING id",
      [tenant],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO memberships(tenant_id,user_id,role,permissions) VALUES($1,'catalog-only','custom',ARRAY['catalog:read','catalog:write'])",
    [tenant],
  );
  await db.exec(
    await readFile(
      "packages/database/migrations/0011_custom_fields.sql",
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
async function actor(work: () => Promise<void>, user = "owner", tid = tenant) {
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
async function define(
  kind = "text",
  options: string[] = [],
  required = false,
  entity = "materials",
  key = "grade",
) {
  return (
    await db.query<{ id: string }>(
      "INSERT INTO custom_field_definitions(tenant_id,entity,key,label,kind,options,required) VALUES($1,$2,$3,'Grade',$4,$5,$6) RETURNING id",
      [tenant, entity, key, kind, JSON.stringify(options), required],
    )
  ).rows[0].id;
}
async function assign(value: unknown, key = "grade") {
  return db.query(
    "UPDATE materials SET custom_fields=custom_fields || $1::jsonb WHERE id=$2 RETURNING custom_fields",
    [JSON.stringify({ [key]: value }), material],
  );
}
it("starts without definitions and preserves pre-migration fields on normal updates", async () => {
  await actor(async () => {
    expect(
      (await db.query("SELECT * FROM custom_field_definitions")).rows,
    ).toHaveLength(0);
    await db.query(
      "UPDATE materials SET name='Renamed',custom_fields=custom_fields || '{}'::jsonb WHERE id=$1",
      [material],
    );
    expect(
      (await db.query("SELECT custom_fields FROM materials")).rows[0],
    ).toEqual({ custom_fields: { legacy_note: "preserved" } });
  });
});
it.each(["materials", "products", "partners"])(
  "supports company-defined fields on %s with audited values",
  async (entity) => {
    await actor(async () => {
      await define("text", [], false, entity);
      if (entity === "materials") await assign("A");
      else if (entity === "products")
        await db.query(
          "INSERT INTO products(tenant_id,code,name,unit,custom_fields) VALUES($1,'PROD','Product','unit','{\"grade\":\"A\"}')",
          [tenant],
        );
      else
        await db.query(
          "INSERT INTO partners(tenant_id,name,kind,custom_fields) VALUES($1,'Partner','customer','{\"grade\":\"A\"}')",
          [tenant],
        );
      expect(
        (
          await db.query<{ count: number }>(
            "SELECT count(*)::int count FROM audit_log WHERE entity=$1 AND new_value->'custom_fields'->>'grade'='A'",
            [entity],
          )
        ).rows[0].count,
      ).toBe(1);
    });
  },
);
it.each([
  ["text", "a".repeat(500), []],
  ["decimal", "-0.123456", []],
  ["boolean", false, []],
  ["date", "2028-02-29", []],
  ["select", "A", ["A", "B"]],
] as const)(
  "accepts a valid %s value without numeric coercion",
  async (kind, value, options) => {
    await actor(async () => {
      await define(kind, [...options]);
      expect((await assign(value)).rows[0]).toEqual({
        custom_fields: { legacy_note: "preserved", grade: value },
      });
    });
  },
);
it.each([
  ["text", "a".repeat(501), []],
  ["text", 1, []],
  ["decimal", "0.1234567", []],
  ["decimal", 0.1, []],
  ["decimal", "1e3", []],
  ["decimal", "1000000000000", []],
  ["boolean", "false", []],
  ["date", "2026-02-29", []],
  ["date", "2026-13-01", []],
  ["date", "2026-01-00", []],
  ["select", "C", ["A", "B"]],
] as const)(
  "rejects invalid %s values at the database boundary",
  async (kind, value, options) => {
    await actor(async () => {
      await define(kind, [...options]);
      await expect(assign(value)).rejects.toThrow("CUSTOM_FIELD_VALUE_INVALID");
    });
  },
);
it("does not make a field mandatory while existing records lack a value", async () => {
  await actor(async () => {
    await expect(define("text", [], true)).rejects.toThrow(
      "CUSTOM_FIELD_EXISTING_VALUES_INVALID",
    );
  });
});
it("allows making a populated field mandatory then rejects empty new records", async () => {
  await actor(async () => {
    const field = await define();
    await assign("A");
    await db.query(
      "UPDATE custom_field_definitions SET required=true WHERE id=$1",
      [field],
    );
    await expect(
      db.query(
        "INSERT INTO materials(tenant_id,code,name,unit) VALUES($1,'NEW','New','unit')",
        [tenant],
      ),
    ).rejects.toThrow("CUSTOM_FIELD_REQUIRED");
  });
});
it("mandatory boolean false is a supplied answer", async () => {
  await actor(async () => {
    const field = await define("boolean");
    await assign(false);
    await db.query(
      "UPDATE custom_field_definitions SET required=true WHERE id=$1",
      [field],
    );
    expect((await assign(false)).rows[0]).toEqual({
      custom_fields: { legacy_note: "preserved", grade: false },
    });
  });
});
it("cannot remove an option that is used by an existing card", async () => {
  await actor(async () => {
    const field = await define("select", ["A", "B"]);
    await assign("A");
    await expect(
      db.query(
        "UPDATE custom_field_definitions SET options='[\"B\"]' WHERE id=$1",
        [field],
      ),
    ).rejects.toThrow("CUSTOM_FIELD_EXISTING_VALUES_INVALID");
  });
});
it("archiving preserves values and blocks further edits until reactivated", async () => {
  await actor(async () => {
    const field = await define();
    await assign("A");
    await db.query(
      "UPDATE custom_field_definitions SET active=false WHERE id=$1",
      [field],
    );
    await assign("A");
    await expect(assign("B")).rejects.toThrow("CUSTOM_FIELD_NOT_ACTIVE");
  });
});
it("can reactivate an archived field without losing its value", async () => {
  await actor(async () => {
    const field = await define();
    await assign("A");
    await db.query(
      "UPDATE custom_field_definitions SET active=false WHERE id=$1",
      [field],
    );
    await db.query(
      "UPDATE custom_field_definitions SET active=true WHERE id=$1",
      [field],
    );
    expect((await assign("B")).rows[0]).toEqual({
      custom_fields: { legacy_note: "preserved", grade: "B" },
    });
  });
});
it.each([
  "id=gen_random_uuid()",
  "key='other'",
  "kind='decimal'",
  "entity='products'",
])("rejects changing a definition's identity: %s", async (change) => {
  await actor(async () => {
    const field = await define();
    await expect(
      db.query(`UPDATE custom_field_definitions SET ${change} WHERE id=$1`, [
        field,
      ]),
    ).rejects.toThrow("CUSTOM_FIELD_IDENTITY_IMMUTABLE");
  });
});
it("rejects unknown values and cannot erase legacy values", async () => {
  await actor(async () => {
    await expect(assign("new", "undefined_field")).rejects.toThrow(
      "CUSTOM_FIELD_NOT_ACTIVE",
    );
  });
  await actor(async () => {
    await expect(
      db.query("UPDATE materials SET custom_fields='{}' WHERE id=$1", [
        material,
      ]),
    ).rejects.toThrow("CUSTOM_FIELD_NOT_ACTIVE");
  });
});
it("catalog editors can fill fields but cannot define them", async () => {
  await actor(async () => {
    await define();
    await db.query("SELECT set_config('app.user_id','catalog-only',true)");
    await assign("A");
    await expect(
      define("text", [], false, "materials", "extra"),
    ).rejects.toThrow("FORBIDDEN");
  });
});
it("another company cannot read or mutate definitions", async () => {
  await actor(async () => {
    await define();
    await db.query(
      "SELECT set_config('app.user_id','outsider',true),set_config('app.tenant_id',$1,true)",
      [other],
    );
    expect(
      (await db.query("SELECT * FROM custom_field_definitions")).rows,
    ).toHaveLength(0);
    await expect(define()).rejects.toThrow("FORBIDDEN");
  });
});
it.each([
  { options: ["A", "A"] },
  { options: [] },
  { options: [" A"] },
  { options: ["a".repeat(81)] },
])("rejects invalid select options $options", async ({ options }) => {
  await actor(async () => {
    await expect(define("select", options)).rejects.toThrow(
      "INVALID_CUSTOM_FIELD_DEFINITION",
    );
  });
});
it("enforces the active field limit even without the API", async () => {
  await actor(async () => {
    for (let index = 0; index < 50; index++)
      await define("text", [], false, "materials", `field_${index}`);
    await expect(
      define("text", [], false, "materials", "overflow"),
    ).rejects.toThrow("CUSTOM_FIELD_LIMIT");
  });
});
it("rejects array values instead of accepting an arbitrary JSON container", async () => {
  await actor(async () => {
    await expect(
      db.query("UPDATE materials SET custom_fields='[]' WHERE id=$1", [
        material,
      ]),
    ).rejects.toThrow("INVALID_CUSTOM_FIELDS");
  });
});
it("an expired workspace cannot define fields or change their values", async () => {
  await db.query(
    "UPDATE subscriptions SET trial_ends_at=now()-interval '1 day' WHERE tenant_id=$1",
    [tenant],
  );
  try {
    await actor(async () => {
      await expect(define()).rejects.toThrow("SUBSCRIPTION_REQUIRED");
    });
    await actor(async () => {
      await expect(
        db.query(
          "UPDATE materials SET custom_fields=custom_fields WHERE id=$1",
          [material],
        ),
      ).rejects.toThrow("SUBSCRIPTION_REQUIRED");
    });
  } finally {
    await db.query(
      "UPDATE subscriptions SET trial_ends_at=now()+interval '14 days' WHERE tenant_id=$1",
      [tenant],
    );
  }
});
