import "server-only";
import { rateLimit } from "@/lib/rate-limit";
import { nextStudyDayStart } from "@/lib/time/study-day";
import { getStudyTimezone } from "@/lib/time/study-timezone";
import { authenticateSummary, loadLessonSummary } from "./load-snapshot";

const LIMIT = { limit: 10, windowMs: 60_000 };

export async function scheduleReviewTomorrow(
  videoId: string,
  now = new Date(),
): Promise<
  | { kind: "ok"; scheduled: number; dueAt: string }
  | { kind: "unauthorized" }
  | { kind: "not_found" }
  | { kind: "rate_limited"; retryAfter: number }
> {
  const auth = await authenticateSummary();
  if (!auth) return { kind: "unauthorized" };
  const limited = rateLimit(`summary:review-tomorrow:${auth.userId}`, LIMIT, now.getTime());
  if (!limited.ok) return { kind: "rate_limited", retryAfter: limited.retryAfter };

  const summary = await loadLessonSummary(videoId, auth);
  if (!summary.ok) return summary.status === 401 ? { kind: "unauthorized" } : { kind: "not_found" };

  const dueAt = nextStudyDayStart(now, (await getStudyTimezone()).timeZone).toISOString();
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
