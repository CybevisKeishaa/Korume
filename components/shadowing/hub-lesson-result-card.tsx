import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import type { HubLesson } from "@/lib/data/shadowing-hub";

export interface HubLessonResultCardProps {
  lesson: HubLesson;
  noThumbnailLabel: string;
  durationLabel: string | null;
}

/** A compact, data-only result card for pronunciation browse and search. */
export function HubLessonResultCard({ lesson, noThumbnailLabel, durationLabel }: HubLessonResultCardProps) {
  // Named by the title alone, described by the meta: an aria-label would hide
  // the duration and level from assistive technology. A lesson appears once
  // per results page, so its id makes the element ids unique.
  const titleId = `lesson-result-${lesson.id}-title`;
  const metaId = `lesson-result-${lesson.id}-meta`;
  const levelId = `lesson-result-${lesson.id}-level`;
  const describedBy = [lesson.jlptLevelEstimate ? levelId : null, durationLabel ? metaId : null].filter(Boolean).join(" ") || undefined;
  return (
    <li>
      <Link
        href={`/shadowing/${lesson.id}`}
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-raised transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted">
          {lesson.thumbnailUrl ? (
            <Image
              src={lesson.thumbnailUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 15rem, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-base group-hover:scale-[1.02] motion-reduce:transform-none"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-body text-muted-foreground">{noThumbnailLabel}</div>
          )}
          {lesson.jlptLevelEstimate ? (
            <span id={levelId} className="absolute left-sm top-sm rounded-full bg-background/90 px-sm py-2xs text-caption font-semibold text-foreground">
              {lesson.jlptLevelEstimate}
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-xs p-sm">
          <h3 id={titleId} className="line-clamp-2 text-body font-semibold text-foreground">{lesson.title}</h3>
          {durationLabel ? <p id={metaId} className="text-caption text-muted-foreground">{durationLabel}</p> : null}
        </div>
      </Link>
    </li>
  );
}
