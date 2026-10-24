/** Makes one value safe for a CSV file, including protection against spreadsheet formula tricks. */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
  if (/[",\n\r]/.test(text)) text = '"' + text.replace(/"/g, '""') + '"';
  return text;
}

export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
