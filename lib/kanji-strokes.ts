/**
 * Hand-authored stroke-order paths for a small starter set of kanji, on a
 * 109×109 grid, listed in correct writing order. Original data (CLAUDE.md §3).
 * Characters without an entry fall back to a static glyph in <StrokeOrder>.
 * A fuller stroke dataset is a later content/admin task.
 */
export interface KanjiStrokes {
  /** SVG path `d` strings, one per stroke, in writing order. */
  paths: string[];
}

export const KANJI_STROKES: Record<string, KanjiStrokes> = {
  一: { paths: ["M16,55 L93,55"] },
  二: { paths: ["M24,40 L85,40", "M14,72 L95,72"] },
  三: { paths: ["M26,30 L83,30", "M20,54 L89,54", "M13,80 L96,80"] },
  十: { paths: ["M16,54 L93,54", "M54,16 L54,93"] },
  川: { paths: ["M30,18 L26,94", "M56,14 L56,96", "M82,20 L80,86"] },
};
