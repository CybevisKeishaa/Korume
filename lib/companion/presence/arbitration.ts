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
  // Picking the first minimum matches a stable sort's leading element.
  const best = live.reduce((a, b) => {
    const byPriority = CONTEXT_PRIORITY[a.context] - CONTEXT_PRIORITY[b.context];
    if (byPriority !== 0) return byPriority <= 0 ? a : b;
    if (a.emittedAt !== b.emittedAt) return a.emittedAt <= b.emittedAt ? a : b;
    return a.context.localeCompare(b.context) <= 0 ? a : b;
  });

  const cooldownActive = cooldown.lastAddressAt != null && now - cooldown.lastAddressAt <= COOLDOWN_WINDOW_MS;
  if (cooldownActive && CONTEXT_PRIORITY[best.context] > COOLDOWN_OVERRIDE_MAX_PRIORITY) {
    return { kind: "silence" };
  }
  return { kind: "address", context: best.context };
}
