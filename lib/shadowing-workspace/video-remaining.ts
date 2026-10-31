/**
 * "Video còn lại" (WP spec §3.7): video time from the current sentence's start to the end of the video, else to the
 * last line's end; never "time to finish the practice". Seconds, floored at 0; null when nothing says where it ends.
 */
export function videoRemainingSeconds(
  lines: readonly { startTime: number; endTime: number | null }[],
  index: number | null,
  durationSeconds: number | null,
): number | null {
  const line = index === null ? undefined : lines[index];
  if (!line) return null;
  const end = durationSeconds ?? lines.at(-1)?.endTime ?? null;
  return end === null ? null : Math.max(0, end - line.startTime);
}
