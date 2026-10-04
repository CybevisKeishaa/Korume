import { Hero } from "./hero";
import { LessonStatusCard } from "./lesson-status-card";
import { NextLessonCard } from "./next-lesson-card";
import type { SummaryPageProps } from "./props";
import { SavedKnowledgeCard } from "./saved-knowledge-card";
import { SummaryHeader } from "./summary-header";
import { SummaryIsland } from "./summary-island";

/**
 * The Summary page (spec §7, Figma `125:1030`). Server-rendered deterministic blocks plus one client island; one
 * DOM in the order hero → reflection → words → expressions → grammar → culture → review → status → saved → next,
 * placed by `.lesson-summary-grid` areas.
 */
export function SummaryPage(props: SummaryPageProps & { locale: "vi" | "en" }) {
  return (
    <div className="min-h-dvh">
      <SummaryHeader videoId={props.videoId} title={props.title} backHref={props.resumeHref} />
      <main className="lesson-summary-grid mx-auto w-full max-w-content px-md py-lg">
        <Hero
          title={props.title}
          thumbnailUrl={props.thumbnailUrl}
          completed={props.completed}
          jlptLevel={props.jlptLevel}
          sentenceCount={props.sentenceCount}
          durationMinutes={props.durationMinutes}
          replayHref={props.replayHref}
          resumeHref={props.resumeHref}
        />
        <SummaryIsland
          videoId={props.videoId}
          youtubeVideoId={props.youtubeVideoId}
          locale={props.locale}
          reviewTargets={props.reviewTargets}
          reviewTargetTotal={props.reviewTargetTotal}
          fallback={props.fallback}
          savedCards={props.savedCards}
        />
        <LessonStatusCard status={props.status} />
        <SavedKnowledgeCard saved={props.saved} />
        {props.nextLesson && <NextLessonCard next={props.nextLesson} />}
      </main>
    </div>
  );
}
