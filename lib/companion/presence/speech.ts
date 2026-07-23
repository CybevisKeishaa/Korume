import type { RelationshipPhase } from "../types";
import type { ExperienceContext } from "./contexts";

/**
 * (context, phase) → key inside the `companion` catalog namespace. Phase is
 * accepted now so the signature is stable when register shifts arrive with
 * adaptive voice (Companion Plan 3); in this plan every phase speaks the
 * same template.
 */
export function speechKeyFor(context: ExperienceContext, phase: RelationshipPhase): string {
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
