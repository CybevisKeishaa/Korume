"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import { OPENING_SECTION, PHRASE_SECTION } from "@/lib/knowledge/types";
import { drawerReducer, effectiveTarget, initialDrawerState, type DrawerAction, type DrawerState, type DrawerTarget } from "@/lib/shadowing-workspace/drawer-state";
import { useCurrentSentence, useLesson } from "../workspace-context";
import { AiKnowledgeProvider, useAiKnowledge } from "./ai-knowledge-context";

interface DrawerContextValue {
  state: DrawerState;
  dispatch: Dispatch<DrawerAction>;
  /** What every tab speaks about: the pinned target, or the current sentence while following. */
  target: DrawerTarget | null;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

/**
 * Session-only drawer state (spec §6.1). It sits above the layout, so Focus Mode can hide the drawer without
 * losing its tab, height or target. Nothing here fetches: following the current sentence only changes `target`.
 */
export function DrawerProvider({ children }: { children: ReactNode }) {
  return <AiKnowledgeProvider><DrawerStateProvider>{children}</DrawerStateProvider></AiKnowledgeProvider>;
}

function DrawerStateProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(drawerReducer, initialDrawerState);
  const { request } = useAiKnowledge();
  // Every ✨ entry point dispatches `open` with the AI tab from a click: that click — never an effect on the
  // current sentence (R11) — is where the opening generations start. A span asks for its phrase analysis too.
  const dispatch = useCallback<Dispatch<DrawerAction>>((action) => {
    rawDispatch(action);
    if (action.type !== "open" || action.tab !== "ai" || !action.target) return;
    const sentence = { lineId: action.target.lineId, span: null };
    if (action.target.span) request(action.target, PHRASE_SECTION, { force: true });
    request(sentence, OPENING_SECTION, { force: true });
    if (action.section) request(sentence, action.section, { force: true });
  }, [request]);
  const { lines } = useLesson();
  const { index } = useCurrentSentence();
  const currentLineId = index === null ? null : lines[index]?.id ?? null;
  const value = useMemo(() => ({
    state, dispatch, target: effectiveTarget(state, currentLineId ? { lineId: currentLineId } : null),
  }), [currentLineId, dispatch, state]);
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function useDrawer(): DrawerContextValue {
  const value = useContext(DrawerContext);
  if (value === null) throw new Error("useDrawer must be used within DrawerProvider");
  return value;
}

/** For surfaces that may render outside the workspace (shared rows): null when there is no drawer. */
export function useOptionalDrawer(): DrawerContextValue | null {
  return useContext(DrawerContext);
}
