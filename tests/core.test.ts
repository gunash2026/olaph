import { describe, it, expect } from "vitest";
import {
  stockAfter,
  shortage,
  can,
  defaultRoles,
  planPrice,
  parseCsv,
  toCsv,
  materialSchema,
} from "../packages/core/src/index";
describe("Inventory integrity", () => {
  it("keeps decimal arithmetic exact", () => {
    expect(stockAfter("0.1", "0.2", "in")).toBe("0.3");
    expect(stockAfter("54.829", "0.029", "out")).toBe("54.8");
  });
  it("prevents negative or invalid stock", () => {
    expect(() => stockAfter("3", "4", "out")).toThrow("INSUFFICIENT_STOCK");
    for (const amount of ["-1", "0", "NaN", "Infinity", "1e9", "0.0000001"])
      expect(() => stockAfter("3", amount, "in")).toThrow();
  });
  it("bounds precision and amount", () =>
    expect(() => stockAfter("999999999999", "1", "in")).toThrow());
  it("never returns a negative shortage", () => {
    expect(shortage("10.25", "2.1")).toBe("8.15");
    expect(shortage("1", "2")).toBe("0");
  });
});
describe("Default permission boundaries", () => {
  it("keeps costs and purchases from production role", () => {
    expect(can(defaultRoles.production, "stock:write")).toBe(true);
    expect(can(defaultRoles.production, "cost:read")).toBe(false);
    expect(can(defaultRoles.production, "purchasing:approve")).toBe(false);
  });
  it("accountant prepares but cannot approve", () => {
    expect(can(defaultRoles.accountant, "purchasing:write")).toBe(true);
    expect(can(defaultRoles.accountant, "purchasing:approve")).toBe(false);
  });
  it("denies unspecified access", () =>
    expect(can([], "settings:write")).toBe(false));
});
describe("Import/export integrity", () => {
  it("preserves quoted commas, line breaks and quote escaping", () =>
    expect(parseCsv('code,name\r\nA,"Line 1,\nLine ""2"""')).toEqual([
      ["code", "name"],
      ["A", 'Line 1,\nLine "2"'],
    ]));
  it("rejects malformed CSV", () => expect(() => parseCsv('a,"b')).toThrow());
  it("escapes spreadsheet formula injection", () =>
    expect(toCsv([["=1+1", "+1", "@sum", "normal"]])).toContain(
      '"\'=1+1","\'+1","\'@sum","normal"',
    ));
  it("requires neutral user-defined fields", () =>
    expect(
      materialSchema.safeParse({
        id: crypto.randomUUID(),
        name: "",
        code: "A",
        unit: "",
        quantity: "0",
        minimum: "0",
      }).success,
    ).toBe(false));
});
it("charges ten months for an annual term", () => {
  expect(planPrice(59, true)).toBe("590.00");
  expect(planPrice(149, false)).toBe("149.00");
});
