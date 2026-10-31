// Word Bank answer = piece indices; the hinted prefix (pieces 0..hintedCount-1 in `hinted` order) is locked in front.

/** Hinted pieces first (in `hinted` order), then the rest of `answer` in its order. */
export function withHints(answer: number[], hinted: number[]): number[] {
  return [...hinted, ...answer.filter((p) => !hinted.includes(p))];
}

/** Place `piece` at `at` (clamped to `[hintedCount, len]`); a piece already placed is moved. */
export function insertPiece(answer: number[], piece: number, at: number, hintedCount: number): number[] {
  const prefix = answer.slice(0, hintedCount);
  if (prefix.includes(piece)) return answer;
  const rest = answer.slice(hintedCount).filter((p) => p !== piece);
  // `at` counts positions in the answer before the piece is lifted out
  const from = answer.indexOf(piece);
  const target = Math.min(Math.max(at, hintedCount), answer.length) - hintedCount - (from >= 0 && from < at ? 1 : 0);
  rest.splice(Math.min(Math.max(target, 0), rest.length), 0, piece);
  return [...prefix, ...rest];
}

/** Take `piece` out of the answer; a hinted prefix piece stays. */
export function removePiece(answer: number[], piece: number, hintedCount: number): number[] {
  const i = answer.indexOf(piece);
  return i < hintedCount ? answer : answer.filter((p) => p !== piece);
}

/** Swap `piece` one step left/right inside the free part; never into the prefix or past the end. */
export function movePiece(answer: number[], piece: number, delta: -1 | 1, hintedCount: number): number[] {
  const i = answer.indexOf(piece);
  const j = i + delta;
  if (i < hintedCount || j < hintedCount || j >= answer.length) return answer;
  const out = answer.slice();
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}
