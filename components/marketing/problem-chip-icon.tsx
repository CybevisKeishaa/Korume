/**
 * The six line icons the §2 capability chips carry (spec §13.1.2 — the
 * reference `346:6275` puts an orange line icon above every chip label; the
 * build shipped label-only rectangles).
 *
 * ⚠️ DECORATIVE, ALWAYS. Every chip's meaning lives in its own visible text
 * (`problem.chips.<key>.name` + `.detail`); the glyph repeats nothing and
 * carries nothing. Hence `aria-hidden` + `focusable="false"` on every one —
 * deleting this file would cost the section its texture and no meaning at all.
 *
 * There is no icon library in this repo (no `lucide-react` in package.json),
 * so these are hand-written inline SVG in the house style of
 * `components/layout/notification-bell.tsx`: one `viewBox="0 0 24 24"`, stroke
 * drawing with `currentColor`, round caps and joins. Size comes from the
 * caller's token classes, never from a width/height attribute.
 */

export type ChipKey =
  | "vocabulary"
  | "grammar"
  | "kanji"
  | "pronunciation"
  | "listening"
  | "srs";

/**
 * One glyph per chip key. Written as an element rather than a path string so
 * an icon can mix strokes and dots (grammar's bullets, SRS's centre dot)
 * without a second abstraction.
 */
const GLYPHS: Record<ChipKey, React.ReactNode> = {
  // A word card holding a mark — the reference draws a rounded frame with a
  // small shape inside.
  vocabulary: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="4" />
      <path d="M8.6 12.1c0-1.3 1-2.3 2.2-2.3.5 0 1 .2 1.2.6.3-.4.7-.6 1.2-.6 1.2 0 2.2 1 2.2 2.3 0 1.9-3.4 4.1-3.4 4.1s-3.4-2.2-3.4-4.1Z" />
    </>
  ),
  // A bulleted list — sentence structure, item by item.
  grammar: (
    <>
      <circle cx="5.2" cy="7" r="1" fill="currentColor" stroke="none" />
      <path d="M9.4 7h9.4" />
      <circle cx="5.2" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M9.4 12h6.6" />
      <circle cx="5.2" cy="17" r="1" fill="currentColor" stroke="none" />
      <path d="M9.4 17h8.2" />
    </>
  ),
  // Brush strokes — an abstracted glyph, deliberately not a real character:
  // a decorative mark must not read as content to anyone who can parse it.
  kanji: (
    <>
      <path d="M3.8 6.6h8.4" />
      <path d="M8 3.4v6" />
      <path d="M4.4 12.2h7.2" />
      <path d="M8.6 12.2c0 4.2-1.6 6.4-3.9 8" />
      <path d="M15.2 4c1.9 2.2 3.2 4.6 4 7.2" />
      <path d="M15 14.4h5.4" />
      <path d="M17.7 14.4v6" />
    </>
  ),
  // A pitch contour — the same curve the product's headline differentiator
  // draws for real (CLAUDE.md §5 #1).
  pronunciation: (
    <path d="M3 16.4c1.9-5.6 3.4-7.7 5.3-7.7 1.8 0 2.3 2.4 3.2 4.8.9 2.4 1.9 4.3 3.4 4.3 1.7 0 3.2-2.2 6.1-8.2" />
  ),
  // Headphones — real audio, not a studio recording of a textbook.
  listening: (
    <>
      <path d="M4.6 15.2v-3a7.4 7.4 0 0 1 14.8 0v3" />
      <path d="M4.6 14.6h1.8c.9 0 1.6.7 1.6 1.6v2c0 .9-.7 1.6-1.6 1.6h-.2a1.6 1.6 0 0 1-1.6-1.6v-3.6Z" />
      <path d="M19.4 14.6h-1.8c-.9 0-1.6.7-1.6 1.6v2c0 .9.7 1.6 1.6 1.6h.2c.9 0 1.6-.7 1.6-1.6v-3.6Z" />
    </>
  ),
  // A review cycle closing on a held item — long-term memory.
  srs: (
    <>
      <path d="M20.2 12a8.2 8.2 0 1 1-2.7-6.1" />
      <path d="M20.6 3.8v4.4h-4.4" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
};

export interface ChipIconProps {
  chip: ChipKey;
  className?: string;
}

/**
 * `data-chip-icon` carries the key so a test can prove the six chips get six
 * DIFFERENT glyphs — the cheap failure here is one icon rendered six times,
 * which a presence-only assertion would happily pass.
 */
export function ChipIcon({ chip, className }: ChipIconProps) {
  return (
    <svg
      data-chip-icon={chip}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {GLYPHS[chip]}
    </svg>
  );
}
