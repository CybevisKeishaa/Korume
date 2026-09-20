import "server-only";
import { z } from "zod";
import { findExistingLesson } from "@/lib/data/lesson-library";
import {
  youtubeCaptionProvider,
  type ProviderTranscriptResult,
} from "@/lib/data/transcript-providers";
import type { VideoRow } from "@/lib/data/videos";
import { fetchOembed } from "@/lib/youtube";
import { sanitizeTranscriptText } from "@/lib/transcript";
import { TransientLessonCreationProviderError } from "./errors";
import {
  finalizeClaimedJob,
  getRequesterJob,
  hasStudyableLessonTranscript,
  transitionClaimedJob,
  type ClaimedLessonCreationJob,
  type FinalizeClaimedJobInput,
  type FinalizeOutcome,
  type LessonCreationContent,
  type TransitionClaimedJobInput,
} from "./store";
import type { LessonCreationErrorCode, LessonCreationJobProjection, LessonCreationStep } from "./types";

export type CaptionResult = ProviderTranscriptResult;

export interface LessonCreationDependencies {
  findExistingLesson(youtubeVideoId: string): Promise<VideoRow | null>;
  fetchOembed(youtubeVideoId: string): Promise<{ title: string; thumbnailUrl: string }>;
  fetchCaptions(youtubeVideoId: string): Promise<CaptionResult | null>;
  toFurigana(text: string): Promise<unknown>;
}

export interface LessonCreationPersistenceDependencies {
  getRequesterJob(jobId: string, requesterId: string): Promise<LessonCreationJobProjection | null>;
  transitionClaimedJob(input: TransitionClaimedJobInput): Promise<void>;
  finalizeClaimedJob(input: FinalizeClaimedJobInput): Promise<FinalizeOutcome>;
}

export class LessonCreationPipelineError extends Error {
  constructor(
    public readonly publicErrorCode: LessonCreationErrorCode,
    options?: ErrorOptions,
  ) {
    super(publicErrorCode, options);
    this.name = "LessonCreationPipelineError";
  }
}

export class InvalidLessonCreationStoreDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLessonCreationStoreDataError";
  }
}

const captionResultSchema = z.object({
  source: z.literal("youtube_caption"),
  lines: z.array(z.object({
    startTime: z.number().finite().nonnegative(),
    endTime: z.number().finite().nonnegative(),
    textJp: z.string(),
    textTranslation: z.string().nullable(),
  }).strict()).min(1),
}).strict().superRefine((caption, context) => {
  caption.lines.forEach((line, index) => {
    if (line.endTime < line.startTime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lines", index, "endTime"],
        message: "Caption end time must not precede its start time.",
      });
    }
  });
});

const furiganaSchema = z.array(z.object({
  text: z.string().min(1),
  reading: z.string().min(1).optional(),
}).strict());

const persistenceDependencies: LessonCreationPersistenceDependencies = {
  getRequesterJob,
  transitionClaimedJob,
  finalizeClaimedJob,
};

/**
 * The production provider boundary. The existing synchronous entry points
 * temporarily reuse these methods until their consumers move to the queue.
 */
export const defaultLessonCreationDependencies: LessonCreationDependencies = {
  async findExistingLesson(youtubeVideoId: string): Promise<VideoRow | null> {
    const lesson = await findExistingLesson(youtubeVideoId);
    if (!lesson) return null;
    return (await hasStudyableLessonTranscript(lesson.id)) ? lesson : null;
  },
  async fetchOembed(youtubeVideoId: string) {
    return fetchOembed(youtubeVideoId);
  },
  async fetchCaptions(youtubeVideoId: string) {
    return youtubeCaptionProvider.fetchForWorker(youtubeVideoId);
  },
  async toFurigana(text: string) {
    const { toFurigana } = await import("@/lib/japanese");
    return toFurigana(text);
  },
};

async function readRunningJob(
  claim: ClaimedLessonCreationJob,
  store: LessonCreationPersistenceDependencies,
  expectedStep?: LessonCreationStep,
): Promise<LessonCreationJobProjection> {
  const durable = await store.getRequesterJob(claim.job.id, claim.requesterId);
  if (!durable || durable.state !== "running" || (expectedStep !== undefined && durable.step !== expectedStep)) {
    throw new InvalidLessonCreationStoreDataError(
      `The claimed lesson-creation job ${claim.job.id} is no longer running at the expected durable step.`,
    );
  }
  return durable;
}

async function transitionAndRead(
  claim: ClaimedLessonCreationJob,
  store: LessonCreationPersistenceDependencies,
  step: Exclude<LessonCreationStep, "ready">,
): Promise<void> {
  await store.transitionClaimedJob({
    jobId: claim.job.id,
    leaseToken: claim.leaseToken,
    step,
  });
  await readRunningJob(claim, store, step);
}

function requireFinalOutcome(outcome: FinalizeOutcome, jobId: string): LessonCreationJobProjection {
  if (!outcome || (outcome.state !== "succeeded" && outcome.state !== "failed")) {
    throw new InvalidLessonCreationStoreDataError(
      `Finalization returned invalid durable state for claimed lesson-creation job ${jobId}.`,
    );
  }
  return outcome;
}

