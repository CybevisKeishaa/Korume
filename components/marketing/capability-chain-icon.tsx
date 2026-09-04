/**
 * The eight line icons the §6 capability chain carries, one per node.
 *
 * ⚠️ DECORATIVE, ALWAYS. Every node's meaning lives in its own visible text
 * (`chain.nodes.<key>.name` + `.caption`); the glyph repeats nothing and
 * carries nothing. Hence `aria-hidden` + `focusable="false"` on every one —
 * deleting this file would cost the section its texture and no meaning at all.
 *
 * There is no icon library in this repo (no `lucide-react` in package.json),
 * so these are hand-written inline SVG in the house style of
 * `problem-chip-icon.tsx`: one `viewBox="0 0 24 24"`, stroke drawing with
 * `currentColor`, round caps and joins. Size and colour come from the caller's
 * token classes, never from a width/height attribute and never from an inline
 * `stroke="hsl(var(--primary))"` (which would freeze the tone at the glyph).
 *
 * ## What each glyph is, and where it comes from — AND where the two sources disagree
 *
 * Read off Figma `347:6835`, the §6 frame, one 18x18 `Icon` per node — the
 * eight are `347:6848`, `:6862`, `:6875`, `:6893`, `:6907`, `:6924`, `:6938`,
 * `:6953`. **The frame is the icon source used below — this stays true after
 * the correction in this docblock.** An earlier version of this comment
 * claimed the flattened reference render `346:6275` draws the same eight
 * shapes "shape for shape." That claim was false and has been withdrawn:
 * a reviewer cropped the reference icons at 14x and found the frame and the
 * reference DISAGREE on at least four of the eight —
 *
 *   grammar             frame: sparkles, one large and two small.
 *                        reference (x406-434, y1324-1350): a closed A/chevron
 *                        outline — no sparkle shape at all.
 *   video (& context)    frame: a play mark inside a ring.
 *                        reference (x52-80): a padlock/bag body with a
 *                        shackle arc on top — no play mark.
 *   jlpt                 frame: a shield with a check inside.
 *                        reference: a square badge, not a shield.
 *   conversation         frame: a speaker cone with two sound arcs.
 *                        reference: a speech-bubble blob with a dot — no
 *                        cone, no arcs.
 *
 * (`shadowing`, `kanji`, `vocabulary`, `memory` were not re-litigated here;
 * treat them as unverified against the reference, not as confirmed matches.)
 *
 * **Controller ruling: the frame `347:6835` REMAINS the icon source. The
 * glyphs below are NOT redrawn to chase the reference.** `346:6275` is a
 * flattened PNG export, and this plan already refuses to take *copy* from
 * that export for exactly this reason — a small raster mark is unreliable
 * evidence, and a ~28px icon glyph is that same class of evidence. The frame
 * is vector truth; the export is not. This divergence is recorded here for
 * the design owner to resolve (retire one source, or accept the mismatch),
 * not resolved by an implementer's own redraw. A successor can re-check it
 * in one step: open `346:6275` at the coordinates above and compare against
 * the glyphs this file draws.
 *
 * The glyphs actually drawn (per the frame, `347:6835`):
 *
 *   video         play mark inside a ring
 *   shadowing     headphones
 *   kanji         a brush-stroke glyph beside a Latin A — the "languages" mark
 *   vocabulary    an open book
 *   grammar       sparkles, one large and two small
 *   jlpt          a shield with a check inside
 *   conversation  a speaker cone with two sound arcs
 *   memory        a robot head with an antenna
 *
 * ⚠️ `kanji`'s left half is an ABSTRACTED brush stroke, deliberately not a
 * real character — the same rule `problem-chip-icon.tsx` states for its own
 * kanji glyph: a decorative mark must not read as content to anyone who can
 * parse it. The frame draws 文; this draws a mark in its spirit instead.
 */

export type ChainIconKey =
  | "video"
  | "shadowing"
  | "kanji"
  | "vocabulary"
  | "grammar"
  | "jlpt"
  | "conversation"
  | "memory";

