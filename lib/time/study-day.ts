/** Canonical timezone-aware calendar days, shared by server and client. */
export const FALLBACK_STUDY_TIMEZONE = "Asia/Ho_Chi_Minh";
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const formatters = new Map<string, Intl.DateTimeFormat>();
function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export function canonicalTimeZone(input: string): string | null {
  if (input.trim() === "" || input.length > 64) return null;
  try {
    return new Intl.DateTimeFormat("en", { timeZone: input }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function studyDate(instant: Date, timeZone: string): string {
  return dayFormatter(timeZone).format(instant);
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function isoWeekday(date: string): IsoWeekday {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (day === 0 ? 7 : day) as IsoWeekday;
}

/** First existing instant of the local date, including dates whose midnight is skipped. */
export function studyDayStart(date: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const step = 15 * 60_000;
  const from = Date.UTC(year, month - 1, day) - 14 * 3_600_000;
  const to = Date.UTC(year, month - 1, day + 1) + 14 * 3_600_000;
  for (let t = from; t < to; t += step) {
    if (studyDate(new Date(t), timeZone) === date) return new Date(t);
  }
  throw new Error(`no local midnight found for ${timeZone} on ${date}`);
}

export function nextStudyDayStart(instant: Date, timeZone: string): Date {
  return studyDayStart(addDays(studyDate(instant, timeZone), 1), timeZone);
}

export function studyDaysAgo(instant: Date, now: Date, timeZone: string): number {
  return daysBetween(studyDate(instant, timeZone), studyDate(now, timeZone));
}
