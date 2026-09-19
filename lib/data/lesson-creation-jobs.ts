import "server-only";
import { requireAdmin } from "@/lib/admin/guard";
import { findExistingLesson, isUnderQuota } from "@/lib/data/lesson-library";
import { requireUser } from "@/lib/data/videos";
import { isLessonCreationWorkerEnabled } from "@/lib/lesson-creation/env";
import {
  enqueueLessonCreation,
  getRequesterJobWithEvents,
  retryRequesterJob,
} from "@/lib/lesson-creation/store";
import type { LessonCreationJobEvent, LessonCreationJobProjection } from "@/lib/lesson-creation/types";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * Authorization, advisory refusals, and identity for the lesson-creation job
 * APIs (spec §8). Everything that decides *whether* a request may queue work
 * lives here; the routes above only turn these results into HTTP.
 *
 * Two rules hold across every function:
 *
 * 1. **The requester is derived, never supplied.** A client can name a video
 *    and (as an admin) an access level. Requester, origin, state, step,
 *    attempt and lease are the server's alone.
 * 2. **Reads and retries are owner-scoped, and a foreign job is indistinguishable
 *    from a missing one.** Both answer 404, so the API is not an oracle for
 *    whether another learner is creating a given lesson.
 */

/** Unchanged from the synchronous importer this replaces: the same user action, the same budget. */
const CREATE_LIMIT = { limit: 20, windowMs: 60_000 };

export interface LessonCreationJobStatus {
  job: LessonCreationJobProjection;
  events: LessonCreationJobEvent[];
}

type Refusal<S extends number> = { ok: false; status: S };
type RateLimited = { ok: false; status: 429; retryAfter: number };

/**
 * Why a 403 happened, so a route never has to infer its copy from the status
 * code alone. The learner path's only 403 is the quota today — but the next
 * one added would silently inherit "Monthly lesson quota reached" without this.
 */
type Forbidden = { ok: false; status: 403; reason: "quota_exceeded" | "not_admin" };

export type EnqueueLessonCreationJobResult =
  | { ok: true; data: LessonCreationJobProjection }
  | Refusal<401 | 503>
  | Forbidden
  | RateLimited;

export type ReadLessonCreationJobResult =
  | { ok: true; data: LessonCreationJobStatus }
  | Refusal<401 | 404>
  | Forbidden;

export type RetryLessonCreationJobResult =
  | { ok: true; data: LessonCreationJobProjection }
  | Refusal<401 | 404 | 409>
  | Forbidden
  | RateLimited;

type Identity = { ok: true; userId: string } | Refusal<401> | Forbidden;

async function learnerIdentity(): Promise<Identity> {
  const user = await requireUser(createClient());
  return user === null ? { ok: false, status: 401 } : { ok: true, userId: user.id };
}

/**
 * Admin jobs are scoped to the admin who requested them, not to the admin
 * role: one admin cannot read or retry another's queue entry (spec §8.2).
 */
async function adminIdentity(): Promise<Identity> {
  const admin = await requireAdmin();
  if (admin.ok) return { ok: true, userId: admin.user.id };
  return admin.status === 401 ? { ok: false, status: 401 } : { ok: false, status: 403, reason: "not_admin" };
}

/**
 * `retry_lesson_creation_job` raises `job_not_retryable` under SQLSTATE 23505
 * when the job is not failed, or when another attempt for the same video is
 * already active. Any other database error is re-thrown.
 *
 * ⚠️ 23505 is also the ordinary unique-violation code, and this table HAS a
 * unique index — `lesson_creation_jobs_active` on
 * `(requester_user_id, youtube_video_id) where state in ('queued','running')`
 * — whose predicate retry's own `set state = 'queued'` writes the row into.
 * What keeps the two apart is not the absence of an index: it is that every
 * function able to put a row into that predicate first takes the requester's
 * row lock (`perform 1 from public.users where id = p_requester for update`,
 * migration lines 87/157/197), and claim/transition/recover only move rows
 * already inside it. That `perform` reads like a no-op; delete it, or add a
 * writer without it, and a genuine unique violation starts reaching a learner
 * as "This job cannot be retried". The durable fix is for the RPC to raise a
 * custom SQLSTATE for the business rule instead of overloading a system code —
 * recorded as a Task 8 item, since it changes an applied migration and needs
 * the live database gate re-run.
 */
function isNotRetryableRejection(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";
}

/**
 * The refusal order every enqueue shares: identity, then budget, then whether
 * the worker exists at all, and only then anything about this particular
 * learner. A disabled service must not answer "you are out of quota".
 */
