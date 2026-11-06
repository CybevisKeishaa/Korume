"use client";

import { useRef } from "react";
import { Heart } from "lucide-react";
import { Link, useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { kanjiPageHref } from "@/lib/kanji/href";
import type { KanjiExplore, KanjiFavorite } from "@/lib/kanji/learner-types";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const wayOn = cn("shrink-0 rounded-sm text-caption font-medium text-primary-strong underline-offset-2 hover:underline", focusRing);
// Shown only where the page has the height for it (owner K14); below it the core blocks keep the whole screen.
const tall = "hidden [@media(min-height:800px)]:flex";
const tile = cn("flex flex-col items-center justify-center rounded-md bg-background px-2xs py-xs hover:bg-muted active:bg-border", focusRing);

function Way({ title, h: H, links, className, children }: { title: string; h: "h2" | "h3"; links: { href: string; label: string }[]; className: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className={cn(tall, "min-h-0 flex-col gap-xs rounded-lg border border-border p-sm", className)}>
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-sm gap-y-2xs">
        <H className="me-auto text-caption font-medium text-muted-foreground">{title}</H>
        {links.map((link) => <Link key={link.href} href={link.href} className={wayOn}>{link.label}</Link>)}
      </div>
      {children}
    </section>
  );
}

/**
 * The `/kanji/[literal]` page's ways on (owner K14): where the page is taller than the inspect content, the rest of
 * the screen holds the curated level this kanji is in and the learner's saved kanji, each a door to its own page,
 * plus the level list, the level review and the library. Real data only: no level row for a dictionary-only kanji.
 */
export function KanjiInspectExplore({ literal, hanViet, favorite, onFavorite, explore, h }: { literal: string; hanViet: string[]; favorite: boolean; onFavorite: () => void; explore: KanjiExplore; h: "h2" | "h3" }) {
  const t = useTranslations("kanji");
  const { level } = explore;
  // "Save this kanji" unmounts once the strip fills: hand keyboard focus to the strip instead of dropping it on body.
  const focusStrip = useRef(false);
  // The ♡ in the header changes the strip at once: newest first, as the /kanji strip orders it.
  const listed = explore.favorites.some((item) => item.literal === literal);
  const saved: KanjiFavorite[] = favorite
    ? listed ? explore.favorites : [{ literal, hanViet }, ...explore.favorites]
    : explore.favorites.filter((item) => item.literal !== literal);

  return (
    <>
      {level && (
        <Way
          title={t("explore.levelTitle", { level: level.level })}
          h={h}
          className="col-span-2"
          links={[
            { href: `/kanji?level=${level.level}`, label: t("explore.levelAll", { level: level.level }) },
            { href: `/kanji/review?level=${level.level}`, label: t("explore.levelReview", { level: level.level }) },
          ]}
        >
          <ul tabIndex={0} aria-label={t("explore.levelTitle", { level: level.level })} className={cn("grid min-h-0 grid-cols-[repeat(auto-fill,minmax(calc(48*var(--density-unit)),1fr))] content-start gap-2xs overflow-y-auto rounded-sm", focusRing)}>
            {level.literals.map((item) => (
              <li key={item}>
                <Link
                  href={kanjiPageHref(item)}
                  aria-current={item === literal ? "page" : undefined}
                  lang="ja"
                  className={cn(tile, "font-jp text-heading font-bold", item === literal && "bg-primary/10 text-primary-strong hover:bg-primary/10")}
                >
                  {item}
                </Link>
              </li>
            ))}
          </ul>
        </Way>
      )}
      <Way title={t("saved")} h={h} className={level ? "col-span-1" : "col-span-3"} links={[{ href: "/kanji", label: t("explore.library") }]}>
        {saved.length > 0 ? (
          <ul
            ref={(el) => {
              if (el && focusStrip.current) {
                focusStrip.current = false;
                el.focus();
              }
            }}
            tabIndex={0}
            aria-label={t("saved")} className={cn("grid min-h-0 grid-cols-[repeat(auto-fill,minmax(calc(64*var(--density-unit)),1fr))] content-start gap-2xs overflow-y-auto rounded-sm", focusRing)}>
            {saved.map((item) => (
              <li key={item.literal}>
                <Link href={kanjiPageHref(item.literal)} aria-current={item.literal === literal ? "page" : undefined} className={tile}>
                  <span lang="ja" className="font-jp text-heading font-bold">{item.literal}</span>
                  {item.hanViet.length > 0 && <span title={item.hanViet.join(", ")} className="max-w-full truncate text-caption text-muted-foreground">{item.hanViet.join(", ")}</span>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-start gap-xs">
            <p className="text-body text-muted-foreground">{t("explore.savedEmpty")}</p>
            {/* The empty strip is an invitation: the same toggle as the header ♡. */}
            <button type="button" onClick={() => { focusStrip.current = true; onFavorite(); }}className={cn("inline-flex h-control-sm items-center gap-2xs rounded-full border border-border bg-background px-sm text-caption font-medium text-foreground hover:bg-muted active:bg-border", focusRing)}>
              <Heart aria-hidden="true" className="size-icon-sm" />
              {t("explore.saveThis")}
            </button>
          </div>
        )}
      </Way>
    </>
  );
}
