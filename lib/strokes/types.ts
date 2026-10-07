/** Spec W §1.1: normalized KanjiVG geometry, independent of the lexical resolver; reusable by /kanji or animation. */
export interface StrokeGuide {
  character: string;
  /** KanjiVG's 109 × 109 grid. */
  viewBox: 109;
  /** KanjiVG order, never re-ordered. `start` is null when the path does not begin with a move: drawn, not numbered. */
  strokes: { d: string; start: [number, number] | null }[];
}
