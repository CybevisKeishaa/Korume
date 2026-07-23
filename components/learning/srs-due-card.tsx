import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";

export interface SrsDueCardProps {
  /** `getUserStats()`'s `srsDueCount` — vocab + kanji due items combined. */
  srsDueCount: number;
}

/**
 * Dashboard SRS-due widget (Layer 6). `srsDueCount` spans both the vocab and
 * kanji review queues (see `lib/data/user-stats.ts`), so this links to both
 * rather than picking one arbitrarily. A calm, non-nagging empty state when
 * nothing is due — reviews are a resource, not a debt (CLAUDE.md §5 / product
 * principle G3).
 */
export function SrsDueCard({ srsDueCount }: SrsDueCardProps) {
  const t = useTranslations("dashboard");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("srsDue.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {srsDueCount > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              {t("srsDue.due", { count: srsDueCount })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/vocab/review" className={buttonStyles({ variant: "outline", size: "sm" })}>
                {t("srsDue.reviewVocab")}
              </Link>
              <Link href="/kanji/review" className={buttonStyles({ variant: "outline", size: "sm" })}>
                {t("srsDue.reviewKanji")}
              </Link>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("srsDue.allCaughtUp")}</p>
        )}
      </CardContent>
    </Card>
  );
}
