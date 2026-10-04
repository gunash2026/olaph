import { z } from "zod";
export const id = z.string().uuid();
const text = z.string().trim().min(1).max(160),
  note = z.string().trim().max(2000).default("");
export const quantity = z.string().regex(/^\d{1,12}(\.\d{1,6})?$/);
export const positive = quantity.refine(
  (x) => Number(x) > 0,
  "Must be positive",
);
const date = z.iso.date(),
  datetime = z.iso.datetime({ offset: true });
const optionalId = id.nullable().optional();
const json = z
  .record(
    z.string(),
    z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]),
  )
  .refine((value) => Object.keys(value).length <= 100, "Too many custom fields")
  .optional();
const currency = z.enum(["TRY", "USD", "EUR", "GBP"]);
const price = z.string().regex(/^\d{1,12}(\.\d{1,4})?$/);
type Resource = {
  table: string;
  permission: string;
  schema: z.ZodObject;
  readonly?: boolean;
  immutable?: boolean;
  writePermission?: string;
  critical?: boolean;
};
export const resources: Record<string, Resource> = {
  "custom-fields": {
    table: "custom_field_definitions",
    permission: "catalog",
    writePermission: "settings:write",
    critical: true,
    schema: z.object({
      entity: z.enum(["materials", "products", "partners"]),
      key: z
        .string()
        .regex(/^[a-z][a-z0-9_]{0,39}$/)
        .refine((value) => !["constructor", "prototype"].includes(value)),
      label: z.string().trim().min(1).max(80),
      kind: z.enum(["text", "decimal", "boolean", "date", "select"]),
      required: z.boolean().default(false),
      active: z.boolean().default(true),
      options: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
      position: z.number().int().min(0).max(999).default(0),
    }),
  },
  materials: {
    table: "materials",
    permission: "catalog",
    schema: z.object({
      code: text,
      name: text,
      unit: text,
      minimum: quantity.default("0"),
      custom_fields: json,
    }),
  },
  products: {
    table: "products",
    permission: "catalog",
    schema: z.object({
      code: text,
      name: text,
      unit: text,
      custom_fields: json,
    }),
  },
  recipes: {
    table: "recipes",
    permission: "catalog",
    schema: z
      .object({
        product_id: id,
        material_id: optionalId,
        component_product_id: optionalId,
        quantity: positive,
      })
      .refine(
        (x) => !!x.material_id !== !!x.component_product_id,
        "Choose one component",
      ),
  },
  partners: {
    table: "partners",
    permission: "catalog",
    schema: z.object({
      name: text,
      kind: z.enum(["customer", "supplier", "both"]),
      custom_fields: json,
    }),
  },
  units: {
    table: "units",
    permission: "catalog",
    schema: z.object({
      code: text,
      name: text,
      base_unit_id: optionalId,
      factor: positive.default("1"),
    }),
  },
  "material-unit-conversions": {
    table: "material_unit_conversions",
    permission: "catalog",
    schema: z.object({ material_id: id, input_unit_id: id, factor: positive }),
  },
  "partner-codes": {
    table: "partner_codes",
    permission: "catalog",
    schema: z.object({ partner_id: id, material_id: id, code: text }),
  },
  warehouses: {
    table: "warehouses",
    permission: "stock",
    schema: z.object({ name: text, owner_partner_id: optionalId }),
  },
  balances: {
    table: "stock_balances",
    permission: "stock",
    readonly: true,
    schema: z.object({}),
  },
  movements: {
    table: "stock_movements",
    permission: "stock",
    readonly: true,
    schema: z.object({}),
  },
  transfers: {
    table: "stock_transfers",
    permission: "stock",
    readonly: true,
    schema: z.object({}),
  },
  "stock-counts": {
    table: "stock_counts",
    permission: "stock",
    readonly: true,
    schema: z.object({}),
  },
  reservations: {
    table: "reservations",
    permission: "stock",
    readonly: true,
    schema: z.object({}),
  },
  orders: {
    table: "orders",
    permission: "orders",
    schema: z.object({
      code: text,
      partner_id: optionalId,
      due_date: date,
      status: z.enum(["draft", "active", "done", "cancelled"]).default("draft"),
    }),
  },
  "order-lines": {
    table: "order_lines",
    permission: "orders",
    schema: z.object({ order_id: id, product_id: id, quantity: positive }),
  },
  requirements: {
    table: "material_requirements",
    permission: "orders",
    schema: z.object({
      order_id: id,
      material_id: id,
      quantity: positive,
      source: z
        .enum(["undecided", "own", "customer", "customer_supplier"])
        .default("undecided"),
    }),
  },
  quotes: {
    table: "supplier_quotes",
    permission: "purchasing",
    schema: z.object({
      partner_id: id,
      material_id: id,
      unit_price: price,
      currency,
      lead_days: z.number().int().min(0).max(3650),
      minimum: quantity.default("0"),
      pack_size: positive.default("1"),
      payment_terms: note,
      valid_until: date,
    }),
  },
  purchases: {
    table: "purchase_requests",
    permission: "purchasing",
    immutable: true,
    schema: z.object({
      material_id: id,
      partner_id: optionalId,
      quantity: positive,
      unit_price: price,
      currency,
    }),
  },
  stations: {
    table: "stations",
    permission: "production",
    schema: z.object({ name: text, capacity: positive.default("1") }),
  },
  "work-orders": {
    table: "work_orders",
    permission: "production",
    immutable: true,
    schema: z.object({
      order_id: id,
      station_id: id,
      quantity: positive,
      assigned_to: z.string().max(120).nullable().optional(),
    }),
  },
  quality: {
    table: "quality_checks",
    permission: "production",
    immutable: true,
    schema: z.object({
      work_order_id: id,
      result: z.enum(["pass", "fail", "hold"]),
      sample_size: positive,
      note,
    }),
  },
  employees: {
    table: "employees",
    permission: "hr",
    schema: z.object({
      name: text,
      code: text,
      job_title: note,
      active: z.boolean().default(true),
    }),
  },
  shifts: {
    table: "shifts",
    permission: "hr",
    schema: z.object({
      employee_id: id,
      station_id: optionalId,
      start_at: datetime,
      end_at: datetime,
      note,
    }),
  },
  attendance: {
    table: "attendance",
    permission: "hr",
    schema: z.object({
      employee_id: id,
      arrived_at: datetime,
      left_at: datetime.nullable().optional(),
    }),
  },
  cases: {
    table: "customer_cases",
    permission: "orders",
    schema: z.object({
      partner_id: id,
      order_id: optionalId,
      subject: text,
      message: note,
      status: z.enum(["open", "investigating", "resolved"]).default("open"),
      satisfaction: z.number().int().min(1).max(5).nullable().optional(),
    }),
  },
  "notification-rules": {
    table: "notification_rules",
    permission: "settings",
    schema: z.object({
      event: z.enum(["low_stock", "purchase_pending", "order_due"]),
      channel: z.enum(["email", "in_app"]),
      recipient: z.email(),
      enabled: z.boolean().default(true),
    }),
  },
  notifications: {
    table: "notifications",
    permission: "profile",
    readonly: true,
    schema: z.object({}),
  },
  roles: {
    table: "tenant_roles",
    permission: "settings",
    readonly: true,
    schema: z.object({}),
  },
  settings: {
    table: "tenant_settings",
    permission: "settings",
    immutable: true,
    schema: z.object({
      locale: z.enum(["tr", "en", "ar", "zh", "ru"]),
      timezone: text.refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Use a valid IANA timezone"),
      approval_limit: price,
      retention_days: z.number().int().min(30).max(3650),
    }),
  },
  subscriptions: {
    table: "subscriptions",
    permission: "billing",
    readonly: true,
    schema: z.object({}),
  },
  audit: {
    table: "audit_log",
    permission: "audit",
    readonly: true,
    schema: z.object({}),
  },
  imports: {
    table: "import_jobs",
    permission: "orders",
    readonly: true,
    schema: z.object({}),
  },
  "import-templates": {
    table: "import_templates",
    permission: "orders",
    schema: z.object({
      partner_id: optionalId,
      name: text,
      mapping: z.record(z.string(), z.string()),
    }),
  },
  "privacy-requests": {
    table: "privacy_requests",
    permission: "profile",
    immutable: true,
    schema: z.object({
      kind: z.enum(["export", "erase", "correct"]),
      message: note,
    }),
  },
  proposals: {
    table: "approval_proposals",
    permission: "purchasing",
    readonly: true,
    schema: z.object({}),
  },
};
