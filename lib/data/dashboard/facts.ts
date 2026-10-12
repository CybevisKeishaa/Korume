import "server-only";
import * as React from "react";
import { getRecommendations } from "@/lib/data/recommendations";
import { getStreak, type Streak } from "@/lib/data/streak";
import { getStudyTime, getTrackedSince } from "@/lib/data/study-time";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_DAYS, buildActivityGrid, type ActivityCell } from "@/lib/dashboard/activity";
import { weeklyBars, weeklyDelta, weeklyWindows, type SkillWindowStat, type WeeklyBar } from "@/lib/dashboard/weekly";
import { weaknessRows, type WeaknessFamily, type WeaknessRow, type WeaknessScoreRow } from "@/lib/dashboard/weakness";
import { MASTERY_THRESHOLD } from "@/lib/data/difficulty";
import { addDays, nextStudyDayStart, studyDate, studyDayStart } from "@/lib/time/study-day";
import { getCurriculumJourney, getCurriculumPlacement } from "./journey";
import type { DashboardContext } from "./context";

const cache: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn);

interface ActivityDayRow { day: string; outcomes: number }
interface WeeklySkillRow { skill: "listening" | "pronunciation"; win: 0 | 1; attempts: number; mean: number | string | null }
interface PracticeActivityRow { type: string; last_video_id: string | null }
interface LearnerVideoRow { id: string; title: string; duration_seconds: number | null; last_watched_position: number; jlpt_level_estimate: string | null; situation_id: string | null; source_id: string | null }
/** `situations`/`sources` values are taxonomy slugs labelled by the shadowing catalog; `jlpt` is shown as-is. */
export interface ContinueTag { kind: "jlpt" | "situations" | "sources"; value: string }

export type ContinueView =
  | { kind: "continue"; videoId: string; title: string; placement: { title: string; position: number } | null; percent: number | null; remainingMinutes: number | null; tags: ContinueTag[] }
  | { kind: "startNext"; videoId: string; title: string; placement: { title: string; position: number } | null }
  | { kind: "recommended"; videoId: string; title: string }
  | { kind: "onboarding" };

export const getStreakFact = cache(async (context: DashboardContext): Promise<Streak> =>
  getStreak(createClient(), context.userId, context.timeZone, context.scheduleDays, context.now));

export const getActivityFact = cache(async (context: DashboardContext): Promise<ActivityCell[]> => {
  const from = addDays(context.today, 1 - ACTIVITY_DAYS);
  const supabase = createClient();
  const [activity, instrumented] = await Promise.all([
    supabase.rpc("activity_days", { p_tz: context.timeZone, p_from: from, p_to: context.today }),
    supabase.rpc("learning_outcomes_instrumented_since", {}),
  ]);
  if (activity.error) throw activity.error;
  if (instrumented.error) throw instrumented.error;
  const counts = new Map(((activity.data as ActivityDayRow[] | null) ?? []).map((row) => [row.day, Number(row.outcomes)]));
  const created = studyDate(new Date(context.createdAt), context.timeZone);
  const boundary = instrumented.data ? studyDate(new Date(instrumented.data as string), context.timeZone) : created;
  const firstTrackedDate = [from, created, boundary].sort().at(-1) ?? from;
  return buildActivityGrid({ today: context.today, counts, scheduleDays: context.scheduleDays, firstTrackedDate });
});

export interface StudyTimeFact { bars: WeeklyBar[]; hoursW0: number; trackedSinceDate: string | null }

export const getStudyTimeFact = cache(async (context: DashboardContext): Promise<StudyTimeFact> => {
  const windows = weeklyWindows(context.today);
  const oldest = windows.at(-1);
  if (!oldest) return { bars: [], hoursW0: 0, trackedSinceDate: null };
  const [time, trackedSince] = await Promise.all([
    getStudyTime(studyDayStart(oldest.from, context.timeZone), nextStudyDayStart(context.now, context.timeZone)),
    getTrackedSince(),
  ]);
  const trackedSinceDate = trackedSince ? studyDate(new Date(trackedSince), context.timeZone) : null;
  const bars = weeklyBars(windows, time.days, trackedSinceDate);
  const current = bars.find((bar) => bar.index === 0);
  return { bars, hoursW0: current && "seconds" in current ? Math.round(current.seconds / 360) / 10 : 0, trackedSinceDate };
});

export interface WeeklyFacts extends StudyTimeFact { vocabularyMastered: number; listeningDelta: number | null; pronunciationDelta: number | null }

