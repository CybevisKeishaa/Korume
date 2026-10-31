import { displayMap, displayRange } from "./display";
import { grapheme1Units } from "./listening-score";

export type MaskCell = { kind: "star"; unit: number } | { kind: "shown"; text: string };

/** The Typing mask (spec §3.3): a star per hint unit, punctuation and optional symbols shown in place. */
export function starMask(base: string): MaskCell[] {
  const chars = Array.from(base);
  const cells: MaskCell[] = [];
  let at = 0;
  grapheme1Units(base).forEach((u, unit) => {
    for (; at < u.start; at++) cells.push({ kind: "shown", text: chars[at]! });
    cells.push({ kind: "star", unit });
    at = u.end;
  });
  for (; at < chars.length; at++) cells.push({ kind: "shown", text: chars[at]! });
  return cells;
}

/** The raw text of each scored character of `pieces`, in order: what the stars show for the pieces placed so far. */
export function starFill(pieces: readonly { chunk: string; display: string }[]): string[] {
  return pieces.flatMap(({ chunk, display }) => {
    const map = displayMap(display);
    return grapheme1Units(chunk).map((unit) => displayRange(map, chunk, unit));
  });
}
