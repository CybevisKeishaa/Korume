import { CONTEXT_PRIORITY, type ExperienceContext } from "./contexts";
import { CONTEXT_TTL_MS, COOLDOWN_OVERRIDE_MAX_PRIORITY, COOLDOWN_WINDOW_MS } from "./config";

export interface PendingContext {
  context: ExperienceContext;
  emittedAt: number;
}

export interface CooldownState {
  lastAddressAt: number | null;
}

export type Resolution = { kind: "address"; context: ExperienceContext } | { kind: "silence" };

/** Drop contexts older than CONTEXT_TTL_MS — stale moments are discarded,
 * never queued into a monologue (§5.10). */
export function prunePending(pending: PendingContext[], now: number): PendingContext[] {
  return pending.filter((p) => now - p.emittedAt <= CONTEXT_TTL_MS);
}

/**
 * Deterministic total order over pending contexts: priority (lower wins), then
 * earlier `emittedAt`, then context name. Negative if `a` wins, positive if `b`
 * wins, 0 only when both fields and the context are identical.
 *
 * Exported so levels 2 and 3 are testable — they are unobservable through
 * `resolve` while `CONTEXT_PRIORITY` is injective (equal priority implies the
 * same context, and `Resolution` carries only the context, not `emittedAt`).
 */
export function comparePending(a: PendingContext, b: PendingContext): number {
  const byPriority = CONTEXT_PRIORITY[a.context] - CONTEXT_PRIORITY[b.context];
  if (byPriority !== 0) return byPriority;
  const byEmittedAt = a.emittedAt - b.emittedAt;
  if (byEmittedAt !== 0) return byEmittedAt;
  return a.context.localeCompare(b.context);
}

/**
 * Deterministic arbitration (Spec 1 §5.10): at most one address. Order:
 * priority (lower wins) → emittedAt (earlier wins) → context name. An active
 * experience cooldown suppresses everything except milestone-band priorities
 * (≤ COOLDOWN_OVERRIDE_MAX_PRIORITY — none exist in this plan).
 */
export function resolve(pending: PendingContext[], cooldown: CooldownState, now: number): Resolution {
  const live = prunePending(pending, now);
  if (live.length === 0) return { kind: "silence" };

  // Reduce rather than sort()[0]: on a non-empty array it is total, so the
  // winner needs no undefined-narrowing under `noUncheckedIndexedAccess`.
  // Keeping the incumbent on ties picks the FIRST minimum, matching a stable
  // sort's leading element.
  const best = live.reduce((a, b) => (comparePending(a, b) <= 0 ? a : b));

  // Clock skew / a future `lastAddressAt` makes this delta negative, so the
  // cooldown reads as active and the Companion stays silent — deliberately the
  // safe direction: silence rather than a spurious address.
  const cooldownActive = cooldown.lastAddressAt != null && now - cooldown.lastAddressAt <= COOLDOWN_WINDOW_MS;
  if (cooldownActive && CONTEXT_PRIORITY[best.context] > COOLDOWN_OVERRIDE_MAX_PRIORITY) {
    return { kind: "silence" };
  }
  return { kind: "address", context: best.context };
}
