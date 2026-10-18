"use client";

import { createContext, useContext, useMemo, useReducer, type Dispatch } from "react";
import { attemptsReducer, type AttemptAction, type AttemptsState } from "@/lib/pronunciation/attempts";

interface PronunciationAttemptsContextValue {
  attempts: AttemptsState;
  dispatch: Dispatch<AttemptAction>;
}

const PronunciationAttemptsContext = createContext<PronunciationAttemptsContextValue | null>(null);

export function PronunciationAttemptsProvider({ children }: { children: React.ReactNode }) {
  const [attempts, dispatch] = useReducer(attemptsReducer, {});
  const value = useMemo(() => ({ attempts, dispatch }), [attempts]);
  return <PronunciationAttemptsContext.Provider value={value}>{children}</PronunciationAttemptsContext.Provider>;
}

export function usePronunciationAttempts(): PronunciationAttemptsContextValue {
  const value = useContext(PronunciationAttemptsContext);
  if (!value) throw new Error("usePronunciationAttempts requires PronunciationAttemptsProvider");
  return value;
}