function parseMetadata(metadata: { title: string; thumbnailUrl: string }): {
  title: string;
  thumbnailUrl: string;
} {
  const title = sanitizeTranscriptText(metadata.title);
  const parsed = z.object({
    title: z.string().min(1),
    thumbnailUrl: z.string().url(),
  }).strict().safeParse({ title, thumbnailUrl: metadata.thumbnailUrl });
  if (!parsed.success) {
    throw new LessonCreationPipelineError("metadata_unavailable", { cause: parsed.error });
  }
  return parsed.data;
}

function parseCaptions(result: CaptionResult | null): CaptionResult {
  const parsed = captionResultSchema.safeParse(result);
  if (!parsed.success) {
    throw new LessonCreationPipelineError("transcript_unavailable", { cause: parsed.error });
  }
  const lines = parsed.data.lines.map((line) => ({
    ...line,
    textJp: sanitizeTranscriptText(line.textJp),
    textTranslation: line.textTranslation === null ? null : sanitizeTranscriptText(line.textTranslation),
  }));
  if (lines.some((line) => line.textJp.length === 0)) {
    throw new LessonCreationPipelineError("transcript_unavailable");
  }
  return { source: parsed.data.source, lines };
}

async function enrichCaptions(
  claim: ClaimedLessonCreationJob,
  captionResult: CaptionResult,
  dependencies: LessonCreationDependencies,
): Promise<LessonCreationContent["lines"]> {
  const lines: LessonCreationContent["lines"] = [];
  for (const line of captionResult.lines) {
    let furiganaJson: LessonCreationContent["lines"][number]["furiganaJson"] = null;
    try {
      furiganaJson = furiganaSchema.parse(await dependencies.toFurigana(line.textJp));
    } catch (error) {
      console.error(
        `[lesson-creation] furigana generation failed for job ${claim.job.id} caption line at ${line.startTime}:`,
        error,
      );
    }
    lines.push({ ...line, furiganaJson });
  }
  return lines;
}

/**
 * Executes one fenced claim. Every externally visible pipeline step is
 * preceded by a fresh durable read, so a recovered/superseded claim stops
 * before it can call another provider or finalize stale work.
 */
export async function processClaimedLessonCreationJob(
  claim: ClaimedLessonCreationJob,
  dependencies: LessonCreationDependencies = defaultLessonCreationDependencies,
  store: LessonCreationPersistenceDependencies = persistenceDependencies,
): Promise<LessonCreationJobProjection> {
  await readRunningJob(claim, store);
  const existing = await dependencies.findExistingLesson(claim.youtubeVideoId);

  // An admin job asks for FREE/PLUS. Deduping onto a PRIVATE lesson publishes
  // nothing, so `succeeded` would report catalogue work that never happened.
  // Saves the provider calls only: `finalize_lesson_creation_job` repeats this
  // under the advisory lock, where the row cannot appear after the check.
  if (existing && claim.origin === "admin" && existing.library_access === "PRIVATE") {
    throw new LessonCreationPipelineError("existing_private_lesson");
  }

  if (existing) {
    await transitionAndRead(claim, store, "persisting");
    return requireFinalOutcome(await store.finalizeClaimedJob({
      jobId: claim.job.id,
      requesterId: claim.requesterId,
      leaseToken: claim.leaseToken,
      lessonId: existing.id,
    }), claim.job.id);
  }

  await transitionAndRead(claim, store, "fetching_metadata");
  let metadata: { title: string; thumbnailUrl: string };
  try {
    metadata = parseMetadata(await dependencies.fetchOembed(claim.youtubeVideoId));
  } catch (error) {
    if (error instanceof LessonCreationPipelineError) throw error;
    // A stall is not a verdict on the video. `metadata_unavailable` is terminal,
    // so swallowing a transient provider error here would permanently fail a
    // lesson because YouTube was slow once — and the 10s provider timeout makes
    // that reachable. Let the worker's retry classification see it.
    if (error instanceof TransientLessonCreationProviderError) throw error;
    throw new LessonCreationPipelineError("metadata_unavailable", { cause: error });
  }

  await transitionAndRead(claim, store, "fetching_transcript");
  const captionResult = parseCaptions(await dependencies.fetchCaptions(claim.youtubeVideoId));

  await transitionAndRead(claim, store, "enriching_furigana");
  const lines = await enrichCaptions(claim, captionResult, dependencies);

  await transitionAndRead(claim, store, "persisting");
  return requireFinalOutcome(await store.finalizeClaimedJob({
    jobId: claim.job.id,
    requesterId: claim.requesterId,
    leaseToken: claim.leaseToken,
    lessonId: null,
    content: {
      title: metadata.title,
      thumbnailUrl: metadata.thumbnailUrl,
      source: "youtube_caption",
      lines,
    },
  }), claim.job.id);
}
