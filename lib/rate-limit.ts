/**
 * In-memory sliding-window rate limiter for API routes (CLAUDE.md §6 — all
 * AI-scoring / write-heavy endpoints must be rate-limited).
 *
 * NOTE: state lives in this process's memory only, so the budget is per
 * server instance — fine for local dev and a single Vercel function
 * instance, but multi-instance production deployments will each get their
 * own quota. Move this to Redis/Upstash when that starts to matter (Layer 8).
 */

export interface RateLimitOptions {
  /** Max allowed hits within the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  /** Whether this hit is within budget. */
  ok: boolean;
  /** Milliseconds until the caller may retry. Always 0 when `ok`. */
  retryAfter: number;
}

const hits = new Map<string, number[]>();

/**
 * Record one hit for `key` and report whether it's within
 * `opts.limit` hits per `opts.windowMs` (sliding window).
 *
 * A blocked call does NOT consume budget — only successful hits are
 * recorded — so retrying while blocked doesn't push the retry time out
 * further. `now` (ms epoch) is injectable for deterministic tests; defaults
 * to the real clock.
 */
export function rateLimit(
  key: string,
  opts: RateLimitOptions,
  now: number = Date.now(),
): RateLimitResult {
  const windowStart = now - opts.windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (recent.length >= opts.limit) {
    const oldest = recent[0] as number;
    hits.set(key, recent);
    return { ok: false, retryAfter: oldest + opts.windowMs - now };
  }

  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfter: 0 };
}
