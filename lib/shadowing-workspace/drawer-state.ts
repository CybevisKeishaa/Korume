import type { Utf16Span } from "@/lib/analysis/types";
import type { KanjiCommonWord } from "@/lib/dictionary/types";

export const DRAWER_LEVELS = ["collapsed", "peek", "expanded", "maximized"] as const;
export type DrawerLevel = (typeof DRAWER_LEVELS)[number];
export const DRAWER_TABS = ["mining", "notes"] as const;
export type DrawerTab = (typeof DRAWER_TABS)[number];

/** The sentence (and optional span) the drawer is about (spec §6.2). */
export interface DrawerTarget {
  lineId: string;
  span: Utf16Span | null;
}

export type InspectorEntry = { kind: "kanji"; literal: string } | { kind: "word"; word: KanjiCommonWord };

export interface InspectorReturnState {
  tab: DrawerTab;
  level: DrawerLevel;
  tracking: "follow" | "pinned";
  drawerTarget: DrawerTarget | null;
}

export interface DrawerState {
  level: DrawerLevel;
  tab: DrawerTab;
  tracking: "follow" | "pinned";
  pinned: DrawerTarget | null;
  inspector: { stack: InspectorEntry[]; returnState: InspectorReturnState } | null;
}

export type DrawerAction =
  | { type: "open"; tab: DrawerTab; target?: DrawerTarget }
  | { type: "set-level"; level: DrawerLevel }
  | { type: "step"; delta: 1 | -1 }
  | { type: "select-tab"; tab: DrawerTab }
  | { type: "follow" }
  | { type: "collapse" }
  | { type: "inspect"; entry: InspectorEntry }
  | { type: "inspector-back" }
  | { type: "inspector-close" };

export const initialDrawerState: DrawerState = {
  level: "collapsed", tab: "mining", tracking: "follow", pinned: null, inspector: null,
};

/** Every entry point opens a collapsed drawer to peek; an open drawer keeps the height the learner chose. */
const opened = (level: DrawerLevel): DrawerLevel => (level === "collapsed" ? "peek" : level);
const snapshot = (state: DrawerState): InspectorReturnState => ({
  tab: state.tab, level: state.level, tracking: state.tracking, drawerTarget: state.pinned,
});
const restore = (state: DrawerState, back: InspectorReturnState): DrawerState => ({
  ...state, inspector: null, tab: back.tab, level: back.level, tracking: back.tracking, pinned: back.drawerTarget,
});

export function drawerReducer(state: DrawerState, action: DrawerAction): DrawerState {
  switch (action.type) {
    case "open": {
      const base = state.inspector ? { ...state, inspector: null } : state;
      const next = action.target ? { ...base, tracking: "pinned" as const, pinned: action.target } : base;
      return { ...next, tab: action.tab, level: opened(state.level) };
    }
    case "set-level": return { ...state, level: action.level };
    case "step": {
      const index = Math.min(DRAWER_LEVELS.length - 1, Math.max(0, DRAWER_LEVELS.indexOf(state.level) + action.delta));
      return { ...state, level: DRAWER_LEVELS[index] ?? state.level };
    }
    case "select-tab": {
      const base = state.inspector ? restore(state, state.inspector.returnState) : state;
      return { ...base, tab: action.tab, level: opened(base.level) };
    }
    case "follow": {
      // An explicit Follow outranks the snapshot: it closes the Inspector into its tab at the current height.
      const base = state.inspector ? { ...restore(state, state.inspector.returnState), level: state.level } : state;
      return { ...base, tracking: "follow", pinned: null };
    }
    case "collapse": return { ...state, level: "collapsed" };
    case "inspect":
      return state.inspector
        ? { ...state, inspector: { ...state.inspector, stack: [...state.inspector.stack, action.entry] } }
        : { ...state, level: opened(state.level), inspector: { stack: [action.entry], returnState: snapshot(state) } };
    case "inspector-back": {
      if (!state.inspector) return state;
      const stack = state.inspector.stack.slice(0, -1);
      return stack.length > 0 ? { ...state, inspector: { ...state.inspector, stack } } : restore(state, state.inspector.returnState);
    }
    case "inspector-close": return state.inspector ? restore(state, state.inspector.returnState) : state;
  }
}

/**
 * Pinned: always the pinned target, whatever playback does. Following: the current sentence (1a keeps the
 * sentence just spoken through a gap), with no span.
 */
export function effectiveTarget(state: DrawerState, current: { lineId: string } | null): DrawerTarget | null {
  if (state.tracking === "pinned") return state.pinned;
  return current ? { lineId: current.lineId, span: null } : null;
}

/**
 * The level whose height is closest to a dragged height. Mirrors the CSS heights in `drawerRowHeight`:
 * peek = max(160 units, 40 % of the viewport), expanded = 70 %, maximized = all the space below the header.
 */
export function nearestDrawerLevel(height: number, metrics: { collapsed: number; available: number; viewport: number; peekMin?: number }): DrawerLevel {
  const heights: Record<DrawerLevel, number> = {
    collapsed: metrics.collapsed,
    peek: Math.max(metrics.peekMin ?? 160, metrics.viewport * 0.4),
    expanded: metrics.viewport * 0.7,
    maximized: metrics.available,
  };
  return DRAWER_LEVELS.reduce((best, level) => (Math.abs(heights[level] - height) < Math.abs(heights[best] - height) ? level : best));
}

/** The drawer's grid-row size and the height the 1a video budget subtracts (spec §6.1). */
export function drawerRowHeight(level: DrawerLevel): string {
  switch (level) {
    case "collapsed": return "var(--drawer-collapsed-height)";
    case "peek": return "max(var(--drawer-peek-min), 40dvh)";
    case "expanded": return "70dvh";
    case "maximized": return "minmax(0, 1fr)";
  }
}
