"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ListeningFormat } from "@/lib/shadowing-workspace/learning-modes";

type Phase = "answering" | "checked" | "revealed";
interface RevealState { key: string; attempt: number; phase: Phase; videoShown: boolean }
export interface ListeningReveal {
  attempt: number;
  phase: Phase;
  answerVisible: boolean;
  videoVisible: boolean;
  markChecked(attempt: number): void;
  markRevealed(attempt: number): void;
  showVideo(attempt: number): void;
  newAttempt(): void;
}

const ListeningRevealContext = createContext<ListeningReveal | null>(null);
const concealed = (key: string, attempt: number): RevealState => ({ key, attempt, phase: "answering", videoShown: false });

/**
 * P11: what Listening may show for the current line, keyed by line + URL format + attempt. A new key resets to a
 * concealed new attempt DURING RENDER (React's "adjust state when a prop changes"), so the first committed frame
 * after a line or format change is already concealed. A call carrying a stale attempt is a no-op, so a late
 * response from a discarded attempt can never reveal anything.
 */
export function ListeningRevealProvider({ lineId, format, children }: { lineId: string | null; format: ListeningFormat; children: ReactNode }) {
  const key = `${lineId}|${format}`;
  const [state, setState] = useState(() => concealed(key, 1));
  if (state.key !== key) setState(concealed(key, state.attempt + 1));

  const value = useMemo<ListeningReveal>(() => {
    const current = state.key === key;
    const ifCurrent = (attempt: number, change: Partial<RevealState>) =>
      setState((previous) => previous.attempt === attempt ? { ...previous, ...change } : previous);
    return {
      attempt: state.attempt,
      phase: state.phase,
      answerVisible: current && state.phase !== "answering",
      videoVisible: current && state.videoShown,
      markChecked: (attempt) => ifCurrent(attempt, { phase: "checked" }),
      markRevealed: (attempt) => ifCurrent(attempt, { phase: "revealed" }),
      showVideo: (attempt) => ifCurrent(attempt, { videoShown: true }),
      newAttempt: () => setState((previous) => concealed(previous.key, previous.attempt + 1)),
    };
  }, [key, state]);

  return <ListeningRevealContext.Provider value={value}>{children}</ListeningRevealContext.Provider>;
}

export function useListeningReveal(): ListeningReveal {
  const value = useContext(ListeningRevealContext);
  if (value === null) throw new Error("useListeningReveal must be used within ListeningRevealProvider");
  return value;
}
