const BACKOFF_MS = [30_000, 120_000, 600_000];

/** A failed generation may be retried after 30 s, then 2 min, then every 10 min (spec §5.3 step 6). */
export function retryAfterFor(attempts: number, now: Date): Date {
  const wait = BACKOFF_MS[Math.min(Math.max(attempts, 1), BACKOFF_MS.length) - 1] ?? 600_000;
  return new Date(now.getTime() + wait);
}
