export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (quoted) {
        quoted = false;
      } else if (field === "") {
        quoted = true;
      } else throw new Error("INVALID_CSV");
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("UNCLOSED_QUOTE");
  row.push(field);
  if (row.some(Boolean)) rows.push(row);
  if (rows.length > 5001) throw new Error("TOO_MANY_ROWS");
  return rows;
}
export function toCsv(rows: string[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((cell) => {
            const safe = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
            return `"${safe.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\r\n")
  );
}
