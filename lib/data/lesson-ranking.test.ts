import { describe, expect, it, vi } from "vitest";
import { createMockSupabase, type TableResolver } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function useTables(tables: Record<string, TableResolver>) {
  const supabase = createMockSupabase({ user: { id: "u1" }, tables });
  vi.mocked(createClient).mockReturnValue(
    supabase as unknown as ReturnType<typeof createClient>,
  );
}

/** `videos` echoes back whatever ids the strategy asked for, in that order. */
const echoVideos: TableResolver = (calls) => {
  const inCall = calls.find(
    (c): c is Extract<typeof c, { op: "in" }> => c.op === "in",
  );
  const ids = (inCall?.values ?? []) as string[];
  return { data: ids.map((id) => ({ id })), error: null };
};

describe("PopularStrategyV1", () => {
  it("ranks by the number of distinct learner libraries containing the lesson", async () => {
    // Spec §4.2.1. This is Popular v1: a recorded PRODUCT decision, not a
    // placeholder. It is the only real signal the system has — there is no view
    // count, no completion rate, no rating.
    useTables({
      user_lesson_library: () => ({
        data: [
          { lesson_id: "b", user_id: "u1" },
          { lesson_id: "a", user_id: "u1" },
          { lesson_id: "a", user_id: "u2" },
          { lesson_id: "a", user_id: "u3" },
          { lesson_id: "b", user_id: "u2" },
          { lesson_id: "c", user_id: "u1" },
        ],
        error: null,
      }),
      videos: echoVideos,
    });
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");
    const result = await PopularStrategyV1.rank({ userId: "u1", limit: 10 });
    expect(result.map((v) => v.id)).toEqual(["a", "b", "c"]);
  });

  it("counts each learner once even if the ledger has duplicate rows", async () => {
    useTables({
      user_lesson_library: () => ({
        data: [
          { lesson_id: "a", user_id: "u1" },
          { lesson_id: "a", user_id: "u1" },
          { lesson_id: "b", user_id: "u1" },
          { lesson_id: "b", user_id: "u2" },
        ],
        error: null,
      }),
      videos: echoVideos,
    });
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");
    const result = await PopularStrategyV1.rank({ userId: "u1", limit: 10 });
    expect(result.map((v) => v.id)).toEqual(["b", "a"]);
  });

  it("respects the limit", async () => {
    useTables({
      user_lesson_library: () => ({
        data: [
          { lesson_id: "a", user_id: "u1" },
          { lesson_id: "b", user_id: "u1" },
          { lesson_id: "c", user_id: "u1" },
        ],
        error: null,
      }),
      videos: echoVideos,
    });
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");
    expect(await PopularStrategyV1.rank({ userId: "u1", limit: 2 })).toHaveLength(2);
  });

  it("drops a ranked lesson RLS hid rather than returning a hole", async () => {
    // A PLUS lesson a Free viewer cannot read is filtered by the database, so
    // the returned array is legitimately shorter than the ranking.
    useTables({
      user_lesson_library: () => ({
        data: [
          { lesson_id: "a", user_id: "u1" },
          { lesson_id: "secret", user_id: "u2" },
        ],
        error: null,
      }),
      videos: () => ({ data: [{ id: "a" }], error: null }),
    });
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");
    expect((await PopularStrategyV1.rank({ userId: "u1", limit: 10 })).map((v) => v.id)).toEqual(["a"]);
  });

  it("returns an empty array when no lesson is in any library", async () => {
    useTables({
      // No `videos` resolver: the mock throws for an unresolved table, so this
      // also proves the second query is skipped.
      user_lesson_library: () => ({ data: [], error: null }),
    });
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");
    expect(await PopularStrategyV1.rank({ userId: "u1", limit: 10 })).toEqual([]);
  });

  it("identifies itself so a later strategy swap is visible", async () => {
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");
    expect(PopularStrategyV1.id).toBe("popular-v1");
  });
});
