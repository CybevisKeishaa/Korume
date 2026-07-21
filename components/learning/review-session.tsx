"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import type { ItemType } from "@/lib/validation/content";
import type { ReviewItem } from "@/lib/learning-types";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type { ReviewItem };

/**
 * Anki-style grades mapped to SM-2 quality (0–5). `labelKey` is the leaf
 * under `common.srs.*` — this component is shared by `/kanji/review` and
 * `/vocab/review` (Task 8), which is why its strings live in `common`, not a
 * per-module namespace (CLAUDE.md P4). `components/video-player/
 * mining-review-session.tsx` (Task 12) mirrors this component and consumes
 * the same keys.
 */
const GRADES = [
  { labelKey: "again", quality: 1, key: "1" },
  { labelKey: "hard", quality: 3, key: "2" },
  { labelKey: "good", quality: 4, key: "3" },
  { labelKey: "easy", quality: 5, key: "4" },
] as const;

export function ReviewSession({
  itemType,
  items,
  backHref,
}: {
  itemType: ItemType;
  items: ReviewItem[];
  backHref: string;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(0);
  const firstGradeRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations("common");

  const current = items[index];
  const done = index >= items.length;

  // Keep keyboard focus continuous: land on the first grade button on reveal.
  useEffect(() => {
    if (revealed) firstGradeRef.current?.focus();
  }, [revealed]);

  const grade = useCallback(
    async (quality: number) => {
      if (!current || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/srs/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemType, itemId: current.id, quality }),
        });
        if (!res.ok) throw new Error(`Review failed (${res.status})`);
        setReviewed((n) => n + 1);
        setRevealed(false);
        setIndex((i) => i + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("srs.error"));
      } finally {
        setSubmitting(false);
      }
    },
    [current, itemType, submitting, t],
  );

  // Keyboard: Space/Enter reveals; 1–4 grade once revealed.
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
        <p className="text-muted-foreground">{t("srs.empty")}</p>
        <Link href={backHref} className={buttonStyles({ className: "mt-4" })}>
          {t("srs.back")}
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center" role="status">
        <p className="text-2xl font-bold">{t("srs.complete")}</p>
        <p className="mt-2 text-muted-foreground">
          {t("srs.reviewedCount", { count: reviewed })}
        </p>
        <Link href={backHref} className={buttonStyles({ className: "mt-6" })}>
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
        <p className="font-jp text-4xl">{current!.front}</p>
        {revealed && (
          <div className="border-t border-border pt-3" aria-live="polite">
            {current!.sub && (
              <p className="font-jp text-lg text-muted-foreground">{current!.sub}</p>
            )}
            <p className="text-lg">{current!.back}</p>
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
          <Button
            size="lg"
            className="w-full"
            onClick={() => setRevealed(true)}
            autoFocus
          >
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
