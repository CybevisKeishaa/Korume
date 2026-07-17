import { Link } from "@/lib/i18n/navigation";
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review queue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {srsDueCount > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              {srsDueCount} card{srsDueCount === 1 ? "" : "s"} due for review
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/vocab/review" className={buttonStyles({ variant: "outline", size: "sm" })}>
                Review vocab
              </Link>
              <Link href="/kanji/review" className={buttonStyles({ variant: "outline", size: "sm" })}>
                Review kanji
              </Link>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">All caught up — nothing due right now.</p>
        )}
      </CardContent>
    </Card>
  );
}
