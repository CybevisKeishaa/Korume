import "server-only";
import { createClient } from "@/lib/supabase/server";

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
