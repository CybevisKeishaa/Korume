import { z } from "zod";
import { prepareDocument, type PreparedItem, type PreparedPage } from "../prepare";
import { worksheetSettingsSchema, type WorksheetSettings } from "../settings";
import type { PrintDocument, PrintResources } from "../source";

export const pdfRequestSchema = z.object({
  lessonId: z.string().uuid(),
  set: z.enum(["all", "saved"]),
  locale: z.enum(["vi", "en"]),
  settings: worksheetSettingsSchema,
  pages: z.array(z.object({ kind: z.enum(["items", "answers"]), ids: z.array(z.string().min(1).max(200)).min(1).max(200) }).strict()).min(1).max(60),
}).strict();
export type PdfRequest = z.infer<typeof pdfRequestSchema>;

/** Everything the cookie-less render page needs; built only from the re-resolved document (spec W §6.3 step 3). */
export interface RenderPayload {
  locale: "vi" | "en";
  title: string;
  settings: WorksheetSettings;
  pages: PreparedPage[];
  resources: PrintResources;
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((value, index) => value === b[index]);

/** Spec W §6.3 step 2: the client's page breaks are kept; every id is checked against `prepareDocument` on the server. */
export function assignPages(doc: PrintDocument, request: PdfRequest):
  { ok: true; pages: PreparedPage[]; items: PreparedItem[] } | { ok: false; reason: string } {
  const firstAnswers = request.pages.findIndex((page) => page.kind === "answers");
  if (firstAnswers === 0) return { ok: false, reason: "answers before items" };
  if (firstAnswers > 0 && request.pages.slice(firstAnswers).some((page) => page.kind !== "answers")) return { ok: false, reason: "items after answers" };
  const itemPages = request.pages.filter((page) => page.kind === "items");
  const answerPages = request.pages.filter((page) => page.kind === "answers");
  const itemIds = itemPages.flatMap((page) => page.ids);
  const prepared = prepareDocument(doc.items, new Set(itemIds), request.settings);
  if (!same(prepared.items.map((item) => item.id), itemIds)) return { ok: false, reason: "item ids do not match the document" };
  if (request.settings.mode === "practice" && answerPages.length > 0) return { ok: false, reason: "answers in practice" };
  if (request.settings.mode === "selfTest" && !same(answerPages.flatMap((page) => page.ids), itemIds)) return { ok: false, reason: "answers do not match items" };
  const itemById = new Map(prepared.items.map((item) => [item.id, item]));
  const answerById = new Map(prepared.answers.map((answer) => [answer.id, answer]));
  const pages = request.pages.map((page): PreparedPage => (page.kind === "items"
    ? { kind: "items", items: page.ids.map((id) => itemById.get(id)!) }
    : { kind: "answers", answers: page.ids.map((id) => answerById.get(id)!) }));
  return { ok: true, pages, items: prepared.items };
}
