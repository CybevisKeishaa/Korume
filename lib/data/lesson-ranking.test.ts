import { describe, expect, it, vi } from "vitest";
import { createMockSupabase, type TableResolver } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

/**
 * The ranking itself — distinct learners per lesson, lesson id ascending on a
 * tie, over every library row — is SQL (`popular_lesson_ids`), proved live by
 * `supabase/tests/pronunciation-studio.sql`. These tests cover what the
 * TypeScript side owns: which client asks, the limit it passes, keeping the
 * SQL order through the `videos` read, and letting `videos` RLS drop a lesson.
 */
function useRanking(ranked: string[], videos: TableResolver, onRank?: (args: Record<string, unknown>) => void) {
  const service = createMockSupabase({
    tables: {},
    rpcs: {
      popular_lesson_ids: (args) => {
        onRank?.(args);
        return { data: ranked.map((lesson_id) => ({ lesson_id })), error: null };
      },
    },
  });
  // No `user_lesson_library` resolver on either client: reading the ledger
  // as a table (and not through the SQL ranking) throws.
  const client = createMockSupabase({ user: { id: "u1" }, tables: { videos } });
  vi.mocked(createServiceClient).mockReturnValue(service as unknown as ReturnType<typeof createServiceClient>);
  vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
}

/** `videos` answers in reverse, so only the strategy can restore the ranking's order. */
const reversedVideos: TableResolver = (calls) => {
  const ids = ((calls.find((call) => call.op === "in") as { values: string[] } | undefined)?.values ?? []);
  return { data: [...ids].reverse().map((id) => ({ id })), error: null };
};

describe("PopularStrategyV1", () => {
  it("asks the SQL ranking through the service client for exactly the limit", async () => {
    const calls: Record<string, unknown>[] = [];
    useRanking(["a"], reversedVideos, (args) => calls.push(args));
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");

    await PopularStrategyV1.rank({ userId: "u1", limit: 4 });

    expect(calls).toEqual([{ p_limit: 4 }]);
  });

  it("keeps the SQL ranking's order through the videos read", async () => {
    useRanking(["b", "a", "c"], reversedVideos);
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");

    expect((await PopularStrategyV1.rank({ userId: "u1", limit: 3 })).map((v) => v.id)).toEqual(["b", "a", "c"]);
  });

  it("drops a ranked lesson RLS hid rather than returning a hole", async () => {
    // A PLUS lesson a Free viewer cannot read is filtered by the database, so
    // the returned array is legitimately shorter than the ranking.
    useRanking(["a", "secret"], () => ({ data: [{ id: "a" }], error: null }));
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");

    expect((await PopularStrategyV1.rank({ userId: "u1", limit: 10 })).map((v) => v.id)).toEqual(["a"]);
  });

  it("returns an empty array without reading videos when no lesson is in any library", async () => {
    let videosRead = false;
    useRanking([], () => { videosRead = true; return { data: [], error: null }; });
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");

    expect(await PopularStrategyV1.rank({ userId: "u1", limit: 10 })).toEqual([]);
    expect(videosRead).toBe(false);
  });

  it("identifies itself so a later strategy swap is visible", async () => {
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");
    expect(PopularStrategyV1.id).toBe("popular-v1");
  });
});
