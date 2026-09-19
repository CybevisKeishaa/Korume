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
  const [retryErrorVideoId, setRetryErrorVideoId] = useState<string | null>(null);
  // One card at a time: the retry buttons disable each other while one runs.
  const [tracked, setTracked] = useState<{ youtubeVideoId: string; jobId: string } | null>(null);

  const { job, events, phase, restart } = useLessonCreationJob(tracked?.jobId ?? null, {
    onSucceeded() {
      // Only now is the lesson studyable; the server render is the authority
      // on what the card becomes.
      router.refresh();
    },
  });

  // A poll that was refused, or a job that stopped moving, must release the
  // card: `tracked !== null` disables EVERY unavailable card's retry, so
  // holding it would make the whole section inert with nothing on screen to
  // explain why.
  const pollAbandoned = phase === "refused" || phase === "stalled";
  const trackedCard = pollAbandoned ? null : tracked;
  useEffect(() => {
    if (pollAbandoned && tracked !== null) setRetryErrorVideoId(tracked.youtubeVideoId);
  }, [pollAbandoned, tracked]);

  /**
   * Queues a fresh creation attempt for a lesson whose transcript never
   * arrived. The endpoint answers `202` with a job, so this shows that job's
   * durable progress in the card rather than refreshing as though the lesson
   * were already back.
   */
  async function retryCaptionFetch(youtubeVideoId: string): Promise<void> {
    setRetryingVideoId(youtubeVideoId);
    setRetryErrorVideoId(null);

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
      setRetryErrorVideoId(youtubeVideoId);
    } finally {
      setRetryingVideoId(null);
    }
  }

  /** Re-queues the tracked job itself, once it has failed. */
  async function retryTrackedJob(): Promise<void> {
    if (tracked === null) return;
    setRetryErrorVideoId(null);
    try {
      const response = await fetch(`/api/lesson-creation-jobs/${tracked.jobId}/retry`, { method: "POST" });
      // 409 means an attempt is already active — polling it is the honest answer.
      if (!response.ok && response.status !== 409) throw new Error("Job retry failed");
      restart();
    } catch {
      setRetryErrorVideoId(tracked.youtubeVideoId);
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
                {trackedCard?.youtubeVideoId === item.lesson.youtubeVideoId && job !== null ? (
                  <LessonCreationProgress job={job} events={events} onRetry={retryTrackedJob} />
                ) : (
                  <Button
                    type="button"
                    className="mt-md"
                    variant="outline"
                    disabled={retryingVideoId !== null || trackedCard !== null}
                    onClick={() => void retryCaptionFetch(item.lesson.youtubeVideoId)}
                  >
                    {retryingVideoId === item.lesson.youtubeVideoId ? labels.retryPending : labels.retry}
                  </Button>
                )}
                {retryErrorVideoId === item.lesson.youtubeVideoId && (
                  <p role="alert" className="mt-sm text-sm text-danger-strong">
                    {labels.retryFailed}
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
