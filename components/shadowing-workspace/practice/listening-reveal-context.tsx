"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { dictationFormat, type ListeningExercise } from "@/lib/shadowing-workspace/learning-modes";

type Phase = "answering" | "checked" | "revealed";
interface RevealState { key: string; attempt: number; phase: Phase }
export interface ListeningReveal {
  attempt: number;
  phase: Phase;
  answerVisible: boolean;
  /** Ẩn video (spec §3.2, Ruling T1): page-visit state, outside the reveal key. */
  listenOnly: boolean;
  setListenOnly(on: boolean): void;
  /** Chế độ dễ (spec §3.2): page-visit state; in Chép chính tả it picks the stored format, so it is in the key. */
  easy: boolean;
  setEasy(on: boolean): void;
  /** Card toggles (spec §3.5): page-visit state, outside the reveal key, so they survive Next. */
  showTranslation: boolean;
  setShowTranslation(on: boolean): void;
  showRomaji: boolean;
  setShowRomaji(on: boolean): void;
  markChecked(attempt: number): void;
  markRevealed(attempt: number): void;
  newAttempt(): void;
}

const ListeningRevealContext = createContext<ListeningReveal | null>(null);
const concealed = (key: string, attempt: number): RevealState => ({ key, attempt, phase: "answering" });

/**
 * P11: what Listening may show for the current line, keyed by line + stored format + attempt (no exercise = the
 * picker). A new key resets to a concealed new attempt DURING RENDER (React's "adjust state when a prop changes"), so
 * the first committed frame after a line, exercise or Chế độ dễ change is already concealed. A call carrying a stale
 * attempt is a no-op, so a late response from a discarded attempt can never reveal anything. Ẩn video and Chế độ dễ
 * live beside the key, so they survive every line, exercise, picker and attempt change of the page visit.
 */
export function ListeningRevealProvider({ lineId, exercise, children }: { lineId: string | null; exercise: ListeningExercise | null; children: ReactNode }) {
  const [listenOnly, setListenOnly] = useState(false);
  const [easy, setEasy] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showRomaji, setShowRomaji] = useState(false);
  const key = `${lineId}|${exercise === "dictation" ? dictationFormat(easy) : exercise}`;
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
      listenOnly,
      setListenOnly,
      easy,
      setEasy,
      showTranslation,
      setShowTranslation,
      showRomaji,
      setShowRomaji,
      markChecked: (attempt) => ifCurrent(attempt, { phase: "checked" }),
      markRevealed: (attempt) => ifCurrent(attempt, { phase: "revealed" }),
      newAttempt: () => setState((previous) => concealed(previous.key, previous.attempt + 1)),
    };
  }, [easy, key, listenOnly, showRomaji, showTranslation, state]);

  return <ListeningRevealContext.Provider value={value}>{children}</ListeningRevealContext.Provider>;
}

export function useListeningReveal(): ListeningReveal {
  const value = useContext(ListeningRevealContext);
  if (value === null) throw new Error("useListeningReveal must be used within ListeningRevealProvider");
  return value;
}
