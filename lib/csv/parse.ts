/**
 * Small, dependency-free CSV parser for admin bulk content import
 * (`lib/data/admin-content.ts`). Handles the RFC-4180 basics this repo
 * actually needs: quoted fields, an escaped quote as a doubled `""`, a
 * comma/newline embedded inside a quoted field, and CRLF vs LF line endings.
 * No new npm dependency — flagged per task instructions rather than adding
 * one for what a ~100-line state machine covers.
 */

export interface CsvRecord {
  /** 1-based row number, counting data rows only (the header row is not counted). */
  rowNumber: number;
  /** Header name -> cell value for this row. Missing trailing cells are `""`. */
  fields: Record<string, string>;
}

export interface CsvParseResult {
  headers: string[];
  records: CsvRecord[];
}

/** Tokenize raw CSV text into rows of raw string cells (no header mapping yet). */
function tokenizeRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawAnyContentInRow = false;
  let i = 0;
  const len = input.length;

  function endField(): void {
    row.push(field);
    field = "";
  }

  function endRow(): void {
    endField();
    rows.push(row);
    row = [];
    sawAnyContentInRow = false;
  }

  while (i < len) {
    const ch = input[i] as string;

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      sawAnyContentInRow = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      endField();
      sawAnyContentInRow = true;
      i += 1;
      continue;
    }
    if (ch === "\r") {
      if (input[i + 1] === "\n") i += 1;
      endRow();
      i += 1;
      continue;
    }
    if (ch === "\n") {
      endRow();
      i += 1;
      continue;
    }

    field += ch;
    sawAnyContentInRow = true;
    i += 1;
  }

  // Flush a final field/row with no trailing newline. Guard against pushing a
  // phantom empty row when the input ended right on a newline (already
  // flushed by endRow above) or was entirely empty.
  if (field.length > 0 || sawAnyContentInRow || row.length > 0) {
    endRow();
  }

  return rows;
}

/**
 * Parse CSV text into a header list plus one record per data row, each cell
 * looked up by header name. A row with fewer cells than headers gets `""`
 * for the missing trailing columns; extra cells beyond the header count are
 * dropped (documented limitation — admin CSV templates are expected to match
 * the header exactly).
 */
export function parseCsv(input: string): CsvParseResult {
  const rows = tokenizeRows(input);
  if (rows.length === 0) {
    return { headers: [], records: [] };
  }

  const headers = (rows[0] ?? []).map((h) => h.trim());
  const records: CsvRecord[] = [];

  for (let idx = 1; idx < rows.length; idx += 1) {
    const row = rows[idx] ?? [];
    const fields: Record<string, string> = {};
    headers.forEach((header, colIndex) => {
      fields[header] = row[colIndex] ?? "";
    });
    records.push({ rowNumber: idx, fields });
  }

  return { headers, records };
}
