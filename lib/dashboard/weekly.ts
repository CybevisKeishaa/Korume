import { addDays } from "@/lib/time/study-day";

export const WEEKLY_WINDOWS = 10;
export const WEEKLY_SIGNIFICANT_POINTS = 5;
export const MIN_SKILL_EVIDENCE = 3;
export interface WeekWindow { index: number; from: string; to: string }
export type WeeklyBar = { index: number; seconds: number } | { index: number; unavailable: true };
export interface SkillWindowStat { skill: "listening" | "pronunciation"; window: 0 | 1; attempts: number; mean: number | null }

export function weeklyWindows(today: string): WeekWindow[] {
  return Array.from({ length: WEEKLY_WINDOWS }, (_, index) => ({ index, from: addDays(today, -6 - index * 7), to: addDays(today, -index * 7) }));
}

export function weeklyBars(windows: readonly WeekWindow[], days: readonly { day: string; seconds: number }[], trackedSinceDate: string | null): WeeklyBar[] {
  return windows.map((window) => {
    if (trackedSinceDate === null || window.to < trackedSinceDate) return { index: window.index, unavailable: true };
    return { index: window.index, seconds: days.filter((day) => day.day >= window.from && day.day <= window.to).reduce((total, day) => total + day.seconds, 0) };
  });
}

export function weeklyDelta(stats: readonly SkillWindowStat[], skill: SkillWindowStat["skill"]): number | null {
  const current = stats.find((stat) => stat.skill === skill && stat.window === 0);
  const previous = stats.find((stat) => stat.skill === skill && stat.window === 1);
  if (!current || !previous || current.attempts < MIN_SKILL_EVIDENCE || previous.attempts < MIN_SKILL_EVIDENCE || current.mean === null || previous.mean === null) return null;
  return Math.round(current.mean - previous.mean);
}
