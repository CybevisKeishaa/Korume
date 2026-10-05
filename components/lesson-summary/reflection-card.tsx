"use client";

import { buttonStyles } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import type { ReflectionFallback } from "@/lib/summary/reflection/fallback";
import type { ReflectionView } from "@/lib/summary/reflection/view";
import { areaProps } from "./area";
import { Clamp, ExpandableCard } from "./expandable-card";
import { ReviewTomorrowButton } from "./review-tomorrow-button";

/**
 * Spec §5.5/§7.2 reflection: the AI text (eyebrow "AI Korume") with its highlight quoted by the UI, or the
 * deterministic fallback (eyebrow "Korume"). Open Memory and Review Tomorrow sit under it.
 */
export function ReflectionCard({ reflection, fallback, videoId, reviewTargetTotal }: {
  reflection: ReflectionView | null;
  fallback: ReflectionFallback;
  videoId: string;
  reviewTargetTotal: number;
}) {
  const t = useTranslations("shadowing.lessonSummary.reflection");
  const fallbackText =
    fallback.kind === "best_line" ? t("fallback.bestLine", { line: fallback.line })
    : fallback.kind === "target" ? t("fallback.target", { line: fallback.line })
    : t(`fallback.${fallback.state}`);
  return (
    <ExpandableCard {...areaProps("reflection")} role="region" aria-labelledby="summary-reflection-title" className="flex flex-col gap-md p-lg">
      <div className="space-y-2xs">
        <p className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{reflection ? t("eyebrowAi") : t("eyebrow")}</p>
        <h2 id="summary-reflection-title" className="text-body font-semibold">{t("title")}</h2>
      </div>
      <Clamp lines={4} className="text-body">
        {reflection ? (
          <>
            {reflection.text}
            {reflection.highlight && <> <span lang="ja" className="font-semibold">「{reflection.highlight.span}」</span></>}
          </>
        ) : fallbackText}
      </Clamp>
      <div className="flex flex-wrap items-start gap-sm">
        <Link href="/companion" className={buttonStyles({ variant: "outline", size: "sm" })}>{t("openMemory")}</Link>
        <ReviewTomorrowButton videoId={videoId} reviewTargetTotal={reviewTargetTotal} />
      </div>
    </ExpandableCard>
  );
}
