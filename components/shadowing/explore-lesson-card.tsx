import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import type { ExploreLesson } from "@/lib/data/shadowing-explore";
import { Button } from "@/components/ui/button";

export interface ExploreLessonCardLabels {
  start: string;
  preview: string;
  noThumbnail: string;
  minutesTemplate: string;
  linesTemplate: string;
  grammarWordsTemplate: string;
  grammarUnavailable: string;
}

export function ExploreLessonCard({ lesson, eyebrow, labels, onPreview }: {
  lesson: ExploreLesson;
  eyebrow: string;
  labels: ExploreLessonCardLabels;
  onPreview: (lesson: ExploreLesson) => void;
}) {
  return (
    <li className="flex h-[298px] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-raised">
      <div className="relative h-28 shrink-0 overflow-hidden bg-muted">
        {lesson.thumbnailUrl ? (
          <Image src={lesson.thumbnailUrl} alt="" fill sizes="(min-width: 1280px) 18.5rem, (min-width: 640px) 50vw, 100vw" className="object-cover opacity-65" />
        ) : (
          <div className="flex h-full items-center justify-center text-body text-muted-foreground">{labels.noThumbnail}</div>
        )}
        {lesson.jlptLevelEstimate ? (
            <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2 py-1 text-[8px] font-semibold leading-3 text-foreground">
            {lesson.jlptLevelEstimate}
            </span>
          ) : null}
        <Button type="button" variant="ghost" size="sm" aria-label={`${labels.preview}: ${lesson.title}`} onClick={() => onPreview(lesson)} className="absolute bottom-2 right-2 h-7 px-2 text-[9px]">
          {labels.preview}
        </Button>
      </div>
      <div className="h-[186px] shrink-0 p-4">
        <p className="h-3 truncate text-[8px] font-semibold uppercase leading-3 tracking-[1.04px] text-primary">{eyebrow}</p>
        <h3 className="h-[26px] truncate pt-2 text-caption font-semibold text-foreground">{lesson.title}</h3>
        <p className="h-9 line-clamp-2 pt-1 text-[9px] leading-4 text-muted-foreground">{lesson.summary ?? "\u00a0"}</p>
        <div className="h-4 pt-3" aria-hidden="true"><div className="h-1 overflow-hidden rounded-full bg-foreground/10"><div className="h-full w-0 bg-primary" /></div></div>
        <div className="flex h-6 items-end justify-between text-[8px] leading-3 text-muted-foreground">
          <span>{labels.minutesTemplate.replace("{count}", lesson.durationSeconds === null ? "—" : String(Math.max(1, Math.round(lesson.durationSeconds / 60))))}</span>
          <span>{labels.linesTemplate.replace("{count}", String(lesson.lineCount))}</span>
        </div>
        <div className="h-10 pt-3">
          <div className="flex h-7 items-center justify-between border-t border-border/70">
          <span className="text-[8px] leading-3 text-muted-foreground">
            {lesson.grammarCount === null || lesson.vocabularyCount === null
              ? labels.grammarUnavailable
              : labels.grammarWordsTemplate.replace("{grammar}", String(lesson.grammarCount)).replace("{words}", String(lesson.vocabularyCount))}
          </span>
          <Link href={`/shadowing/${lesson.id}`} aria-label={`${labels.start}: ${lesson.title}`} className="inline-flex h-7 items-center text-[9px] font-semibold text-primary transition-colors hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            {labels.start}
          </Link>
          </div>
        </div>
      </div>
    </li>
  );
}
