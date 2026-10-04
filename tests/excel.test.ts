import { beforeAll, it, expect } from "vitest";
let excel: typeof import("../apps/api/src/excel");
beforeAll(async () => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://test@localhost/test",
    AUTH_DATABASE_URL: "postgresql://test@localhost/test",
    BETTER_AUTH_SECRET: "test-only-32-character-secret-value",
    APP_URL: "http://localhost:8080",
    SMTP_HOST: "localhost",
  });
  excel = await import("../apps/api/src/excel");
});
it("round trips Turkish text and formula-like input as literal Excel cells", async () => {
  const bytes = await excel.workbookExport(
    [
      {
        code: "İĞÜŞÖÇ",
        quantity: "0.100000",
        name: '=HYPERLINK("https://invalid.test")',
      },
    ],
    "Import",
  );
  const sheets = await excel.readWorkbook(Buffer.from(bytes));
  expect(sheets[0].rows[1]).toEqual([
    "İĞÜŞÖÇ",
    "0.100000",
    '=HYPERLINK("https://invalid.test")',
  ]);
});
it("maps selected columns without guessing ambiguous numbers", () => {
  const sheets = [
    {
      name: "Sipariş",
      rows: [
        ["Miktar", "Kod"],
        ["1,25", "A"],
        ["1.234,56", "B"],
        ["", ""],
      ],
    },
  ];
  const mapped = excel.mappedRows(sheets, {
    sheet: 0,
    headerRow: 0,
    codeColumn: 1,
    quantityColumn: 0,
    mode: "order_lines",
    orderId: "10000000-0000-4000-8000-000000000001",
  });
  expect(mapped).toEqual([
    { row: 2, code: "A", quantity: "1.25", error: null },
    { row: 3, code: "B", quantity: "1.234,56", error: "INVALID_QUANTITY" },
  ]);
});
it("rejects a renamed non-Excel upload before parsing", async () => {
  await expect(excel.readWorkbook(Buffer.from("not an xlsx"))).rejects.toThrow(
    "XLSX_REQUIRED",
  );
});
it("fails closed when the virus scanner is unavailable", async () => {
  await expect(excel.scanFile(Buffer.from("untrusted"))).rejects.toThrow(
    "VIRUS_SCANNER_UNAVAILABLE",
  );
});
