import { inflateSync } from "node:zlib";

/** Every Flate stream of a PDF, inflated and concatenated (latin1). Chrome writes ToUnicode CMaps as `<gid> <UTF-16BE hex>`. */
export function pdfStreams(pdf: Buffer): string {
  const raw = pdf.toString("latin1");
  let text = "";
  for (const match of raw.matchAll(/stream\r?\n/g)) {
    const start = (match.index ?? 0) + match[0].length;
    const end = raw.indexOf("endstream", start);
    try { text += inflateSync(Buffer.from(raw.slice(start, end), "latin1")).toString("latin1"); } catch { /* not Flate */ }
  }
  return text;
}

export const pdfPageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
/** A code point as it appears in a ToUnicode CMap. */
export const cmapHex = (char: string) => `<${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}>`;
