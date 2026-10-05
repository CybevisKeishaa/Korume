import "server-only";
import { rateLimit } from "@/lib/rate-limit";
import { authenticateSummary, loadLessonSummary } from "./load-snapshot";

const LIMIT = { limit: 10, windowMs: 60_000 };

export function isValidTimeZone(zone: string): boolean {
  if (zone.trim() === "") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function localDay(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * The first instant whose local date is tomorrow. Scans forward in 15-minute steps from 14 h before tomorrow's
 * UTC midnight: every zone offset is a multiple of 15 minutes, so the first step on the new local date is local
 * 00:00 — or, where DST skips midnight, the first local time that exists.
 */
export function nextLocalMidnightUtc(now: Date, timeZone: string): Date {
  const today = localDay(now, timeZone);
  const [year, month, day] = today.split("-").map(Number) as [number, number, number];
  const tomorrow = localDay(new Date(Date.UTC(year, month - 1, day + 1, 12)), "UTC");
  const step = 15 * 60_000;
  for (
    let t = Date.UTC(year, month - 1, day + 1) - 14 * 3_600_000;
    t < Date.UTC(year, month - 1, day + 2) + 14 * 3_600_000;
    t += step
  ) {
    if (t > now.getTime() && localDay(new Date(t), timeZone) === tomorrow) return new Date(t);
  }
  throw new Error(`no local midnight found for ${timeZone}`);
}

export async function scheduleReviewTomorrow(
  videoId: string,
  timeZone: string,
  now = new Date(),
): Promise<
  | { kind: "ok"; scheduled: number; dueAt: string }
  | { kind: "unauthorized" }
  | { kind: "not_found" }
  | { kind: "invalid" }
  | { kind: "rate_limited"; retryAfter: number }
> {
  if (!isValidTimeZone(timeZone)) return { kind: "invalid" };
  const auth = await authenticateSummary();
  if (!auth) return { kind: "unauthorized" };
  const limited = rateLimit(`summary:review-tomorrow:${auth.userId}`, LIMIT, now.getTime());
  if (!limited.ok) return { kind: "rate_limited", retryAfter: limited.retryAfter };

  const summary = await loadLessonSummary(videoId, auth);
  if (!summary.ok) return summary.status === 401 ? { kind: "unauthorized" } : { kind: "not_found" };

  const dueAt = nextLocalMidnightUtc(now, timeZone).toISOString();
  const targets = summary.data.snapshot.reviewTargets.map((target) => ({
    lineId: target.lineId,
    focusSpan: target.focusSpan,
  }));
  if (targets.length === 0) return { kind: "ok", scheduled: 0, dueAt };

  const { data, error } = await auth.supabase.rpc("schedule_review_tomorrow", {
    p_video: videoId,
    p_targets: targets,
    p_due: dueAt,
  });
  if (error) throw error;
  return { kind: "ok", scheduled: Number(data), dueAt };
}
