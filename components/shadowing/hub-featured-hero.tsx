import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import type { HubLesson } from "@/lib/data/shadowing-hub";

export interface HubFeaturedHeroLabels {
  eyebrow: string;
  start: string;
  continue: string;
  noThumbnail: string;
  jlptLabel: string;
  durationLabel: string;
  duration: (minutes: number) => string;
}

export function HubFeaturedHero({ lesson, isInProgress = false, labels }: { lesson: HubLesson | null; isInProgress?: boolean; labels: HubFeaturedHeroLabels }) {
  if (!lesson) return null;

  const action = isInProgress ? labels.continue : labels.start;

  return (
    <section aria-label={labels.eyebrow} className="overflow-hidden rounded-xl border border-border bg-card shadow-raised">
      <div className="relative min-h-64 overflow-hidden px-md-lg py-xl">
        {lesson.thumbnailUrl ? (
          <Image src={lesson.thumbnailUrl} alt="" fill priority sizes="(min-width: 1280px) 55rem, 100vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-muted" aria-hidden="true" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/35" aria-hidden="true" />
        <div className="relative flex min-h-56 max-w-xl flex-col justify-end">
          <p className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{labels.eyebrow}</p>
          <h2 className="mt-sm text-title font-semibold tracking-tight text-foreground">{lesson.title}</h2>
          <dl className="mt-md flex flex-wrap gap-x-md gap-y-xs text-caption text-muted-foreground">
            {lesson.jlptLevelEstimate ? <div><dt className="sr-only">{labels.jlptLabel}</dt><dd>{lesson.jlptLevelEstimate}</dd></div> : null}
            {lesson.durationSeconds ? <div><dt className="sr-only">{labels.durationLabel}</dt><dd>{labels.duration(Math.ceil(lesson.durationSeconds / 60))}</dd></div> : null}
          </dl>
          <Link
            href={`/shadowing/${lesson.id}`}
            aria-label={`${action}: ${lesson.title}`}
            className="mt-md inline-flex w-fit rounded-md bg-primary px-md py-sm text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {action}
          </Link>
        </div>
      </div>
    </section>
  );
}
