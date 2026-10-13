/**
 * Spec G2 — content presentation, not interface type: large kanji/glyph art, pitch/pronunciation glyphs, furigana
 * <rt>, the user's own reading line-height. ONE entry per element or CSS rule — never a page or a directory.
 *
 * `match`: for a .tsx/.ts file, an exact substring of the offending line; for app/globals.css, the rule's full
 * selector as written. `scope`: what is exempt — both size and line-height ("all") or line-height only.
 * The browser gate (G4) skips an element only when it (or an ancestor) carries data-type-exempt="<id>".
 * The scan fails on an entry that exempts nothing and whose data-type-exempt marker is absent from `file`.
 */
export interface TypeExemption {
  id: string;
  file: string;
  match: string;
  scope: "all" | "line-height";
  reason: string;
}

export const TYPE_EXEMPTIONS: readonly TypeExemption[] = [
  {
    id: "furigana-rt-player",
    file: "components/video-player/furigana-text.tsx",
    match: "<rt data-type-exempt",
    scope: "all",
    reason: "Ruby annotation is smaller than its base text by definition (HTML <rt>); it is not interface type.",
  },
  {
    id: "stroke-order-glyph",
    file: "components/motion/stroke-order.tsx",
    match: "font-jp text-7xl",
    scope: "all",
    reason: "Large kanji glyph shown as art in the stroke-order fallback tile; content presentation, not interface type.",
  },
];
