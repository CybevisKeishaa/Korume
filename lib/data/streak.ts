import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { studyDate } from "@/lib/time/study-day";
import type { IsoWeekday } from "@/lib/time/study-day";

export interface Streak {
  current: number;
  longest: number;
  /** The learner's last local study date, 'yyyy-MM-dd', or null. */
  lastActiveDate: string | null;
}

/** The streak is derived (SQL `study_streak`) from learning_outcomes in the current zone and schedule; nothing is stored. */
export async function getStreak(
  supabase: SupabaseClient,
  userId: string,
  timeZone: string,
  scheduleDays: readonly IsoWeekday[],
  now: Date = new Date(),
): Promise<Streak> {
  const { data, error } = await supabase.rpc("study_streak", {
    p_user: userId,
    p_tz: timeZone,
    p_schedule: [...scheduleDays],
    p_today: studyDate(now, timeZone),
  });
  if (error) throw error;
  const row = (data as { current_streak: number; longest_streak: number; last_active: string | null }[] | null)?.[0];
  return { current: row?.current_streak ?? 0, longest: row?.longest_streak ?? 0, lastActiveDate: row?.last_active ?? null };
}
