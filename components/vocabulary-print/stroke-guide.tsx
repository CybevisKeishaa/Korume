import type { StrokeGuide } from "@/lib/strokes/types";

const GRID = 109;
const clamp = (value: number) => Math.min(GRID - 6, Math.max(6, value));

/** Spec W W5: one complete diagram per grapheme, numbered at each stroke's start; practice only. */
export function StrokeGuideRow({ glyphs, guides, label }: { glyphs: string[]; guides: Record<string, StrokeGuide>; label: string }) {
  if (!glyphs.some((glyph) => guides[glyph])) return null;
  return (
    <div className="vp-guides">
      <span className="vp-guides-label">{label}</span>
      {glyphs.map((glyph, index) => {
        const guide = guides[glyph];
        if (!guide) return null;
        return (
          <svg key={index} viewBox={`0 0 ${GRID} ${GRID}`} className="vp-guide" aria-hidden="true">
            <line x1="54.5" y1="0" x2="54.5" y2="109" className="vp-guide-cross" />
            <line x1="0" y1="54.5" x2="109" y2="54.5" className="vp-guide-cross" />
            {guide.strokes.map((stroke, order) => <path key={order} d={stroke.d} className="vp-guide-stroke" />)}
            {guide.strokes.map((stroke, order) => stroke.start && (
              <g key={order}>
                <circle cx={stroke.start[0]} cy={stroke.start[1]} r="2.6" className="vp-guide-dot" />
                <text x={clamp(stroke.start[0] - 8)} y={clamp(stroke.start[1] - 3)} className="vp-guide-number">{order + 1}</text>
              </g>
            ))}
          </svg>
        );
      })}
    </div>
  );
}
