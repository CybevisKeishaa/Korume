import type { HubContinueLesson, HubLesson } from "@/lib/data/shadowing-hub";
import type { VideoRecommendation } from "@/lib/recommendation-types";
import { HubLessonCard } from "./hub-lesson-card";
import { HubSectionHeading } from "./hub-section-heading";

export function HubShelves({ featured, recentlyAdded, popular, continueLearning, recommendations, labels }: { featured: HubLesson | null; recentlyAdded: HubLesson[]; popular: HubLesson[]; continueLearning: HubContinueLesson[]; recommendations: VideoRecommendation[]; labels: { featured: string; recentlyAdded: string; popular: string; continueLearning: string; recommended: string; start: string; continue: string; noThumbnail: string } }) {
  const card = (lesson: HubLesson, action: string) => <HubLessonCard key={lesson.id} lesson={lesson} href={`/shadowing/${lesson.id}`} actionLabel={action} noThumbnailLabel={labels.noThumbnail} />;
  const sections: Array<{ title: string; cards: JSX.Element[] }> = [];
  if (featured) sections.push({ title: labels.featured, cards: [card(featured, labels.start)] });
  if (continueLearning.length) sections.push({ title: labels.continueLearning, cards: continueLearning.map(({ lesson }) => card(lesson, labels.continue)) });
  if (recentlyAdded.length) sections.push({ title: labels.recentlyAdded, cards: recentlyAdded.map((lesson) => card(lesson, labels.start)) });
  if (popular.length) sections.push({ title: labels.popular, cards: popular.map((lesson) => card(lesson, labels.start)) });
  if (recommendations.length) sections.push({ title: labels.recommended, cards: recommendations.map((rec) => card({ id: rec.videoId, youtubeVideoId: rec.youtubeVideoId, title: rec.title, durationSeconds: null, thumbnailUrl: rec.thumbnailUrl, jlptLevelEstimate: rec.jlptLevelEstimate }, labels.start)) });
  return <div className="space-y-3xl">{sections.map((section) => <section key={section.title} aria-label={section.title}><HubSectionHeading title={section.title} /><ul className="mt-md grid grid-cols-1 gap-md sm:grid-cols-2">{section.cards}</ul></section>)}</div>;
}
