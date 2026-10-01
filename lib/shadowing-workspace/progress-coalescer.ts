export type ProgressFlushReason = "tick" | "pause" | "ended" | "hidden" | "pagehide" | "leave";
export interface ProgressSent { position: number; at: number }
export const SERVER_WRITE_INTERVAL_MS = 12_000;
export const MEANINGFUL_DELTA_S = 1;

export function shouldWriteServer(last: ProgressSent | null, position: number, now: number, reason: ProgressFlushReason): boolean {
  if (!Number.isFinite(position)) return false;
  if (reason !== "tick") return last === null || Math.abs(position - last.position) >= 0.05;
  return last === null ? position > 0 : now - last.at >= SERVER_WRITE_INTERVAL_MS && Math.abs(position - last.position) >= MEANINGFUL_DELTA_S;
}
