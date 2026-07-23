"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MiningQueueItem } from "@/lib/mining-types";
import { splitSentenceForEmphasis } from "@/lib/mining-format";
import { MiningClipPlayer } from "./mining-clip-player";

/**
 * Anki-style grades mapped to SM-2 quality (0–5) — mirrors
 * `components/learning/review-session.tsx`. `labelKey` is the leaf under
 * `common.srs.*`, resolved via `t(\`srs.${g.labelKey}\`)` in render (no
 * `t()` at module scope).
 */
const GRADES = [
  { labelKey: "again", quality: 1, key: "1" },
  { labelKey: "hard", quality: 3, key: "2" },
  { labelKey: "good", quality: 4, key: "3" },
  { labelKey: "easy", quality: 5, key: "4" },
] as const;

export interface MiningReviewSessionProps {
  items: MiningQueueItem[];
}

/**
 * SM-2 review session for the sentence-mining deck (CLAUDE.md §5
 * differentiator #3) — mirrors `components/learning/review-session.tsx`'s
 * flow/keyboard shortcuts, adapted for a card whose front is a sentence with
 * its target word emphasized plus a "Play clip" replay control, and whose
 * back is the reading + translation.
 */
export function MiningReviewSession({ items }: MiningReviewSessionProps) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(0);
  const firstGradeRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations("common");
  const tMining = useTranslations("mining");

  const current = items[index];
  const done = index >= items.length;

  useEffect(() => {
    if (revealed) firstGradeRef.current?.focus();
  }, [revealed]);

  const grade = useCallback(
    async (quality: number) => {
      if (!current || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/mining/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: current.id, quality }),
        });
        if (!res.ok) throw new Error(`Review failed (${res.status})`);
        setReviewed((n) => n + 1);
        setRevealed(false);
        setIndex((i) => i + 1);
      } catch (e) {
        // The raw exception text (an HTTP status, a browser-locale network
        // error like "Failed to fetch") must never reach the DOM — it can't
        // be translated and leaks English/browser copy to VI users. Log it
        // for support/debugging and show only the translated generic
        // fallback (spec P1/CLAUDE.md §5; mirrors Task 7's
        // `components/learning/review-session.tsx` fix).
        console.error(e);
        setError(t("states.error"));
      } finally {
        setSubmitting(false);
      }
    },
    [current, submitting, t],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed) {
        const g = GRADES.find((x) => x.key === e.key);
        if (g) {
          e.preventDefault();
          void grade(g.quality);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, done, grade]);

  if (items.length === 0) {
    return (
      <div className="text-center">
        <p className="text-muted-foreground">{tMining("review.empty")}</p>
        <Link href="/mining" className={buttonStyles({ className: "mt-4" })}>
          {tMining("review.backToDeck")}
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center" role="status">
        <p className="text-2xl font-bold">{t("srs.complete")}</p>
        <p className="mt-2 text-muted-foreground">
          {tMining("review.reviewedCount", { count: reviewed })}
        </p>
        <Link href="/mining" className={buttonStyles({ className: "mt-6" })}>
          {t("srs.done")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-center text-sm text-muted-foreground" aria-live="polite">
        {t("srs.progress", { current: index + 1, total: items.length })}
      </p>

      <Card className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-jp text-2xl leading-relaxed">
          {splitSentenceForEmphasis(current!.sentenceJp, current!.targetWord).map((segment, i) =>
            segment.emphasized ? (
              <strong key={i} className="text-primary-strong underline decoration-2 underline-offset-2">
                {segment.text}
              </strong>
            ) : (
              <span key={i}>{segment.text}</span>
            ),
          )}
        </p>

        <MiningClipPlayer
          videoId={current!.videoId}
          startTime={current!.startTime}
          endTime={current!.endTime}
        />

        {revealed && (
          <div className="border-t border-border pt-3" aria-live="polite">
            {current!.reading && (
              <p className="font-jp text-lg text-muted-foreground">{current!.reading}</p>
            )}
            {current!.translation && <p className="text-lg">{current!.translation}</p>}
          </div>
        )}
      </Card>

      {error && (
        <p role="alert" className="mt-3 text-center text-sm text-danger-strong">
          {error}
        </p>
      )}

      <div className="mt-6">
        {!revealed ? (
          <Button size="lg" className="w-full" onClick={() => setRevealed(true)} autoFocus>
            {t("srs.showAnswer")} <span className="ml-2 text-xs opacity-70">{t("srs.spaceHint")}</span>
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {GRADES.map((g, i) => (
              <Button
                key={g.labelKey}
                ref={i === 0 ? firstGradeRef : undefined}
                variant="outline"
                onClick={() => grade(g.quality)}
                disabled={submitting}
              >
                {t(`srs.${g.labelKey}`)}
                <span className="ml-1 text-xs opacity-70">{g.key}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
