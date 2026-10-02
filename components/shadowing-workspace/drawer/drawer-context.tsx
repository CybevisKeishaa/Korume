"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type MutableRefObject, type ReactNode } from "react";
import { drawerReducer, effectiveTarget, initialDrawerState, type DrawerAction, type DrawerState, type DrawerTarget } from "@/lib/shadowing-workspace/drawer-state";
import { useCurrentSentence, useLesson } from "../workspace-context";
import { drawerTabId } from "./drawer-header";

interface DrawerContextValue {
  state: DrawerState;
  dispatch: Dispatch<DrawerAction>;
  /** What every tab speaks about: the pinned target, or the current sentence while following. */
  target: DrawerTarget | null;
  focusOrigin: MutableRefObject<HTMLElement | null>;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

/**
 * Session-only drawer state (spec §6.1). It sits above the layout, so Focus Mode can hide the drawer without
 * losing its tab, height or target. Nothing here fetches: following the current sentence only changes `target`.
 */
export function DrawerProvider({ children }: { children: ReactNode }) {
  return <DrawerStateProvider>{children}</DrawerStateProvider>;
}

function DrawerStateProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(drawerReducer, initialDrawerState);
  const focusOrigin = useRef<HTMLElement | null>(null);
  const wasInspecting = useRef(false);
  const lastAction = useRef<DrawerAction["type"] | null>(null);
  const dispatch = useCallback<Dispatch<DrawerAction>>((action) => {
    lastAction.current = action.type;
    rawDispatch(action);
  }, []);
  // Back or Close (or Escape) hands focus back to what opened the Inspector, or to the selected tab when that is
  // gone or cannot take focus. A tab, a row action or Follow that closes it leaves focus where the learner put it.
  useEffect(() => {
    if (wasInspecting.current && !state.inspector) {
      const origin = focusOrigin.current;
      focusOrigin.current = null;
      if (lastAction.current === "inspector-close" || lastAction.current === "inspector-back") {
        if (origin?.isConnected) origin.focus();
        if (!origin?.isConnected || document.activeElement !== origin) document.getElementById(drawerTabId(state.tab))?.focus();
      }
    }
    wasInspecting.current = state.inspector !== null;
  }, [state.inspector, state.tab]);
  const { lines } = useLesson();
  const { index } = useCurrentSentence();
  const currentLineId = index === null ? null : lines[index]?.id ?? null;
  const value = useMemo(() => ({
    state, dispatch, target: effectiveTarget(state, currentLineId ? { lineId: currentLineId } : null), focusOrigin,
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
