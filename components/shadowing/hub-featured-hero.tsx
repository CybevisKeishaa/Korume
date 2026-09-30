import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import type { HubLesson } from "@/lib/data/shadowing-hub";
import { HubEmptyState } from "./hub-empty-state";
import { HubCourseProgress } from "./hub-course-progress";

export interface HubFeaturedHeroLabels {
  eyebrow: string;
  start: string;
  continue: string;
  noThumbnail: string;
  jlptLabel: string;
  durationLabel: string;
  duration: (minutes: number) => string;
  emptyTitle: string;
  emptyBody: string;
}

/** A featured course: an ordered `kind = 'path'` collection (see `getFeaturedCourse`). */
export interface HubFeaturedCourse {
  title: string;
  description: string | null;
  /** Memberships: the denominator of the progress bar. */
  total: number;
  completed: number;
  /** Lessons the viewer can see: what the meta line counts and times. */
  lessonCount: number;
  durationMinutes: number | null;
  jlptRange: string | null;
  /** Already localised by the page; null when no member lesson carries a JLPT level. */
  levelBand: string | null;
  coverUrl: string | null;
  previewHref: string;
  /** The lesson the primary action opens; null when no member lesson is visible. */
  next: HubLesson | null;
  selectedByRecentActivity: boolean;
  /** True when `next` is a lesson the learner already started (the resume lesson). */
  resuming?: boolean;
}

export interface HubFeaturedCourseLabels {
  eyebrow: string;
  start: string;
  continue: string;
  preview: string;
  lessonsLabel: string;
  lessons: (count: number) => string;
  levelLabel: string;
  durationLabel: string;
  duration: (minutes: number) => string;
  jlptLabel: string;
  complete: (percent: number) => string;
  progressLessons: (completed: number, total: number) => string;
  emptyTitle: string;
  emptyBody: string;
}

type HubFeaturedHeroProps =
  | { lesson: HubLesson | null; isInProgress?: boolean; labels: HubFeaturedHeroLabels; course?: never }
  | { course: HubFeaturedCourse | null; labels: HubFeaturedCourseLabels; lesson?: never; isInProgress?: never };

const PRIMARY_ACTION =
  "inline-flex w-fit rounded-md bg-primary px-md py-sm text-body font-semibold text-primary-foreground transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** The cover, scrim, eyebrow and title every featured variant shares. */
function HeroShell({ eyebrow, coverUrl, title, children }: { eyebrow: string; coverUrl: string | null; title: string; children: React.ReactNode }) {
  return (
    <section aria-label={eyebrow} className="overflow-hidden rounded-lg border border-border bg-card shadow-raised">
      <div className="relative min-h-64 overflow-hidden px-md-lg py-xl">
        {coverUrl ? (
          <Image src={coverUrl} alt="" fill priority sizes="(min-width: 1549px) calc(100vw - 42.25rem), (min-width: 1024px) calc(72.5vw - 15.625rem), 100vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-muted" aria-hidden="true" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/35" aria-hidden="true" />
        <div className="relative flex min-h-56 max-w-xl flex-col justify-end">
          <p className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{eyebrow}</p>
          <h2 className="mt-sm text-title font-semibold tracking-tight text-foreground">{title}</h2>
          {children}
        </div>
      </div>
    </section>
  );
}

function EmptyHero({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <section aria-label={eyebrow}>
      <HubEmptyState title={title} body={body} />
    </section>
  );
}

function FeaturedCourse({ course, labels }: { course: HubFeaturedCourse; labels: HubFeaturedCourseLabels }) {
  const action = course.completed > 0 || course.selectedByRecentActivity || course.resuming ? labels.continue : labels.start;
  return (
    <HeroShell eyebrow={labels.eyebrow} coverUrl={course.coverUrl} title={course.title}>
      {course.description ? <p className="mt-sm text-body text-muted-foreground">{course.description}</p> : null}
      <dl className="mt-md flex flex-wrap gap-x-md gap-y-xs text-caption text-muted-foreground">
        <div><dt className="sr-only">{labels.lessonsLabel}</dt><dd>{labels.lessons(course.lessonCount)}</dd></div>
        {course.jlptRange && course.levelBand ? <div><dt className="sr-only">{labels.levelLabel}</dt><dd>{course.levelBand}</dd></div> : null}
        {course.durationMinutes === null ? null : <div><dt className="sr-only">{labels.durationLabel}</dt><dd>{labels.duration(course.durationMinutes)}</dd></div>}
        {course.jlptRange ? <div><dt className="sr-only">{labels.jlptLabel}</dt><dd>{course.jlptRange}</dd></div> : null}
      </dl>
      <HubCourseProgress total={course.total} completed={course.completed} labels={{ complete: labels.complete, lessons: labels.progressLessons }} />
      <div className="mt-md flex flex-wrap gap-sm">
        {course.next ? (
          <Link href={`/shadowing/${course.next.id}`} aria-label={`${action}: ${course.title}`} className={PRIMARY_ACTION}>
            {action}
          </Link>
        ) : null}
        <Link
          href={course.previewHref}
          aria-label={`${labels.preview}: ${course.title}`}
          className="inline-flex w-fit rounded-md border border-border bg-card px-md py-sm text-body font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {labels.preview}
        </Link>
      </div>
    </HeroShell>
  );
}

export function HubFeaturedHero(props: HubFeaturedHeroProps) {
  if (props.course !== undefined) {
    const { course, labels } = props;
    return course
      ? <FeaturedCourse course={course} labels={labels} />
      : <EmptyHero eyebrow={labels.eyebrow} title={labels.emptyTitle} body={labels.emptyBody} />;
  }

  const { lesson, isInProgress = false, labels } = props;
  if (!lesson) return <EmptyHero eyebrow={labels.eyebrow} title={labels.emptyTitle} body={labels.emptyBody} />;

  const action = isInProgress ? labels.continue : labels.start;
  return (
    <HeroShell eyebrow={labels.eyebrow} coverUrl={lesson.thumbnailUrl} title={lesson.title}>
      <dl className="mt-md flex flex-wrap gap-x-md gap-y-xs text-caption text-muted-foreground">
        {lesson.jlptLevelEstimate ? <div><dt className="sr-only">{labels.jlptLabel}</dt><dd>{lesson.jlptLevelEstimate}</dd></div> : null}
        {lesson.durationSeconds ? <div><dt className="sr-only">{labels.durationLabel}</dt><dd>{labels.duration(Math.ceil(lesson.durationSeconds / 60))}</dd></div> : null}
      </dl>
      <Link href={`/shadowing/${lesson.id}`} aria-label={`${action}: ${lesson.title}`} className={`mt-md ${PRIMARY_ACTION}`}>
        {action}
      </Link>
    </HeroShell>
  );
}
