"use client";

import { adaptiveShouldShowReading, FuriganaText } from "@/components/video-player/furigana-text";
import type { ReadingFurigana } from "@/lib/preferences/options";
import type { FuriganaSegment } from "@/lib/japanese/types";
import { cn } from "@/lib/utils";
import { useLesson } from "./workspace-context";

/**
 * Whether a line shows its readings before any per-line override — the `shownByMode` the
 * `toggle-line-furigana` action needs (a first press stores `!shownByMode`, so it is a reveal under `adaptive`
 * / `hidden` and a hide under `always`; a second press deletes it, spec §7.8). One rule for Live Sentence and
 * the transcript rows.
 */
export function furiganaShownByMode(mode: ReadingFurigana): boolean {
  return mode === "always";
}

/**
 * One Japanese line with its readings (spec §7.5, §7.8). Ruby flows INLINE with normal wrapping — Figma
 * `105:3676` draws one segment per column, a frame bug the spec's deviation register corrects. The
 * per-line session override (`lineFurigana[id]`, passed in so a row re-renders only when its own override
 * changes: true = every reading, false = none) beats the
 * persisted mode for this line only; under `adaptive` a revealed line shows mastered readings too.
 * Task 7's Full Transcript rows reuse it.
 */
export function RubySentence({ segments, text, mode, override, hidden = false, as: Tag = "p", className }: {
  segments: FuriganaSegment[] | null;
  /** The plain line, rendered as-is when there are no segments. */
  text: string;
  mode: ReadingFurigana;
  /** This line's session override, undefined when none. */
  override: boolean | undefined;
  /** Visually hidden by the caller: keep it out of the accessibility tree too. */
  hidden?: boolean;
  /** `span` inside a button (a transcript row), where a paragraph is not allowed. */
  as?: "p" | "span";
  className?: string;
}) {
  const { masteryMap } = useLesson();
  const show =
    override !== undefined ? () => override
      : mode === "always" ? () => true
        : mode === "hidden" ? () => false
          : adaptiveShouldShowReading(masteryMap);
  return (
    <Tag lang="ja" aria-hidden={hidden || undefined} className={cn("font-jp", className)}>
      {segments?.length ? <FuriganaText segments={segments} shouldShowReading={show} /> : text}
    </Tag>
  );
}
