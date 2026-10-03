import { PROVIDER_TIMEOUT_MS } from "@/lib/ai/constants";

/**
 * Time budgets of one Ask Korume turn (spec §3.4, §5). The reservation must outlive the slowest possible turn,
 * or a live turn's hold could be reclaimed and its quota slot handed out twice; `turnLifetimeUpperBoundMs` is the
 * arithmetic the TTL invariant test checks.
 */
export const TOOL_DEADLINE_MS = 3_000;
export const RETRIEVAL_DEADLINE_MS = 4_000;
export const TURN_RESERVATION_TTL_SECONDS = 180;
export const MAX_RECENT_TURNS = 6;

/** Planner + answer, each up to the provider timeout, plus the retrieval stage between them. */
export function turnLifetimeUpperBoundMs(): number {
  return 2 * PROVIDER_TIMEOUT_MS + RETRIEVAL_DEADLINE_MS;
}
