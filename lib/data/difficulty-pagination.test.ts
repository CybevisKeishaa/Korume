import { describe, expect, it } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { getKnownVocabAmong, getKnownVocabLemmas } from "./difficulty";

describe("getKnownVocabLemmas", () => {
  it("pages 1,001 mastered rows and chunks vocab lookups", async () => {
    const progressCalls: QueryCall[][] = [];
    const vocabCalls: QueryCall[][] = [];
    const ids = Array.from({ length: 1_001 }, (_, index) => `vocab-${index}`);
    const supabase = createMockSupabase({
      enforcePostgrestCap: true,
      tables: {
        user_vocab_progress: (calls) => {
          progressCalls.push([...calls]);
          return { data: ids.map((vocab_id) => ({ vocab_id })), error: null };
        },
        vocab: (calls) => {
          vocabCalls.push([...calls]);
          const idCall = calls.find((call): call is Extract<QueryCall, { op: "in" }> => call.op === "in" && call.column === "id");
          return { data: (idCall?.values as string[]).map((id) => ({ word: id, reading: null })), error: null };
        },
      },
    });

    const known = await getKnownVocabLemmas(supabase as never, "learner-1");

    expect(known.size).toBe(1_001);
    expect(progressCalls).toEqual([
      expect.arrayContaining([{ op: "range", from: 0, to: 999 }]),
      expect.arrayContaining([{ op: "range", from: 1_000, to: 1_999 }]),
    ]);
    expect(vocabCalls.map((calls) => (calls.find((call): call is Extract<QueryCall, { op: "in" }> => call.op === "in" && call.column === "id")?.values.length))).toEqual([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 1]);
  });
});

describe("getKnownVocabAmong", () => {
  it("asks about the keys only: vocab by word or reading, then mastered progress on just those rows", async () => {
    const vocabCalls: QueryCall[][] = [];
    const progressCalls: QueryCall[][] = [];
    const rows = [
      { id: "v1", word: "勉強", reading: "べんきょう" }, // matched by word
      { id: "v2", word: "日本語", reading: "にほんご" }, // matched by reading, not mastered
      { id: "v3", word: "あめ", reading: null },        // a kana word matched by a candidate's reading
    ];
    const supabase = createMockSupabase({
      tables: {
        vocab: (calls) => {
          vocabCalls.push([...calls]);
          const inCall = calls.find((call): call is Extract<QueryCall, { op: "in" }> => call.op === "in");
          const wanted = new Set(inCall?.values as string[]);
          const column = inCall?.column as "word" | "reading";
          return { data: rows.filter((row) => row[column] !== null && wanted.has(row[column] as string)), error: null };
        },
        user_vocab_progress: (calls) => {
          progressCalls.push([...calls]);
          return { data: [{ vocab_id: "v1" }, { vocab_id: "v3" }], error: null };
        },
      },
    });

    const known = await getKnownVocabAmong(supabase as never, "learner-1", ["勉強", "にほんご", "あめ", "勉強"]);

    expect([...known].sort()).toEqual(["あめ", "べんきょう", "勉強"].sort());
    expect(vocabCalls.map((calls) => calls.find((call) => call.op === "in"))).toEqual([
      { op: "in", column: "word", values: ["勉強", "にほんご", "あめ"] },
      { op: "in", column: "reading", values: ["勉強", "にほんご", "あめ"] },
    ]);
    expect(progressCalls).toHaveLength(1);
    expect(progressCalls[0]).toEqual(expect.arrayContaining([
      { op: "eq", column: "user_id", value: "learner-1" },
      { op: "gte", column: "srs_stage", value: 2 },
      { op: "in", column: "vocab_id", values: ["v1", "v3", "v2"] },
    ]));
  });

  it("reads nothing without keys", async () => {
    const supabase = createMockSupabase({ tables: {} });
    expect(await getKnownVocabAmong(supabase as never, "learner-1", [])).toEqual(new Set());
  });
});
