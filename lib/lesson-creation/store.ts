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
 * One job's append-only transition history, oldest first.
 *
 * ⚠️ Ownership is NOT checked here and cannot be: the events table carries no
 * requester column, and this reads through the service role, which bypasses
 * RLS. Call it only after `getRequesterJob` has returned a row for the same
 * caller — reading history for an id the caller does not own would disclose
 * that someone else's job exists.
 */
export async function listJobEventsForOwnedJob(jobId: string): Promise<LessonCreationJobEvent[]> {
  const client = createServiceClient();
  const { data, error } = await client.from("lesson_creation_job_events")
    .select(publicEventColumns)
    .eq("job_id", jobId)
    .order("id", { ascending: true });
  if (error) throw error;
  return z.array(rowSchema).parse(data).map((row) => lessonCreationJobEventSchema.parse({
    state: row.state,
    step: row.step,
    attemptCount: row.attempt_count,
    publicErrorCode: row.public_error_code,
    createdAt: row.created_at,
  }));
}

export async function retryRequesterJob(jobId: string, requesterId: string): Promise<RetryResult> {
  const data = await callRpc("retry_lesson_creation_job", { p_job_id: jobId, p_requester: requesterId });
  return data === null ? null : projectRow(data);
}

export async function claimNextLessonCreationJob(now: string): Promise<ClaimedLessonCreationJob | null> {
  const data = await callRpc("claim_lesson_creation_job", { p_now: now, p_lease_seconds: leaseSeconds });
  if (data === null) return null;
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

export async function transitionClaimedJob(input: TransitionClaimedJobInput): Promise<void> {
  // Even a discarded RPC row is parsed: a missing row must not look like a completed transition.
  projectRow(await callRpc("transition_lesson_creation_job", {
    p_job_id: input.jobId,
    p_expected_state: "running",
    p_step: input.step,
    p_available_at: input.availableAt ?? null,
    p_error: input.error ?? null,
    p_lease_token: input.leaseToken,
    p_lease_seconds: leaseSeconds,
  }));
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
  return data === null ? null : projectRow(data);
}

export async function recoverExpiredLessonCreationJobs(now: string): Promise<number> {
  return z.number().int().nonnegative().parse(
    await callRpc("recover_expired_lesson_creation_jobs", { p_now: now }),
  );
}
