import Decimal from "decimal.js";
import { z } from "zod";
export { parseCsv, toCsv } from "./csv";
export { materialLabelPayload, supportsCode128 } from "./material-label";
export const decimal = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/)
  .refine((x) => new Decimal(x).lte("999999999999"), "Quantity is too large");
export const materialSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(40),
  unit: z.string().trim().min(1).max(20),
  quantity: decimal,
  minimum: decimal,
});
export type Material = z.infer<typeof materialSchema>;
export const movementSchema = z.object({
  materialId: z.string().uuid(),
  direction: z.enum(["in", "out"]),
  quantity: decimal.refine((v) => new Decimal(v).gt(0)),
  note: z.string().trim().max(300),
});
export function stockAfter(
  current: string,
  amount: string,
  direction: "in" | "out",
) {
  decimal.parse(current);
  decimal.parse(amount);
  if (new Decimal(amount).lte(0)) throw new Error("POSITIVE_QUANTITY_REQUIRED");
  const result = new Decimal(current)[direction === "in" ? "plus" : "minus"](
    amount,
  );
  if (result.lt(0)) throw new Error("INSUFFICIENT_STOCK");
  decimal.parse(result.toFixed());
  return result.toFixed();
}
export function shortage(required: string, available: string) {
  decimal.parse(required);
  decimal.parse(available);
  return Decimal.max(new Decimal(required).minus(available), 0).toFixed();
}
export function isLowStock(material: Material) {
  return new Decimal(material.quantity).lte(material.minimum);
}
export const permissions = [
  "catalog:read",
  "catalog:write",
  "stock:read",
  "stock:write",
  "orders:read",
  "orders:write",
  "purchasing:read",
  "purchasing:write",
  "purchasing:approve",
  "cost:read",
  "settings:write",
  "audit:read",
] as const;
export type Permission = (typeof permissions)[number];
export const defaultRoles: Record<string, readonly Permission[]> = {
  admin: permissions,
  manager: permissions.filter((p) => p !== "settings:write"),
  accountant: permissions.filter(
    (p) => !["settings:write", "audit:read", "purchasing:approve"].includes(p),
  ),
  production: [
    "catalog:read",
    "catalog:write",
    "stock:read",
    "stock:write",
    "orders:read",
  ],
};
export function can(grants: readonly string[], permission: Permission) {
  return grants.includes(permission);
}
export const plans = [
  { id: "starter", usd: 59, users: 5 },
  { id: "professional", usd: 149, users: 15 },
  { id: "enterprise", usd: 349, users: null },
] as const;
export function planPrice(usd: number, yearly: boolean) {
  return new Decimal(usd).times(yearly ? 10 : 1).toFixed(2);
}
