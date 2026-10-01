import type { WorkspaceLine } from "./types";

export function effectiveEnd(lines: readonly WorkspaceLine[], index: number, duration: number | null): number {
  const line = lines[index]!;
  if (line.endTime !== null) return line.endTime;
  return lines[index + 1]?.startTime ?? duration ?? Number.POSITIVE_INFINITY;
}

export interface SentencePosition { index: number | null; isSpoken: boolean }

export function locateSentence(lines: readonly WorkspaceLine[], time: number, duration: number | null): SentencePosition {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (lines[middle]!.startTime <= time) {
      found = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  if (found === -1) return { index: null, isSpoken: false };
  return { index: found, isSpoken: time < effectiveEnd(lines, found, duration) };
}

export function sameSentencePosition(a: SentencePosition, b: SentencePosition): boolean {
  return a.index === b.index && a.isSpoken === b.isSpoken;
}

export function previousTarget(lines: readonly WorkspaceLine[], current: number | null, time: number): number | null {
  if (current === null) return null;
  return time - lines[current]!.startTime > 1.5 ? current : Math.max(0, current - 1);
}

export function nextTarget(lines: readonly WorkspaceLine[], current: number | null): number | null {
  // Before the first sentence (an intro), the next sentence is the first one.
  if (current === null) return lines.length > 0 ? 0 : null;
  return Math.min(lines.length - 1, current + 1);
}
