/**
 * Experience contexts (Spec 1 §5.3): surfaces announce WHAT HAPPENED, never
 * business payloads and never what to say (§5.12). The spec's context
 * vocabulary is broader than this union and does include visit-style contexts
 * (e.g. `entering_dashboard`); this plan deliberately emits none of them,
 * because "a rest point with nothing meaningful to say gets silence, not a
 * scripted greeting" (Spec 1 §3.4).
 */
export type ExperienceContext =
  | "finished_shadowing"
  | "memory_created"
  | "empty_library"
  | "empty_mining_deck";

/**
 * Deterministic priority (lower number wins). Bands mirror Spec 1 §5.10:
 * 10 learner milestone · 20 relationship milestone · 30 reflection ·
 * 40 seasonal · 50+ ambient flavor. Everything this plan emits is ambient —
 * the milestone bands are reserved for later plans.
 */
export const CONTEXT_PRIORITY: Record<ExperienceContext, number> = {
  finished_shadowing: 50,
  memory_created: 51,
  empty_library: 52,
  empty_mining_deck: 53,
};
