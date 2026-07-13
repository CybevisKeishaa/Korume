/**
 * XP table for completed learning outcomes (CLAUDE.md §5 /
 * docs/product/business-model.md §1.1, principle G1). Pure lookup — no I/O,
 * no clock. Idempotency (one award per natural unit per VN day) is enforced
 * by the caller via `sourceIdFor` (./source-id.ts), not here.
 */
import type { LearningOutcomeSource } from "./types";

/** Flat XP amounts, keyed by outcome source. `jlpt_submit` varies by mode. */
export const XP_TABLE = {
  srs_review: 5,
  mining_review: 5,
  dictation: 10,
  shadowing: 15,
  reading_submit: 20,
  conversation: 25,
  jlpt_submit: { section: 30, full: 50 },
} as const;

export interface JlptSubmitOpts {
  mode: "section" | "full";
}

/** XP for a `jlpt_submit` outcome — `mode` is required. */
export function xpForOutcome(source: "jlpt_submit", opts: JlptSubmitOpts): number;
/** XP for any non-JLPT outcome — no options needed. */
export function xpForOutcome(
  source: Exclude<LearningOutcomeSource, "jlpt_submit">,
): number;
export function xpForOutcome(
  source: LearningOutcomeSource,
  opts?: JlptSubmitOpts,
): number {
  if (source === "jlpt_submit") {
    if (!opts) {
      throw new TypeError("xpForOutcome('jlpt_submit', ...) requires { mode }");
    }
    return XP_TABLE.jlpt_submit[opts.mode];
  }
  return XP_TABLE[source];
}
