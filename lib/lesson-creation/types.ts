import { z } from "zod";

/** The durable lifecycle states shared by the queue, worker, APIs, and UI. */
export const LESSON_CREATION_JOB_STATES = ["queued", "running", "succeeded", "failed"] as const;
export type LessonCreationJobState = (typeof LESSON_CREATION_JOB_STATES)[number];

/** The persisted pipeline checkpoints that can be truthfully presented to a learner. */
export const LESSON_CREATION_STEPS = [
  "deduplicating",
  "fetching_metadata",
  "fetching_transcript",
  "enriching_furigana",
  "persisting",
  "ready",
  "failed",
] as const;
export type LessonCreationStep = (typeof LESSON_CREATION_STEPS)[number];

/** Stable, translated-safe failure categories. Provider errors never cross this boundary. */
export const LESSON_CREATION_ERROR_CODES = [
  "metadata_unavailable",
  "transcript_unavailable",
  "quota_exceeded",
  "temporary_failure",
] as const;
export type LessonCreationErrorCode = (typeof LESSON_CREATION_ERROR_CODES)[number];

export type TerminalLessonCreationJobState = Extract<LessonCreationJobState, "succeeded" | "failed">;

/**
 * The only job shape allowed beyond the server/store boundary. Requester and
 * lease fields remain operational database details and must never reach UI or API consumers.
 */
export interface LessonCreationJobProjection {
  id: string;
  state: LessonCreationJobState;
  step: LessonCreationStep;
  attemptCount: number;
  lessonId: string | null;
  publicErrorCode: LessonCreationErrorCode | null;
  updatedAt: string;
}

export const lessonCreationJobProjectionSchema = z
  .object({
    id: z.string(),
    state: z.enum(LESSON_CREATION_JOB_STATES),
    step: z.enum(LESSON_CREATION_STEPS),
    attemptCount: z.number().int().nonnegative(),
    lessonId: z.string().nullable(),
    publicErrorCode: z.enum(LESSON_CREATION_ERROR_CODES).nullable(),
    updatedAt: z.string(),
  })
  .strict();

export function isTerminalJobState(state: LessonCreationJobState): state is TerminalLessonCreationJobState {
  return state === "succeeded" || state === "failed";
}
