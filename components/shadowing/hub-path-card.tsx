"use client";

import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { HubCourseProgress } from "./hub-course-progress";

export interface HubPathCardData {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  total: number;
  completed: number;
  started: boolean;
  saved: boolean;
  /** Goals share the card but are never saveable. Defaults to true for paths. */
  saveable?: boolean;
  /** A server-formatted, optional recommendation badge. */
  badgeLabel?: string;
  /** Already formatted: "48 lessons · 3h 20m". */
  meta: string;
  /** The lesson the card's action opens; null hides the action. */
  nextLessonId: string | null;
  /**
   * Per-path copy, formatted on the server: a Client Component receives
   * strings, never the catalog's formatter functions.
   */
  saveLabel: string;
  progressLabel: string;
}

export interface HubPathCardLabels {
  start: string;
  continue: string;
  saveFailed: string;
}

/** A Popular Learning Paths card (Figma 37:5447), with its ✦ save toggle. */
export function HubPathCard({ path, labels, saveToggleId, focusAfterUnsaveId }: { path: HubPathCardData; labels: HubPathCardLabels; saveToggleId?: string; focusAfterUnsaveId?: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(path.saved);
  const [failed, setFailed] = useState(false);
  // `desired` is what the learner last chose, `confirmed` what the server last
  // accepted. Exactly one request is in flight at a time, so a double click
  // can never land a PUT and a DELETE on the server out of order.
  const desired = useRef(path.saved);
  const confirmed = useRef(path.saved);
  const inFlight = useRef(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // A refresh (this card's, or another card's for the same path) hands down
  // the server's truth; adopt it unless a write of ours is still settling.
  useEffect(() => {
    if (inFlight.current) return;
    desired.current = path.saved;
    confirmed.current = path.saved;
    setSaved(path.saved);
  }, [path.saved]);

  async function flush(): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      while (desired.current !== confirmed.current) {
        const target = desired.current;
        const response = await fetch(`/api/collections/${path.id}/save`, { method: target ? "PUT" : "DELETE" });
        if (!response.ok) throw new Error(`save ${response.status}`);
        confirmed.current = target;
      }
      // Other views of this path (the shelf, the paths page, the featured
      // course, which prefers saved paths) re-read the server's answer.
      // The refresh unmounts this card from the Saved list; hand focus on only
      // if the learner is still on its toggle, never pull it back from elsewhere.
      if (!confirmed.current && focusAfterUnsaveId && document.activeElement === toggleRef.current) {
        document.getElementById(focusAfterUnsaveId)?.focus();
      }
      router.refresh();
    } catch {
      desired.current = confirmed.current;
      setSaved(confirmed.current);
      setFailed(true);
    } finally {
      inFlight.current = false;
    }
  }

  function toggle(): void {
    desired.current = !desired.current;
    setSaved(desired.current);
    setFailed(false);
    void flush();
  }

  const action = path.started ? labels.continue : labels.start;
  const saveable = path.saveable ?? true;

  return (
    <li className="flex flex-col rounded-lg border border-border bg-card p-md shadow-raised">
      <div className="flex items-start justify-between gap-sm">
        <span aria-hidden="true" className="text-heading-lg">{path.icon}</span>
        {path.badgeLabel ? <span className="rounded-full bg-secondary px-sm py-2xs text-caption font-semibold text-primary-strong">{path.badgeLabel}</span> : null}
        {/* A toggle keeps one name; aria-pressed carries the state (WAI-ARIA toggle button). */}
        {saveable ? <button
          type="button"
          id={saveToggleId}
          ref={toggleRef}
          aria-pressed={saved}
          aria-label={path.saveLabel}
          onClick={toggle}
          className={cn(
            "flex min-h-hit-target aspect-square items-center justify-center rounded-md text-body-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            saved ? "text-primary-strong" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span aria-hidden="true">✦</span>
        </button> : null}
      </div>
      <h3 className="mt-sm text-body font-semibold text-foreground">{path.title}</h3>
      {path.description ? <p className="mt-xs text-caption text-muted-foreground">{path.description}</p> : null}
      <p className="mt-sm text-caption text-muted-foreground">{path.meta}</p>
      <HubCourseProgress variant="bar" total={path.total} completed={path.completed} labels={{ complete: () => path.progressLabel, lessons: () => "" }} />
      {path.nextLessonId ? (
        <Link
          href={`/shadowing/${path.nextLessonId}`}
          aria-label={`${action}: ${path.title}`}
          className="mt-auto inline-flex min-h-hit-target w-fit items-center pt-sm text-caption font-semibold text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {action} <span aria-hidden="true">&nbsp;→</span>
        </Link>
      ) : null}
      {failed ? <p role="alert" className="mt-xs text-caption text-danger-strong">{labels.saveFailed}</p> : null}
    </li>
  );
}