/**
 * One glyph per node key. Written as an element rather than a path string so a
 * glyph can mix strokes with filled details (the robot's eyes) without a second
 * abstraction — the shape `problem-chip-icon.tsx` established.
 */
const GLYPHS: Record<ChainIconKey, React.ReactNode> = {
  video: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M10.3 8.7 15.8 12l-5.5 3.3Z" />
    </>
  ),
  shadowing: (
    <>
      <path d="M4.8 14.6v-2.4a7.2 7.2 0 0 1 14.4 0v2.4" />
      <path d="M4.8 13.8h1.9c.8 0 1.5.7 1.5 1.5v2.5c0 .8-.7 1.5-1.5 1.5h-.4a1.5 1.5 0 0 1-1.5-1.5v-4Z" />
      <path d="M19.2 13.8h-1.9c-.8 0-1.5.7-1.5 1.5v2.5c0 .8.7 1.5 1.5 1.5h.4c.8 0 1.5-.7 1.5-1.5v-4Z" />
    </>
  ),
  kanji: (
    <>
      <path d="M3 6.1h8.4" />
      <path d="M7.2 3.2v2.9" />
      <path d="M10.6 8.6c-1 3.1-3.3 5.3-6.8 6.6" />
      <path d="M5.4 10.2c1.2 2.5 3 4.2 5.4 5" />
      <path d="m13.4 20.8 3.6-8 3.6 8" />
      <path d="M14.8 17.9h4.4" />
    </>
  ),
  vocabulary: (
    <>
      <path d="M12 7.4v12.2" />
      <path d="M12 7.4C10.7 6 8.9 5.3 6.7 5.3H3.5v12h3.2c2.2 0 4 .8 5.3 2.3" />
      <path d="M12 7.4c1.3-1.4 3.1-2.1 5.3-2.1h3.2v12h-3.2c-2.2 0-4 .8-5.3 2.3" />
    </>
  ),
  grammar: (
    <>
      <path d="M10.4 3.9 12.2 8.5 16.8 10.3 12.2 12.1 10.4 16.7 8.6 12.1 4 10.3 8.6 8.5Z" />
      <path d="M18.6 3.6v3.2" />
      <path d="M17 5.2h3.2" />
      <path d="M6.2 17.2v2.8" />
      <path d="M4.8 18.6h2.8" />
    </>
  ),
  jlpt: (
    <>
      <path d="M12 3.1 19.3 5.8v5.4c0 4.3-2.9 7.7-7.3 9.5-4.4-1.8-7.3-5.2-7.3-9.5V5.8Z" />
      <path d="m8.8 11.9 2.2 2.2 4.2-4.3" />
    </>
  ),
  conversation: (
    <>
      <path d="M11.3 4.5 6.6 8.5H3.3v7h3.3l4.7 4Z" />
      <path d="M15.1 9.3a3.9 3.9 0 0 1 0 5.4" />
      <path d="M17.9 6.7a7.7 7.7 0 0 1 0 10.6" />
    </>
  ),
  memory: (
    <>
      <rect x="3.7" y="8.4" width="16.6" height="11.4" rx="3.4" />
      <path d="M12 5.2v3.2" />
      <circle cx="12" cy="4" r="1.1" fill="currentColor" stroke="none" />
      <path d="M9.6 12.6v2.6" />
      <path d="M14.4 12.6v2.6" />
      <path d="M1.6 12.8v2.6" />
      <path d="M22.4 12.8v2.6" />
    </>
  ),
};

export interface ChainIconProps {
  node: ChainIconKey;
  className?: string;
}

/**
 * `data-chain-icon` carries the key so a test can prove the eight nodes get
 * eight DIFFERENT glyphs — the cheap failure here is one icon rendered eight
 * times, which a presence-only assertion would happily pass.
 */
export function ChainIcon({ node, className }: ChainIconProps) {
  return (
    <svg
      data-chain-icon={node}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {GLYPHS[node]}
    </svg>
  );
}
