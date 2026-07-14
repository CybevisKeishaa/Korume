/**
 * Weekly leaderboard window: "this week" starts Monday 00:00 VN-local
 * (Asia/Ho_Chi_Minh, UTC+7) — same fixed-offset convention as the daily
 * streak (`lib/gamification/streak.ts::vnDateString`), mirrored here rather
 * than imported so this module has no dependency on the gamification core.
 * Pure and deterministic: callers always pass `now`; nothing here reads the
 * system clock.
 */

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
/** Asia/Ho_Chi_Minh has been a fixed UTC+7 offset since 1975, with no DST. */
const VN_OFFSET_MS = 7 * MS_PER_HOUR;

/**
 * The absolute instant (UTC) of the most recent Monday 00:00 VN-local time,
 * relative to `now`. If `now` itself falls on a Monday, returns that same
 * day's start (i.e. the window includes "today so far").
 *
 * Method: shift `now` into VN-local wall-clock time to read off its calendar
 * date and weekday, walk back to that week's Monday in date-string space
 * (pure calendar math, DST-free), then shift the resulting VN-local midnight
 * back into an absolute UTC instant by subtracting the offset again.
 */
export function mondayStartUtc(now: Date): Date {
  const vnLocal = new Date(now.getTime() + VN_OFFSET_MS);
  const todayDateString = vnLocal.toISOString().slice(0, 10);

  // getUTCDay() on a date-only string (parsed as UTC midnight) reads off the
  // correct weekday for that calendar date: 0=Sun, 1=Mon, ..., 6=Sat.
  const dow = new Date(`${todayDateString}T00:00:00.000Z`).getUTCDay();
  const daysSinceMonday = (dow + 6) % 7; // Mon->0, Tue->1, ..., Sun->6

  const mondayLocalMidnightAsUtc = new Date(`${todayDateString}T00:00:00.000Z`).getTime() - daysSinceMonday * MS_PER_DAY;

  // `mondayLocalMidnightAsUtc` is still expressed as if the VN-local midnight
  // were itself a UTC instant (same trick as `vnDateString`'s inverse) — undo
  // the earlier +7h shift to get the true UTC instant of VN-local Monday 00:00.
  return new Date(mondayLocalMidnightAsUtc - VN_OFFSET_MS);
}
