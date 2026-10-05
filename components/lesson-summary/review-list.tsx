import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import type { ReviewTarget } from "@/lib/summary/snapshot";
import { areaProps } from "./area";
import { SectionHeading } from "./section-heading";

/** Spec §7.2 Review: deterministic targets from the snapshot; each opens its line in Shadowing. */
export function ReviewList({ videoId, targets, total }: { videoId: string; targets: ReviewTarget[]; total: number }) {
  const t = useTranslations("shadowing.lessonSummary.review");
  return (
    <section {...areaProps("review")} aria-labelledby="summary-review-title" className="space-y-md">
      <SectionHeading id="summary-review-title" eyebrow={t("eyebrow")} title={t("title")} />
      {targets.length === 0 ? (
        <p className="text-body text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-sm">
          {targets.map((target) => (
            <li key={target.lineId} className="flex items-center gap-md rounded-lg border border-border bg-card p-md">
              <div className="min-w-0 flex-1 space-y-2xs">
                <p className="flex flex-wrap gap-2xs">
                  {target.reasons.map((reason) => <Badge key={reason} variant="primary">{t(`reason.${reason}`)}</Badge>)}
                </p>
                <p lang="ja" className="truncate text-body">{target.lineText}</p>
              </div>
              <Link
                href={`/shadowing/${videoId}?line=${target.lineId}`}
                className="shrink-0 rounded-md px-xs py-2xs text-caption font-semibold text-primary-strong hover:bg-primary/10"
              >
                {t("again")}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > targets.length && <p className="text-caption text-muted-foreground">{t("more", { count: total - targets.length })}</p>}
    </section>
  );
}
