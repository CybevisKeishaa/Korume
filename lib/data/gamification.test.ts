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
// 2026-07-13T04:00:00Z is 2026-07-12T21:00 in the mocked America/Los_Angeles zone.
const NOW = new Date("2026-07-13T04:00:00.000Z");

type Award = { xp_awarded: number; prev_xp: number; next_xp: number; had_outcome_today: boolean };
const FRESH_AWARD: Award = { xp_awarded: 5, prev_xp: 0, next_xp: 5, had_outcome_today: false };
const DUPLICATE_AWARD: Award = { xp_awarded: 0, prev_xp: 50, next_xp: 50, had_outcome_today: true };
type StreakRow = { current_streak: number; longest_streak: number; last_active: string | null };
const ONE_DAY: StreakRow = { current_streak: 1, longest_streak: 1, last_active: "2026-07-12" };

function mockService(
  tables: Parameters<typeof createMockSupabase>[0]["tables"],
  award: Award | "error" = FRESH_AWARD,
  streak: StreakRow = ONE_DAY,
) {
  const supabase = createMockSupabase({
    tables,
    rpcs: {
      record_learning_outcome: () =>
        award === "error" ? { data: null, error: { message: "boom" } } : { data: [award], error: null },
      study_streak: () => ({ data: [streak], error: null }),
    },
  });
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
  return supabase;
}

function hasOp(calls: QueryCall[], op: QueryCall["op"]) {
  return calls.some((c) => c.op === op);
}

/** No badges seeded / none earned yet - the common case for tests that do not care about badges. */
const NO_BADGES_TABLES = {
  user_badges: () => ({ data: [], error: null }),
  badges: () => ({ data: [], error: null }),
};

/** The tables a badge-evaluating run reads; user_stats is deliberately absent (the RPC owns it). */
const BASE_TABLES = {
  xp_events: () => ({ data: [], error: null }),
  user_kanji_progress: () => ({ data: [], error: null }),
  user_test_attempts: () => ({ data: [], error: null }),
};

beforeEach(() => {
  vi.mocked(createServiceClient).mockReset();
  vi.mocked(emitNotification).mockReset();
  vi.mocked(emitNotification).mockResolvedValue(undefined);
  vi.mocked(getStudyTimezoneFor).mockReset();
  vi.mocked(getStudyTimezoneFor).mockResolvedValue("America/Los_Angeles");
  vi.mocked(readPreferences).mockResolvedValue({ ...DEFAULT_PREFERENCES });
});

