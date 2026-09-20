import "server-only";
import { z } from "zod";
import type { FuriganaSegment } from "@/lib/japanese/types";
import { createServiceClient } from "@/lib/supabase/service";
import {
  lessonCreationJobEventSchema, lessonCreationJobProjectionSchema,
  type LessonCreationErrorCode, type LessonCreationJobEvent, type LessonCreationJobProjection, type LessonCreationStep,
} from "./types";

export type EnqueueLessonCreationInput = {
  requesterId: string;
  youtubeVideoId: string;
} & ({ origin: "learner"; requestedAccess: "PRIVATE" } | { origin: "admin"; requestedAccess: "FREE" | "PLUS" });

export type EnqueueResult = LessonCreationJobProjection;
export type RetryResult = LessonCreationJobProjection | null;
export type FinalizeOutcome = LessonCreationJobProjection | null;

const leaseSeconds = 120;
const publicColumns = "id,state,step,attempt_count,lesson_id,public_error_code,updated_at";
const publicEventColumns = "state,step,attempt_count,public_error_code,created_at";
const rowSchema = z.record(z.unknown());
const privateClaimSchema = z.object({
  requesterId: z.string().uuid(),
  youtubeVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  leaseToken: z.string().uuid(),
  leaseExpiresAt: z.string().datetime({ offset: true }),
}).and(z.discriminatedUnion("origin", [
  z.object({ origin: z.literal("learner"), requestedAccess: z.literal("PRIVATE") }),
  z.object({ origin: z.literal("admin"), requestedAccess: z.enum(["FREE", "PLUS"]) }),
]));

/** Worker-only envelope: only `job` may be passed to a public consumer. */
export type ClaimedLessonCreationJob = z.infer<typeof privateClaimSchema> & {
  job: LessonCreationJobProjection;
};

export interface TransitionClaimedJobInput {
  jobId: string;
  leaseToken: string;
  step: Exclude<LessonCreationStep, "ready">;
  availableAt?: string | null;
  error?: LessonCreationErrorCode | null;
}

/** Captions must already be sanitized and validated by the transcript pipeline. */
export interface LessonCreationContent {
  title: string;
  thumbnailUrl: string | null;
  source: "youtube_caption";
  lines: {
    startTime: number;
    endTime: number | null;
    textJp: string;
    textTranslation: string | null;
    furiganaJson: FuriganaSegment[] | null;
  }[];
}

export interface FinalizeClaimedJobInput {
  jobId: string;
  requesterId: string;
  leaseToken: string;
  lessonId: string | null;
  content?: LessonCreationContent | null;
}

function projectRow(data: unknown): LessonCreationJobProjection {
  const row = rowSchema.parse(data);
  // Explicit projection is necessary: RPC composites also contain private lease/requester fields.
  return lessonCreationJobProjectionSchema.parse({
    id: row.id,
    state: row.state,
    step: row.step,
    attemptCount: row.attempt_count,
    lessonId: row.lesson_id,
    publicErrorCode: row.public_error_code,
    updatedAt: row.updated_at,
  });
}

async function callRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const client = createServiceClient();
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
}

/**
 * Whether an RPC answered "no row".
 *
 * ⚠️ PostgREST does not render a composite NULL as JSON `null`. A plpgsql
 * function declared `returns public.lesson_creation_jobs` that does
 * `return null` — which claim, retry and finalize all do — comes back as an
 * object with EVERY column null. Checking `data === null` alone therefore
 * misses the empty case and hands a row of nulls to the projection parser: the
 * worker threw a ZodError on every idle pass until the C4 browser run showed
 * it, because the unit fixtures used a literal `null` the database never sends.
 */
function isAbsentRow(data: unknown): boolean {
  if (data === null || data === undefined) return true;
  if (typeof data !== "object" || Array.isArray(data)) return false;
  const values = Object.values(data as Record<string, unknown>);
  return values.length > 0 && values.every((value) => value === null);
}

