import type { HubContinueLesson, HubLesson } from "@/lib/data/shadowing-hub";
import type { VideoRecommendation } from "@/lib/recommendation-types";
import { HubLessonCard } from "./hub-lesson-card";
import { HubSectionHeading } from "./hub-section-heading";
import { HubEmptyState } from "./hub-empty-state";

interface ShelfEmptyCopy {
  title: string;
  body: string;
}

export function HubShelves({ recentlyAdded, popular, continueLearning, recommendations, labels }: { recentlyAdded: HubLesson[]; popular: HubLesson[]; continueLearning: HubContinueLesson[]; recommendations: VideoRecommendation[]; labels: { recentlyAdded: string; popular: string; continueLearning: string; recommended: string; start: string; continue: string; noThumbnail: string; recommendationReason: (percent: number) => string; empty: { popular: ShelfEmptyCopy; continueLearning: ShelfEmptyCopy; recentlyAdded: ShelfEmptyCopy; recommended: ShelfEmptyCopy } } }) {
  const card = (lesson: HubLesson, action: string) => <HubLessonCard key={lesson.id} lesson={lesson} href={`/shadowing/${lesson.id}`} actionLabel={action} noThumbnailLabel={labels.noThumbnail} />;
  const sections: Array<{ title: string; cards: JSX.Element[]; empty: ShelfEmptyCopy }> = [
    { title: labels.popular, cards: popular.map((lesson) => card(lesson, labels.start)), empty: labels.empty.popular },
    { title: labels.continueLearning, cards: continueLearning.map(({ lesson }) => card(lesson, labels.continue)), empty: labels.empty.continueLearning },
    { title: labels.recentlyAdded, cards: recentlyAdded.map((lesson) => card(lesson, labels.start)), empty: labels.empty.recentlyAdded },
    { title: labels.recommended, cards: recommendations.map((rec) => <HubLessonCard key={rec.videoId} lesson={{ id: rec.videoId, youtubeVideoId: rec.youtubeVideoId, title: rec.title, durationSeconds: null, thumbnailUrl: rec.thumbnailUrl, jlptLevelEstimate: rec.jlptLevelEstimate }} href={`/shadowing/${rec.videoId}`} actionLabel={labels.start} noThumbnailLabel={labels.noThumbnail} detail={rec.reason?.kind === "known-word-fit" ? labels.recommendationReason(Math.round(rec.reason.knownRatio * 100)) : undefined} />), empty: labels.empty.recommended },
  ];

  return (
    <div className="space-y-3xl">
      {sections.map((section) => (
        <section key={section.title} aria-label={section.title}>
          <HubSectionHeading title={section.title} />
          {section.cards.length ? (
            <ul className="mt-md grid grid-cols-1 gap-md sm:grid-cols-2">{section.cards}</ul>
          ) : (
            <HubEmptyState title={section.empty.title} body={section.empty.body} />
          )}
        </section>
      ))}
    </div>
  );
}
