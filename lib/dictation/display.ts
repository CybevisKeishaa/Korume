import type { Range } from "./listening-score";
import { normalizeJa } from "./normalize";

/**
 * Owner 2026-10-21 (P13): cutting and scoring run on `normalizeJa(textJp)`, but the learner sees the raw
 * characters. One entry per code point of `normalizeJa(textJp)`: the raw text of the grapheme cluster it
 * came from on the cluster's first base code point, `""` on the cluster's other base code points
 * (`…` is `...`: the first dot shows `…`, the next two show nothing). Whitespace has no base code point,
 * so it is absent from every display. `null` when per-cluster normalisation does not concatenate to the
 * whole-line normalisation (NFKC composing across a cluster boundary), so no raw slice can be trusted.
 */
export function displayMap(textJp: string): string[] | null {
  const map: string[] = [];
  let joined = "";
  for (const { segment } of new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(textJp)) {
    const base = Array.from(normalizeJa(segment));
    joined += base.join("");
    base.forEach((_, i) => map.push(i === 0 ? segment : ""));
  }
  return joined === normalizeJa(textJp) ? map : null;
}

/** The raw text of `range`, or the base slice when there is no trustworthy map. */
export function displayRange(map: string[] | null, base: string, range: Range): string {
  return map ? map.slice(range.start, range.end).join("") : Array.from(base).slice(range.start, range.end).join("");
}

/** One display string per chunk, in chunk order; `chunks` must concatenate to the base `map` was built for. */
export function chunkDisplays(map: string[] | null, base: string, chunks: string[]): string[] {
  let start = 0;
  return chunks.map((c) => {
    const end = start + Array.from(c).length;
    const shown = displayRange(map, base, { start, end });
    start = end;
    return shown;
  });
}
