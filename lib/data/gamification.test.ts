import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createServiceClient } from "@/lib/supabase/service";
import { emitNotification } from "@/lib/notifications/emit";
import { getStudyTimezoneFor } from "@/lib/time/study-timezone";
import { readPreferences } from "@/lib/data/preferences";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/notifications/emit", () => ({ emitNotification: vi.fn() }));
vi.mock("@/lib/time/study-timezone", () => ({ getStudyTimezoneFor: vi.fn() }));
vi.mock("@/lib/data/preferences", () => ({ readPreferences: vi.fn() }));

// Imported after the mocks above are registered.
import { recordActivity } from "./gamification";

const USER_ID = "u1";
// 2026-07-13T04:00:00Z + 7h (VN offset) = 2026-07-13T11:00 VN -> vnDateString = "2026-07-13".
const NOW = new Date("2026-07-13T04:00:00.000Z");

type Award = { xp_awarded: number; prev_xp: number; next_xp: number };
const FRESH_AWARD: Award = { xp_awarded: 5, prev_xp: 0, next_xp: 5 };
const DUPLICATE_AWARD: Award = { xp_awarded: 0, prev_xp: 50, next_xp: 50 };

function mockService(tables: Parameters<typeof createMockSupabase>[0]["tables"], award: Award | "error" = FRESH_AWARD) {
  const supabase = createMockSupabase({
    tables,
    rpcs: {
      record_learning_outcome: () =>
        award === "error" ? { data: null, error: { message: "boom" } } : { data: [award], error: null },
    },
  });
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
  vi.mocked(getStudyTimezoneFor).mockReset();
  vi.mocked(getStudyTimezoneFor).mockResolvedValue("America/Los_Angeles");
  vi.mocked(readPreferences).mockResolvedValue({ ...DEFAULT_PREFERENCES });
});

