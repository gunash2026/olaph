import {
  pgTable,
  uuid,
  text,
  numeric,
  jsonb,
  timestamp,
  unique,
  foreignKey,
} from "drizzle-orm/pg-core";
export const tenants = pgTable("tenants", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const materials = pgTable(
  "materials",
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    code: text().notNull(),
    name: text().notNull(),
    unit: text().notNull(),
    quantity: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    minimum: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    customFields: jsonb("custom_fields").notNull().default({}),
  },
  (table) => [
    unique().on(table.tenantId, table.code),
    unique().on(table.tenantId, table.id),
  ],
);
// SQL migrations are authoritative for RLS, roles, triggers and constraints.
