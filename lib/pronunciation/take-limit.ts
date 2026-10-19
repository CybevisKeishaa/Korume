import type { WorkspaceLine } from "@/lib/shadowing-workspace/types";
import { effectiveEnd } from "@/lib/shadowing-workspace/sentence-lookup";

export const MAX_TAKE_SECONDS = 30;
/** Open-ended or invalid durations get the cap, never an unbounded timer. */
export function takeLimitSeconds(lines: readonly WorkspaceLine[], index: number, duration: number | null): number {
  const line = lines[index];
  if (!line) return MAX_TAKE_SECONDS;
  const length = effectiveEnd(lines, index, duration) - line.startTime;
  return Number.isFinite(length) && length > 0 ? Math.min(length * 2 + 3, MAX_TAKE_SECONDS) : MAX_TAKE_SECONDS;
}
