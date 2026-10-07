import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSHEET_SETTINGS } from "../settings";
import type { PrintDocument } from "../source";
import { assignPages, pdfRequestSchema, type PdfRequest } from "./request";

const doc: PrintDocument = { title: "T", backHref: "/b", backLabel: "b", items: [
  { id: "a", surface: "苦手", entSeq: 1, reading: "にがて", meaning: "kém", meaningLocale: "vi", resolution: "resolved" },
  { id: "b", surface: "人", entSeq: 2, reading: "ひと", meaning: "người", meaningLocale: "vi", resolution: "resolved" },
  { id: "k", surface: "する", entSeq: 3, reading: "する", resolution: "resolved" },
] };
const base: PdfRequest = { lessonId: "00000000-0000-4000-8000-000000000000", set: "all", locale: "vi", settings: DEFAULT_WORKSHEET_SETTINGS,
  pages: [{ kind: "items", ids: ["a"] }, { kind: "items", ids: ["b"] }] };
const selfTest = { ...DEFAULT_WORKSHEET_SETTINGS, mode: "selfTest" as const };

describe("assignPages — the client is untrusted (spec W §6.3 step 2)", () => {
  it("rebuilds the pages from the re-resolved document, keeping the client's page breaks", () => {
    const result = assignPages(doc, base);
    expect(result.ok && result.pages.map((page) => page.kind === "items" && page.items.map((item) => item.target))).toEqual([["苦手"], ["人"]]);
  });
  it.each([
    ["an unknown id", [{ kind: "items", ids: ["a", "zzz"] }]],
    ["a duplicate id", [{ kind: "items", ids: ["a"] }, { kind: "items", ids: ["a", "b"] }]],
    ["an order the document does not have", [{ kind: "items", ids: ["b", "a"] }]],
    ["a word without kanji while the toggle is off", [{ kind: "items", ids: ["a", "k"] }]],
    ["answer pages in practice", [{ kind: "items", ids: ["a"] }, { kind: "answers", ids: ["a"] }]],
    ["an answers page first", [{ kind: "answers", ids: ["a"] }, { kind: "items", ids: ["a"] }]],
  ] as const)("rejects %s", (_, pages) => {
    expect(assignPages(doc, { ...base, pages: pages as unknown as PdfRequest["pages"] }).ok).toBe(false);
  });
  it("self-test: answers must list exactly the item ids in order, and items carry no target", () => {
    const good = assignPages(doc, { ...base, settings: selfTest, pages: [{ kind: "items", ids: ["a", "b"] }, { kind: "answers", ids: ["a", "b"] }] });
    expect(good.ok).toBe(true);
    expect(good.ok && good.items.every((item) => item.target === undefined)).toBe(true);
    expect(assignPages(doc, { ...base, settings: selfTest, pages: [{ kind: "items", ids: ["a", "b"] }, { kind: "answers", ids: ["a"] }] }).ok).toBe(false);
    expect(assignPages(doc, { ...base, settings: selfTest, pages: [{ kind: "items", ids: ["a", "b"] }] }).ok).toBe(false);
  });
});

describe("pdfRequestSchema (spec W §6.3 step 1)", () => {
  it("caps pages and ids and rejects unknown settings keys", () => {
    expect(pdfRequestSchema.safeParse(base).success).toBe(true);
    expect(pdfRequestSchema.safeParse({ ...base, pages: Array.from({ length: 61 }, () => ({ kind: "items", ids: ["a"] })) }).success).toBe(false);
    expect(pdfRequestSchema.safeParse({ ...base, settings: { ...base.settings, hide: "meaning" } }).success).toBe(false);
    expect(pdfRequestSchema.safeParse({ ...base, lessonId: "not-a-uuid" }).success).toBe(false);
    expect(pdfRequestSchema.safeParse({ ...base, pages: [{ kind: "items", ids: [] }] }).success).toBe(false);
  });
});
