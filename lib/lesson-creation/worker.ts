import "server-only";
import { ZodError } from "zod";
import {
  claimNextLessonCreationJob,
  recoverExpiredLessonCreationJobs,
  transitionClaimedJob,
} from "./store";
import {
  defaultLessonCreationDependencies,
  InvalidLessonCreationStoreDataError,
  LessonCreationPipelineError,
  processClaimedLessonCreationJob,
  type LessonCreationDependencies,
} from "./pipeline";
import type { LessonCreationErrorCode } from "./types";
export { TransientLessonCreationProviderError } from "./errors";
import { TransientLessonCreationProviderError } from "./errors";

export const MAX_LESSON_CREATION_ATTEMPTS = 3;

const TRANSIENT_DATABASE_CODES = new Set([
  "08000", "08001", "08003", "08004", "08006", "08007", "08P01",
  "40001", "40P01", "53300", "57P01", "57P02", "57P03",
]);

export interface LessonCreationPassResult {
  claimed: number;
  succeeded: number;
  requeued: number;
  failed: number;
  recovered: number;
}

export function retryDelayMs(attempt: number): number {
  const safeAttempt = Number.isInteger(attempt) && attempt > 0 ? attempt : 1;
  return Math.min(30_000, 1_000 * (2 ** (safeAttempt - 1)));
}

function databaseCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function isExplicitlyTransient(error: unknown): boolean {
  return error instanceof TransientLessonCreationProviderError ||
    (databaseCode(error) !== null && TRANSIENT_DATABASE_CODES.has(databaseCode(error) as string));
}

function mustSurface(error: unknown): boolean {
  return error instanceof InvalidLessonCreationStoreDataError || error instanceof ZodError;
}

function terminalErrorCode(error: unknown): LessonCreationErrorCode {
  return error instanceof LessonCreationPipelineError
    ? error.publicErrorCode
    : "temporary_failure";
}

/** Recover expired leases, claim at most one due job, and contain job failures. */
export async function runLessonCreationPass(
  now: Date,
  deps: LessonCreationDependencies = defaultLessonCreationDependencies,
  clock: () => Date = () => new Date(),
): Promise<LessonCreationPassResult> {
  const timestamp = now.toISOString();
  const recovered = await recoverExpiredLessonCreationJobs(timestamp);
  const claimed = await claimNextLessonCreationJob(timestamp);
  const result: LessonCreationPassResult = {
    claimed: claimed ? 1 : 0,
    succeeded: 0,
    requeued: 0,
    failed: 0,
    recovered,
  };
  if (!claimed) return result;
  if (claimed.job.attemptCount < 1 || claimed.job.attemptCount > MAX_LESSON_CREATION_ATTEMPTS) {
    throw new InvalidLessonCreationStoreDataError(
      `Claimed lesson-creation job has invalid attempt count ${claimed.job.attemptCount}.`,
    );
  }

  try {
    const outcome = await processClaimedLessonCreationJob(claimed, deps);
    if (outcome.state === "succeeded") result.succeeded = 1;
    else if (outcome.state === "failed") result.failed = 1;
    else {
      throw new InvalidLessonCreationStoreDataError(
        `Claimed lesson-creation job ${claimed.job.id} finalized without a terminal state.`,
      );
    }
    return result;
  } catch (error) {
    if (mustSurface(error)) throw error;

    const retryable = isExplicitlyTransient(error) &&
      claimed.job.attemptCount < MAX_LESSON_CREATION_ATTEMPTS;
    if (retryable) {
      const availableAt = new Date(clock().getTime() + retryDelayMs(claimed.job.attemptCount)).toISOString();
      await transitionClaimedJob({
        jobId: claimed.job.id,
        leaseToken: claimed.leaseToken,
        step: "failed",
        error: "temporary_failure",
        availableAt,
      });
      result.requeued = 1;
      return result;
    }

    await transitionClaimedJob({
      jobId: claimed.job.id,
      leaseToken: claimed.leaseToken,
      step: "failed",
      error: terminalErrorCode(error),
    });
    result.failed = 1;
    return result;
  }
}
