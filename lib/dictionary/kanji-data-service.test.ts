import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, hasCall, type QueryCall } from "@/test/supabase-mock";
import { assertPlainSerializableDto } from "@/test/dto";
import { createClient } from "@/lib/supabase/server";
import { getKanjiData, getKanjiInspectPayload } from "./kanji-data-service";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => ({ ok: true, retryAfter: 0 })) }));

const SNAPSHOT = "s0000000-0000-0000-0000-000000000001";
const recorded: Record<string, QueryCall[][]> = {};

function record(table: string, calls: QueryCall[]) {
  (recorded[table] ??= []).push(calls);
}

function useDictionary(options: { kanji?: boolean; curated?: boolean; strokes?: boolean } = {}) {
  const { kanji = true, curated = true, strokes = true } = options;
  vi.mocked(createClient).mockReturnValue(
    createMockSupabase({
      user: { id: "u1" },
      rpcs: {
        dict_active_snapshot_id: () => ({ data: SNAPSHOT, error: null }),
        kanji_lesson_lines: () => ({ data: [{ line_id: "l1", video_id: "v1", lesson_title: "Lesson", text_jp: "緑の森", translation: null, start_time: 1 }], error: null }),
        kanji_lesson_counts: () => ({ data: [{ video_id: "v1", lesson_title: "Lesson", occurrences: 2 }], error: null }),
      },
      tables: {
        dict_kanji: (calls) => {
          record("dict_kanji", calls);
          if (!hasCall(calls, "maybeSingle")) return { data: [{ literal: "緑", vi_readings: ["Lục"] }], error: null };
          return {
            data: kanji
              ? {
                  literal: "緑",
                  on_readings: ["リョク", "ロク"],
                  kun_readings: ["みどり"],
                  meanings_en: ["green"],
                  stroke_count: 14,
                  grade: 3,
                  freq: 1082,
                  vi_readings: ["Lục"],
                  tc_lines: ["line one"],
                  jlpt_old: 2,
                }
              : null,
            error: null,
          };
        },
        dict_kanji_strokes: (calls) => {
          record("dict_kanji_strokes", calls);
          return {
            data: strokes ? { paths: ["M1,1L2,2", "M3,3L4,4"], components: { element: "緑", position: null, children: [] } } : null,
            error: null,
          };
        },
        dict_kanji_words: (calls) => {
          record("dict_kanji_words", calls);
          return { data: [{ ent_seq: 20, rank: 1 }, { ent_seq: 10, rank: 2 }], error: null };
        },
        dict_entries: (calls) => {
          record("dict_entries", calls);
          return {
            data: [
              { ent_seq: 10, kanji_forms: ["新緑"], kana_forms: ["しんりょく"], senses: [{ gloss: ["fresh verdure"] }] },
              { ent_seq: 20, kanji_forms: ["緑", "翠"], kana_forms: ["みどり"], senses: [{ gloss: ["green", "greenery"] }] },
            ],
            error: null,
          };
        },
        kanji: (calls) => {
          record("kanji", calls);
          // getKanjiList (the level context): a list, in the page's order.
          if (!hasCall(calls, "maybeSingle")) return { data: ["月", "緑", "火"].map((character) => ({ id: character, character })), error: null };
          return {
            data: curated ? { id: "k-curated", meaning_vi: "xanh lá", mnemonic_text: "sợi chỉ xanh", jlpt_level: "N3" } : null,
            error: null,
          };
        },
        user_kanji_favorites: (calls) =>
          hasCall(calls, "maybeSingle")
            ? { data: { literal: "緑" }, error: null }
            : { data: [{ literal: "緑" }, { literal: "水" }], error: null },
        user_kanji_progress: () => ({ data: { srs_stage: 1, reviews: 2, lapses: 0, next_review_at: "2026-11-07T00:00:00.000Z" }, error: null }),
        dict_snapshots: () => ({
          data: { jmdict_import_id: "j", kanjidic_import_id: "k", kanjivg_import_id: "v" },
          error: null,
        }),
        dict_imports: () => ({
          data: [
            { id: "j", source: "jmdict", source_version: "2026-10-02", source_url: "http://j", license: "CC BY-SA 4.0" },
            { id: "k", source: "kanjidic2", source_version: "2026-225", source_url: "http://k", license: "CC BY-SA 4.0" },
            { id: "v", source: "kanjivg", source_version: "20260714", source_url: "http://v", license: "CC BY-SA 3.0" },
          ],
          error: null,
        }),
      },
    }) as unknown as ReturnType<typeof createClient>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(recorded)) delete recorded[key];
});

