import { useTranslations } from "@/lib/i18n";
import type { ReflectionFallback } from "@/lib/summary/reflection/fallback";
import type { ReviewTarget, SavedCard } from "@/lib/summary/snapshot";
import { areaProps } from "./area";
import { ReviewList } from "./review-list";
import { SectionHeading } from "./section-heading";

export interface SummaryIslandProps {
  videoId: string;
  youtubeVideoId: string;
  locale: "vi" | "en";
  reviewTargets: ReviewTarget[];
  reviewTargetTotal: number;
  fallback: ReflectionFallback;
  savedCards: SavedCard[];
}

/**
 * The six areas that depend on the AI artifacts or on learner actions, in grid order: reflection, words,
 * expressions, grammar, culture, review. Placeholder sections until the client island lands (plan Task 14).
 */
export function SummaryIsland({ videoId, reviewTargets, reviewTargetTotal }: SummaryIslandProps) {
  const t = useTranslations("shadowing.lessonSummary");
  return (
    <>
      <section {...areaProps("reflection")} aria-label={t("reflection.title")} />
      <section {...areaProps("words")} aria-labelledby="summary-words-title">
        <SectionHeading id="summary-words-title" eyebrow={t("words.eyebrow")} title={t("words.title")} subtitle={t("words.subtitle")} />
      </section>
      <section {...areaProps("expressions")} aria-labelledby="summary-expressions-title">
        <SectionHeading id="summary-expressions-title" eyebrow={t("expressions.eyebrow")} title={t("expressions.title")} subtitle={t("expressions.subtitle")} />
      </section>
      <section {...areaProps("grammar")} aria-labelledby="summary-grammar-title">
        <SectionHeading id="summary-grammar-title" eyebrow={t("grammar.eyebrow")} title={t("grammar.title")} />
      </section>
      <section {...areaProps("culture")} aria-labelledby="summary-culture-title">
        <SectionHeading id="summary-culture-title" eyebrow={t("culture.eyebrow")} title={t("culture.title")} />
      </section>
      <ReviewList videoId={videoId} targets={reviewTargets} total={reviewTargetTotal} />
    </>
  );
}
