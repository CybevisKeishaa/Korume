"use client";

import { useEffect, useId, useRef } from "react";
import { Link, useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { buttonStyles } from "@/components/ui/button";
import { JLPT_LEVELS } from "@/lib/conversation-types";
import { CountUp } from "@/components/motion/count-up";

export interface Reviewed {
  literal: string;
  again: boolean;
}

const ring = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const tile = cn("relative flex size-[calc(48*var(--density-unit))] items-center justify-center rounded-md bg-background hover:bg-muted active:bg-border", ring);
const wayOn = cn("rounded-sm text-body font-medium text-primary-strong underline-offset-2 hover:underline", ring);

/**
 * End of deck, in the card's own box (spec §6, the owner-approved mock): reviewed and again counts and the way back.
 * The rest of the card holds ways on (owner R16): this session's kanji, each opening its inspect over the review, or —
 * for a deck that was empty from the start — the levels to learn new kanji from; then the library and the dashboard.
 */
export function KanjiReviewEnd({ reviewed, backHref, modalHref }: { reviewed: Reviewed[]; backHref: string; modalHref: (literal: string) => string }) {
  const t = useTranslations("kanji");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const empty = reviewed.length === 0;
  const again = reviewed.filter((item) => item.again).length;

  // The last rating button just unmounted: focus moves to the summary (no ring: a landing point, not a control).
  useEffect(() => {
    if (!empty) heading.current?.focus();
  }, [empty]);

  return (
    <section aria-labelledby={id} className="kanji-card-in grid min-h-0 flex-1 grid-cols-1 gap-xl md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="flex flex-col items-center justify-center gap-md text-center">
        <h2 id={id} ref={heading} tabIndex={-1} className="text-title font-semibold focus-visible:ring-0 focus-visible:ring-offset-0">
          {empty ? t("review.emptyTitle") : t("review.doneTitle")}
        </h2>
        {empty ? (
          <p className="max-w-[40ch] text-body text-muted-foreground">{t("review.emptyBody")}</p>
        ) : (
          <dl className="flex gap-2xl">
            <div className="flex flex-col-reverse items-center">
              <dt className="text-caption text-muted-foreground">{t("review.reviewed")}</dt>
              <dd className="text-display font-semibold tabular-nums"><CountUp value={reviewed.length} /></dd>
            </div>
            <div className="flex flex-col-reverse items-center">
              <dt className="text-caption text-muted-foreground">{tCommon("srs.again")}</dt>
              <dd className="text-display font-semibold tabular-nums text-accent-strong"><CountUp value={again} /></dd>
            </div>
          </dl>
        )}
        <Link href={backHref} className={buttonStyles({ className: "rounded-full font-semibold" })}>{t("review.backToKanji")}</Link>
      </div>

      <div className="flex min-h-0 flex-col justify-center gap-sm md:border-s md:border-border md:ps-xl">
        <div>
          <h3 className="text-caption font-medium text-muted-foreground">{empty ? t("review.learnByLevel") : t("review.sessionKanji")}</h3>
          {!empty && <p className="text-caption text-muted-foreground">{t("review.sessionHint")}</p>}
        </div>
        {empty ? (
          <ul className="flex flex-wrap gap-xs">
            {JLPT_LEVELS.map((level) => (
              <li key={level}>
                <Link href={`/kanji?level=${level}`} className={cn(tile, "font-mono text-body font-medium")}>{level}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <ul tabIndex={0} aria-label={t("review.sessionKanji")} className={cn("flex min-h-0 flex-wrap content-start gap-xs overflow-y-auto rounded-sm", ring)}>
            {reviewed.map((item) => (
              <li key={item.literal}>
                <Link href={modalHref(item.literal)} scroll={false} aria-label={item.again ? t("review.ratedAgain", { literal: item.literal }) : undefined} className={tile}>
                  <span lang="ja" className="font-jp text-heading font-bold">{item.literal}</span>
                  {item.again && <span aria-hidden="true" className="absolute end-2xs top-2xs size-[calc(6*var(--density-unit))] rounded-full bg-accent" />}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-x-lg gap-y-2xs">
          <Link href="/kanji" className={wayOn}>{t("review.library")}</Link>
          <Link href="/dashboard" className={wayOn}>{tNav("dashboard")}</Link>
        </div>
      </div>
    </section>
  );
}
