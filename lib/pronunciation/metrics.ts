export type PronunciationMetric = "accuracy" | "pitch" | "rhythm";
export type PronunciationMetricMeans = Record<PronunciationMetric, number | null>;

export const PRONUNCIATION_METRICS: readonly PronunciationMetric[] = ["accuracy", "pitch", "rhythm"];

/** The lowest measured score; ties intentionally prefer accuracy, then pitch, then rhythm. */
export function weakestPronunciationMetric(means: PronunciationMetricMeans): PronunciationMetric | null {
  return PRONUNCIATION_METRICS.reduce<PronunciationMetric | null>((weakest, metric) => {
    const candidate = means[metric];
    const current = weakest === null ? null : means[weakest];
    return candidate !== null && (current === null || candidate < current) ? metric : weakest;
  }, null);
}
