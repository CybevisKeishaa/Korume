import type { PathSummary } from "@/lib/data/collections";
import { courseProgressPercent } from "./hub-course-progress";
import { HubPathCard, type HubPathCardData, type HubPathCardLabels } from "./hub-path-card";
import { HubShelf } from "./hub-shelf";

/** Maps a path read model onto its card, formatting the "48 lessons · 3h 20m" line. */
export function toHubPathCard(
  summary: PathSummary,
  format: {
    lessons: (count: number) => string;
    duration: (minutes: number) => string;
    meta: (lessons: string, duration: string) => string;
    save: (title: string) => string;
    complete: (percent: number) => string;
  },
): HubPathCardData {
  // Count and duration describe the same lessons: the ones this viewer can take.
  const lessons = format.lessons(summary.lessonCount);
  return {
    id: summary.collection.id,
    title: summary.collection.title,
    description: summary.collection.description,
    icon: summary.collection.icon ?? null,
    total: summary.total,
    completed: summary.completed,
    started: summary.started,
    saved: summary.saved,
    meta: summary.durationMinutes === null ? lessons : format.meta(lessons, format.duration(summary.durationMinutes)),
    nextLessonId: summary.next?.id ?? null,
    saveLabel: format.save(summary.collection.title),
    progressLabel: summary.total > 0 ? format.complete(courseProgressPercent(summary.total, summary.completed)) : "",
  };
}

/** A titled grid of path cards: the studio's shelf, and each section of the paths page. */
export function HubPathShelf({ title, paths, labels, viewAll, empty, saveToggleIdPrefix, focusAfterUnsaveIdPrefix }: {
  title: string;
  paths: HubPathCardData[];
  labels: HubPathCardLabels;
  viewAll?: { href: string; label: string; accessibleSuffix?: string };
  empty: { title: string; body: string };
  saveToggleIdPrefix?: string;
  focusAfterUnsaveIdPrefix?: string;
}) {
  return (
    <HubShelf title={title} viewAll={viewAll} empty={empty}>
      {paths.map((path) => <HubPathCard key={path.id} path={path} labels={labels} saveToggleId={saveToggleIdPrefix ? `${saveToggleIdPrefix}${path.id}` : undefined} focusAfterUnsaveId={focusAfterUnsaveIdPrefix ? `${focusAfterUnsaveIdPrefix}${path.id}` : undefined} />)}
    </HubShelf>
  );
}
