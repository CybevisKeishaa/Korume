import { Link } from "@/lib/i18n/navigation";
import type { PathSummary } from "@/lib/data/collections";
import { courseProgressPercent } from "./hub-course-progress";
import { HubEmptyState } from "./hub-empty-state";
import { HubPathCard, type HubPathCardData, type HubPathCardLabels } from "./hub-path-card";
import { HubSectionHeading } from "./hub-section-heading";

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
export function HubPathShelf({ title, paths, labels, viewAll, empty }: {
  title: string;
  paths: HubPathCardData[];
  labels: HubPathCardLabels;
  viewAll?: { href: string; label: string };
  empty: { title: string; body: string };
}) {
  return (
    <section aria-label={title}>
      <HubSectionHeading
        title={title}
        action={viewAll ? (
          <Link href={viewAll.href} className="inline-flex min-h-hit-target items-center text-caption font-semibold text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {viewAll.label} <span aria-hidden="true">&nbsp;→</span>
          </Link>
        ) : undefined}
      />
      {paths.length ? (
        <ul className="mt-md grid grid-cols-2 gap-md xl:grid-cols-4">
          {paths.map((path) => <HubPathCard key={path.id} path={path} labels={labels} />)}
        </ul>
      ) : (
        <HubEmptyState title={empty.title} body={empty.body} />
      )}
    </section>
  );
}
