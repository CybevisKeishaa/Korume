"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n";
import type { FuriganaSegment } from "@/lib/reading-types";
import { splitIntoSentences } from "@/lib/reading-format";
import { FuriganaToggle } from "./furigana-toggle";
import { WordLookupPopover } from "./word-lookup-popover";

export interface ReadingBodyProps {
  bodyJp: string;
  /** null when lazy furigana generation failed server-side (see `lib/data/reading.ts`). */
  furiganaJson: FuriganaSegment[] | null;
}

/** A segment/sentence with only whitespace or punctuation isn't worth a lookup popover. */
function isLookupable(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}

/**
 * Reading passage body: a furigana on/off toggle (CLAUDE.md §5.4 — a plain
 * toggle here, not the mastery-adaptive one the shadowing transcript uses,
 * per the Layer 5 task) plus tap-to-lookup on every word (CLAUDE.md §5
 * differentiator #3's UI half, `components/video-player/mine-line-control.tsx`'s
 * sibling for the reading module).
 *
 * When `furiganaJson` is null (generation failed), word boundaries are
 * unknown, so lookup falls back to sentence-level chunks instead of leaving
 * the passage fully inert.
 */
export function ReadingBody({ bodyJp, furiganaJson }: ReadingBodyProps) {
  const t = useTranslations("reading");
  const segments = furiganaJson ?? [];
  const hasFurigana = segments.length > 0;
  const [showFurigana, setShowFurigana] = useState(hasFurigana);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{t("body.heading")}</h2>
        <FuriganaToggle
          pressed={hasFurigana && showFurigana}
          onToggle={() => setShowFurigana((v) => !v)}
          disabled={!hasFurigana}
        />
      </div>

      <p className="font-jp text-lg leading-loose" lang="ja">
        {hasFurigana
          ? segments.map((segment, index) =>
              isLookupable(segment.text) ? (
                <WordLookupPopover key={index} word={segment.text} reading={segment.reading}>
                  {showFurigana && segment.reading ? (
                    <ruby>
                      {segment.text}
                      <rt>{segment.reading}</rt>
                    </ruby>
                  ) : (
                    segment.text
                  )}
                </WordLookupPopover>
              ) : (
                // eslint-disable-next-line react/no-array-index-key -- segments are a stable, non-reorderable render of one passage.
                <span key={index}>{segment.text}</span>
              ),
            )
          : splitIntoSentences(bodyJp).map((sentence, index) =>
              isLookupable(sentence) ? (
                <WordLookupPopover key={index} word={sentence}>
                  {sentence}
                </WordLookupPopover>
              ) : (
                // eslint-disable-next-line react/no-array-index-key -- sentences are a stable, non-reorderable render of one passage.
                <span key={index}>{sentence}</span>
              ),
            )}
      </p>

      {!hasFurigana && (
        <p className="text-xs text-muted-foreground">{t("body.noFurigana")}</p>
      )}
    </div>
  );
}
