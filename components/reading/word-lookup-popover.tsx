"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface WordLookupPopoverProps {
  /** The word (or, when no word-boundary data exists, whole sentence) tapped. */
  word: string;
  /** Hiragana reading, when known (word-level lookup only). */
  reading?: string;
  /** Visible content of the trigger — the word/sentence itself, possibly with furigana. */
  children: React.ReactNode;
  className?: string;
}

/**
 * Tap-to-lookup affordance for one word/sentence inside a reading passage
 * (CLAUDE.md §5 differentiator #3's UI half). Opens a small inline popover
 * showing the word + its reading.
 *
 * "Add to flashcard" gap: `POST /api/mining` (the existing sentence-mining
 * endpoint — see `lib/validation/mining.ts`) requires a `lineId` that is a
 * foreign key into `transcript_lines`, which only exist for video transcripts.
 * Reading passages have no transcript line, so there is no schema-compatible
 * way to mint a card from here without a backend/schema change (out of scope
 * for frontend-engineer — see the Layer 5 reading-UI handoff report). This
 * component therefore ships lookup-only: the action is visible so users know
 * it's coming, but stays disabled with a visible (not just title-attribute)
 * explanation rather than firing a request that would always fail.
 */
export function WordLookupPopover({ word, reading, children, className }: WordLookupPopoverProps) {
  const t = useTranslations("reading");
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const isEmpty = word.trim().length === 0;

  return (
    <span ref={containerRef} className={cn("relative inline", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={open ? popoverId : undefined}
        disabled={isEmpty}
        className={cn(
          "rounded-sm underline decoration-dotted decoration-muted-foreground/60 underline-offset-4",
          "hover:decoration-foreground focus-visible:decoration-foreground",
          "disabled:no-underline disabled:pointer-events-none",
        )}
      >
        {children}
      </button>

      {open && (
        <span
          id={popoverId}
          role="group"
          aria-label={t("wordLookup.lookUp", { word })}
          className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-border bg-card p-3 text-left shadow-overlay"
        >
          <span className="flex items-start justify-between gap-2">
            <span className="font-jp block text-base" lang="ja">
              {word}
              {reading && (
                <span className="ml-2 text-sm text-muted-foreground">{reading}</span>
              )}
            </span>
            <button
              ref={closeRef}
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label={t("wordLookup.close")}
              className="shrink-0 rounded px-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              ×
            </button>
          </span>

          <span className="mt-2 block">
            <button
              type="button"
              disabled
              className="w-full rounded-md bg-muted px-2 py-1.5 text-sm font-medium text-muted-foreground disabled:cursor-not-allowed"
            >
              {t("wordLookup.addToFlashcard")}
            </button>
            <span className="mt-1 block text-xs text-muted-foreground">
              {t("wordLookup.addToFlashcardExplanation")}
            </span>
          </span>
        </span>
      )}
    </span>
  );
}
