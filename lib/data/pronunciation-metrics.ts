import "server-only";
import { createClient } from "@/lib/supabase/server";
import { JLPT_LEVELS, type JlptLevel } from "@/lib/conversation-types";
import { vnDateString } from "@/lib/gamification/streak";

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

const DAY_MS = 24 * 60 * 60 * 1000;

/** The caller's rolling seven-day pronunciation read. `now` is injected for deterministic tests. */
export function getWeeklyPronunciationMetrics(now: Date = new Date()) {
  return getPronunciationMetricWindow(new Date(now.getTime() - 7 * DAY_MS), now);
}

/** Midnight of the VN-local day holding `instant` (the streak's fixed UTC+7 day). */
export function vnDayStart(instant: Date): Date {
  return new Date(`${vnDateString(instant)}T00:00:00+07:00`);
}

/** Whole VN-local days from `instant` to `now`: 0 today, 1 yesterday. */
export function vnDaysAgo(instant: Date, now: Date): number {
  return Math.round((vnDayStart(now).getTime() - vnDayStart(instant).getTime()) / DAY_MS);
}

/** Today's Speaking: what the caller did since VN-local midnight. */
export interface TodaySpeaking {
  /** Reference length of the lines shadowed today; a measured 0 when none. */
  minutes: number;
  /** Lessons whose completion was stamped today. */
  lessonsCompleted: number;
  averageScore: number | null;
}

export async function getTodaySpeaking(now: Date = new Date()): Promise<TodaySpeaking> {
  const supabase = createClient();
  const start = vnDayStart(now);
  const [seconds, completed, window] = await Promise.all([
    supabase.rpc("pronunciation_speaking_seconds", { p_start: start.toISOString(), p_end: now.toISOString() }),
    // RLS scopes progress to the caller; a day's completions stay far below max_rows.
    supabase.from("user_video_progress").select("video_id")
      .gte("completed_at", start.toISOString()).lt("completed_at", now.toISOString()),
    getPronunciationMetricWindow(start, now),
  ]);
  if (seconds.error) throw seconds.error;
  if (completed.error) throw completed.error;
  return {
    minutes: Math.round(Number(seconds.data ?? 0) / 60),
    lessonsCompleted: ((completed.data as { video_id: string }[] | null) ?? []).length,
    averageScore: window.means.accuracy === null ? null : Math.round(window.means.accuracy),
  };
}

/** Weekly Improvement: each metric's move from last week to this one, and the daily trend. */
export interface WeeklyImprovement {
  /** This week's mean minus last week's, in score points; null when either week has none. */
  deltas: PronunciationMetricMeans;
  /** Mean score per VN-local day, the 14 whole days ending today; days without a score are absent. */
  trend: { day: string; score: number }[];
}

export async function getWeeklyImprovement(now: Date = new Date()): Promise<WeeklyImprovement> {
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY_MS);
  const supabase = createClient();
  const [current, previous, daily] = await Promise.all([
    getPronunciationMetricWindow(weekAgo, now),
    getPronunciationMetricWindow(twoWeeksAgo, weekAgo),
    // Whole VN days, so the oldest point is not an average of a partial day.
    supabase.rpc("pronunciation_daily_means", { p_start: vnDayStart(new Date(now.getTime() - 13 * DAY_MS)).toISOString(), p_end: now.toISOString() }),
  ]);
  if (daily.error) throw daily.error;
  const deltas = Object.fromEntries(METRIC_ORDER.map((metric) => {
    const [thisWeek, lastWeek] = [current.means[metric], previous.means[metric]];
    return [metric, thisWeek === null || lastWeek === null ? null : Math.round(thisWeek - lastWeek)];
  })) as PronunciationMetricMeans;
  const trend = ((daily.data as { day: string; pronunciation_score: number | string }[] | null) ?? [])
    .map((row) => ({ day: row.day, score: Math.round(Number(row.pronunciation_score)) }));
  return { deltas, trend };
}

/** One Recently Practiced row. */
export interface RecentPractice {
  lesson: { id: string; title: string };
  practicedAt: string;
  /** Mean over that lesson's sessions on the day of its last practice. */
  averageScore: number | null;
}

export async function getRecentPractice(limit = 3): Promise<RecentPractice[]> {
  const supabase = createClient();
  // ponytail: over-fetches by 3 because a lesson RLS now hides still holds a slot in the SQL
  // limit; more than 3 hidden among the newest shows fewer rows. Filter in SQL if that bites.
  const { data, error } = await supabase.rpc("pronunciation_recent_practice", { p_limit: limit + 3 });
  if (error) throw error;
  const rows = (data as { video_id: string; practiced_at: string; pronunciation_score: number | string | null }[] | null) ?? [];
  if (!rows.length) return [];
  // A lesson the caller can no longer see (RLS) drops out rather than showing an id.
  const { data: videos, error: videoError } = await supabase.from("videos").select("id, title").in("id", rows.map((row) => row.video_id));
  if (videoError) throw videoError;
  const titleById = new Map(((videos as { id: string; title: string }[] | null) ?? []).map((video) => [video.id, video.title]));
  return rows.flatMap((row) => {
    const title = titleById.get(row.video_id);
    return title === undefined ? [] : [{
      lesson: { id: row.video_id, title },
      practicedAt: row.practiced_at,
      averageScore: row.pronunciation_score === null ? null : Math.round(Number(row.pronunciation_score)),
    }];
  }).slice(0, limit);
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
