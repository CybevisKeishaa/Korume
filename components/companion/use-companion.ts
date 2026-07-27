"use client";

import { createContext, useContext } from "react";
import type { RelationshipPhase } from "@/lib/companion";
import type { CompanionState } from "@/lib/companion/presence/state-machine";
import type { ExperienceContext } from "@/lib/companion/presence/contexts";
import type { CompanionSpeechKey } from "@/lib/companion/presence/speech";

export interface CompanionApi {
  getCurrentState(): { state: CompanionState; phase: RelationshipPhase | null };
  emitContext(context: ExperienceContext): void;
  openJournal(): void;
  /** Plan 2 stub — AI reflection is Companion Plan 3. Always unavailable,
   * and the Companion simply says nothing about it (spec 1 §6.3). */
  requestReflection(): Promise<{ available: false }>;
}

/** Outside a provider the Companion simply isn't there — a silent no-op, so
 * no consumer can ever crash a surface over Companion wiring (§6.5). */
const NOOP_API: CompanionApi = {
  getCurrentState: () => ({ state: "idle", phase: null }),
  emitContext: () => undefined,
  openJournal: () => undefined,
  requestReflection: async () => ({ available: false }),
};

export const CompanionContext = createContext<CompanionApi | null>(null);

/** What an anchor needs to render the creature. Separate from the public
 * 4-verb API so surfaces cannot reach provider internals (spec 1 §5.9). */
export interface CompanionAnchorRegistration {
  /** Call on mount; the returned function unregisters. Stable identity, so
   * an anchor's registration effect never churns when speech changes. */
  registerAnchor: () => () => void;
  rendered: {
    speechKey: CompanionSpeechKey | null;
    phase: RelationshipPhase | null;
    dismiss: () => void;
  };
}

export const CompanionAnchorContext = createContext<CompanionAnchorRegistration | null>(null);

export function useCompanion(): CompanionApi {
  return useContext(CompanionContext) ?? NOOP_API;
}
