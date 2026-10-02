import type { PlaybackLoopCount } from "@/lib/preferences/options";

export interface LoopConfig { enabled: boolean; count: PlaybackLoopCount; autoPause: boolean }
export interface LoopState { sentenceIndex: number | null; playsCompleted: number }
export type BoundaryDecision = { kind: "replay" } | { kind: "continue" } | { kind: "pause" };

export function decideAtSentenceEnd(config: LoopConfig, state: LoopState): { decision: BoundaryDecision; next: LoopState } {
  const playsCompleted = state.playsCompleted + 1;
  if (config.enabled && (config.count === 0 || playsCompleted < config.count)) {
    return { decision: { kind: "replay" }, next: { ...state, playsCompleted } };
  }
  return { decision: { kind: config.autoPause ? "pause" : "continue" }, next: { ...state, playsCompleted: 0 } };
}

export function resetLoop(sentenceIndex: number | null): LoopState {
  return { sentenceIndex, playsCompleted: 0 };
}
