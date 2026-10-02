"use client";

import { useTheme } from "@/components/providers/theme-provider";
import { useTranslations } from "@/lib/i18n";

const STROKE_DURATION = 0.6; // seconds per stroke

/**
 * Animated kanji stroke-order (differentiator, spec §9). Draws each stroke in
 * order from `paths` — KanjiVG geometry on a 109×109 grid, read from the
 * active dictionary snapshot by `getKanjiData` and sanitised on import. Under
 * reduce-motion the full glyph is shown statically (strokes pre-drawn), never
 * hidden. Without geometry it falls back to the font glyph. A new `replayKey`
 * remounts the strokes so the animation plays again.
 */
export function StrokeOrder({
  character,
  paths,
  replayKey = 0,
}: {
  character: string;
  paths?: string[];
  replayKey?: number;
}) {
  const { reduceMotion } = useTheme();
  const t = useTranslations("kanji");

  if (!paths || paths.length === 0) {
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
      <g key={replayKey}>
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            className={reduceMotion ? undefined : "stroke-draw"}
            style={reduceMotion ? undefined : { animationDelay: `${i * STROKE_DURATION}s` }}
          />
        ))}
      </g>
    </svg>
  );
}
