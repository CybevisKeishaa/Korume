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
    id: z.string().uuid(),
    state: z.enum(LESSON_CREATION_JOB_STATES),
    step: z.enum(LESSON_CREATION_STEPS),
    attemptCount: z.number().int().nonnegative(),
    lessonId: z.string().uuid().nullable(),
    publicErrorCode: z.enum(LESSON_CREATION_ERROR_CODES).nullable(),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((projection, context) => {
    if (projection.state === "succeeded" && projection.step !== "ready") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["step"],
        message: 'A succeeded job must have the "ready" step.',
      });
    }
    if (projection.state === "failed" && projection.step !== "failed") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["step"],
        message: 'A failed job must have the "failed" step.',
      });
    }
    if (projection.step === "ready" && projection.state !== "succeeded") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["state"],
        message: 'The "ready" step requires a succeeded job.',
      });
    }
    if (projection.step === "failed" && projection.state !== "failed") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["state"],
        message: 'The "failed" step requires a failed job.',
      });
    }
  });

export function isTerminalJobState(state: LessonCreationJobState): state is TerminalLessonCreationJobState {
  return state === "succeeded" || state === "failed";
}
