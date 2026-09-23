/** A cell a spreadsheet would treat as a formula rather than as text. */
const FORMULA_START = /^[=+\-@]/;

/**
 * One CSV field, RFC 4180.
 *
 * `null` is an empty field. A string starting `=`, `+`, `-` or `@` is prefixed
 * with `'` and quoted, because Excel and Sheets execute such a cell on open —
 * a reader's own exported text is untrusted input to their spreadsheet. A
 * *number* is never prefixed: `-5` is data, and the check only ever sees
 * strings.
 */
function field(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "number") return String(value);

  const defused = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(defused) || defused !== value
    ? `"${defused.replace(/"/g, '""')}"`
    : defused;
}

/**
 * Render a header and rows as RFC 4180 CSV, lines joined with CRLF and no
 * trailing newline. Round trips through `parseCsv`.
 */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  return [header, ...rows].map((row) => row.map(field).join(",")).join("\r\n");
}