export const getWeeklyFacts = cache(async (context: DashboardContext): Promise<WeeklyFacts> => {
  const windows = weeklyWindows(context.today);
  const current = windows[0];
  const previous = windows[1];
  if (!current || !previous) {
    return { bars: [], hoursW0: 0, trackedSinceDate: null, vocabularyMastered: 0, listeningDelta: null, pronunciationDelta: null };
  }
  const [study, skills, mastery] = await Promise.all([
    getStudyTimeFact(context),
    createClient().rpc("weekly_skill_windows", { p_tz: context.timeZone, p_w1_from: previous.from, p_w0_from: current.from, p_to: current.to }),
    createClient().rpc("newly_mastered_count", {
      p_mastery: MASTERY_THRESHOLD,
      p_from: studyDayStart(current.from, context.timeZone).toISOString(),
      p_to: nextStudyDayStart(context.now, context.timeZone).toISOString(),
    }),
  ]);
  if (skills.error) throw skills.error;
  if (mastery.error) throw mastery.error;
  const stats: SkillWindowStat[] = ((skills.data as WeeklySkillRow[] | null) ?? []).map((row) => ({
    skill: row.skill, window: row.win, attempts: Number(row.attempts), mean: row.mean === null ? null : Number(row.mean),
  }));
  return {
    ...study,
    vocabularyMastered: Number(mastery.data ?? 0),
    listeningDelta: weeklyDelta(stats, "listening"),
    pronunciationDelta: weeklyDelta(stats, "pronunciation"),
  };
});

export type WeaknessFact = WeaknessRow & { practiceHref: string | null };

export const getWeaknessFacts = cache(async (context: DashboardContext): Promise<WeaknessFact[]> => {
  const since = studyDayStart(addDays(context.today, -29), context.timeZone).toISOString();
  const [scores, activity, continuation] = await Promise.all([
    createClient().rpc("weakness_scores", { p_tz: context.timeZone, p_dates: 30 }),
    createClient().rpc("practice_activity", { p_since: since }),
    getContinueLearning(context),
  ]);
  if (scores.error) throw scores.error;
  if (activity.error) throw activity.error;
  const practiceRows = (activity.data as PracticeActivityRow[] | null) ?? [];
  const d5VideoId = continuation.kind === "continue" ? continuation.videoId : null;
  const fallback = (family: WeaknessFamily): string | null => {
    if (d5VideoId) return d5VideoId;
    const type = family === "listening" ? "dictation_lines" : "shadow_lines";
    return practiceRows.find((row) => row.type === type)?.last_video_id ?? null;
  };
  return weaknessRows((scores.data as WeaknessScoreRow[] | null) ?? []).map((row) => {
    const videoId = row.family === "reading" ? null : fallback(row.family);
    return { ...row, score: Math.round(row.score), practiceHref: videoId ? `/shadowing/${videoId}${row.family === "listening" ? "/dictation" : ""}` : null };
  });
});

export const getContinueLearning = cache(async (context: DashboardContext): Promise<ContinueView> => {
  void context;
  const supabase = createClient();
  const { data, error } = await supabase.from("learner_videos")
    .select("id, title, duration_seconds, last_watched_position, jlpt_level_estimate, situation_id, source_id").eq("in_progress", true)
    .order("in_progress_last_watched_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (error) throw error;
  const video = data as LearnerVideoRow | null;
  if (video) {
    const [placement, situation, source] = await Promise.all([
      getCurriculumPlacement(video.id),
      video.situation_id ? supabase.from("lesson_situations").select("slug").eq("id", video.situation_id).maybeSingle() : null,
      video.source_id ? supabase.from("lesson_sources").select("slug").eq("id", video.source_id).maybeSingle() : null,
    ]);
    if (situation?.error) throw situation.error;
    if (source?.error) throw source.error;
    const tags = ([
      ["jlpt", video.jlpt_level_estimate],
      ["situations", (situation?.data as { slug: string } | null)?.slug],
      ["sources", (source?.data as { slug: string } | null)?.slug],
    ] as const).flatMap(([kind, value]): ContinueTag[] => value ? [{ kind, value }] : []);
    const duration = video.duration_seconds;
    const validDuration = duration !== null && duration > 0;
    const position = Math.max(0, video.last_watched_position);
    return {
      kind: "continue", videoId: video.id, title: video.title, placement,
      percent: validDuration && duration !== null ? Math.min(100, Math.round(100 * position / duration)) : null,
      remainingMinutes: validDuration && duration !== null ? Math.max(0, Math.ceil((duration - position) / 60)) : null,
      tags,
    };
  }
  const journey = await getCurriculumJourney();
  if (journey.kind === "active" && journey.next) {
    return { kind: "startNext", videoId: journey.next.videoId, title: journey.next.title, placement: await getCurriculumPlacement(journey.next.videoId) };
  }
  const recommendations = await getRecommendations({ limit: 1 });
  const recommendation = recommendations.ok ? recommendations.data[0] : null;
  return recommendation ? { kind: "recommended", videoId: recommendation.videoId, title: recommendation.title } : { kind: "onboarding" };
});
