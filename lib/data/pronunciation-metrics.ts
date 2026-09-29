import "server-only";
import { createClient } from "@/lib/supabase/server";
import { JLPT_LEVELS, type JlptLevel } from "@/lib/conversation-types";

export type PronunciationMetric = "accuracy" | "pitch" | "rhythm";
export type PronunciationMetricMeans = Record<PronunciationMetric, number | null>;

interface ScoreMeansRow {
  pronunciation_score: number | string | null;
  pitch_score: number | string | null;
  rhythm_score: number | string | null;
}

const METRIC_COLUMNS: Record<PronunciationMetric, keyof ScoreMeansRow> = {
  accuracy: "pronunciation_score",
  pitch: "pitch_score",
  rhythm: "rhythm_score",
};
const METRIC_ORDER: readonly PronunciationMetric[] = ["accuracy", "pitch", "rhythm"];

/** The lowest measured score; ties intentionally prefer accuracy, then pitch, then rhythm. */
export function weakestPronunciationMetric(means: PronunciationMetricMeans): PronunciationMetric | null {
  return METRIC_ORDER.reduce<PronunciationMetric | null>((weakest, metric) => {
    const candidate = means[metric];
    const current = weakest === null ? null : means[weakest];
    return candidate !== null && (current === null || candidate < current) ? metric : weakest;
  }, null);
}

/**
 * A reusable half-open score window. Task 5 reads this same shape for the
 * preceding week by supplying `[now - 14 days, now - 7 days)`.
 */
export async function getPronunciationMetricWindow(start: Date, end: Date): Promise<{
  means: PronunciationMetricMeans;
  weakest: PronunciationMetric | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("pronunciation_metric_means", {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });
  if (error) throw error;

  const row = (data as ScoreMeansRow[] | null)?.[0];
  const means = Object.fromEntries(METRIC_ORDER.map((metric) => [
    metric,
    row?.[METRIC_COLUMNS[metric]] === null || row?.[METRIC_COLUMNS[metric]] === undefined
      ? null
      : Number(row[METRIC_COLUMNS[metric]]),
  ])) as PronunciationMetricMeans;
  return { means, weakest: weakestPronunciationMetric(means) };
}

/** The caller's rolling seven-day pronunciation read. `now` is injected for deterministic tests. */
export function getWeeklyPronunciationMetrics(now: Date = new Date()) {
  return getPronunciationMetricWindow(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), now);
}


/** One JLPT Speaking card: lessons at the level, how many the caller has shadowed, and the caller's mean score there. */
export interface JlptSpeakingLevel {
  level: JlptLevel;
  lessonCount: number;
  practicedCount: number;
  /** Null until the caller has a scored session at this level; never a stand-in zero. */
  averageScore: number | null;
}

interface JlptSpeakingRow {
  level: JlptLevel;
  lesson_count: number | string;
  practiced_count: number | string;
  average_score: number | string | null;
}

/** The levels holding a lesson the caller can see, N5 first. */
export async function getJlptSpeakingSummary(): Promise<JlptSpeakingLevel[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("jlpt_speaking_summary");
  if (error) throw error;
  const byLevel = new Map(((data as JlptSpeakingRow[] | null) ?? []).map((row) => [row.level, row]));
  return JLPT_LEVELS.flatMap((level) => {
    const row = byLevel.get(level);
    const lessonCount = row ? Number(row.lesson_count) : 0;
    if (!row || lessonCount === 0) return [];
    return [{
      level,
      lessonCount,
      practicedCount: Number(row.practiced_count),
      averageScore: row.average_score === null ? null : Math.round(Number(row.average_score)),
    }];
  });
}
