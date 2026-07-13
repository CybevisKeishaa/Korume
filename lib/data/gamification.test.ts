import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createServiceClient } from "@/lib/supabase/service";
import { emitNotification } from "@/lib/notifications/emit";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/notifications/emit", () => ({ emitNotification: vi.fn() }));

// Imported after the mocks above are registered.
import { recordActivity } from "./gamification";

const USER_ID = "u1";
// 2026-07-13T04:00:00Z + 7h (VN offset) = 2026-07-13T11:00 VN -> vnDateString = "2026-07-13".
const NOW = new Date("2026-07-13T04:00:00.000Z");

function mockService(tables: Parameters<typeof createMockSupabase>[0]["tables"]) {
  const supabase = createMockSupabase({ tables });
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
  return supabase;
}

function hasOp(calls: QueryCall[], op: QueryCall["op"]) {
  return calls.some((c) => c.op === op);
}

/** No badges seeded / none earned yet — the common case for tests that don't care about badges. */
const NO_BADGES_TABLES = {
  user_badges: () => ({ data: [], error: null }),
  badges: () => ({ data: [], error: null }),
};

const FRESH_STATS = { xp: 0, streak_current: 0, streak_longest: 0, last_active_date: null };

beforeEach(() => {
  vi.mocked(createServiceClient).mockReset();
  vi.mocked(emitNotification).mockReset();
  vi.mocked(emitNotification).mockResolvedValue(undefined);
});

