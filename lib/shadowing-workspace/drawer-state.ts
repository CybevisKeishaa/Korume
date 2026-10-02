import type { Utf16Span } from "@/lib/analysis/types";

export const DRAWER_LEVELS = ["collapsed", "peek", "expanded", "maximized"] as const;
export type DrawerLevel = (typeof DRAWER_LEVELS)[number];
export const DRAWER_TABS = ["vocabulary", "grammar", "mining", "notes", "ai"] as const;
export type DrawerTab = (typeof DRAWER_TABS)[number];

/** The sentence (and optional span) the drawer is about (spec §6.2). */
export interface DrawerTarget {
  lineId: string;
  span: Utf16Span | null;
}

export interface DrawerState {
  level: DrawerLevel;
  tab: DrawerTab;
  tracking: "follow" | "pinned";
  pinned: DrawerTarget | null;
  /** Vocabulary's drill-down: a word card, then a kanji inside it. */
  kanji: string | null;
  wordEntSeq: number | null;
}

export type DrawerAction =
  | { type: "open"; tab: DrawerTab; target?: DrawerTarget }
  | { type: "set-level"; level: DrawerLevel }
  | { type: "step"; delta: 1 | -1 }
  | { type: "select-tab"; tab: DrawerTab }
  | { type: "follow" }
  | { type: "collapse" }
  | { type: "open-kanji"; literal: string; target: DrawerTarget }
  | { type: "open-word"; entSeq: number; target: DrawerTarget }
  | { type: "back" };

export const initialDrawerState: DrawerState = {
  level: "collapsed", tab: "vocabulary", tracking: "follow", pinned: null, kanji: null, wordEntSeq: null,
};

/** Every entry point opens a collapsed drawer to peek; an open drawer keeps the height the learner chose. */
const opened = (level: DrawerLevel): DrawerLevel => (level === "collapsed" ? "peek" : level);
const pin = (state: DrawerState, target: DrawerTarget): DrawerState => ({ ...state, tracking: "pinned", pinned: target, kanji: null, wordEntSeq: null });

export function drawerReducer(state: DrawerState, action: DrawerAction): DrawerState {
  switch (action.type) {
    case "open": {
      const next = action.target ? pin(state, action.target) : state;
      return { ...next, tab: action.tab, level: opened(state.level) };
    }
    case "set-level": return { ...state, level: action.level };
    case "step": {
      const index = Math.min(DRAWER_LEVELS.length - 1, Math.max(0, DRAWER_LEVELS.indexOf(state.level) + action.delta));
      return { ...state, level: DRAWER_LEVELS[index] ?? state.level };
    }
    case "select-tab": return { ...state, tab: action.tab, level: opened(state.level) };
    case "follow": return { ...state, tracking: "follow", pinned: null };
    case "collapse": return { ...state, level: "collapsed" };
    case "open-word": return { ...pin(state, action.target), tab: "vocabulary", level: opened(state.level), wordEntSeq: action.entSeq };
    case "open-kanji": {
      // Inside a word card the kanji opens on top of it; from anywhere else it starts a fresh drill-down.
      const sameTarget = state.pinned?.lineId === action.target.lineId;
      const base = sameTarget ? state : pin(state, action.target);
      return { ...base, tracking: "pinned", pinned: action.target, tab: "vocabulary", level: opened(state.level), kanji: action.literal };
    }
    case "back":
      if (state.kanji !== null) return { ...state, kanji: null };
      return { ...state, wordEntSeq: null };
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
