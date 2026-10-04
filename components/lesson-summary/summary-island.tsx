"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import type { AnalysisResponse } from "@/lib/summary/analysis/view";
import type { ReflectionFallback } from "@/lib/summary/reflection/fallback";
import type { ReflectionResponse, ReflectionView } from "@/lib/summary/reflection/view";
import type { ReviewTarget, SavedCard } from "@/lib/summary/snapshot";
import { AnalysisBlocks } from "./analysis-blocks";
import { ClipPlayerProvider } from "./clip-player";
import { ReflectionCard } from "./reflection-card";
import { ReviewList } from "./review-list";
import { type PollPolicy, usePolledResource } from "./use-polled-resource";

export interface SummaryIslandProps {
  videoId: string;
  youtubeVideoId: string;
  locale: "vi" | "en";
  hasTranscript: boolean;
  reviewTargets: ReviewTarget[];
  reviewTargetTotal: number;
  fallback: ReflectionFallback;
  savedCards: SavedCard[];
}

export const analysisPolicy: PollPolicy<AnalysisResponse> = {
  waitMs: (body) => (body.status === "pending" ? body.retryAfterMs : null),
  needsPost: (body) => body.status === "not_ready",
};

/** `stale` shows the old text AND asks for a fresh one: a stale reflection is never treated as current. */
export const reflectionPolicy: PollPolicy<ReflectionResponse> = {
  waitMs: (body) => (body.state === "pending" ? body.retryAfterMs : null),
  needsPost: (body) => body.state === "not_found" || body.state === "stale",
};

const NO_TRANSCRIPT: AnalysisResponse = { status: "no_transcript" };

/**
 * The six areas that depend on the AI artifacts or on learner actions, in grid order: reflection, words,
 * expressions, grammar, culture, review. Analysis is polled first; the reflection chain starts once it settles.
 */
export function SummaryIsland({ videoId, youtubeVideoId, locale, hasTranscript, reviewTargets, reviewTargetTotal, fallback, savedCards }: SummaryIslandProps) {
  const t = useTranslations("shadowing.lessonSummary");
  // The last AI text stays on screen: a later `fallback` or `pending` answer never erases it.
  const [shown, setShown] = useState<ReflectionView | null>(null);
  const analysis = usePolledResource<AnalysisResponse>({
    url: `/api/videos/${videoId}/lesson-analysis?locale=${locale}`,
    postBody: { locale },
    enabled: hasTranscript,
    policy: analysisPolicy,
  });
  usePolledResource<ReflectionResponse>({
    url: `/api/videos/${videoId}/lesson-reflection?locale=${locale}`,
    postBody: { locale },
    enabled: analysis.settled,
    policy: reflectionPolicy,
    onBody: (body) => {
      if ("reflection" in body && body.reflection) setShown(body.reflection);
    },
  });

  const analysisReady = analysis.body?.status === "ready";
  const [announced, setAnnounced] = useState(false);
  useEffect(() => {
    if (analysisReady) setAnnounced(true);
  }, [analysisReady]);

  return (
    <ClipPlayerProvider youtubeVideoId={youtubeVideoId}>
      <p role="status" aria-live="polite" className="sr-only">{announced ? t("ai.ready") : ""}</p>
      <ReflectionCard reflection={shown} fallback={fallback} videoId={videoId} reviewTargetTotal={reviewTargetTotal} />
      <AnalysisBlocks response={hasTranscript ? analysis.body : NO_TRANSCRIPT} onRetry={analysis.retry} savedCards={savedCards} />
      <ReviewList videoId={videoId} targets={reviewTargets} total={reviewTargetTotal} />
    </ClipPlayerProvider>
  );
}
