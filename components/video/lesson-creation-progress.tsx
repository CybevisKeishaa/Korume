"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type {
  LessonCreationErrorCode,
  LessonCreationJobEvent,
  LessonCreationJobProjection,
  LessonCreationStep,
} from "@/lib/lesson-creation/types";

/**
 * The learner's view of a durable lesson-creation job.
 *
 * Two rules from design §9 shape all of it:
 *
 * 1. **A stage may be shown complete only once a durable event proves it.**
 *    The job's current `step` is not that proof — it says what is happening
 *    now, and after a retry resets the attempt it can move backwards. So
 *    completion is derived from `events` alone, never from `job.step`.
 * 2. **No percentage and no ETA, ever.** No worker measurement is
 *    authoritative enough to promise either, so there is no progress bar and
 *    no time language here — the stage list IS the progress indicator.
 *
 * Each stage carries its state as text as well as colour, so the information
 * survives both a screen reader and `prefers-reduced-motion` (nothing here
 * animates: reduced motion changes decoration elsewhere, not this).
 */
const STAGES: { key: "preparing" | "findingTranscript" | "building" | "ready"; steps: LessonCreationStep[] }[] = [
  { key: "preparing", steps: ["deduplicating", "fetching_metadata"] },
  { key: "findingTranscript", steps: ["fetching_transcript"] },
  { key: "building", steps: ["enriching_furigana", "persisting"] },
  { key: "ready", steps: ["ready"] },
];

/**
 * `as const satisfies` rather than a `Record<…, string>` annotation: the
 * literal types are what let the compiler check the catalog key this builds.
 * Widened to `string`, `t()` would accept a key that does not exist.
 */
const ERROR_KEYS = {
  metadata_unavailable: "metadataUnavailable",
  transcript_unavailable: "transcriptUnavailable",
  quota_exceeded: "quotaExceeded",
  temporary_failure: "temporaryFailure",
  existing_private_lesson: "existingPrivateLesson",
} as const satisfies Record<LessonCreationErrorCode, string>;

type StageState = "done" | "inProgress" | "waiting";

/** Which stage a durable step belongs to, or -1 for `failed`, which is no stage. */
function stageIndexOf(step: LessonCreationStep): number {
  return STAGES.findIndex((stage) => stage.steps.includes(step));
}

/**
 * The events belonging to the attempt now running.
 *
 * A retry re-queues the same job, so its history accumulates across attempts.
 * Every `queued` event marks an attempt beginning, so the tail from the last
 * one is the current attempt. Without this, a retried job would show the stages
 * its FAILED attempt had reached as already complete — work that is being
 * redone, presented as done. `attemptCount` cannot serve here: retry resets it
 * to 0, so the numbers repeat across attempts.
 *
 * The store caps history at its newest rows, so after enough retries the
 * opening `queued` event can fall outside the window. That is treated as NO
 * proof rather than as licence to use the whole window — the alternative would
 * mark stages done from a previous attempt, which is the exact lie this exists
 * to prevent.
 */
function currentAttempt(events: LessonCreationJobEvent[]): LessonCreationJobEvent[] {
  const lastQueued = events.map((event) => event.state).lastIndexOf("queued");
  if (lastQueued === -1) return events.length === 0 ? events : [];
  return events.slice(lastQueued);
}

function stageStates(job: LessonCreationJobProjection, events: LessonCreationJobEvent[]): StageState[] {
  const reached = currentAttempt(events)
    .map((event) => stageIndexOf(event.step))
    .filter((index) => index >= 0);
  const furthestReached = reached.length === 0 ? -1 : Math.max(...reached);

  return STAGES.map((_stage, index) => {
    if (job.state === "succeeded") return "done";
    // Proof of completion is a durable event for a LATER stage, nothing weaker.
    if (furthestReached > index) return "done";
    if (furthestReached === index) return "inProgress";
    return "waiting";
  });
}

export interface LessonCreationProgressProps {
  job: LessonCreationJobProjection;
  events: LessonCreationJobEvent[];
  onRetry(): Promise<void>;
}

export function LessonCreationProgress({ job, events, onRetry }: LessonCreationProgressProps) {
  const t = useTranslations("videos");
  const [retrying, setRetrying] = useState(false);
  const states = stageStates(job, events);
  const stateLabel: Record<StageState, string> = {
    done: t("creation.stepDone"),
    inProgress: t("creation.stepInProgress"),
    waiting: t("creation.stepWaiting"),
  };

  async function handleRetry(): Promise<void> {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="mt-md">
      <div role="status" aria-label={t("creation.progressLabel")}>
        <ol className="flex flex-col gap-xs">
          {STAGES.map((stage, index) => {
            const state = states[index] ?? "waiting";
            return (
              <li
                key={stage.key}
                className={cn(
                  "flex items-center gap-sm text-sm",
                  state === "done" && "text-foreground",
                  state === "inProgress" && "font-semibold text-foreground",
                  state === "waiting" && "text-muted-foreground",
                )}
              >
                <span aria-hidden="true">{state === "done" ? "✓" : state === "inProgress" ? "▸" : "·"}</span>
                <span>{t(`creation.steps.${stage.key}`)}</span>
                <span className="sr-only">{stateLabel[state]}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {job.state === "failed" && (
        <div className="mt-sm">
          <p role="alert" className="text-sm text-danger-strong">
            {t(`creation.errors.${ERROR_KEYS[job.publicErrorCode ?? "temporary_failure"]}`)}
          </p>
          <Button type="button" variant="outline" className="mt-sm" disabled={retrying} onClick={() => void handleRetry()}>
            {retrying ? t("creation.retrying") : t("creation.retry")}
          </Button>
        </div>
      )}
    </div>
  );
}
