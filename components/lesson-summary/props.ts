import type { LoadedSummary } from "@/lib/summary/load-snapshot";
import type { NextLesson, SummaryNavigation } from "@/lib/summary/navigation";
import { buildReflectionFallback, type ReflectionFallback } from "@/lib/summary/reflection/fallback";
import {
  REVIEW_TARGET_DISPLAY_LIMIT,
  type LessonStatus,
  type ReviewTarget,
  type SavedCard,
  type SavedKnowledge,
} from "@/lib/summary/snapshot";

/** Everything the Summary page renders, as plain JSON: it crosses the RSC → client boundary into the island. */
export interface SummaryPageProps {
  videoId: string;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string | null;
  jlptLevel: string | null;
  sentenceCount: number;
  durationMinutes: number | null;
  completed: boolean;
  hasTranscript: boolean;
  status: LessonStatus;
  saved: SavedKnowledge;
  reviewTargets: ReviewTarget[];
  reviewTargetTotal: number;
  nextLesson: NextLesson | null;
  replayHref: string;
  resumeHref: string;
  fallback: ReflectionFallback;
  savedCards: SavedCard[];
}

export function toSummaryProps(data: LoadedSummary, navigation: SummaryNavigation): SummaryPageProps {
  const { video, snapshot } = data;
  return {
    videoId: video.id,
    youtubeVideoId: video.youtubeVideoId,
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    jlptLevel: video.jlptLevel,
    sentenceCount: data.lines.length,
    durationMinutes: video.durationSeconds ? Math.max(1, Math.round(video.durationSeconds / 60)) : null,
    completed: data.completed,
    hasTranscript: data.hasTranscript,
    status: snapshot.status,
    saved: snapshot.savedKnowledge,
    reviewTargets: snapshot.reviewTargets.slice(0, REVIEW_TARGET_DISPLAY_LIMIT),
    reviewTargetTotal: snapshot.reviewTargets.length,
    nextLesson: navigation.nextLesson,
    replayHref: navigation.replayHref,
    resumeHref: navigation.resumeHref,
    fallback: buildReflectionFallback(snapshot),
    savedCards: data.saved,
  };
}
