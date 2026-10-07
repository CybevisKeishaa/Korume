import { addDays, isoWeekday, studyDate, studyDayStart } from "@/lib/time/study-day";

/** One shared competition week for every learner, independent of study timezone. */
export const LEADERBOARD_WEEK_TIMEZONE = "Asia/Ho_Chi_Minh";

/** Instant of the most recent Monday 00:00 in the shared competition zone. */
export function mondayStartUtc(now: Date): Date {
  const today = studyDate(now, LEADERBOARD_WEEK_TIMEZONE);
  return studyDayStart(addDays(today, 1 - isoWeekday(today)), LEADERBOARD_WEEK_TIMEZONE);
}
