import "server-only";
import { requireAdmin } from "@/lib/admin/guard";
import { isUnderQuota } from "@/lib/data/lesson-library";
import { requireUser } from "@/lib/data/videos";
import { isLessonCreationWorkerEnabled } from "@/lib/lesson-creation/env";
import {
  enqueueLessonCreation,
  getRequesterJob,
  listJobEventsForOwnedJob,
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

export type EnqueueLessonCreationJobResult =
  | { ok: true; data: LessonCreationJobProjection }
  | Refusal<401 | 403 | 503>
  | RateLimited;

export type ReadLessonCreationJobResult =
  | { ok: true; data: LessonCreationJobStatus }
  | Refusal<401 | 403 | 404>;

export type RetryLessonCreationJobResult =
  | { ok: true; data: LessonCreationJobProjection }
  | Refusal<401 | 403 | 404 | 409>;

type Identity = { ok: true; userId: string } | Refusal<401 | 403>;

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
  return admin.ok ? { ok: true, userId: admin.user.id } : { ok: false, status: admin.status };
}

/**
 * `retry_lesson_creation_job` raises `job_not_retryable` under SQLSTATE 23505
 * when the job is not failed, or when another attempt for the same video is
 * already active. It is the only 23505 that RPC can raise — it performs one
 * update against a table with no unique index — so nothing else is being
 * swallowed here. Any other database error is re-thrown.
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

  if (advisory !== undefined && !(await advisory())) return { ok: false, status: 403 };

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
    // Advisory only. `finalize_lesson_creation_job` rechecks the quota under
    // the user's lock and stays authoritative; this just refuses an already
    // exhausted learner quickly instead of doing a doomed pipeline pass (spec §6).
    () => isUnderQuota(requesterId),
  );
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

  const job = await getRequesterJob(jobId, identity.userId);
  if (job === null) return { ok: false, status: 404 };

  // Ownership is established by the line above; only then may history be read.
  return { ok: true, data: { job, events: await listJobEventsForOwnedJob(jobId) } };
}

export async function readLearnerLessonCreationJob(jobId: string): Promise<ReadLessonCreationJobResult> {
  return readFor(await learnerIdentity(), jobId);
}

export async function readAdminLessonCreationJob(jobId: string): Promise<ReadLessonCreationJobResult> {
  return readFor(await adminIdentity(), jobId);
}

async function retryFor(identity: Identity, jobId: string): Promise<RetryLessonCreationJobResult> {
  if (!identity.ok) return identity;

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
  return retryFor(await learnerIdentity(), jobId);
}

export async function retryAdminLessonCreationJob(jobId: string): Promise<RetryLessonCreationJobResult> {
  return retryFor(await adminIdentity(), jobId);
}
