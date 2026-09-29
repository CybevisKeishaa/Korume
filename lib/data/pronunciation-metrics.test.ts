import { describe, expect, it, vi } from "vitest";
import { createMockSupabase, type TableResolver } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function useTables(tables: Record<string, TableResolver>, rpcs?: Parameters<typeof createMockSupabase>[0]["rpcs"]) {
  vi.mocked(createClient).mockReturnValue(createMockSupabase({ user: { id: "u1" }, tables, rpcs }) as unknown as ReturnType<typeof createClient>);
}

describe("weekly pronunciation metrics", () => {
  const now = new Date("2026-09-29T12:00:00.000Z");

  it("reads the rolling [now - 7 days, now) database aggregate and coerces numeric RPC values", async () => {
    useTables({}, {
      pronunciation_metric_means: (args) => {
        expect(args).toEqual({ p_start: "2026-09-22T12:00:00.000Z", p_end: "2026-09-29T12:00:00.000Z" });
        return { data: [{ pronunciation_score: "70", pitch_score: null, rhythm_score: "50" }], error: null };
      },
    });
    const { getWeeklyPronunciationMetrics } = await import("@/lib/data/pronunciation-metrics");

    await expect(getWeeklyPronunciationMetrics(now)).resolves.toEqual({
      means: { accuracy: 70, pitch: null, rhythm: 50 },
      weakest: "rhythm",
    });
  });

  it("breaks equal means by accuracy, then pitch, then rhythm, and has no weakest without a score", async () => {
    const { weakestPronunciationMetric } = await import("@/lib/data/pronunciation-metrics");

    expect(weakestPronunciationMetric({ accuracy: 50, pitch: 50, rhythm: 50 })).toBe("accuracy");
    expect(weakestPronunciationMetric({ accuracy: null, pitch: 50, rhythm: 50 })).toBe("pitch");
    expect(weakestPronunciationMetric({ accuracy: null, pitch: null, rhythm: null })).toBeNull();
  });
});

describe("JLPT Speaking summary", () => {
  it("orders the database aggregate N5 to N1, coerces bigint/numeric strings and drops levels without lessons", async () => {
    useTables({}, {
      jlpt_speaking_summary: () => ({
        data: [
          { level: "N1", lesson_count: "2", practiced_count: "0", average_score: null },
          { level: "N5", lesson_count: "18", practiced_count: "15", average_score: "90.6" },
          { level: "N3", lesson_count: "0", practiced_count: "0", average_score: null },
        ],
        error: null,
      }),
    });
    const { getJlptSpeakingSummary } = await import("@/lib/data/pronunciation-metrics");

    await expect(getJlptSpeakingSummary()).resolves.toEqual([
      { level: "N5", lessonCount: 18, practicedCount: 15, averageScore: 91 },
      { level: "N1", lessonCount: 2, practicedCount: 0, averageScore: null },
    ]);
  });

  it("surfaces an RPC failure instead of rendering empty levels", async () => {
    useTables({}, { jlpt_speaking_summary: () => ({ data: null, error: { message: "denied" } }) });
    const { getJlptSpeakingSummary } = await import("@/lib/data/pronunciation-metrics");

    await expect(getJlptSpeakingSummary()).rejects.toMatchObject({ message: "denied" });
  });
});
