import { PRONUNCIATION_METRICS, weakestPronunciationMetric, type PronunciationMetric } from "@/lib/pronunciation/metrics";
import { MIN_SKILL_EVIDENCE } from "./weekly";

export type WeaknessFamily = "listening" | "reading" | "pronunciation";
export interface WeaknessScoreRow { family: WeaknessFamily; metric: string; attempts: number; score: number }
export interface WeaknessRow { family: WeaknessFamily; metric: "accuracy" | "score" | PronunciationMetric; score: number }

export function weaknessRows(rows: readonly WeaknessScoreRow[]): WeaknessRow[] {
  const eligible = rows.filter((row) => row.attempts >= MIN_SKILL_EVIDENCE);
  const pronunciation = eligible.filter((row) => row.family === "pronunciation");
  const means = Object.fromEntries(PRONUNCIATION_METRICS.map((metric) => [metric, pronunciation.find((row) => row.metric === metric)?.score ?? null])) as Record<PronunciationMetric, number | null>;
  const weakest = weakestPronunciationMetric(means);
  const selected = eligible.filter((row) => row.family !== "pronunciation").concat(weakest === null ? [] : pronunciation.filter((row) => row.metric === weakest));
  return selected.sort((left, right) => left.score - right.score).slice(0, 3).map((row) => ({ family: row.family, metric: row.metric as WeaknessRow["metric"], score: row.score }));
}
