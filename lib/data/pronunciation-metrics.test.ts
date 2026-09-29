import { describe, expect, it, vi } from "vitest";
import { createMockSupabase, type RpcResolver, type TableResolver } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function useMock(tables: Record<string, TableResolver>, rpcs: Record<string, RpcResolver>) {
  const supabase = createMockSupabase({ tables, rpcs });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return supabase;
}

describe("pronunciation metrics", () => {
  it("uses the fixed VN midnight boundary", async () => {
    const { vnDayStart, vnDaysAgo } = await import("./pronunciation-metrics");
    expect(vnDayStart(new Date("2026-09-29T16:59:00.000Z")).toISOString()).toBe("2026-09-28T17:00:00.000Z");
    expect(vnDayStart(new Date("2026-09-29T17:00:00.000Z")).toISOString()).toBe("2026-09-29T17:00:00.000Z");
    expect(vnDaysAgo(new Date("2026-09-29T16:59:00.000Z"), new Date("2026-09-29T17:00:00.000Z"))).toBe(1);
  });

  it("reads the rolling weekly aggregate and keeps the documented weakest-metric tie order", async () => {
    useMock({}, { pronunciation_metric_means: (args) => {
      expect(args).toEqual({ p_start: "2026-09-22T12:00:00.000Z", p_end: "2026-09-29T12:00:00.000Z" });
      return { data: [{ pronunciation_score: "70", pitch_score: null, rhythm_score: "50" }], error: null };
    } });
    const { getWeeklyPronunciationMetrics, weakestPronunciationMetric } = await import("./pronunciation-metrics");
    await expect(getWeeklyPronunciationMetrics(new Date("2026-09-29T12:00:00.000Z"))).resolves.toEqual({ means: { accuracy: 70, pitch: null, rhythm: 50 }, weakest: "rhythm" });
    expect(weakestPronunciationMetric({ accuracy: 50, pitch: 50, rhythm: 50 })).toBe("accuracy");
    expect(weakestPronunciationMetric({ accuracy: null, pitch: 50, rhythm: 50 })).toBe("pitch");
    expect(weakestPronunciationMetric({ accuracy: null, pitch: null, rhythm: null })).toBeNull();
  });

  it("orders and rounds the JLPT aggregate, dropping empty levels and surfacing RPC failures", async () => {
    useMock({}, { jlpt_speaking_summary: () => ({ data: [
      { level: "N1", lesson_count: "2", practiced_count: "0", average_score: null },
      { level: "N5", lesson_count: "18", practiced_count: "15", average_score: "90.6" },
      { level: "N3", lesson_count: "0", practiced_count: "0", average_score: null },
    ], error: null }) });
    const { getJlptSpeakingSummary } = await import("./pronunciation-metrics");
    await expect(getJlptSpeakingSummary()).resolves.toEqual([{ level: "N5", lessonCount: 18, practicedCount: 15, averageScore: 91 }, { level: "N1", lessonCount: 2, practicedCount: 0, averageScore: null }]);
    useMock({}, { jlpt_speaking_summary: () => ({ data: null, error: { message: "denied" } }) });
    await expect(getJlptSpeakingSummary()).rejects.toMatchObject({ message: "denied" });
  });

  it("reads today's measured seconds, completions, and unknown score in the VN window", async () => {
    let calls: unknown[] = [];
    const supabase = useMock({
      user_video_progress: (value) => { calls = value; return { data: [{ video_id: "a" }, { video_id: "b" }], error: null }; },
    }, {
      pronunciation_speaking_seconds: () => ({ data: 91, error: null }),
      pronunciation_metric_means: () => ({ data: [{ pronunciation_score: null, pitch_score: 80, rhythm_score: 70 }], error: null }),
    });
    const { getTodaySpeaking } = await import("./pronunciation-metrics");
    await expect(getTodaySpeaking(new Date("2026-09-30T01:00:00.000Z"))).resolves.toEqual({ minutes: 2, lessonsCompleted: 2, averageScore: null });
    expect(supabase.rpcCalls).toContainEqual({ name: "pronunciation_speaking_seconds", args: { p_start: "2026-09-29T17:00:00.000Z", p_end: "2026-09-30T01:00:00.000Z" } });
    expect(calls).toEqual(expect.arrayContaining([{ op: "gte", column: "completed_at", value: "2026-09-29T17:00:00.000Z" }, { op: "lt", column: "completed_at", value: "2026-09-30T01:00:00.000Z" }]));
  });

  it("keeps unknown weekly deltas unknown, retains measured zero, and coerces trend numbers", async () => {
    const supabase = useMock({}, {
      pronunciation_metric_means: (args) => ({ data: args.p_start === "2026-09-16T01:00:00.000Z"
        ? [{ pronunciation_score: null, pitch_score: 70, rhythm_score: 60 }]
        : [{ pronunciation_score: 80, pitch_score: 70, rhythm_score: 65 }], error: null }),
      pronunciation_daily_means: () => ({ data: [{ day: "2026-09-20", pronunciation_score: "81.6" }], error: null }),
    });
    const { getWeeklyImprovement } = await import("./pronunciation-metrics");
    await expect(getWeeklyImprovement(new Date("2026-09-30T01:00:00.000Z"))).resolves.toEqual({ deltas: { accuracy: null, pitch: 0, rhythm: 5 }, trend: [{ day: "2026-09-20", score: 82 }] });
    expect(supabase.rpcCalls).toEqual(expect.arrayContaining([
      { name: "pronunciation_metric_means", args: { p_start: "2026-09-23T01:00:00.000Z", p_end: "2026-09-30T01:00:00.000Z" } },
      { name: "pronunciation_metric_means", args: { p_start: "2026-09-16T01:00:00.000Z", p_end: "2026-09-23T01:00:00.000Z" } },
      // The 14 whole VN days ending today: 2026-09-17 00:00 VN is 09-16 17:00Z.
      { name: "pronunciation_daily_means", args: { p_start: "2026-09-16T17:00:00.000Z", p_end: "2026-09-30T01:00:00.000Z" } },
    ]));
  });

  it("keeps the RPC's recent order, drops a lesson hidden by RLS and over-fetches to still fill the limit", async () => {
    const supabase = useMock({
      // Returned out of order: the rows must follow the RPC, not this read.
      videos: () => ({ data: [{ id: "third", title: "Third" }, { id: "first", title: "First" }, { id: "second", title: "Second" }], error: null }),
    }, {
      pronunciation_recent_practice: () => ({ data: [
        { video_id: "first", practiced_at: "2026-09-28T19:00:00.000Z", pronunciation_score: "94.4" },
        { video_id: "hidden", practiced_at: "2026-09-28T18:00:00.000Z", pronunciation_score: "90" },
        { video_id: "second", practiced_at: "2026-09-27T18:00:00.000Z", pronunciation_score: null },
        { video_id: "third", practiced_at: "2026-09-26T18:00:00.000Z", pronunciation_score: "70" },
      ], error: null }),
    });
    const { getRecentPractice } = await import("./pronunciation-metrics");
    await expect(getRecentPractice(2)).resolves.toEqual([
      { lesson: { id: "first", title: "First" }, practicedAt: "2026-09-28T19:00:00.000Z", averageScore: 94 },
      { lesson: { id: "second", title: "Second" }, practicedAt: "2026-09-27T18:00:00.000Z", averageScore: null },
    ]);
    expect(supabase.rpcCalls).toEqual([{ name: "pronunciation_recent_practice", args: { p_limit: 5 } }]);
  });
});
