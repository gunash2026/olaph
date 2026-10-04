import { expect, it } from "vitest";
import {
  materialLabelPayload,
  supportsCode128,
} from "../packages/core/src/material-label";
import { parseMaterialLabel } from "../apps/api/src/material-label";
const tenant = "10000000-0000-4000-8000-000000000001",
  material = "20000000-0000-4000-8000-000000000001";

it("binds QR labels to the company and immutable material id", () => {
  const label = materialLabelPayload(tenant, material);
  expect(parseMaterialLabel(label, tenant)).toEqual({
    kind: "id",
    value: material,
  });
  expect(() =>
    parseMaterialLabel(label, "10000000-0000-4000-8000-000000000002"),
  ).toThrow("MATERIAL_LABEL_DIFFERENT_COMPANY");
});
it("supports exact unicode material codes and scanner line endings", () => {
  expect(parseMaterialLabel("  MALZ-İ / 01\r\n", tenant)).toEqual({
    kind: "code",
    value: "MALZ-İ / 01",
  });
});
it.each([
  "",
  "x".repeat(161),
  "OLAPH:2:a:b",
  "OLAPH:1:a:b",
  "MAT\u0000CODE",
  `OLAPH:1:${tenant}:${material}:extra`,
])("rejects malformed or unbounded scan input %s", (value) => {
  expect(() => parseMaterialLabel(value, tenant)).toThrow(
    "INVALID_MATERIAL_LABEL",
  );
});
it("treats URLs as literal codes and never a navigation instruction", () => {
  expect(parseMaterialLabel("https://example.test/other", tenant)).toEqual({
    kind: "code",
    value: "https://example.test/other",
  });
});
it("offers Code 128 only for bounded printable ASCII codes", () => {
  expect(supportsCode128("MAT-001 / 2")).toBe(true);
  for (const value of [
    "MALZ-İ",
    "MAT\n001",
    "x".repeat(65),
    "OLAPH:1:reserved",
    "",
  ])
    expect(supportsCode128(value)).toBe(false);
});
