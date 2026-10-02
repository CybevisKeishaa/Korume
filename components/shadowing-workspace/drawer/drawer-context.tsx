"use client";

import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import { drawerReducer, effectiveTarget, initialDrawerState, type DrawerAction, type DrawerState, type DrawerTarget } from "@/lib/shadowing-workspace/drawer-state";
import { useCurrentSentence, useLesson } from "../workspace-context";

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
  const [state, dispatch] = useReducer(drawerReducer, initialDrawerState);
  const { lines } = useLesson();
  const { index } = useCurrentSentence();
  const currentLineId = index === null ? null : lines[index]?.id ?? null;
  const value = useMemo(() => ({
    state, dispatch, target: effectiveTarget(state, currentLineId ? { lineId: currentLineId } : null),
  }), [currentLineId, state]);
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
