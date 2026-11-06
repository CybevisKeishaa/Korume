import { getTranslations } from "@/lib/i18n/server";
import { Skeleton } from "@/components/ui/skeleton";

/** The review's frame while the deck loads: the same bar, header, card and footer boxes, so nothing jumps after. */
export default async function KanjiReviewLoading() {
  const t = await getTranslations("kanji");
  return (
    <div role="status" aria-label={t("review.loading")} className="flex min-h-dvh flex-col md:h-dvh">
      <div className="flex h-[calc(56*var(--density-unit))] shrink-0 items-center gap-sm border-b border-border px-xl">
        <Skeleton className="h-control-sm w-1/4" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-sm px-xl py-sm">
        <Skeleton className="h-[calc(28*var(--density-unit))] w-full max-w-[calc(1040*var(--density-unit))]" />
        <Skeleton className="min-h-0 w-full max-w-[calc(820*var(--density-unit))] flex-1 rounded-lg md:max-h-[calc(560*var(--density-unit))]" />
        <Skeleton className="h-[calc(18*var(--density-unit))] w-full max-w-[calc(820*var(--density-unit))]" />
      </div>
    </div>
  );
}
