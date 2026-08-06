"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { FuriganaSegment, TranscriptLineRow } from "@/lib/video-types";

export interface MineLineControlProps {
  line: TranscriptLineRow;
}

type Status = "idle" | "submitting" | "success" | "error";

interface KanjiSegment {
  text: string;
  reading: string;
}

function kanjiSegmentsOf(line: TranscriptLineRow): KanjiSegment[] {
  return (line.furigana_json ?? [])
    .filter((segment): segment is FuriganaSegment & { reading: string } =>
      Boolean(segment.reading && segment.reading.length > 0),
    )
    .map((segment) => ({ text: segment.text, reading: segment.reading }));
}

/**
 * Tap-to-mine affordance for one transcript line (CLAUDE.md §5 differentiator
 * #3). Opens a small popover listing the line's kanji-bearing segments as
 * one-tap targets; a line with no kanji (kana-only) falls back to a manual
 * text field. Posts straight to `POST /api/mining` — the API derives the
 * sentence/timestamps server-side, so this only ever sends `lineId` +
 * `targetWord`(+`reading`). Never stores or downloads media (CLAUDE.md §2).
 */
export function MineLineControl({ line }: MineLineControlProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [manualWord, setManualWord] = useState("");
  const popoverId = useId();
  const inputId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement | HTMLInputElement>(null);
  const t = useTranslations("mining");

  const kanjiSegments = kanjiSegmentsOf(line);

  useEffect(() => {
    if (open) firstOptionRef.current?.focus();
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
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function mine(targetWord: string, reading?: string): Promise<void> {
    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/mining", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineId: line.id, targetWord, ...(reading ? { reading } : {}) }),
      });

      if (res.status === 201) {
        setStatus("success");
        setMessage(t("mine.added", { word: targetWord }));
        setOpen(false);
        setManualWord("");
        triggerRef.current?.focus();
        return;
      }
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        setStatus("error");
        setMessage(
          retryAfter
            ? t("mine.rateLimited", { seconds: retryAfter })
            : t("mine.rateLimitedGeneric"),
        );
        return;
      }
      setStatus("error");
      setMessage(t("mine.error"));
    } catch {
      setStatus("error");
      setMessage(t("mine.error"));
    }
  }

  function handleManualSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = manualWord.trim();
    if (trimmed) void mine(trimmed);
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={popoverId}
        className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {t("mine.trigger")}
      </button>

      {open && (
        <div
          id={popoverId}
          role="group"
          aria-label={t("mine.a11y.pickWord")}
          className="absolute right-0 z-10 mt-1 w-56 rounded-md border border-border bg-card p-2 shadow-overlay"
        >
          {kanjiSegments.length > 0 ? (
            <ul className="space-y-1">
              {kanjiSegments.map((segment, index) => (
                <li key={`${segment.text}-${index}`}>
                  <button
                    ref={index === 0 ? (firstOptionRef as React.RefObject<HTMLButtonElement>) : undefined}
                    type="button"
                    onClick={() => void mine(segment.text, segment.reading)}
                    disabled={status === "submitting"}
                    className="w-full rounded px-2 py-1 text-left font-jp text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                  >
                    {segment.text}
                    <span className="ml-1 text-xs text-muted-foreground">{segment.reading}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <form onSubmit={handleManualSubmit} className="flex items-center gap-1">
              <label className="sr-only" htmlFor={inputId}>
                {t("mine.a11y.wordLabel")}
              </label>
              <input
                ref={firstOptionRef as React.RefObject<HTMLInputElement>}
                id={inputId}
                type="text"
                value={manualWord}
                onChange={(event) => setManualWord(event.target.value)}
                placeholder={t("mine.placeholder")}
                disabled={status === "submitting"}
                className="w-full rounded border border-input bg-card px-2 py-1 text-sm font-jp"
              />
              <button
                type="submit"
                disabled={status === "submitting" || !manualWord.trim()}
                className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                {t("mine.add")}
              </button>
            </form>
          )}
        </div>
      )}

      <p
        role={status === "error" ? "alert" : "status"}
        aria-live={status === "error" ? "assertive" : "polite"}
        className={cn("mt-1 max-w-40 text-right text-xs", status === "error" ? "text-danger-strong" : "text-muted-foreground")}
      >
        {message}
      </p>
    </div>
  );
}
