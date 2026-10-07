import type { WorksheetSettings } from "./settings";

const UNSAFE = /[/\\:*?"<>|\u0000-\u001f\u007f]/g;
const ASCII_FALLBACK = { practice: "Korume-Writing-Practice.pdf", selfTest: "Korume-Self-Test.pdf" } as const;

/** Spec W §6.3 step 7: `Korume - <document name> - <lesson title>.pdf`, unsafe characters replaced by a space. */
export function pdfFilename(documentName: string, title: string): string {
  const clean = title.replace(UNSAFE, " ").replace(/\s+/g, " ").trim();
  return clean ? `Korume - ${documentName} - ${clean}.pdf` : `Korume - ${documentName}.pdf`;
}

/** RFC 6266 + 5987: an ASCII `filename` for old clients, the real name in `filename*`. */
export function contentDisposition(filename: string, mode: WorksheetSettings["mode"]): string {
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ASCII_FALLBACK[mode]}"; filename*=UTF-8''${encoded}`;
}
