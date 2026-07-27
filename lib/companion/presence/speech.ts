import type { RelationshipPhase } from "../types";
import type { ExperienceContext } from "./contexts";

/**
 * Every key this module can return, as a literal union. Narrower than
 * `string` on purpose: `messages/{en,vi}/companion.json` now carries these
 * leaves, so a typo at any call site (or a catalog rename that forgets this
 * file) is a compile error rather than a silent missing-message at render.
 */
export type CompanionSpeechKey =
  | "speech.finishedShadowing"
  | "speech.memoryCreated"
  | "speech.emptyLibrary"
  | "speech.emptyMiningDeck";

/**
 * (context, phase) → key inside the `companion` catalog namespace. Phase is
 * accepted now so the signature is stable when register shifts arrive with
 * adaptive voice (Companion Plan 3); in this plan every phase speaks the
 * same template.
 */
export function speechKeyFor(context: ExperienceContext, phase: RelationshipPhase): CompanionSpeechKey {
  void phase;
  switch (context) {
    case "finished_shadowing":
      return "speech.finishedShadowing";
    case "memory_created":
      return "speech.memoryCreated";
    case "empty_library":
      return "speech.emptyLibrary";
    case "empty_mining_deck":
      return "speech.emptyMiningDeck";
  }
}
