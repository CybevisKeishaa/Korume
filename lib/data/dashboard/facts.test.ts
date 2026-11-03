import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { getStreak } from "@/lib/data/streak";
import { getStudyTime, getTrackedSince } from "@/lib/data/study-time";
import { getCurriculumJourney, getCurriculumPlacement } from "./journey";
import { getRecommendations } from "@/lib/data/recommendations";
import { getDashboardContext } from "./context";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/streak", () => ({ getStreak: vi.fn() }));
vi.mock("@/lib/data/study-time", () => ({ getStudyTime: vi.fn(), getTrackedSince: vi.fn() }));
vi.mock("./journey", () => ({ getCurriculumJourney: vi.fn(), getCurriculumPlacement: vi.fn() }));
vi.mock("@/lib/data/recommendations", () => ({ getRecommendations: vi.fn() }));
vi.mock("./context", () => ({ getDashboardContext: vi.fn() }));

import {
  getActivityFact,
  getContinueLearning,
  getStreakFact,
  getStudyTimeFact,
  getWeaknessFacts,
  getWeeklyFacts,
} from "./facts";

const context = {
  userId: "u1", name: "Keishaa", avatarUrl: null, timeZone: "Asia/Tokyo",
  now: new Date("2026-10-10T00:00:00Z"), today: "2026-10-10", createdAt: "2026-01-02T00:00:00.000Z",
  scheduleDays: [1, 2, 3, 4, 5] as const, companionEnabled: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDashboardContext).mockResolvedValue(context);
  vi.mocked(getStreak).mockResolvedValue({ current: 4, longest: 9, lastActiveDate: "2026-10-10" });
  vi.mocked(getStudyTime).mockResolvedValue({ totalSeconds: 5400, days: [{ day: "2026-10-10", seconds: 5400 }] });
  vi.mocked(getTrackedSince).mockResolvedValue("2026-09-01T00:00:00.000Z");
  vi.mocked(getCurriculumJourney).mockResolvedValue({ kind: "authoring" });
  vi.mocked(getCurriculumPlacement).mockResolvedValue(null);
  vi.mocked(getRecommendations).mockResolvedValue({ ok: true, data: [] });
});

function mockClient(options: Parameters<typeof createMockSupabase>[0]) {
  const supabase = createMockSupabase(options);
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return supabase;
}