describe("getKanjiData", () => {
  it("reads every dictionary table only from the active snapshot", async () => {
    useDictionary();
    await getKanjiData("緑");
    for (const table of ["dict_kanji", "dict_kanji_strokes", "dict_kanji_words", "dict_entries"]) {
      expect(recorded[table]?.length, table).toBeGreaterThan(0);
      for (const calls of recorded[table] ?? []) expect(eqValue(calls, "snapshot_id"), table).toBe(SNAPSHOT);
    }
  });

  it("merges the curated Vietnamese meaning and mnemonic and returns a plain DTO", async () => {
    useDictionary();
    const data = await getKanjiData("緑");
    expect(data).toMatchObject({
      literal: "緑",
      onReadings: ["リョク", "ロク"],
      kunReadings: ["みどり"],
      meaningsEn: ["green"],
      meaningVi: "xanh lá",
      mnemonic: "sợi chỉ xanh",
      strokeCount: 14,
      grade: 3,
      frequency: 1082,
      hanViet: ["Lục"],
      tcLines: ["line one"],
      oldJlpt: 2,
      jlpt: "N3",
      strokePaths: ["M1,1L2,2", "M3,3L4,4"],
      curatedKanjiId: "k-curated",
    });
    expect(data?.attribution.map((item) => item.source)).toEqual(["jmdict", "kanjidic2", "kanjivg"]);
    assertPlainSerializableDto(data);
  });

  it("orders common words by rank and caps them", async () => {
    useDictionary();
    const data = await getKanjiData("緑", { commonWords: 2 });
    expect(data?.commonWords).toEqual([
      { entSeq: 20, headword: "緑", reading: "みどり", glossEn: "green; greenery" },
      { entSeq: 10, headword: "新緑", reading: "しんりょく", glossEn: "fresh verdure" },
    ]);
    const wordCalls = recorded.dict_kanji_words?.[0] ?? [];
    expect(wordCalls).toContainEqual({ op: "order", column: "rank", ascending: true });
    expect(wordCalls).toContainEqual({ op: "limit", count: 2 });
  });

  it("works without a curated row and without stroke geometry", async () => {
    useDictionary({ curated: false, strokes: false });
    const data = await getKanjiData("緑");
    expect(data).toMatchObject({ meaningVi: null, mnemonic: null, jlpt: null, curatedKanjiId: null, strokePaths: [] });
  });

  it("returns null for a literal the dictionary does not know", async () => {
    useDictionary({ kanji: false });
    await expect(getKanjiData("緑")).resolves.toBeNull();
  });
});

describe("getKanjiForLearner", () => {
  it("is 401 signed out, 400 for a non-kanji, 429 over the limit, 404 unknown, else the data", async () => {
    const { getKanjiForLearner } = await import("./kanji-data-service");
    const { rateLimit } = await import("@/lib/rate-limit");
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({ user: null, tables: {} }) as unknown as ReturnType<typeof createClient>,
    );
    await expect(getKanjiForLearner("緑")).resolves.toEqual({ ok: false, status: 401 });

    useDictionary();
    await expect(getKanjiForLearner("abc")).resolves.toEqual({ ok: false, status: 400 });
    vi.mocked(rateLimit).mockReturnValueOnce({ ok: false, retryAfter: 3_000 });
    await expect(getKanjiForLearner("緑")).resolves.toEqual({ ok: false, status: 429, retryAfter: 3_000 });
    expect(rateLimit).toHaveBeenLastCalledWith("dictionary-kanji:u1", { limit: 60, windowMs: 60_000 });
    const found = await getKanjiForLearner("%E7%B7%91");
    expect(found).toMatchObject({ ok: true, data: { data: { literal: "緑" }, learner: { favorite: true }, neighbors: null } });
    const withContext = await getKanjiForLearner("緑", "level:N5");
    expect(withContext).toMatchObject({ ok: true, data: { neighbors: { prev: "月", next: "火" } } });

    useDictionary({ kanji: false });
    await expect(getKanjiForLearner("緑")).resolves.toEqual({ ok: false, status: 404 });
  });
});

describe("getKanjiInspectPayload", () => {
  it("carries the learner state and survives structuredClone unchanged", async () => {
    useDictionary();
    const payload = await getKanjiInspectPayload("緑");
    expect(payload?.data.literal).toBe("緑");
    expect(payload?.learner).toEqual({ favorite: true, progress: { stage: 1, reviews: 2, lapses: 0, nextReviewAt: "2026-11-07T00:00:00.000Z" } });
    expect(payload?.examples).toEqual([{ lineId: "l1", videoId: "v1", lessonTitle: "Lesson", textJp: "緑の森", translation: null }]);
    expect(payload?.lessons).toEqual([{ videoId: "v1", title: "Lesson", count: 2 }]);
    expect(payload?.neighbors).toBeNull();
    expect(structuredClone(payload)).toEqual(payload);
    assertPlainSerializableDto(payload);
  });

  it("is null for an unknown literal", async () => {
    useDictionary({ kanji: false });
    await expect(getKanjiInspectPayload("緑")).resolves.toBeNull();
  });

  it("gives neighbors in the level list's order", async () => {
    useDictionary();
    const payload = await getKanjiInspectPayload("緑", { from: "level:N5" });
    expect(payload?.neighbors).toEqual({ prev: "月", next: "火" });
    const listCall = (recorded.kanji ?? []).find((calls) => !hasCall(calls, "maybeSingle")) ?? [];
    expect(eqValue(listCall, "jlpt_level")).toBe("N5");
    expect(structuredClone(payload)).toEqual(payload);
  });

  it("gives neighbors in the favorites order, null at the ends", async () => {
    useDictionary();
    const payload = await getKanjiInspectPayload("緑", { from: "favorites" });
    expect(payload?.neighbors).toEqual({ prev: null, next: "水" });
  });

  it.each([null, "level:N9", "x"])("has no neighbors for from=%s", async (from) => {
    useDictionary();
    const payload = await getKanjiInspectPayload("緑", { from });
    expect(payload?.neighbors).toBeNull();
  });

  it("has no neighbors when the kanji is not in the context list", async () => {
    useDictionary();
    const payload = await getKanjiInspectPayload("日", { from: "level:N5" }); // the mock list is 月 緑 火
    expect(payload?.neighbors).toBeNull();
  });
});
