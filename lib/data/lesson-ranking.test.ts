import { describe, expect, it, vi } from "vitest";
import { createMockSupabase, type TableResolver } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

/**
 * `user_lesson_library`'s only SELECT policy is owner-only (`user_id =
 * auth.uid()`), so the ledger read MUST go through the service-role client
 * — see the "reads the popularity ledger through the service-role client"
 * test below. Every other table in this file (`videos`) stays behind the
 * caller-scoped client on purpose, since RLS on `videos` is a feature the
 * "drops a ranked lesson RLS hid" test below depends on.
 */
const SERVICE_TABLES = new Set(["user_lesson_library"]);

function useTables(tables: Record<string, TableResolver>) {
  const clientTables: Record<string, TableResolver> = {};
  const serviceTables: Record<string, TableResolver> = {};
  for (const [name, resolver] of Object.entries(tables)) {
    (SERVICE_TABLES.has(name) ? serviceTables : clientTables)[name] = resolver;
  }
  const client = createMockSupabase({ user: { id: "u1" }, tables: clientTables });
  const service = createMockSupabase({ tables: serviceTables });
  vi.mocked(createClient).mockReturnValue(
    client as unknown as ReturnType<typeof createClient>,
  );
  vi.mocked(createServiceClient).mockReturnValue(
    service as unknown as ReturnType<typeof createServiceClient>,
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

  it("breaks a genuine tie deterministically, by lesson id ascending", async () => {
    // Ranking feeds a UI list. Two runs over the exact same underlying data
    // must render lessons in the exact same order, or the learner sees rows
    // reshuffle between visits for no reason they can perceive (CLAUDE.md §7:
    // this logic family — SRS/pitch/difficulty/ranking — requires
    // deterministic unit tests, not "probably stable" ones).
    //
    // "z" and "a" are constructed to tie on the ONLY scoring term this
    // strategy uses (2 distinct learners each) — so nothing but the
    // tie-break can decide their order. "z"'s rows are listed FIRST in the
    // ledger on purpose: a bare `Array.prototype.sort`, which is stable and
    // would leave equal-scoring entries in their original (insertion) order
    // if the tie-break comparator term were removed, would then emit
    // ["z", "a"] — the WRONG order — making this fixture strong enough to
    // catch a dropped tie-break, not just a coincidentally-correct one.
    useTables({
      user_lesson_library: () => ({
        data: [
          { lesson_id: "z", user_id: "u1" },
          { lesson_id: "z", user_id: "u2" },
          { lesson_id: "a", user_id: "u1" },
          { lesson_id: "a", user_id: "u2" },
        ],
        error: null,
      }),
      videos: echoVideos,
    });
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");
    const result = await PopularStrategyV1.rank({ userId: "u1", limit: 10 });
    expect(result.map((v) => v.id)).toEqual(["a", "z"]);
  });

  it("reads the popularity ledger through the service-role client, never the caller-scoped one", async () => {
    // user_lesson_library_read (20260731000018_user_lesson_library.sql) is
    // `user_id = auth.uid()` — owner-only. A caller-scoped client here would
    // see only the caller's own rows, so "popular" would silently collapse
    // into "lessons in my library" for every real user (Task 10 review,
    // Item 1). This asserts the ledger read at the FACTORY level, not just
    // that the resulting numbers look right, so a regression back to
    // `createClient()` for this call is caught even if some fixture happens
    // to produce a plausible-looking count.
    let serviceReadLedger = false;
    const service = createMockSupabase({
      tables: {
        user_lesson_library: () => {
          serviceReadLedger = true;
          return {
            data: [
              { lesson_id: "a", user_id: "u1" },
              { lesson_id: "a", user_id: "u2" },
            ],
            error: null,
          };
        },
      },
    });
    vi.mocked(createServiceClient).mockReturnValue(
      service as unknown as ReturnType<typeof createServiceClient>,
    );

    // The caller-scoped client has NO resolver for user_lesson_library at
    // all: if the implementation reads the ledger through it instead, the
    // mock throws immediately (`no resolver registered for table
    // "user_lesson_library"`) rather than silently returning RLS-filtered
    // data that could coincidentally look plausible.
    const client = createMockSupabase({ user: { id: "u1" }, tables: { videos: echoVideos } });
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);

    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");
    await PopularStrategyV1.rank({ userId: "u1", limit: 10 });

    expect(serviceReadLedger).toBe(true);
  });

  it("identifies itself so a later strategy swap is visible", async () => {
    const { PopularStrategyV1 } = await import("@/lib/data/lesson-ranking");
    expect(PopularStrategyV1.id).toBe("popular-v1");
  });
});
