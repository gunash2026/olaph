import ExcelJS from "exceljs";
import { connect } from "node:net";
import { createHash } from "node:crypto";
import { z } from "zod";
import { config } from "./config.js";
import { positive } from "./resources.js";
export type ImportSheet = { name: string; rows: string[][] };
export async function scanFile(buffer: Buffer) {
  if (!config.CLAMAV_HOST) throw Error("VIRUS_SCANNER_UNAVAILABLE");
  await new Promise<void>((resolve, reject) => {
    const socket = connect(config.CLAMAV_PORT, config.CLAMAV_HOST!);
    let result = "";
    socket.setTimeout(30000, () => socket.destroy(Error("SCAN_TIMEOUT")));
    socket.on("error", reject);
    socket.on("data", (data) => {
      result += data.toString();
      if (result.length > 4096) socket.destroy(Error("INVALID_SCAN_RESPONSE"));
    });
    socket.on("end", () =>
      result.includes("stream: OK")
        ? resolve()
        : reject(Error("FILE_REJECTED_BY_SCANNER")),
    );
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let start = 0; start < buffer.length; start += 65536) {
        const chunk = buffer.subarray(start, start + 65536),
          length = Buffer.alloc(4);
        length.writeUInt32BE(chunk.length);
        socket.write(length);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
  });
}
export async function readWorkbook(buffer: Buffer): Promise<ImportSheet[]> {
  if (
    buffer.length < 4 ||
    buffer.length > 8 * 1024 * 1024 ||
    buffer.readUInt32LE(0) !== 0x04034b50
  )
    throw Error("XLSX_REQUIRED_MAX_8_MB");
  let uncompressed = 0,
    entries = 0;
  for (let offset = 0; offset + 46 <= buffer.length; offset++)
    if (buffer.readUInt32LE(offset) === 0x02014b50) {
      const size = buffer.readUInt32LE(offset + 24),
        names = buffer.readUInt16LE(offset + 28),
        extra = buffer.readUInt16LE(offset + 30),
        comment = buffer.readUInt16LE(offset + 32);
      uncompressed += size;
      entries++;
      const name = buffer.subarray(offset + 46, offset + 46 + names).toString();
      if (
        size === 0xffffffff ||
        uncompressed > 32 * 1024 * 1024 ||
        entries > 300 ||
        /vbaProject|externalLinks|embeddings/i.test(name)
      )
        throw Error("UNSAFE_WORKBOOK");
      offset += 45 + names + extra + comment;
    }
  if (!entries) throw Error("INVALID_WORKBOOK");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  if (workbook.worksheets.length > 20) throw Error("TOO_MANY_SHEETS");
  let total = 0;
  return workbook.worksheets.map((sheet) => {
    if (sheet.rowCount > 5001 || sheet.columnCount > 60)
      throw Error("WORKBOOK_ROW_OR_COLUMN_LIMIT");
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      if (++total > 10000) throw Error("TOO_MANY_ROWS");
      const values: string[] = [];
      for (let col = 1; col <= sheet.columnCount; col++) {
        const cell = row.getCell(col);
        if (cell.type === ExcelJS.ValueType.Formula)
          throw Error("FORMULAS_REQUIRE_VALUES_ONLY_EXPORT");
        values.push(cell.text.slice(0, 2000));
      }
      rows.push(values);
    });
    return { name: sheet.name, rows };
  });
}
export const mappingSchema = z.object({
  sheet: z.number().int().min(0).max(19),
  headerRow: z.number().int().min(0).max(4999),
  codeColumn: z.number().int().min(0).max(59),
  quantityColumn: z.number().int().min(0).max(59),
  mode: z.enum(["order_lines", "requirements"]),
  orderId: z.string().uuid(),
});
export type ImportMapping = z.infer<typeof mappingSchema>;
export function mappedRows(sheets: ImportSheet[], mapping: ImportMapping) {
  const sheet = sheets[mapping.sheet];
  if (!sheet) throw Error("SHEET_NOT_FOUND");
  return sheet.rows
    .slice(mapping.headerRow + 1)
    .map((row, index) => {
      const code = (row[mapping.codeColumn] || "").trim(),
        raw = (row[mapping.quantityColumn] || "").trim();
      if (!code && !raw) return null;
      const normalized = /^\d+,\d{1,6}$/.test(raw)
          ? raw.replace(",", ".")
          : raw,
        checked = positive.safeParse(normalized);
      return {
        row: index + mapping.headerRow + 2,
        code,
        quantity: normalized,
        error: !code
          ? "CODE_REQUIRED"
          : !checked.success
            ? "INVALID_QUANTITY"
            : null,
      };
    })
    .filter((x) => x !== null);
}
export const digest = (buffer: Buffer | string) =>
  createHash("sha256").update(buffer).digest("hex");
export async function workbookExport(
  rows: Record<string, unknown>[],
  name: string,
) {
  const workbook = new ExcelJS.Workbook(),
    sheet = workbook.addWorksheet(name.slice(0, 31)),
    keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  sheet.columns = keys.map((key) => ({ header: key, key, width: 24 }));
  for (const row of rows)
    sheet.addRow(
      Object.fromEntries(
        keys.map((key) => {
          const value = row[key];
          return [
            key,
            value === null
              ? ""
              : typeof value === "object"
                ? JSON.stringify(value)
                : String(value ?? ""),
          ];
        }),
      ),
    );
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return workbook.xlsx.writeBuffer();
}
