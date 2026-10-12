import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { getStreak } from "@/lib/data/streak";
import { getStudyTime, getTrackedSince } from "@/lib/data/study-time";
import { buildBadgeSnapshot } from "@/lib/data/badge-snapshot";
import { getStudyTimezone } from "@/lib/time/study-timezone";
import { readPreferences } from "@/lib/data/preferences";
import { resolveAvatarUrl } from "@/lib/profile/avatar-url";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";

type CachedFunction = (...args: never[]) => unknown;
let entries = new WeakMap<CachedFunction, Map<unknown, unknown>>();
const noArguments = Symbol("no arguments");
let client: ReturnType<typeof createMockSupabase>;

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T): T => ((...args: never[]) => {
      const key = args[0] ?? noArguments;
      const cached = fn as CachedFunction;
      const calls = entries.get(cached) ?? new Map<unknown, unknown>();
      entries.set(cached, calls);
      if (!calls.has(key)) calls.set(key, fn(...args));
      return calls.get(key);
    }) as T,
  };
});
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/streak", () => ({ getStreak: vi.fn() }));
vi.mock("@/lib/data/study-time", () => ({ getStudyTime: vi.fn(), getTrackedSince: vi.fn() }));
vi.mock("@/lib/data/badge-snapshot", () => ({ buildBadgeSnapshot: vi.fn() }));
vi.mock("@/lib/time/study-timezone", () => ({ getStudyTimezone: vi.fn() }));
vi.mock("@/lib/data/preferences", () => ({ readPreferences: vi.fn() }));
vi.mock("@/lib/profile/avatar-url", () => ({ resolveAvatarUrl: vi.fn() }));

import { getAchievementSnapshot } from "./achievements";
import { getDashboardContext } from "./context";
import { getActivityFact, getContinueLearning, getStreakFact, getStudyTimeFact, getWeaknessFacts, getWeeklyFacts } from "./facts";

const context = {
  userId: "u1", name: "Keishaa", avatarUrl: null, timeZone: "Asia/Tokyo",
  now: new Date("2026-10-10T00:00:00Z"), today: "2026-10-10", createdAt: "2026-01-02T00:00:00.000Z",
  scheduleDays: [1, 2, 3, 4, 5] as const, companionEnabled: true,
};

beforeEach(() => {
  entries = new WeakMap();
  vi.clearAllMocks();
  vi.mocked(getStreak).mockResolvedValue({ current: 4, longest: 9, lastActiveDate: "2026-10-10" });
  vi.mocked(getStudyTime).mockResolvedValue({ totalSeconds: 3600, days: [{ day: "2026-10-10", seconds: 3600 }] });
  vi.mocked(getTrackedSince).mockResolvedValue("2026-09-01T00:00:00.000Z");
  vi.mocked(buildBadgeSnapshot).mockResolvedValue({ totalXp: 10, streakCurrent: 4, kanjiLearned: 0, totalOutcomes: 0, outcomeCounts: {}, jlptMockLevelsCompleted: [] });
  vi.mocked(getStudyTimezone).mockResolvedValue({ timeZone: "Asia/Tokyo", needsDetection: false });
  vi.mocked(readPreferences).mockResolvedValue(DEFAULT_PREFERENCES);
  vi.mocked(resolveAvatarUrl).mockResolvedValue(null);
  client = createMockSupabase({
    user: { id: "u1" },
    tables: {
      users: () => ({ data: { name: "Keishaa", avatar_path: null, avatar_url: null, created_at: "2026-01-02T00:00:00Z" }, error: null }),
      user_stats: () => ({ data: { xp: 10 }, error: null }),
      badges: () => ({ data: [], error: null }),
      user_badges: () => ({ data: [], error: null }),
      kanji: () => ({ data: [], error: null }),
      learner_videos: () => ({ data: { id: "d5", title: "In progress", duration_seconds: null, last_watched_position: 1, situation_id: null, source_id: null }, error: null }),
    },
    rpcs: {
      activity_days: () => ({ data: [], error: null }),
      learning_outcomes_instrumented_since: () => ({ data: "2026-09-01T00:00:00Z", error: null }),
      weekly_skill_windows: () => ({ data: [], error: null }),
      newly_mastered_count: () => ({ data: 0, error: null }),
      weakness_scores: () => ({ data: [], error: null }),
      practice_activity: () => ({ data: [], error: null }),
      curriculum_membership: () => ({ data: [], error: null }),
    },
  });
  vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
});

describe("dashboard fact request cache", () => {
  it("reads the context once for the same request arguments", async () => {
    const now = new Date("2026-10-10T00:00:00Z");
    await getDashboardContext(now);
    await getDashboardContext(now);

    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it("runs the activity RPCs only once for a repeated fact", async () => {
    await getActivityFact(context);
    await getActivityFact(context);

    expect(client.rpcCalls?.map((call) => call.name)).toEqual(["activity_days", "learning_outcomes_instrumented_since"]);
  });

  it("shares the study-time read between its direct consumer and weekly facts", async () => {
    await getStudyTimeFact(context);
    await getWeeklyFacts(context);
    await getWeeklyFacts(context);

    expect(getStudyTime).toHaveBeenCalledTimes(1);
    expect(getTrackedSince).toHaveBeenCalledTimes(1);
    expect(client.rpcCalls?.map((call) => call.name)).toEqual(["weekly_skill_windows", "newly_mastered_count"]);
  });

  it("shares the streak between its direct consumer and achievement snapshot", async () => {
    await getStreakFact(context);
    await getAchievementSnapshot(context);
    await getAchievementSnapshot(context);

    expect(getStreak).toHaveBeenCalledTimes(1);
    expect(buildBadgeSnapshot).toHaveBeenCalledTimes(1);
  });

  it("runs weakness and continuation reads once when each fact is repeated", async () => {
    await getWeaknessFacts(context);
    await getWeaknessFacts(context);
    await getContinueLearning(context);
    await getContinueLearning(context);

    expect(client.rpcCalls?.map((call) => call.name)).toEqual(["weakness_scores", "practice_activity", "curriculum_membership"]);
  });

  it("starts fresh reads in a new request scope", async () => {
    await getStudyTimeFact(context);
    entries = new WeakMap();
    await getStudyTimeFact(context);

    expect(getStudyTime).toHaveBeenCalledTimes(2);
    expect(getTrackedSince).toHaveBeenCalledTimes(2);
  });
});