describe("dashboard fact loaders", () => {
  it("shares the streak fact between dashboard consumers", async () => {
    mockClient({ tables: {} });

    await expect(getStreakFact(context)).resolves.toEqual({ current: 4, longest: 9, lastActiveDate: "2026-10-10" });
    expect(getStreak).toHaveBeenCalledWith(expect.anything(), "u1", "Asia/Tokyo", [1, 2, 3, 4, 5], context.now);
  });

  it("maps the 56-day activity RPC into the calendar grid", async () => {
    const supabase = mockClient({
      tables: {},
      rpcs: {
        activity_days: () => ({ data: [{ day: "2026-10-10", outcomes: 5 }], error: null }),
        learning_outcomes_instrumented_since: () => ({ data: "2026-09-14T15:00:00Z", error: null }),
      },
    });

    const result = await getActivityFact(context);

    expect(result).toHaveLength(56);
    expect(result.find((cell) => cell.date === "2026-09-14")).toEqual({ date: "2026-09-14", state: "unavailable", level: 0, count: 0 });
    expect(result.at(-1)).toEqual({ date: "2026-10-10", state: "active", level: 2, count: 5 });
    expect(supabase.rpcCalls).toEqual([
      { name: "activity_days", args: { p_tz: "Asia/Tokyo", p_from: "2026-08-16", p_to: "2026-10-10" } },
      { name: "learning_outcomes_instrumented_since", args: {} },
    ]);
  });

  it("uses the shared study-time fact for weekly bars and one current-week mastery count", async () => {
    const supabase = mockClient({
      tables: {},
      rpcs: {
        weekly_skill_windows: () => ({ data: [
          { skill: "listening", win: 0, attempts: 3, mean: 80 }, { skill: "listening", win: 1, attempts: 3, mean: 72 },
        ], error: null }),
        newly_mastered_count: () => ({ data: 2, error: null }),
      },
    });

    await expect(getWeeklyFacts(context)).resolves.toEqual(expect.objectContaining({
      vocabularyMastered: 2, listeningDelta: 8, pronunciationDelta: null, hoursW0: 1.5,
    }));
    expect(getStudyTime).toHaveBeenCalledTimes(1);
    expect(supabase.rpcCalls?.map((call) => call.name)).toEqual(["weekly_skill_windows", "newly_mastered_count"]);
  });

  it("converts tracked-since into the learner study timezone before marking weekly history", async () => {
    mockClient({ tables: {} });
    vi.mocked(getTrackedSince).mockResolvedValue("2026-10-03T15:00:00.000Z");

    const fact = await getStudyTimeFact(context);

    expect(fact.bars.find((bar) => bar.index === 1)).toEqual({ index: 1, unavailable: true });
  });

  it("rounds current-window hours to one decimal", async () => {
    mockClient({ tables: {} });
    vi.mocked(getStudyTime).mockResolvedValue({ totalSeconds: 4620, days: [{ day: "2026-10-10", seconds: 4620 }] });

    await expect(getStudyTimeFact(context)).resolves.toEqual(expect.objectContaining({ hoursW0: 1.3 }));
  });

  it("routes listening and pronunciation weaknesses to the most relevant lesson practice", async () => {
    mockClient({
      tables: {
        learner_videos: () => ({ data: { id: "d5", title: "In progress", duration_seconds: null, last_watched_position: 5 }, error: null }),
      },
      rpcs: {
        weakness_scores: () => ({ data: [
          { family: "listening", metric: "accuracy", attempts: 3, score: 50 },
          { family: "pronunciation", metric: "pitch", attempts: 3, score: 40.4 },
        ], error: null }),
        practice_activity: () => ({ data: [{ type: "dictation_lines", outcomes: 2, last_at: null, last_video_id: "fallback" }], error: null }),
      },
    });
    await expect(getWeaknessFacts(context)).resolves.toEqual([
      { family: "pronunciation", metric: "pitch", score: 40, practiceHref: "/shadowing/d5" },
      { family: "listening", metric: "accuracy", score: 50, practiceHref: "/shadowing/d5/listening?format=dictation" },
    ]);
  });

  it("gives the next curriculum lesson its cover when nothing is in progress", async () => {
    mockClient({
      tables: {
        learner_videos: (calls) => calls.some((call) => call.op === "select" && call.columns === "thumbnail_url")
          ? { data: { thumbnail_url: "https://i.ytimg.com/vi/n/hqdefault.jpg" }, error: null }
          : { data: null, error: null },
      },
    });
    vi.mocked(getCurriculumJourney).mockResolvedValue({
      kind: "active", current: "N5", next: { videoId: "next-1", title: "Numbers" }, remaining: 2,
      plus: { total: 0, accessible: 0 }, nodes: [],
    });

    await expect(getContinueLearning(context)).resolves.toEqual({
      kind: "startNext", videoId: "next-1", title: "Numbers", placement: null, thumbnailUrl: "https://i.ytimg.com/vi/n/hqdefault.jpg",
    });
  });

  it("prefers the newest incomplete lesson and derives progress without inventing tags", async () => {
    const learnerReads: QueryCall[][] = [];
    const supabase = mockClient({
      tables: {
        learner_videos: (calls) => {
          learnerReads.push(calls);
          return { data: { id: "video-1", title: "Episode", thumbnail_url: "https://i.ytimg.com/vi/x/hqdefault.jpg", duration_seconds: 600, last_watched_position: 180, jlpt_level_estimate: "N4", situation_id: "s1", source_id: "o1" }, error: null };
        },
        lesson_situations: () => ({ data: { slug: "restaurant" }, error: null }),
        lesson_sources: () => ({ data: { slug: "podcast" }, error: null }),
      },
    });
    vi.mocked(getCurriculumPlacement).mockResolvedValue({ title: "N5 Foundations", position: 2 });

    await expect(getContinueLearning(context)).resolves.toEqual({
      kind: "continue", videoId: "video-1", title: "Episode", placement: { title: "N5 Foundations", position: 2 },
      percent: 30, remainingMinutes: 7, tags: [{ kind: "jlpt", value: "N4" }, { kind: "situations", value: "restaurant" }, { kind: "sources", value: "podcast" }], thumbnailUrl: "https://i.ytimg.com/vi/x/hqdefault.jpg",
    });
    expect(supabase).toBeDefined();
    expect(learnerReads[0]).toContainEqual({ op: "select", columns: "id, title, thumbnail_url, duration_seconds, last_watched_position, jlpt_level_estimate, situation_id, source_id" });
  });
});
