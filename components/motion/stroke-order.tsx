"use client";

import { useTheme } from "@/components/providers/theme-provider";
import { useTranslations } from "@/lib/i18n";
import { KANJI_STROKES } from "@/lib/kanji-strokes";

const STROKE_DURATION = 0.6; // seconds per stroke

/**
 * Animated kanji stroke-order (differentiator, spec §9). Draws each stroke in
 * order. Under reduce-motion the full glyph is shown statically (strokes
 * pre-drawn), never hidden. Characters without stroke data fall back to the
 * font glyph.
 */
export function StrokeOrder({ character }: { character: string }) {
  const { reduceMotion } = useTheme();
  const t = useTranslations("kanji");
  const strokes = KANJI_STROKES[character];

  if (!strokes) {
    return (
      <div
        aria-hidden
        className="flex aspect-square w-full items-center justify-center rounded-lg border border-border bg-card font-jp text-7xl"
      >
        {character}
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 109 109"
      role="img"
      aria-label={t("a11y.strokeOrder", { character })}
      className="aspect-square w-full rounded-lg border border-border bg-card text-foreground"
    >
      {/* writing guide */}
      <line x1="54.5" y1="0" x2="54.5" y2="109" className="stroke-border" strokeDasharray="4 4" strokeWidth={1} />
      <line x1="0" y1="54.5" x2="109" y2="54.5" className="stroke-border" strokeDasharray="4 4" strokeWidth={1} />
      {strokes.paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className={reduceMotion ? undefined : "stroke-draw"}
          style={
            reduceMotion ? undefined : { animationDelay: `${i * STROKE_DURATION}s` }
          }
        />
      ))}
    </svg>
  );
}
