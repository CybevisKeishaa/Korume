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
  /** `false` opts the element out of the gate's clip check (G4); omit it and clipping is still detected. */
  clip?: false;
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
  {
    id: "furigana-rt-reading",
    file: "components/reading/reading-body.tsx",
    match: "<rt data-type-exempt",
    scope: "all",
    reason: "Ruby annotation is smaller than its base text by definition (HTML <rt>); it is not interface type.",
  },
  {
    id: "kanji-detail-glyph",
    file: "app/[locale]/(protected)/(app)/kanji/[id]/page.tsx",
    match: "font-jp text-5xl",
    scope: "all",
    reason: "The kanji specimen shown large as the detail page art; content presentation, not interface type.",
  },
  {
    id: "vocab-detail-glyph",
    file: "app/[locale]/(protected)/(app)/vocab/[id]/page.tsx",
    match: "font-jp text-4xl",
    scope: "all",
    reason: "The vocabulary word shown large as the detail page specimen; content presentation, not interface type.",
  },
  {
    id: "reading-jp-body",
    file: "app/globals.css",
    match: ".reading-jp-body",
    scope: "all",
    reason: "The reader's own Reading Settings size multiplier and line-height preference apply on top of the token rung, by design.",
  },
  {
    id: "reading-jp-body-lg",
    file: "app/globals.css",
    match: ".reading-jp-body-lg",
    scope: "all",
    reason: "The reader's own Reading Settings size multiplier and line-height preference apply on top of the token rung, by design.",
  },
  {
    id: "reading-jp-heading",
    file: "app/globals.css",
    match: ".reading-jp-heading",
    scope: "all",
    reason: "The reader's own Reading Settings size multiplier and line-height preference apply on top of the token rung, by design.",
  },
  {
    id: "reading-jp-heading-lg",
    file: "app/globals.css",
    match: ".reading-jp-heading-lg",
    scope: "all",
    reason: "The reader's own Reading Settings size multiplier and line-height preference apply on top of the token rung, by design.",
  },
  {
    id: "reading-latin-caption",
    file: "app/globals.css",
    match: ".reading-latin-caption",
    scope: "all",
    reason: "The reader's own Reading Settings size multiplier and line-height preference apply on top of the token rung, by design.",
  },
  {
    id: "reading-latin-body",
    file: "app/globals.css",
    match: ".reading-latin-body",
    scope: "all",
    reason: "The reader's own Reading Settings size multiplier and line-height preference apply on top of the token rung, by design.",
  },
  {
    id: "vocab-print-sheet",
    file: "components/vocabulary-print/worksheet.tsx",
    match: "data-type-exempt=\"vocab-print-sheet\"",
    scope: "all",
    clip: false,
    reason: "The printable worksheet is set in physical units for paper (spec P1: the sheet is an allowlist entry); only the page chrome is interface type.",
  },
  {
    id: "footer-snore-z",
    file: "app/globals.css",
    match: ".app-footer__chip-z",
    scope: "all",
    reason: "Decorative snore glyph in the mascot chip, sized relative to its chip; art, not text.",
  },
];
