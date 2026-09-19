"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LessonCreationProgress } from "@/components/video/lesson-creation-progress";
import { useLessonCreationJob } from "@/components/video/use-lesson-creation-job";
import type { HubLibraryLesson } from "@/lib/data/shadowing-hub";
import { useRouter } from "@/lib/i18n/navigation";
import type { LessonCreationJobProjection } from "@/lib/lesson-creation/types";
import { HubLessonCard } from "./hub-lesson-card";
import { HubSectionHeading } from "./hub-section-heading";
import { HubEmptyState } from "./hub-empty-state";

export interface HubLibrarySectionLabels {
  title: string;
  readyAction: string;
  unavailable: string;
  retry: string;
  retryPending: string;
  retryFailed: string;
  /** Shown instead of `retryFailed` when the refusal was a 401. */
  retrySessionExpired: string;
  noThumbnail: string;
  emptyTitle: string;
  emptyBody: string;
  emptyAction: string;
}

export interface HubLibrarySectionProps {
  items: HubLibraryLesson[];
  labels: HubLibrarySectionLabels;
  /** The Hub uses its local importer; Explore routes learners back to it. */
  emptyActionHref?: string;
}

export function HubLibrarySection({ items, labels, emptyActionHref = "#hub-import" }: HubLibrarySectionProps) {
  const router = useRouter();
  const [retryingVideoId, setRetryingVideoId] = useState<string | null>(null);
  // One object, not a video id plus a parallel flag: two states that must agree
  // by hand are a second home for one fact (AGENTS.md §6).
  const [retryError, setRetryError] = useState<{ youtubeVideoId: string; sessionExpired: boolean } | null>(null);
  // One card at a time: the retry buttons disable each other while one runs.
  const [tracked, setTracked] = useState<{ youtubeVideoId: string; jobId: string } | null>(null);

  const { job, events, phase, refusedStatus, restart } = useLessonCreationJob(tracked?.jobId ?? null, {
    onSucceeded() {
      // Only now is the lesson studyable; the server render is the authority
      // on what the card becomes.
      router.refresh();
    },
  });

  // A refused poll must RELEASE the card, not merely hide it: `tracked !== null`
  // disables EVERY unavailable card's retry, so holding it would make the whole
  // section inert with nothing on screen to explain why.
  //
  // Clearing `tracked` rather than masking it is load-bearing. Enqueue is
  // idempotent while a job is active, so a retry hands back the SAME job id; if
  // the old id were still held, the hook's `[jobId, attempt]` deps would not
  // change, its effect would not re-run, and Try again would do nothing
  // forever. Clearing makes the next attempt a real `null -> id` transition,
  // and it closes the window where this effect could stamp an error onto a new
  // job after reading a stale `phase`.
  const pollAbandoned = phase === "refused";
  useEffect(() => {
    if (pollAbandoned && tracked !== null) {
      // A 401 is about the session, not the captions: telling a signed-out
      // learner to try again sends them round the same refusal forever.
      setRetryError({ youtubeVideoId: tracked.youtubeVideoId, sessionExpired: refusedStatus === 401 });
      setTracked(null);
    }
  }, [pollAbandoned, refusedStatus, tracked]);

  /**
   * Queues a fresh creation attempt for a lesson whose transcript never
   * arrived. The endpoint answers `202` with a job, so this shows that job's
   * durable progress in the card rather than refreshing as though the lesson
   * were already back.
   */
  async function retryCaptionFetch(youtubeVideoId: string): Promise<void> {
    setRetryingVideoId(youtubeVideoId);
    setRetryError(null);

    try {
      const response = await fetch("/api/videos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}` }),
      });
      if (!response.ok) throw new Error("Caption retry failed");
      const body = (await response.json()) as { data: LessonCreationJobProjection };
      setTracked({ youtubeVideoId, jobId: body.data.id });
    } catch {
      setRetryError({ youtubeVideoId, sessionExpired: false });
    } finally {
      setRetryingVideoId(null);
    }
  }

  /** Re-queues the tracked job itself, once it has failed. */
  async function retryTrackedJob(): Promise<void> {
    if (tracked === null) return;
    setRetryError(null);
    try {
      const response = await fetch(`/api/lesson-creation-jobs/${tracked.jobId}/retry`, { method: "POST" });
      // 409 means an attempt is already active — polling it is the honest answer.
      if (!response.ok && response.status !== 409) throw new Error("Job retry failed");
      restart();
    } catch {
      setRetryError({ youtubeVideoId: tracked.youtubeVideoId, sessionExpired: false });
    }
  }

  return (
    <section aria-label={labels.title}>
      <HubSectionHeading title={labels.title} />
      {items.length === 0 ? (
        <HubEmptyState
          title={labels.emptyTitle}
          body={labels.emptyBody}
          action={(
            <a
              href={emptyActionHref}
              className="inline-flex rounded-md bg-primary px-md py-sm text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {labels.emptyAction}
            </a>
          )}
        />
      ) : (
        <ul className="mt-md grid grid-cols-1 gap-md sm:grid-cols-2">
          {items.map((item) =>
            item.state === "ready" ? (
              <HubLessonCard
                key={item.lesson.id}
                lesson={item.lesson}
                href={`/shadowing/${item.lesson.id}`}
                actionLabel={labels.readyAction}
                noThumbnailLabel={labels.noThumbnail}
              />
            ) : (
              <li key={item.lesson.id} className="rounded-xl border border-danger/40 bg-card p-md-lg">
                <h3 className="font-semibold text-foreground">{item.lesson.title}</h3>
                <p className="mt-xs text-sm text-muted-foreground">{labels.unavailable}</p>
                {tracked?.youtubeVideoId === item.lesson.youtubeVideoId && job !== null ? (
                  <LessonCreationProgress job={job} events={events} onRetry={retryTrackedJob} />
                ) : (
                  <Button
                    type="button"
                    className="mt-md"
                    variant="outline"
                    disabled={retryingVideoId !== null || tracked !== null}
                    onClick={() => void retryCaptionFetch(item.lesson.youtubeVideoId)}
                  >
                    {retryingVideoId === item.lesson.youtubeVideoId ? labels.retryPending : labels.retry}
                  </Button>
                )}
                {retryError?.youtubeVideoId === item.lesson.youtubeVideoId && (
                  <p role="alert" className="mt-sm text-sm text-danger-strong">
                    {retryError.sessionExpired ? labels.retrySessionExpired : labels.retryFailed}
                  </p>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