async function enqueueFor(
  identity: Identity,
  rateLimitKey: string,
  job: Parameters<typeof enqueueLessonCreation>[0],
  advisory?: () => Promise<boolean>,
): Promise<EnqueueLessonCreationJobResult> {
  if (!identity.ok) return identity;

  const limited = rateLimit(rateLimitKey, CREATE_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  // Refuse before recording anything: a job queued while the worker is off
  // would present as pending forever rather than as unavailable (spec §7).
  if (!isLessonCreationWorkerEnabled()) return { ok: false, status: 503 };

  if (advisory !== undefined && !(await advisory())) {
    return { ok: false, status: 403, reason: "quota_exceeded" };
  }

  return { ok: true, data: await enqueueLessonCreation(job) };
}

export async function enqueueLearnerLessonCreationJob(input: {
  youtubeVideoId: string;
}): Promise<EnqueueLessonCreationJobResult> {
  const identity = await learnerIdentity();
  if (!identity.ok) return identity;

  const requesterId = identity.userId;
  return enqueueFor(
    identity,
    `lessons:create:${requesterId}`,
    { requesterId, origin: "learner", requestedAccess: "PRIVATE", youtubeVideoId: input.youtubeVideoId },
    () => mayProceedOnQuota(requesterId, input.youtubeVideoId),
  );
}

/**
 * The advisory quota check (design §6) — deliberately narrower than the
 * authoritative one.
 *
 * `finalize_lesson_creation_job` charges a slot only where no lesson row
 * exists, or where it is PRIVATE and the requester does not already hold it
 * (migration line 212). Design §3 rules 3 and 4 keep that: a visible FREE/PLUS
 * lesson, or one already in the learner's library, costs nothing — so an
 * exhausted learner must still be able to reach it. Refusing those here would
 * be a lie AND would put them out of reach of the importer entirely.
 *
 * So this refuses only the case where a charge is certain: the video has no
 * lesson at all yet. The remaining case — an unheld PRIVATE lesson while
 * exhausted — is left to the worker, which ends the job `failed` with
 * `quota_exceeded`, a truthful terminal state the projection already carries.
 * Restating finalize's three-clause predicate here instead would be a second
 * home for it, and the two would drift (AGENTS.md §6).
 */
async function mayProceedOnQuota(requesterId: string, youtubeVideoId: string): Promise<boolean> {
  if ((await findExistingLesson(youtubeVideoId)) !== null) return true;
  return isUnderQuota(requesterId);
}

export async function enqueueAdminLessonCreationJob(input: {
  youtubeVideoId: string;
  libraryAccess: "FREE" | "PLUS";
}): Promise<EnqueueLessonCreationJobResult> {
  const identity = await adminIdentity();
  if (!identity.ok) return identity;

  const requesterId = identity.userId;
  // No quota check: the learner monthly quota governs personal libraries, and
  // `finalize_lesson_creation_job` applies it to learner-origin jobs only.
  return enqueueFor(identity, `lessons:create:admin:${requesterId}`, {
    requesterId,
    origin: "admin",
    requestedAccess: input.libraryAccess,
    youtubeVideoId: input.youtubeVideoId,
  });
}

async function readFor(identity: Identity, jobId: string): Promise<ReadLessonCreationJobResult> {
  if (!identity.ok) return identity;

  // One call: the store will not read history for a job this caller does not own.
  const found = await getRequesterJobWithEvents(jobId, identity.userId);
  if (found === null) return { ok: false, status: 404 };

  return { ok: true, data: found };
}

export async function readLearnerLessonCreationJob(jobId: string): Promise<ReadLessonCreationJobResult> {
  return readFor(await learnerIdentity(), jobId);
}

export async function readAdminLessonCreationJob(jobId: string): Promise<ReadLessonCreationJobResult> {
  return readFor(await adminIdentity(), jobId);
}

/**
 * A retry resets `attempt_count` to 0 (migration line 164), buying a fresh
 * three-attempt budget of third-party metadata and caption calls. The RPC's
 * "no other active job for this video" rule bounds the loop to about one cycle
 * per worker tick but caps nothing over time, so the retry needs a per-user
 * budget of its own (AGENTS.md §2.6, design §8.1).
 */
async function retryFor(
  identity: Identity,
  jobId: string,
  rateLimitKeyPrefix: string,
): Promise<RetryLessonCreationJobResult> {
  if (!identity.ok) return identity;

  // Built from the identity here, never handed in: a caller that derived the
  // key before knowing who is calling could bucket every user together.
  const limited = rateLimit(`${rateLimitKeyPrefix}${identity.userId}`, CREATE_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  let job: LessonCreationJobProjection | null;
  try {
    job = await retryRequesterJob(jobId, identity.userId);
  } catch (error) {
    if (isNotRetryableRejection(error)) return { ok: false, status: 409 };
    throw error;
  }
  if (job === null) return { ok: false, status: 404 };
  return { ok: true, data: job };
}

export async function retryLearnerLessonCreationJob(jobId: string): Promise<RetryLessonCreationJobResult> {
  return retryFor(await learnerIdentity(), jobId, "lessons:retry:");
}

export async function retryAdminLessonCreationJob(jobId: string): Promise<RetryLessonCreationJobResult> {
  return retryFor(await adminIdentity(), jobId, "lessons:retry:admin:");
}