describe("recordActivity", () => {
  it("awards xp, starts the streak, and updates user_stats on a fresh outcome", async () => {
    let statsUpdate: unknown;
    mockService({
      xp_events: (calls) => (hasOp(calls, "upsert") ? { data: { id: "xpe-1" }, error: null } : { data: [], error: null }),
      user_stats: (calls) => {
        if (hasOp(calls, "upsert")) {
          statsUpdate = calls.find((c) => c.op === "upsert")?.values;
          return { data: null, error: null };
        }
        return { data: FRESH_STATS, error: null };
      },
      user_kanji_progress: () => ({ data: [], error: null }),
      user_test_attempts: () => ({ data: [], error: null }),
      ...NO_BADGES_TABLES,
    });

    const result = await recordActivity({
      userId: USER_ID,
      source: "srs_review",
      parts: { itemType: "kanji", itemId: "k1" },
      now: NOW,
    });

    expect(result).toEqual({ ok: true, xpAwarded: 5, newBadges: [], leveledUp: false });
    expect((statsUpdate as Record<string, unknown>).xp).toBe(5);
    expect((statsUpdate as Record<string, unknown>).streak_current).toBe(1);
    expect((statsUpdate as Record<string, unknown>).last_active_date).toBe("2026-07-13");
  });

  it("detects a level-up boundary and emits a level_up notification", async () => {
    mockService({
      xp_events: (calls) => (hasOp(calls, "upsert") ? { data: { id: "xpe-1" }, error: null } : { data: [], error: null }),
      user_stats: (calls) =>
        hasOp(calls, "upsert")
          ? { data: null, error: null }
          : { data: { xp: 95, streak_current: 3, streak_longest: 5, last_active_date: "2026-07-12" }, error: null },
      user_kanji_progress: () => ({ data: [], error: null }),
      user_test_attempts: () => ({ data: [], error: null }),
      ...NO_BADGES_TABLES,
    });

    // 95 + 5 (srs_review) = 100 == thresholdForLevel(2) -> level 1 -> level 2.
    const result = await recordActivity({
      userId: USER_ID,
      source: "srs_review",
      parts: { itemType: "vocab", itemId: "v1" },
      now: NOW,
    });

    expect(result.leveledUp).toBe(true);
    expect(emitNotification).toHaveBeenCalledWith(expect.anything(), {
      type: "level_up",
      userId: USER_ID,
      payload: { level: 2 },
    });
  });

  it("awards a newly-satisfied badge and emits badge_earned", async () => {
    mockService({
      xp_events: (calls) =>
        hasOp(calls, "upsert") ? { data: { id: "xpe-1" }, error: null } : { data: [{ source_type: "dictation" }], error: null },
      user_stats: (calls) =>
        hasOp(calls, "upsert") ? { data: null, error: null } : { data: FRESH_STATS, error: null },
      user_kanji_progress: () => ({ data: [], error: null }),
      user_test_attempts: () => ({ data: [], error: null }),
      user_badges: (calls) =>
        hasOp(calls, "upsert") ? { data: [{ badge_id: "badge-1" }], error: null } : { data: [], error: null },
      badges: () => ({
        data: [{ id: "badge-1", name: "first_steps", criteria: { type: "sessions", count: 1 } }],
        error: null,
      }),
    });

    const result = await recordActivity({
      userId: USER_ID,
      source: "dictation",
      parts: { lineId: "line-1" },
      now: NOW,
    });

    expect(result.newBadges).toEqual(["badge-1"]);
    expect(emitNotification).toHaveBeenCalledWith(expect.anything(), {
      type: "badge_earned",
      userId: USER_ID,
      payload: { badgeId: "badge-1", badgeName: "first_steps" },
    });
  });

  it("does not re-emit or re-award a badge already earned", async () => {
    mockService({
      xp_events: (calls) =>
        hasOp(calls, "upsert") ? { data: { id: "xpe-1" }, error: null } : { data: [{ source_type: "dictation" }], error: null },
      user_stats: (calls) =>
        hasOp(calls, "upsert") ? { data: null, error: null } : { data: FRESH_STATS, error: null },
      user_kanji_progress: () => ({ data: [], error: null }),
      user_test_attempts: () => ({ data: [], error: null }),
      user_badges: () => ({ data: [{ badge_id: "badge-1" }], error: null }), // already earned
      badges: () => ({
        data: [{ id: "badge-1", name: "first_steps", criteria: { type: "sessions", count: 1 } }],
        error: null,
      }),
    });

    const result = await recordActivity({
      userId: USER_ID,
      source: "dictation",
      parts: { lineId: "line-1" },
      now: NOW,
    });

    expect(result.newBadges).toEqual([]);
    expect(emitNotification).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "badge_earned" }),
    );
  });

  it("awards no xp on a duplicate outcome but still advances the streak", async () => {
    let statsUpdate: unknown;
    mockService({
      xp_events: (calls) => (hasOp(calls, "upsert") ? { data: null, error: null } : { data: [], error: null }),
      user_stats: (calls) => {
        if (hasOp(calls, "upsert")) {
          statsUpdate = calls.find((c) => c.op === "upsert")?.values;
          return { data: null, error: null };
        }
        // last_active_date is "yesterday" (VN) relative to NOW -> consecutive day.
        return { data: { xp: 50, streak_current: 2, streak_longest: 2, last_active_date: "2026-07-12" }, error: null };
      },
      user_kanji_progress: () => ({ data: [], error: null }),
      user_test_attempts: () => ({ data: [], error: null }),
      ...NO_BADGES_TABLES,
    });

    const result = await recordActivity({
      userId: USER_ID,
      source: "srs_review",
      parts: { itemType: "kanji", itemId: "k1" },
      now: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.xpAwarded).toBe(0);
    expect((statsUpdate as Record<string, unknown>).streak_current).toBe(3);
    expect((statsUpdate as Record<string, unknown>).xp).toBe(50);
  });

  it("skips the badge-snapshot aggregate when the outcome is a duplicate AND the streak is unchanged", async () => {
    let kanjiQueried = false;
    mockService({
      xp_events: (calls) => (hasOp(calls, "upsert") ? { data: null, error: null } : { data: [], error: null }),
      user_stats: (calls) =>
        hasOp(calls, "upsert")
          ? { data: null, error: null }
          // last_active_date already == today (VN) -> advanceStreak is a no-op.
          : { data: { xp: 50, streak_current: 2, streak_longest: 2, last_active_date: "2026-07-13" }, error: null },
      user_kanji_progress: () => {
        kanjiQueried = true;
        return { data: [], error: null };
      },
      user_test_attempts: () => ({ data: [], error: null }),
      ...NO_BADGES_TABLES,
    });

    const result = await recordActivity({
      userId: USER_ID,
      source: "srs_review",
      parts: { itemType: "kanji", itemId: "k1" },
      now: NOW,
    });

    expect(result).toEqual({ ok: true, xpAwarded: 0, newBadges: [], leveledUp: false });
    expect(kanjiQueried).toBe(false);
    expect(emitNotification).not.toHaveBeenCalled();
  });

  it("never throws and returns {ok:false} when a DB call errors", async () => {
    mockService({
      xp_events: () => ({ data: null, error: { message: "boom" } }),
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await recordActivity({
      userId: USER_ID,
      source: "srs_review",
      parts: { itemType: "kanji", itemId: "k1" },
      now: NOW,
    });

    expect(result).toEqual({ ok: false, xpAwarded: 0, newBadges: [], leveledUp: false });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("computes jlpt_submit xp by mode and builds a VN-day-scoped source_id", async () => {
    let insertedRow: unknown;
    mockService({
      xp_events: (calls) => {
        if (hasOp(calls, "upsert")) {
          insertedRow = calls.find((c) => c.op === "upsert")?.values;
          return { data: { id: "xpe-1" }, error: null };
        }
        return { data: [], error: null };
      },
      user_stats: (calls) =>
        hasOp(calls, "upsert") ? { data: null, error: null } : { data: FRESH_STATS, error: null },
      user_kanji_progress: () => ({ data: [], error: null }),
      user_test_attempts: () => ({ data: [], error: null }),
      ...NO_BADGES_TABLES,
    });

    const result = await recordActivity({
      userId: USER_ID,
      source: "jlpt_submit",
      parts: { testId: "test-1" },
      jlptMode: "full",
      now: NOW,
    });

    expect(result.xpAwarded).toBe(50);
    expect((insertedRow as Record<string, unknown>).xp).toBe(50);
    expect((insertedRow as Record<string, unknown>).source_id).toBe("test-1:full:2026-07-13");
    expect((insertedRow as Record<string, unknown>).source_type).toBe("jlpt_submit");
  });

  it("resolves jlptMockLevelsCompleted from user_test_attempts joined to jlpt_tests for badge evaluation", async () => {
    mockService({
      xp_events: (calls) =>
        hasOp(calls, "upsert") ? { data: { id: "xpe-1" }, error: null } : { data: [{ source_type: "jlpt_submit" }], error: null },
      user_stats: (calls) =>
        hasOp(calls, "upsert") ? { data: null, error: null } : { data: FRESH_STATS, error: null },
      user_kanji_progress: () => ({ data: [], error: null }),
      user_test_attempts: (calls) => {
        expect(calls.some((c) => c.op === "eq" && c.column === "mode" && c.value === "full")).toBe(true);
        return { data: [{ test_id: "test-1" }], error: null };
      },
      jlpt_tests: (calls) => {
        expect(calls.some((c) => c.op === "in" && c.column === "id")).toBe(true);
        return { data: [{ level: "N5" }], error: null };
      },
      user_badges: (calls) =>
        hasOp(calls, "upsert") ? { data: [{ badge_id: "badge-n5" }], error: null } : { data: [], error: null },
      badges: () => ({
        data: [{ id: "badge-n5", name: "n5_mock", criteria: { type: "jlpt_mock", level: "N5" } }],
        error: null,
      }),
    });

    const result = await recordActivity({
      userId: USER_ID,
      source: "jlpt_submit",
      parts: { testId: "test-1" },
      jlptMode: "full",
      now: NOW,
    });

    expect(result.newBadges).toEqual(["badge-n5"]);
  });
});
