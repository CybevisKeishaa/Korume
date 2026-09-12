import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import type { ExploreLesson } from "@/lib/data/shadowing-explore";
import { Button } from "@/components/ui/button";

export interface ExploreLessonCardLabels {
  start: string;
  preview: string;
  noThumbnail: string;
}

export function ExploreLessonCard({ lesson, labels, onPreview }: {
  lesson: ExploreLesson;
  labels: ExploreLessonCardLabels;
  onPreview: (lesson: ExploreLesson) => void;
}) {
  return (
    <li className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-raised">
      <div className="relative aspect-video overflow-hidden bg-muted">
        {lesson.thumbnailUrl ? (
          <Image src={lesson.thumbnailUrl} alt="" fill sizes="(min-width: 1280px) 22rem, (min-width: 640px) 50vw, 100vw" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{labels.noThumbnail}</div>
        )}
        {lesson.jlptLevelEstimate ? (
          <span className="absolute left-sm top-sm rounded-full bg-background/90 px-sm py-2xs text-caption font-semibold text-foreground">
            {lesson.jlptLevelEstimate}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-sm p-md-lg">
        <h3 className="line-clamp-2 text-body font-semibold text-foreground">{lesson.title}</h3>
        <div className="mt-auto flex flex-wrap gap-sm">
          <Link href={`/shadowing/${lesson.id}`} aria-label={`${labels.start}: ${lesson.title}`} className="inline-flex min-h-10 items-center rounded-md bg-primary px-md text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            {labels.start}
          </Link>
          <Button type="button" variant="outline" aria-label={`${labels.preview}: ${lesson.title}`} onClick={() => onPreview(lesson)}>
            {labels.preview}
          </Button>
        </div>
      </div>
    </li>
  );
}
