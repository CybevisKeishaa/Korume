import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertPlainSerializableDto } from "@/test/dto";
import type { AnalysisToken, StaticLineAnalysis } from "@/lib/analysis/types";
import { loadLessonSummary } from "@/lib/summary/load-snapshot";
import { analysisStatusForReflection, requestLessonAnalysis } from "@/lib/summary/analysis/service";
import { getGloss, requestGloss } from "@/lib/dictionary/lookup";
import { resolveLessonSource } from "./lesson-source";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/summary/load-snapshot", () => ({ loadLessonSummary: vi.fn() }));
vi.mock("@/lib/summary/analysis/service", () => ({ analysisStatusForReflection: vi.fn(), requestLessonAnalysis: vi.fn() }));
vi.mock("@/lib/dictionary/lookup", () => ({ getGloss: vi.fn(), requestGloss: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({ getTranslations: vi.fn(async () => (key: string) => key) }));

const LESSON = "ba522023-8eba-4929-924f-35ae69eacf99";
const db = {} as never;
const tok = (surface: string, entSeq: number, reading: string, curatedVi: string | null = null): AnalysisToken => ({
  index: 0, surface, base: surface, reading: null, pos: "名詞", posDetail1: "一般", span: { start: 0, end: surface.length },
  entries: [{ entSeq, headword: surface, reading, glossEn: `${surface}-en`, jlpt: null }], vocabId: null, curatedVi,
});
const LINES = [
  { id: "l-1", index: 0, textJp: "苦手な人です", translation: null, startTime: 0, endTime: 1 },
  { id: "l-2", index: 1, textJp: "人が好き", translation: null, startTime: 1, endTime: 2 },
];
const ANALYSES = new Map<string, StaticLineAnalysis>([
  ["l-1", { lineId: "l-1", snapshotId: "s", grammar: [], tokens: [tok("苦手", 10, "にがて", "kém"), tok("人", 20, "ひと")] }],
  ["l-2", { lineId: "l-2", snapshotId: "s", grammar: [], tokens: [tok("人", 20, "ひと"), tok("好き", 30, "すき")] }],
]);

function loaded(saved: { cardId: string; kind: "vocabulary" | "expression"; ref: string; lineId: string }[] = []) {
  vi.mocked(loadLessonSummary).mockResolvedValue({ ok: true, data: {
    userId: "u-1", video: { id: LESSON, youtubeVideoId: "y", title: "苦手な人", thumbnailUrl: null, jlptLevel: null, durationSeconds: null },
    lines: LINES, analyses: ANALYSES, hasTranscript: true, completed: false, snapshot: {} as never, saved,
  } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(analysisStatusForReflection).mockResolvedValue({ kind: "absent" });
  loaded();
});

const run = (set: "all" | "saved", locale: "vi" | "en" = "vi") =>
  resolveLessonSource({ source: { kind: "lesson", lessonId: LESSON, set }, locale, userId: "u-1", db });

describe("resolveLessonSource — all (spec §2.3)", () => {
  it("is the Words list: frequent lesson words with their first line as the example and a locale-aware meaning", async () => {
    const result = await run("all");
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.doc.title).toBe("苦手な人");
    expect(result.doc.backHref).toBe(`/shadowing/${LESSON}/summary`);
    expect(result.doc.items.map((item) => item.surface)).toEqual(["人", "苦手", "好き"]);
    expect(result.doc.items[1]).toEqual({
      id: "lesson-10", surface: "苦手", reading: "にがて", meaning: "kém", meaningLocale: "vi", meaningSource: "curated",
      resolution: "resolved", example: { text: "苦手な人です" },
    });
    expect(result.doc.items[0]).toMatchObject({ meaning: "人-en", meaningLocale: "en", meaningSource: "jmdict" });
  });

  it("reads a ready analysis read-only and never generates (P8), and never reads the AI gloss cache (P6)", async () => {
    await run("all");
    expect(analysisStatusForReflection).toHaveBeenCalledWith(LESSON, "vi", expect.objectContaining({ lines: LINES, analyses: ANALYSES }));
    expect(requestLessonAnalysis).not.toHaveBeenCalled();
    expect(getGloss).not.toHaveBeenCalled();
    expect(requestGloss).not.toHaveBeenCalled();
  });

  it("puts the AI words first when the analysis is ready", async () => {
    vi.mocked(analysisStatusForReflection).mockResolvedValue({ kind: "ready", fingerprint: "f", view: { overview: "", expressions: [], grammar: [], culture: [], words: [{
      entSeq: 30, surface: "好き", written: "好き", reading: "すき", meaning: "liked", meaningLocale: "en", meaningSource: "jmdict",
      posKey: "noun", jlpt: null, common: true, whyItMatters: "", usageNote: "", source: { lineId: "l-2", textJp: "人が好き", startTime: 1, endTime: 2 },
    }] } });
    const result = await run("all");
    expect(result.kind === "ok" && result.doc.items.map((item) => item.surface)).toEqual(["好き", "人", "苦手"]);
  });

  it("returns a plain, JSON-safe document", async () => {
    const result = await run("all");
    assertPlainSerializableDto(result);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("maps an unreadable lesson to unauthorized and a missing one to not_found", async () => {
    vi.mocked(loadLessonSummary).mockResolvedValueOnce({ ok: false, status: 401 });
    expect((await run("all")).kind).toBe("unauthorized");
    vi.mocked(loadLessonSummary).mockResolvedValueOnce({ ok: false, status: 404 });
    expect((await run("all")).kind).toBe("not_found");
  });
});

describe("resolveLessonSource — saved (spec §2.4)", () => {
  it("prints vocabulary cards only, deduped by entSeq + reading with the earliest line as the example", async () => {
    loaded([
      { cardId: "c-2", kind: "vocabulary", ref: "人", lineId: "l-2" },
      { cardId: "c-1", kind: "vocabulary", ref: "人", lineId: "l-1" },
      { cardId: "c-3", kind: "expression", ref: "苦手な人", lineId: "l-1" },
    ]);
    const result = await run("saved");
    expect(result.kind === "ok" && result.doc.items).toEqual([{
      id: "lex-20:ひと", surface: "人", reading: "ひと", meaning: "人-en", meaningLocale: "en", meaningSource: "jmdict",
      resolution: "resolved", example: { text: "苦手な人です" },
    }]);
  });

  it("keeps a card that no longer resolves as saved_raw, without reading or meaning, and without a deleted line", async () => {
    loaded([
      { cardId: "c-9", kind: "vocabulary", ref: "消えた", lineId: "l-1" },
      { cardId: "c-8", kind: "vocabulary", ref: "幽霊", lineId: "l-gone" },
    ]);
    const result = await run("saved");
    expect(result.kind === "ok" && result.doc.items).toEqual([
      { id: "raw-消えた", surface: "消えた", resolution: "saved_raw", example: { text: "苦手な人です" } },
      { id: "raw-幽霊", surface: "幽霊", resolution: "saved_raw" },
    ]);
  });

  it("returns an empty document when nothing is saved", async () => {
    const result = await run("saved");
    expect(result.kind === "ok" && result.doc.items).toEqual([]);
  });
});
