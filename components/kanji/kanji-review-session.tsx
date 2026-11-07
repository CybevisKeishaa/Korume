"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, Eye, Flame, RotateCcw, X, Zap } from "lucide-react";
import { Link, usePathname, useRouter, useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { kanjiModalHref } from "@/lib/kanji/href";
import type { KanjiReviewCard } from "@/lib/data/kanji-review";
import { REVIEW_SUBMITTED_EVENT } from "@/lib/nav/nav-state";
import { GRADES } from "@/components/learning/review-session";
import { useStudyPresence } from "@/components/study-time/use-study-presence";
import { KanjiReviewEnd, type Reviewed } from "./kanji-review-end";

const AGAIN = GRADES[0].quality;
const ICONS = { again: RotateCcw, hard: Zap, good: Check, easy: ChevronRight } as const;
const ring = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const quiet = cn("inline-flex items-center gap-2xs rounded-full text-muted-foreground hover:text-foreground", ring);
// Figma 280:1314 on its 1536 canvas (1 frame px = 1 density unit): deck header 1040 wide, card and footer 820.
const wide = "w-full max-w-[calc(1040*var(--density-unit))]";
const narrow = "w-full max-w-[calc(820*var(--density-unit))]";

/** A key that belongs to something else: the inspect modal (or any dialog / menu) over the session, or a text field. */
const notOurs = (target: EventTarget | null) =>
  target instanceof Element && target.closest('[role="dialog"], dialog, [role="menu"], input, textarea, select, [contenteditable="true"]') !== null;

/**
 * The kanji review screen (Figma `280:1314`, spec §6, the owner-approved post-reveal / end-of-deck mock) inside the
 * `(focus)` chrome: slim bar, deck header, one card that keeps its box through every state, footer. One viewport at
 * 1280×529 and 1440×900 (owner K1): the card takes the height left over and the glyph is capped to its face.
 *
 * The session is prompt → answer → grade (owner K7). Flashcard's answer step is the learner's own reveal; a later mode
 * (multiple choice, cloze, listen-and-type) brings its own answer step in place of `revealed` and still grades through
 * `grade(quality)`. Nothing maps right/wrong to a grade automatically. SM-2 stays on the server (`/api/srs/review`).
 */
export function KanjiReviewSession({ cards, deckLabel, streak, backHref }: { cards: KanjiReviewCard[]; deckLabel: string; streak: number | null; backHref: string }) {
  useStudyPresence({ surface: "srs_review", contextId: "kanji" });
  const t = useTranslations("kanji");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // Opening the inspect (`?kanji=`) re-renders the server page with a re-queried deck: the session keeps its own.
  const [deck] = useState(cards);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState<number | null>(null);
  const [reviewed, setReviewed] = useState<Reviewed[]>([]);
  const face = useRef<HTMLElement>(null);
  const retry = useRef<HTMLButtonElement>(null);
  // Set synchronously: a key press and a click in one tick must not POST the same card twice.
  const inFlight = useRef(false);

  const card = deck[index];
  const done = !card;
  const total = deck.length;
  const percent = total === 0 ? 0 : Math.round((reviewed.length / total) * 100);

  // Owner 2026-11-07: focus lands on the card itself (no ring, not a control) after a reveal and after every rating,
  // so the reveal button / a clicked rating button never keeps it — Space reveals the next card, 1–4 rate, every time.
  // The end of deck focuses its own heading instead.
  useEffect(() => {
    if (!done) face.current?.focus({ preventScroll: true });
  }, [revealed, done]); // a rating always un-reveals, so this also runs after every rating

  // A failed save disables the button that was pressed: focus goes to Retry, not to body.
  useEffect(() => {
    if (failed !== null) retry.current?.focus();
  }, [failed]);

  const grade = useCallback(
    async (quality: number) => {
      if (!card || inFlight.current) return;
      inFlight.current = true;
      setSubmitting(true);
      setFailed(null);
      try {
        const res = await fetch("/api/srs/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemType: "kanji", itemId: card.literal, quality }),
        });
        if (!res.ok) throw new Error(`Review failed (${res.status})`);
        window.dispatchEvent(new Event(REVIEW_SUBMITTED_EVENT));
        setReviewed((list) => [...list, { literal: card.literal, again: quality === AGAIN }]);
        setRevealed(false);
        setIndex((i) => i + 1);
      } catch (e) {
        console.error(e); // the raw text never reaches the DOM (it is neither translated nor useful to a learner)
        setFailed(quality);
      } finally {
        inFlight.current = false;
        setSubmitting(false);
      }
    },
    [card],
  );

  // Space flips the card both ways (owner 2026-11-07; a focused button or link keeps its own Space), 1–4 rate once
  // revealed, Esc leaves.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing || event.defaultPrevented || notOurs(event.target)) return;
      if (event.key === "Escape") return router.push(backHref);
      if (done) return;
      if (event.key === " " && !submitting) {
        if (event.target instanceof Element && event.target.closest("button, a[href]")) return;
        event.preventDefault();
        return setRevealed((shown) => !shown);
      }
      const match = revealed ? GRADES.find((g) => g.key === event.key) : undefined;
      if (match) {
        event.preventDefault();
        void grade(match.quality);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, done, submitting, grade, router, backHref]);

  return (
    <div className="flex min-h-dvh flex-col md:h-dvh">
      <header className="flex h-[calc(56*var(--density-unit))] shrink-0 items-center gap-sm border-b border-border px-xl">
        <Link href={backHref} aria-label={t("review.back")} title={t("review.back")} className={cn(quiet, "size-control-sm justify-center hover:bg-muted")}>
          <ArrowLeft aria-hidden="true" className="size-icon-sm" />
        </Link>
        <span className="text-body font-semibold">Korume</span>
        <span aria-hidden="true" className="h-[calc(14*var(--density-unit))] w-px bg-border" />
        <h1 className="text-body text-muted-foreground">{t("review.practice")}</h1>
        <div className="ms-auto flex items-center gap-md">
          <span className="font-mono text-caption text-muted-foreground">{deckLabel}</span>
          <span className="font-mono text-caption tabular-nums">{tCommon("srs.progress", { current: done ? total : index + 1, total })}</span>
          <Link href="/kanji" className={cn(quiet, "px-2xs text-body")}>
            <X aria-hidden="true" className="size-icon-sm" />
            {t("review.exit")}
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-sm px-xl py-sm">
        <div className={cn(wide, "shrink-0")}>
          <div className="flex items-baseline justify-between gap-md">
            <p className="flex items-baseline gap-xs">
              <span className="text-caption text-muted-foreground">{t("review.currentDeck")}</span>
              <span className="text-body font-medium">{deckLabel}</span>
            </p>
            <span className="font-mono text-caption tabular-nums text-muted-foreground">{t("review.cardOf", { current: done ? total : index + 1, total })}</span>
          </div>
          <div role="progressbar" aria-label={t("review.progress")} aria-valuemin={0} aria-valuemax={total} aria-valuenow={reviewed.length} className="mt-xs h-[3px] rounded-full bg-border">
            <div className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-base ease-out-expo rtl:origin-right" style={{ transform: `scaleX(${percent / 100})` }} />
          </div>
        </div>

        {/* Motion (globals.css "Kanji motion"): the face leaves while a rating saves, the next one steps in, the answer slides in. */}
        <article ref={face} tabIndex={-1} data-leaving={submitting || undefined} className={cn(narrow, "outline-none flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card px-xl py-md md:max-h-[calc(560*var(--density-unit))]")}>
          {done ? (
            <KanjiReviewEnd reviewed={reviewed} backHref={backHref} modalHref={(literal) => kanjiModalHref(pathname, search, literal)} />
          ) : (
            <>
              <div key={index} className="kanji-face kanji-card-in flex shrink-0 items-center justify-between">
                {card.level ? (
                  <span className="rounded-full border border-border bg-muted px-sm font-mono text-caption">{t("quickInspect.jlpt", { level: card.level })}</span>
                ) : <span />}
                <span className="inline-flex items-center gap-2xs font-mono text-caption text-muted-foreground">
                  <span aria-hidden="true" className={cn("size-[calc(6*var(--density-unit))] rounded-full", card.isNew ? "bg-primary" : "bg-success")} />
                  {card.isNew ? t("review.new") : t("inspect.inReview")}
                </span>
              </div>

              <div className="kanji-face flex min-h-0 flex-1 flex-col">
                <div aria-live="polite" className="flex min-h-0 flex-1 gap-lg">
                  <div key={index} className="kanji-card-in flex min-h-0 min-w-0 flex-1 items-center justify-center [container-type:size]">
                    <p lang="ja" data-type-exempt="kanji-review-glyph" className="font-jp text-[length:min(var(--kanji-review-glyph),66cqh)] font-medium leading-[1.5]">{card.literal}</p>
                  </div>
                  {revealed && (
                    <section
                      // Not a tab stop (owner 2026-11-07: no focus box on the flashcard): the answer fits the card at
                      // 1280×529 and 1440×900. ponytail: re-add tabIndex if an answer can ever overflow.
                      aria-label={t("review.answer")} className="kanji-answer-in flex min-h-0 min-w-0 flex-[1.5] flex-col justify-center gap-xs overflow-y-auto">
                      {card.hanViet.length > 0 && <p className="text-display font-semibold">{card.hanViet.join(", ")}</p>}
                      <p className="text-heading">{card.meaningsEn.join(", ")}</p>
                      <dl className="flex flex-wrap gap-x-xl gap-y-2xs">
                        {([[t("onReading"), card.on], [t("kunReading"), card.kun]] as const).map(([label, readings]) =>
                          readings.length > 0 && (
                            <div key={label}>
                              <dt className="text-caption text-muted-foreground">{label}</dt>
                              <dd lang="ja" className="font-jp text-body-lg">{readings.join("、")}</dd>
                            </div>
                          ),
                        )}
                      </dl>
                      {card.meaningVi && (
                        <p className="flex items-baseline gap-xs">
                          <span className="text-caption text-muted-foreground">{t("review.vietnamese")}</span>
                          <span className="text-body-lg">{card.meaningVi}</span>
                        </p>
                      )}
                      <Link href={kanjiModalHref(pathname, search, card.literal)} scroll={false} className={cn("self-start rounded-sm text-body text-primary-strong underline underline-offset-2 focus-visible:ring-inset", ring)}>
                        {t("review.details")}
                      </Link>
                    </section>
                  )}
                </div>
                {!revealed && (
                  <div className="flex shrink-0 flex-col items-center gap-xs pt-xs">
                    <p className="text-body text-muted-foreground">{t("review.prompt")}</p>
                    <button type="button" onClick={() => setRevealed(true)} aria-keyshortcuts="Space" className={cn("inline-flex h-control-sm items-center gap-xs rounded-full border border-border bg-muted px-md text-body font-medium hover:bg-secondary active:translate-y-px", ring)}>
                      <Eye aria-hidden="true" className="size-icon-sm" />
                      {t("review.reveal")}
                      <kbd className="font-mono text-caption text-muted-foreground">{t("review.space")}</kbd>
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-sm shrink-0 border-t border-border pt-sm">
                {failed !== null ? (
                  <p role="alert" className="flex items-center justify-center gap-sm text-caption text-danger-strong">
                    {t("review.saveFailed")}
                    <button ref={retry} type="button" onClick={() => void grade(failed)} disabled={submitting} className={cn("rounded-sm font-medium text-foreground underline underline-offset-2", ring)}>
                      {tCommon("actions.retry")}
                    </button>
                  </p>
                ) : (
                  <p className="text-center font-mono text-caption text-muted-foreground">{revealed ? t("review.rate") : t("review.rateLocked")}</p>
                )}
                <div className="mt-xs grid grid-cols-2 gap-sm sm:grid-cols-4">
                  {GRADES.map((g) => {
                    const Icon = ICONS[g.labelKey];
                    return (
                      <button
                        key={g.labelKey}
                        type="button"
                        disabled={!revealed || submitting}
                        onClick={() => void grade(g.quality)}
                        aria-keyshortcuts={g.key}
                        className={cn("relative flex flex-col items-start gap-2xs rounded-md border border-border bg-secondary px-md py-xs text-start hover:bg-muted active:translate-y-px disabled:pointer-events-none disabled:opacity-40", ring)}
                      >
                        <Icon aria-hidden="true" className="size-icon-sm text-muted-foreground" />
                        <span className="text-body-lg font-medium">{tCommon(`srs.${g.labelKey}`)}</span>
                        <kbd className="absolute end-sm top-xs font-mono text-caption text-muted-foreground">{g.key}</kbd>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </article>

        <footer className={cn(narrow, "flex shrink-0 flex-wrap items-center justify-between gap-x-lg text-caption text-muted-foreground")}>
          <div className="flex items-center gap-lg">
            {total > 0 && (
              <>
                <span className="font-medium tabular-nums text-foreground">{t("review.complete", { percent })}</span>
                <span className="tabular-nums">{t("review.remaining", { count: total - reviewed.length })}</span>
              </>
            )}
            {streak !== null && (
              <span className="inline-flex items-center gap-2xs tabular-nums">
                <Flame aria-hidden="true" className="size-icon-xs text-primary-strong" />
                {t("review.streak", { count: streak })}
              </span>
            )}
          </div>
          {total > 0 && <span>{reviewed.length > 0 ? t("review.encourage") : t("review.encourageStart")}</span>}
        </footer>
      </div>
    </div>
  );
}
