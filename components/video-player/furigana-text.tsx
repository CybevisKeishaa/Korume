import type { FuriganaSegment } from "@/lib/video-types";

export type FuriganaMode = "all" | "none";

export interface FuriganaTextProps {
  segments: FuriganaSegment[];
  /**
   * "all": show every segment's reading. "none": render plain text, no
   * `<rt>`. Defaults to "all". Ignored for a segment when `shouldShowReading`
   * is provided.
   */
  mode?: FuriganaMode;
  /**
   * Per-segment override — return true to show that segment's reading. This
   * is the seam the adaptive-furigana task (spec §5.4 / CLAUDE.md §5.4)
   * hooks into: it can show readings only for words the user hasn't
   * mastered yet, instead of a global on/off switch. Takes precedence over
   * `mode` when provided.
   */
  shouldShowReading?: (segment: FuriganaSegment, index: number) => boolean;
  className?: string;
}

/**
 * Renders furigana-annotated Japanese text using semantic `<ruby>`/`<rt>`
 * elements — never `dangerouslySetInnerHTML` (CLAUDE.md §6). Segments with no
 * `reading` (kana/punctuation) always render as plain text.
 */
export function FuriganaText({
  segments,
  mode = "all",
  shouldShowReading,
  className,
}: FuriganaTextProps) {
  return (
    <span className={className} lang="ja">
      {segments.map((segment, index) => {
        const canShow = segment.reading != null && segment.reading.length > 0;
        const showReading =
          canShow && (shouldShowReading ? shouldShowReading(segment, index) : mode === "all");

        if (showReading) {
          return (
            <ruby key={index}>
              {segment.text}
              <rt>{segment.reading}</rt>
            </ruby>
          );
        }
        // eslint-disable-next-line react/no-array-index-key -- segments are a stable, non-reorderable render of one transcript line.
        return <span key={index}>{segment.text}</span>;
      })}
    </span>
  );
}