/** Service-role dedup may inspect private lessons; only a boolean leaves this lookup. */
export async function hasStudyableLessonTranscript(lessonId: string): Promise<boolean> {
  const client = createServiceClient();
  // Match getTranscript and finalization: an older complete header cannot hide a newer empty one.
  const { data: header, error: headerError } = await client.from("transcripts")
    .select("id").eq("video_id", lessonId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (headerError) throw headerError;
  if (header === null) return false;
  const transcript = z.object({ id: z.string().uuid() }).strict().parse(header);
  const { data: line, error: lineError } = await client.from("transcript_lines")
    .select("id").eq("transcript_id", transcript.id).limit(1).maybeSingle();
  if (lineError) throw lineError;
  if (line === null) return false;
  z.object({ id: z.string().uuid() }).strict().parse(line);
  return true;
}

export async function enqueueLessonCreation(input: EnqueueLessonCreationInput): Promise<EnqueueResult> {
  return projectRow(await callRpc("enqueue_lesson_creation_job", {
    p_requester: input.requesterId,
    p_origin: input.origin,
    p_access: input.requestedAccess,
    p_youtube_video_id: input.youtubeVideoId,
  }));
}

export async function getRequesterJob(jobId: string, requesterId: string): Promise<LessonCreationJobProjection | null> {
  // Service role bypasses RLS: caller supplies the authenticated requester, and both filters are mandatory.
  const client = createServiceClient();
  const { data, error } = await client.from("lesson_creation_jobs")
    .select(publicColumns)
    .eq("id", jobId)
    .eq("requester_user_id", requesterId)
    .maybeSingle();
  if (error) throw error;
  return data === null ? null : projectRow(data);
}

/**
 * A retried job accumulates history without limit, and every poll re-sends it.
 * Sixty rows is roughly ten attempts' worth — far more than the presentation
 * needs (it reads only the current attempt) and enough that the cap is never
 * reached in an ordinary life. The newest rows are the ones kept.
 */
const maxEventHistory = 60;

/**
 * One job and its append-only transition history, oldest first — or `null` if
 * the caller does not own it.
 *
 * Both reads live in one function on purpose. The events table carries no
 * requester column and this client bypasses RLS, so a history read is only
 * safe once the job lookup has proven ownership. Exposing the history read on
 * its own would make "forgot to check first" a mistake someone can make; here
 * it is not expressible.
 */
export async function getRequesterJobWithEvents(
  jobId: string,
  requesterId: string,
): Promise<{ job: LessonCreationJobProjection; events: LessonCreationJobEvent[] } | null> {
  const job = await getRequesterJob(jobId, requesterId);
  if (job === null) return null;

  const client = createServiceClient();
  const { data, error } = await client.from("lesson_creation_job_events")
    .select(publicEventColumns)
    .eq("job_id", jobId)
    .order("id", { ascending: false })
    .limit(maxEventHistory);
  if (error) throw error;
  const events = z.array(rowSchema).parse(data).map((row) => lessonCreationJobEventSchema.parse({
    state: row.state,
    step: row.step,
    attemptCount: row.attempt_count,
    publicErrorCode: row.public_error_code,
    createdAt: row.created_at,
  }));
  // Queried newest-first so the cap keeps the newest; consumers read oldest-first.
  return { job, events: events.reverse() };
}

export async function retryRequesterJob(jobId: string, requesterId: string): Promise<RetryResult> {
  const data = await callRpc("retry_lesson_creation_job", { p_job_id: jobId, p_requester: requesterId });
  return isAbsentRow(data) ? null : projectRow(data);
}

export async function claimNextLessonCreationJob(now: string): Promise<ClaimedLessonCreationJob | null> {
  const data = await callRpc("claim_lesson_creation_job", { p_now: now, p_lease_seconds: leaseSeconds });
  if (isAbsentRow(data)) return null;
  const job = projectRow(data);
  const row = rowSchema.parse(data);
  z.literal("running").parse(job.state);
  const privateFields = privateClaimSchema.parse({
    requesterId: row.requester_user_id,
    origin: row.origin,
    requestedAccess: row.requested_library_access,
    youtubeVideoId: row.youtube_video_id,
    leaseToken: row.lease_token,
    leaseExpiresAt: row.lease_expires_at,
  });
  return { job, ...privateFields };
}

export class LessonCreationJobVanishedError extends Error {
  constructor(jobId: string) {
    super(`Lesson-creation job ${jobId} no longer exists.`);
    this.name = "LessonCreationJobVanishedError";
  }
}

export async function transitionClaimedJob(input: TransitionClaimedJobInput): Promise<void> {
  // A missing row must not look like a completed transition — and it arrives as
  // PostgREST's all-null composite, so it needs `isAbsentRow` like its siblings.
  // Naming it beats letting a raw ZodError out: the only realistic cause is the
  // requester deleting their account mid-flight (FK cascade).
  const data = await callRpc("transition_lesson_creation_job", {
    p_job_id: input.jobId,
    p_expected_state: "running",
    p_step: input.step,
    p_available_at: input.availableAt ?? null,
    p_error: input.error ?? null,
    p_lease_token: input.leaseToken,
    p_lease_seconds: leaseSeconds,
  });
  if (isAbsentRow(data)) throw new LessonCreationJobVanishedError(input.jobId);
  projectRow(data);
}

export async function finalizeClaimedJob(input: FinalizeClaimedJobInput): Promise<FinalizeOutcome> {
  const content = input.content;
  const data = await callRpc("finalize_lesson_creation_job", {
    p_job_id: input.jobId,
    p_lesson_id: input.lessonId,
    p_requester: input.requesterId,
    p_lease_token: input.leaseToken,
    p_content: content == null ? null : {
      title: content.title,
      thumbnail_url: content.thumbnailUrl,
      source: content.source,
      lines: content.lines.map((line) => ({
        start_time: line.startTime,
        end_time: line.endTime,
        text_jp: line.textJp,
        text_translation: line.textTranslation,
        furigana_json: line.furiganaJson,
      })),
    },
  });
  return isAbsentRow(data) ? null : projectRow(data);
}

export async function recoverExpiredLessonCreationJobs(now: string): Promise<number> {
  return z.number().int().nonnegative().parse(
    await callRpc("recover_expired_lesson_creation_jobs", { p_now: now }),
  );
}
/**
 * How long a `queued` job may sit untouched before it is failed as unreachable
 * (review finding I2).
 *
 * It is generous on purpose. A queue that is merely busy must never be declared
 * dead — that is why the client-side poll budget was removed — so the SQL pairs
 * this window with a second condition the number cannot express: whether a worker
 * acted inside it, read from the `running` rows in the event history. Every path
 * that writes one either mints a lease (`claim`) or presents a live matching one
 * (`transition`), so such an event means a worker was alive in the window, however
 * long the backlog is. The window is several times the lease and the backoff
 * ceiling, both of which live in this file and in `worker.ts`.
 *
 * Passed as an RPC argument rather than written into the migration, so the window
 * keeps one home (AGENTS.md §6) and needs no pin of its own.
 */
export const STALE_QUEUED_JOB_SECONDS = 600;

/**
 * Fail one queued job no live worker can still be reaching — the job the learner
 * is polling, after the read above it has proven ownership. Returns 1 if it ended
 * that row, 0 otherwise.
 *
 * Scoped to a single job because that is the only shape production needs: the
 * worker pass must NOT sweep (see `runLessonCreationPass`), because every row it
 * could reach is a row it can claim. The SQL keeps a queue-wide form for the live
 * gate and for the deferred enqueue-path rule; no TypeScript calls it.
 */
export async function failStaleQueuedLessonCreationJobs(
  jobId: string,
  now: string = new Date().toISOString(),
): Promise<number> {
  return z.number().int().nonnegative().parse(
    await callRpc("fail_stale_queued_lesson_creation_jobs", {
      p_now: now,
      p_max_age_seconds: STALE_QUEUED_JOB_SECONDS,
      p_job_id: jobId,
    }),
  );
}
