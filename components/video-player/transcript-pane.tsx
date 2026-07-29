"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "@/lib/i18n";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";
import type { FuriganaDisplayMode, FuriganaSegment, TranscriptLineRow, VocabMasteryMap } from "@/lib/video-types";
import { FuriganaText } from "./furigana-text";
import { MineLineControl } from "./mine-line-control";
import { PinLineControl } from "./pin-line-control";

export interface TranscriptPaneProps {
  lines: TranscriptLineRow[];
  /** id of the line whose [start_time, end_time) contains the current playback time, or null. */
  activeLineId: string | null;
  onLineSelect: (line: TranscriptLineRow) => void;
  /**
   * "adaptive" hides a reading only for words in `masteryMap` (CLAUDE.md
   * §5.4); "all"/"off" are the old hard on/off states.
   */
  furiganaMode: FuriganaDisplayMode;
  /** word/reading -> srs_stage for mastered vocab; consulted only in "adaptive" mode. */
  masteryMap: VocabMasteryMap;
  showTranslation: boolean;
  /** DB video id, threaded into a gifted pin's payload. Optional — a pin is
   * anchored by its transcript line id, so the pin control renders either way. */
  videoId?: string;
  className?: string;
}

/** Adaptive furigana seam: hide a reading once its word is mastered. */
function shouldShowReading(masteryMap: VocabMasteryMap) {
  return (segment: FuriganaSegment): boolean => !(segment.text in masteryMap);
}

/**
 * Scrollable transcript line list. Highlights the active line and keeps it
 * in view, seeks the player when a line is clicked or activated via
 * keyboard (native <button> — Enter/Space work for free).
 */
export function TranscriptPane({
  lines,
  activeLineId,
  onLineSelect,
  furiganaMode,
  masteryMap,
  showTranslation,
  videoId,
  className,
}: TranscriptPaneProps) {
  const t = useTranslations("shadowing");
  const { reduceMotion } = useTheme();
  const activeRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (!activeLineId) return;
    activeRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
  }, [activeLineId, reduceMotion]);

  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("player.transcriptEmpty")}</p>;
  }

  return (
    <ol className={cn("space-y-1", className)} aria-label={t("player.a11y.transcript")}>
      {lines.map((line) => {
        const isActive = line.id === activeLineId;
        return (
          <li
            key={line.id}
            ref={isActive ? activeRef : undefined}
            className="flex items-start gap-1"
          >
            <button
              type="button"
              onClick={() => onLineSelect(line)}
              aria-current={isActive ? "true" : undefined}
              data-active={isActive || undefined}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-left transition-colors",
                isActive
                  ? "bg-primary/10 text-foreground ring-1 ring-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="font-jp block text-base leading-relaxed">
                {line.furigana_json && line.furigana_json.length > 0 ? (
                  <FuriganaText
                    segments={line.furigana_json}
                    mode={furiganaMode === "all" ? "all" : "none"}
                    shouldShowReading={
                      furiganaMode === "adaptive" ? shouldShowReading(masteryMap) : undefined
                    }
                  />
                ) : (
                  line.text_jp
                )}
              </span>
              {showTranslation && line.text_translation && (
                <span className="mt-1 block text-sm text-muted-foreground">
                  {line.text_translation}
                </span>
              )}
            </button>
            <MineLineControl line={line} />
            <PinLineControl line={line} videoId={videoId} />
          </li>
        );
      })}
    </ol>
  );
}
