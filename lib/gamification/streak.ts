/**
 * Daily streak logic, VN-local (Asia/Ho_Chi_Minh, UTC+7). The market is
 * VN-only (docs/product/business-model.md), so we use one fixed offset for
 * every user rather than per-user timezones. Pure and deterministic: the
 * caller always passes `now`; nothing here reads the system clock.
 */
import type { StreakState } from "./types";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
/** Asia/Ho_Chi_Minh has been a fixed UTC+7 offset since 1975, with no DST. */
const VN_OFFSET_MS = 7 * MS_PER_HOUR;

/**
 * The VN-local calendar date ('yyyy-MM-dd') for an absolute instant.
 *
 * Because the VN offset is a constant +7h with no DST, the VN calendar date
 * is simply the UTC calendar date of (instant + 7h) — no Intl/timezone
 * database lookup needed, so this is safe to call from any JS runtime
 * regardless of its ICU data.
 */
export function vnDateString(now: Date): string {
  const shifted = new Date(now.getTime() + VN_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

/** Parse a 'yyyy-MM-dd' string as a UTC-midnight Date, for day-difference math only. */
function parseDateOnly(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function daysBetween(a: string, b: string): number {
  const diffMs = parseDateOnly(b).getTime() - parseDateOnly(a).getTime();
  return Math.round(diffMs / MS_PER_DAY);
}

/**
 * Advance a streak given a new activity instant.
 * - Same VN day as `lastActiveDate` -> unchanged.
 * - Exactly the VN-next day -> current + 1.
 * - Anything older (or `lastActiveDate` is null) -> reset to 1.
 * `longest` is always the max of its previous value and the new `current`.
 */
export function advanceStreak(prev: StreakState, now: Date): StreakState {
  const today = vnDateString(now);

  if (prev.lastActiveDate === today) {
    return prev;
  }

  const isConsecutive =
    prev.lastActiveDate !== null && daysBetween(prev.lastActiveDate, today) === 1;

  const current = isConsecutive ? prev.current + 1 : 1;
  const longest = Math.max(prev.longest, current);

  return { current, longest, lastActiveDate: today };
}
