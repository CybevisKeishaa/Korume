"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import type { ItemType } from "@/lib/validation/content";
import type { ReviewItem } from "@/lib/learning-types";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type { ReviewItem };

/** Anki-style grades mapped to SM-2 quality (0–5). */
const GRADES = [
  { label: "Again", quality: 1, key: "1" },
  { label: "Hard", quality: 3, key: "2" },
  { label: "Good", quality: 4, key: "3" },
  { label: "Easy", quality: 5, key: "4" },
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
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setSubmitting(false);
      }
    },
    [current, itemType, submitting],
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
        <p className="text-muted-foreground">Nothing to review here yet.</p>
        <Link href={backHref} className={buttonStyles({ className: "mt-4" })}>
          Back
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center" role="status">
        <p className="text-2xl font-bold">Session complete 🎉</p>
        <p className="mt-2 text-muted-foreground">
          You reviewed {reviewed} item{reviewed === 1 ? "" : "s"}.
        </p>
        <Link href={backHref} className={buttonStyles({ className: "mt-6" })}>
          Done
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-center text-sm text-muted-foreground" aria-live="polite">
        {index + 1} / {items.length}
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
            Show answer <span className="ml-2 text-xs opacity-70">(Space)</span>
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {GRADES.map((g, i) => (
              <Button
                key={g.label}
                ref={i === 0 ? firstGradeRef : undefined}
                variant="outline"
                onClick={() => grade(g.quality)}
                disabled={submitting}
              >
                {g.label}
                <span className="ml-1 text-xs opacity-70">{g.key}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
