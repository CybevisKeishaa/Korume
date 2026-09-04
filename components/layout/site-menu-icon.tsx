/**
 * §0's three menu glyphs, traced from the Figma export rather than drawn by
 * eye (nodes `433:1448` hamburger, `434:2222` close, `434:2171` chevron).
 *
 * All three arrive from the design as 1.333px round-capped strokes — the
 * hamburger and ✕ in a 16 box at 1.33333, the chevron in a 15 box at 1.25,
 * which is the same weight once scaled (1.25 × 16/15 = 1.3333). So they are
 * normalised onto ONE 16 viewBox at one stroke width instead of carrying two
 * boxes and two numbers that happen to mean the same thing (CLAUDE.md §6).
 * The chevron's points scale with it: 5.625/9.375/3.75/11.25 × 16/15 = 6/10/4/12.
 *
 * `stroke="currentColor"`, not the export's literals: the hamburger and ✕ ship
 * as `#F5F4F0` (`--paper-50`, i.e. `--foreground`) and the chevron as `#FF8A3D`
 * (`--ember-500`, i.e. `--primary`), so the colours are the token system's
 * already and belong on the element that uses the glyph, not baked into it.
 */
interface GlyphProps {
  className?: string;
}

function Glyph({ className, children }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.333}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Three rules — the closed state's affordance. */
export function MenuGlyph({ className }: GlyphProps) {
  return (
    <Glyph className={className}>
      <path d="M2.667 4H13.333" />
      <path d="M2.667 8H13.333" />
      <path d="M2.667 12H13.333" />
    </Glyph>
  );
}

/** The open state's affordance, in the same 32px circle. */
export function CloseGlyph({ className }: GlyphProps) {
  return (
    <Glyph className={className}>
      <path d="M12 4L4 12" />
      <path d="M4 4L12 12" />
    </Glyph>
  );
}

/** The row affordance at the end of every destination. */
export function ChevronRightGlyph({ className }: GlyphProps) {
  return (
    <Glyph className={className}>
      <path d="M6 12L10 8L6 4" />
    </Glyph>
  );
}