describe("recordActivity", () => {
  it("uses the learning schedule when advancing a streak", async () => {
    let statsUpdate: unknown;
    vi.mocked(readPreferences).mockResolvedValue({ ...DEFAULT_PREFERENCES, learningSchedule: "weekdays" as const, scheduleDays: [1, 2, 3, 4, 5] });
    mockService({
      xp_events: () => ({ data: [], error: null }),
      user_stats: (calls) => {
        if (hasOp(calls, "upsert")) {
          statsUpdate = calls.find((call) => call.op === "upsert")?.values;
          return { data: null, error: null };
        }
        return { data: { xp: 0, streak_current: 4, streak_longest: 4, last_active_date: "2026-09-18" }, error: null };
      },
      user_kanji_progress: () => ({ data: [], error: null }),
      user_test_attempts: () => ({ data: [], error: null }),
      ...NO_BADGES_TABLES,
    });

    const result = await recordActivity({ userId: USER_ID, source: "srs_review", parts: { itemType: "kanji", itemId: "k1" }, now: new Date("2026-09-21T05:00:00Z") });

    expect(result.ok).toBe(true);
    expect((statsUpdate as Record<string, unknown>).streak_current).toBe(5);
  });

  it("awards xp, starts the streak, and updates user_stats on a fresh outcome", async () => {
    let statsUpdate: unknown;
    mockService({
      xp_events: () => ({ data: [], error: null }),
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
    expect(statsUpdate).not.toHaveProperty("xp");
    expect((statsUpdate as Record<string, unknown>).streak_current).toBe(1);
    expect((statsUpdate as Record<string, unknown>).last_active_date).toBe("2026-07-13");
  });

  it("detects a level-up boundary and emits a level_up notification", async () => {
    mockService({
      xp_events: () => ({ data: [], error: null }),
      user_stats: (calls) =>
        hasOp(calls, "upsert")
          ? { data: null, error: null }
          : { data: { xp: 95, streak_current: 3, streak_longest: 5, last_active_date: "2026-07-12" }, error: null },
      user_kanji_progress: () => ({ data: [], error: null }),
      user_test_attempts: () => ({ data: [], error: null }),
      ...NO_BADGES_TABLES,
    }, { xp_awarded: 5, prev_xp: 95, next_xp: 100 });

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
      xp_events: () => ({ data: [{ source_type: "dictation" }], error: null }),
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
      xp_events: () => ({ data: [{ source_type: "dictation" }], error: null }),
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
      xp_events: () => ({ data: [], error: null }),
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
    }, DUPLICATE_AWARD);

    const result = await recordActivity({
      userId: USER_ID,
      source: "srs_review",
      parts: { itemType: "kanji", itemId: "k1" },
      now: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.xpAwarded).toBe(0);
    expect((statsUpdate as Record<string, unknown>).streak_current).toBe(3);
    expect(statsUpdate).not.toHaveProperty("xp");
  });

  it("skips the badge-snapshot aggregate when the outcome is a duplicate AND the streak is unchanged", async () => {
    let kanjiQueried = false;
    mockService({
      xp_events: () => ({ data: [], error: null }),
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
    }, DUPLICATE_AWARD);

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
    mockService({}, "error");
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

  it("computes jlpt_submit xp by mode and awards through the locked RPC with a date-free source_id", async () => {
    const supabase = mockService({
      xp_events: () => ({ data: [], error: null }),
      user_stats: (calls) =>
        hasOp(calls, "upsert") ? { data: null, error: null } : { data: FRESH_STATS, error: null },
      user_kanji_progress: () => ({ data: [], error: null }),
      user_test_attempts: () => ({ data: [], error: null }),
      ...NO_BADGES_TABLES,
    }, { xp_awarded: 50, prev_xp: 0, next_xp: 50 });

    const result = await recordActivity({
      userId: USER_ID,
      source: "jlpt_submit",
      parts: { testId: "test-1" },
      jlptMode: "full",
      now: NOW,
    });

    expect(result.xpAwarded).toBe(50);
    expect(supabase.rpcCalls).toContainEqual({
      name: "record_learning_outcome",
      args: { p_user: USER_ID, p_source: "jlpt_submit", p_source_id: "test-1:full", p_xp: 50, p_tz: "America/Los_Angeles", p_daily: true },
    });
  });

  it("resolves jlptMockLevelsCompleted from user_test_attempts joined to certification_tests for badge evaluation", async () => {
    mockService({
      xp_events: () => ({ data: [{ source_type: "jlpt_submit" }], error: null }),
      user_stats: (calls) =>
        hasOp(calls, "upsert") ? { data: null, error: null } : { data: FRESH_STATS, error: null },
      user_kanji_progress: () => ({ data: [], error: null }),
      user_test_attempts: (calls) => {
        expect(calls.some((c) => c.op === "eq" && c.column === "mode" && c.value === "full")).toBe(true);
        return { data: [{ test_id: "test-1" }], error: null };
      },
      certification_tests: (calls) => {
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

  it("treats conversation as once-only and takes the award from the RPC row", async () => {
    const supabase = mockService({
      xp_events: () => ({ data: [], error: null }),
      user_stats: () => ({ data: FRESH_STATS, error: null }),
      user_kanji_progress: () => ({ data: [], error: null }),
      user_test_attempts: () => ({ data: [], error: null }),
      ...NO_BADGES_TABLES,
    }, DUPLICATE_AWARD);
    const result = await recordActivity({ userId: USER_ID, source: "conversation", parts: { sessionId: "s1" }, now: NOW });
    expect(supabase.rpcCalls?.[0]?.args).toMatchObject({ p_source_id: "s1", p_daily: false });
    expect(result).toMatchObject({ ok: true, xpAwarded: 0 });
  });

  it("reads the zone for the user and writes no xp from TypeScript", async () => {
    const writes: string[] = [];
    const supabase = mockService({
      xp_events: (calls) => { if (calls.some((c) => c.op === "upsert" || c.op === "insert")) writes.push("xp_events"); return { data: [], error: null }; },
      user_stats: (calls) => {
        const w = calls.find((c) => c.op === "upsert");
        if (w) { writes.push(Object.keys(w.values as object).includes("xp") ? "xp" : "stats"); return { data: null, error: null }; }
        return { data: FRESH_STATS, error: null };
      },
      user_kanji_progress: () => ({ data: [], error: null }),
      user_test_attempts: () => ({ data: [], error: null }),
      ...NO_BADGES_TABLES,
    });
    await recordActivity({ userId: USER_ID, source: "srs_review", parts: { itemType: "vocab", itemId: "v1" }, now: NOW });
    expect(getStudyTimezoneFor).toHaveBeenCalledWith(supabase, USER_ID);
    expect(writes).not.toContain("xp_events");
    expect(writes).not.toContain("xp");
  });
});
