"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { HubLibraryLesson } from "@/lib/data/shadowing-hub";
import { useRouter } from "@/lib/i18n/navigation";
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
      router.refresh();
    } catch {
      setRetryErrorVideoId(youtubeVideoId);
    } finally {
      setRetryingVideoId(null);
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
                <Button
                  type="button"
                  className="mt-md"
                  variant="outline"
                  disabled={retryingVideoId !== null}
                  onClick={() => void retryCaptionFetch(item.lesson.youtubeVideoId)}
                >
                  {retryingVideoId === item.lesson.youtubeVideoId ? labels.retryPending : labels.retry}
                </Button>
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
