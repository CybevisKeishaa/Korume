import { describe, expect, it } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { getKnownVocabLemmas } from "./difficulty";

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
