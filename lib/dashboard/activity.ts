import { addDays, isoWeekday, type IsoWeekday } from "@/lib/time/study-day";

export const ACTIVITY_DAYS = 56;
export const ACTIVITY_THRESHOLDS = [1, 5, 15, 30] as const;
export type ActivityCell = { date: string; state: "unavailable" | "rest" | "empty" | "active"; level: 0 | 1 | 2 | 3 | 4; count: number };

function level(count: number): ActivityCell["level"] {
  if (count >= ACTIVITY_THRESHOLDS[3]) return 4;
  if (count >= ACTIVITY_THRESHOLDS[2]) return 3;
  if (count >= ACTIVITY_THRESHOLDS[1]) return 2;
  return count >= ACTIVITY_THRESHOLDS[0] ? 1 : 0;
}

export function buildActivityGrid(input: { today: string; counts: ReadonlyMap<string, number>; scheduleDays: readonly IsoWeekday[]; firstTrackedDate: string }): ActivityCell[] {
  const start = addDays(input.today, 1 - ACTIVITY_DAYS);
  return Array.from({ length: ACTIVITY_DAYS }, (_, index) => {
    const date = addDays(start, index);
    const count = input.counts.get(date) ?? 0;
    if (date < input.firstTrackedDate) return { date, state: "unavailable", level: 0, count: 0 };
    if (count > 0) return { date, state: "active", level: level(count), count };
    return { date, state: input.scheduleDays.includes(isoWeekday(date)) ? "empty" : "rest", level: 0, count: 0 };
  });
}