describe("recordActivity", () => {
  it("derives the streak from the learner zone, schedule and local date, and writes no user_stats", async () => {
    vi.mocked(readPreferences).mockResolvedValue({ ...DEFAULT_PREFERENCES, learningSchedule: "weekdays" as const, scheduleDays: [1, 2, 3, 4, 5] });
    const supabase = mockService({ ...BASE_TABLES, ...NO_BADGES_TABLES });

    const result = await recordActivity({ userId: USER_ID, source: "srs_review", parts: { itemType: "kanji", itemId: "k1" }, now: NOW });

    expect(result.ok).toBe(true);
    expect(supabase.rpcCalls).toContainEqual({
      name: "study_streak",
      args: { p_user: USER_ID, p_tz: "America/Los_Angeles", p_schedule: [1, 2, 3, 4, 5], p_today: "2026-07-12" },
    });
  });

  it("awards xp on a fresh outcome", async () => {
    mockService({ ...BASE_TABLES, ...NO_BADGES_TABLES });
    const result = await recordActivity({ userId: USER_ID, source: "srs_review", parts: { itemType: "kanji", itemId: "k1" }, now: NOW });
    expect(result).toEqual({ ok: true, xpAwarded: 5, newBadges: [], leveledUp: false });
  });

  it("detects a level-up boundary and emits a level_up notification", async () => {
    mockService({ ...BASE_TABLES, ...NO_BADGES_TABLES }, { xp_awarded: 5, prev_xp: 95, next_xp: 100, had_outcome_today: false });

    // 95 + 5 (srs_review) = 100 == thresholdForLevel(2) -> level 1 -> level 2.
    const result = await recordActivity({ userId: USER_ID, source: "srs_review", parts: { itemType: "vocab", itemId: "v1" }, now: NOW });

    expect(result.leveledUp).toBe(true);
    expect(emitNotification).toHaveBeenCalledWith(expect.anything(), {
      type: "level_up",
      userId: USER_ID,
      payload: { level: 2 },
    });
  });

  it("awards a newly-satisfied badge and emits badge_earned", async () => {
    mockService({
      ...BASE_TABLES,
      xp_events: () => ({ data: [{ source_type: "dictation" }], error: null }),
      user_badges: (calls) =>
        hasOp(calls, "upsert") ? { data: [{ badge_id: "badge-1" }], error: null } : { data: [], error: null },
      badges: () => ({
        data: [{ id: "badge-1", name: "first_steps", criteria: { type: "sessions", count: 1 } }],
        error: null,
      }),
    });

    const result = await recordActivity({ userId: USER_ID, source: "dictation", parts: { lineId: "line-1" }, now: NOW });

    expect(result.newBadges).toEqual(["badge-1"]);
    expect(emitNotification).toHaveBeenCalledWith(expect.anything(), {
      type: "badge_earned",
      userId: USER_ID,
      payload: { badgeId: "badge-1", badgeName: "first_steps" },
    });
  });

  it("hands the RPC current_streak to the badge snapshot", async () => {
    const tables = {
      ...BASE_TABLES,
      user_badges: (calls: QueryCall[]) =>
        hasOp(calls, "upsert") ? { data: [{ badge_id: "streak-3" }], error: null } : { data: [], error: null },
      badges: () => ({ data: [{ id: "streak-3", name: "three", criteria: { type: "streak", days: 3 } }], error: null }),
    };
    mockService(tables, FRESH_AWARD, { current_streak: 3, longest_streak: 3, last_active: "2026-07-12" });
    const earned = await recordActivity({ userId: USER_ID, source: "srs_review", parts: { itemType: "kanji", itemId: "k1" }, now: NOW });
    expect(earned.newBadges).toEqual(["streak-3"]);

    mockService(tables, FRESH_AWARD, { current_streak: 2, longest_streak: 9, last_active: "2026-07-12" });
    const notYet = await recordActivity({ userId: USER_ID, source: "srs_review", parts: { itemType: "kanji", itemId: "k1" }, now: NOW });
    expect(notYet.newBadges).toEqual([]);
  });

  it("does not re-emit or re-award a badge already earned", async () => {
    mockService({
      ...BASE_TABLES,
      xp_events: () => ({ data: [{ source_type: "dictation" }], error: null }),
      user_badges: () => ({ data: [{ badge_id: "badge-1" }], error: null }), // already earned
      badges: () => ({
        data: [{ id: "badge-1", name: "first_steps", criteria: { type: "sessions", count: 1 } }],
        error: null,
      }),
    });

    const result = await recordActivity({ userId: USER_ID, source: "dictation", parts: { lineId: "line-1" }, now: NOW });

    expect(result.newBadges).toEqual([]);
    expect(emitNotification).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "badge_earned" }),
    );
  });

  it("never revokes a badge when the derived streak shrinks", async () => {
    const badgeCalls: QueryCall[] = [];
    mockService({
      ...BASE_TABLES,
      user_badges: (calls) => {
        badgeCalls.push(...calls);
        return { data: [{ badge_id: "streak-7" }], error: null };
      },
      badges: () => ({ data: [{ id: "streak-7", name: "seven", criteria: { type: "streak", days: 7 } }], error: null }),
    }, FRESH_AWARD, { current_streak: 0, longest_streak: 7, last_active: "2026-07-01" });

    await recordActivity({ userId: USER_ID, source: "srs_review", parts: { itemType: "kanji", itemId: "k1" }, now: NOW });

    expect(badgeCalls.length).toBeGreaterThan(0);
    expect(hasOp(badgeCalls, "delete")).toBe(false);
    expect(hasOp(badgeCalls, "update")).toBe(false);
  });

  it("still evaluates badges on a duplicate outcome that is the first of the learner day", async () => {
    let kanjiQueried = false;
    mockService({
      ...BASE_TABLES,
      user_kanji_progress: () => {
        kanjiQueried = true;
        return { data: [], error: null };
      },
      ...NO_BADGES_TABLES,
    }, { ...DUPLICATE_AWARD, had_outcome_today: false });

    const result = await recordActivity({ userId: USER_ID, source: "srs_review", parts: { itemType: "kanji", itemId: "k1" }, now: NOW });

    expect(result).toMatchObject({ ok: true, xpAwarded: 0 });
    expect(kanjiQueried).toBe(true);
  });

  it("skips the streak and badge work when no xp was awarded AND the learner already had an outcome today", async () => {
    let kanjiQueried = false;
    const supabase = mockService({
      ...BASE_TABLES,
      user_kanji_progress: () => {
        kanjiQueried = true;
        return { data: [], error: null };
      },
      ...NO_BADGES_TABLES,
    }, DUPLICATE_AWARD);

    const result = await recordActivity({ userId: USER_ID, source: "srs_review", parts: { itemType: "kanji", itemId: "k1" }, now: NOW });

    expect(result).toEqual({ ok: true, xpAwarded: 0, newBadges: [], leveledUp: false });
    expect(kanjiQueried).toBe(false);
    expect(supabase.rpcCalls?.some((c) => c.name === "study_streak")).toBe(false);
    expect(emitNotification).not.toHaveBeenCalled();
  });

  it("never throws and returns {ok:false} when a DB call errors", async () => {
    mockService({}, "error");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await recordActivity({ userId: USER_ID, source: "srs_review", parts: { itemType: "kanji", itemId: "k1" }, now: NOW });

    expect(result).toEqual({ ok: false, xpAwarded: 0, newBadges: [], leveledUp: false });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("computes jlpt_submit xp by mode and awards through the locked RPC with a date-free source_id", async () => {
    const supabase = mockService({
      ...BASE_TABLES,
      ...NO_BADGES_TABLES,
    }, { xp_awarded: 50, prev_xp: 0, next_xp: 50, had_outcome_today: false });

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
      user_kanji_progress: () => ({ data: [], error: null }),
      user_test_attempts: () => ({ data: [], error: null }),
      ...NO_BADGES_TABLES,
    });
    await recordActivity({ userId: USER_ID, source: "srs_review", parts: { itemType: "vocab", itemId: "v1" }, now: NOW });
    expect(getStudyTimezoneFor).toHaveBeenCalledWith(supabase, USER_ID);
    expect(writes).not.toContain("xp_events");
  });
});
