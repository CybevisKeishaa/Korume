import { describe, expect, it } from "vitest";
import { DRAWER_LEVELS, drawerReducer, effectiveTarget, initialDrawerState, nearestDrawerLevel, type DrawerState } from "./drawer-state";

const LINE_42 = { lineId: "line-42", span: null };
const PHRASE = { lineId: "line-42", span: { start: 2, end: 5 } };
const WORD = { entSeq: 1358280, headword: "\u98df\u3079\u308b", reading: "\u305f\u3079\u308b", glossEn: "to eat" };
const at = (overrides: Partial<DrawerState>): DrawerState => ({ ...initialDrawerState, ...overrides });

describe("drawerReducer", () => {
  it("starts collapsed on Mining, following playback, without an inspector", () => {
    expect(initialDrawerState).toEqual({ level: "collapsed", tab: "mining", tracking: "follow", pinned: null, inspector: null });
  });

  it("opens a collapsed drawer to peek and pins the target; an open drawer keeps its level", () => {
    expect(drawerReducer(initialDrawerState, { type: "open", tab: "mining", target: LINE_42 })).toEqual(at({ level: "peek", tab: "mining", tracking: "pinned", pinned: LINE_42 }));
    expect(drawerReducer(at({ level: "maximized" }), { type: "open", tab: "notes", target: PHRASE })).toMatchObject({ level: "maximized", tab: "notes", pinned: PHRASE });
    expect(drawerReducer(at({ tracking: "pinned", pinned: LINE_42 }), { type: "open", tab: "mining" })).toMatchObject({ level: "peek", tab: "mining", tracking: "pinned", pinned: LINE_42 });
  });

  it("selecting a tab while collapsed opens peek; while open keeps the level", () => {
    expect(drawerReducer(initialDrawerState, { type: "select-tab", tab: "mining" })).toMatchObject({ level: "peek", tab: "mining" });
    expect(drawerReducer(at({ level: "expanded" }), { type: "select-tab", tab: "mining" })).toMatchObject({ level: "expanded" });
  });

  it("steps through the four levels and clamps at both ends", () => {
    let state = initialDrawerState;
    const seen = [state.level];
    for (let i = 0; i < 5; i += 1) seen.push((state = drawerReducer(state, { type: "step", delta: 1 })).level);
    expect(seen).toEqual(["collapsed", "peek", "expanded", "maximized", "maximized", "maximized"]);
    expect(drawerReducer(initialDrawerState, { type: "step", delta: -1 }).level).toBe("collapsed");
    expect(drawerReducer(at({ level: "peek" }), { type: "set-level", level: "expanded" }).level).toBe("expanded");
  });

  it("collapses keeping tab and target; follow clears the pin", () => {
    const pinned = at({ level: "expanded", tab: "notes", tracking: "pinned", pinned: LINE_42 });
    expect(drawerReducer(pinned, { type: "collapse" })).toEqual({ ...pinned, level: "collapsed" });
    expect(drawerReducer(pinned, { type: "follow" })).toEqual({ ...pinned, tracking: "follow", pinned: null });
  });

  it("opens an inspector without changing its pinned target, and preserves its first snapshot while pushing", () => {
    const opened = drawerReducer(at({ tab: "notes", tracking: "pinned", pinned: PHRASE }), { type: "inspect", entry: { kind: "kanji", literal: "\u98df" } });
    const snapshot = { tab: "notes", level: "collapsed", tracking: "pinned" as const, drawerTarget: PHRASE };
    expect(opened).toMatchObject({ level: "peek", tab: "notes", tracking: "pinned", pinned: PHRASE, inspector: { stack: [{ kind: "kanji", literal: "\u98df" }], returnState: snapshot } });
    const word = drawerReducer(opened, { type: "inspect", entry: { kind: "word", word: WORD } });
    const kanji = drawerReducer(word, { type: "inspect", entry: { kind: "kanji", literal: "\u98df" } });
    expect(kanji.inspector?.stack).toHaveLength(3);
    expect(kanji.inspector?.returnState).toEqual(snapshot);
  });

  it("backs through the inspector and restores the exact pinned snapshot at its root", () => {
    const opened = drawerReducer(at({ tab: "notes", tracking: "pinned", pinned: PHRASE }), { type: "inspect", entry: { kind: "kanji", literal: "\u98df" } });
    const depthThree = drawerReducer(drawerReducer(opened, { type: "inspect", entry: { kind: "word", word: WORD } }), { type: "inspect", entry: { kind: "kanji", literal: "\u98df" } });
    const root = drawerReducer(drawerReducer(depthThree, { type: "inspector-back" }), { type: "inspector-back" });
    expect(root.inspector?.stack).toHaveLength(1);
    expect(drawerReducer(root, { type: "inspector-back" })).toMatchObject({ inspector: null, level: "collapsed", tab: "notes", tracking: "pinned", pinned: PHRASE });
  });

  it("closes an inspector from any depth and restores its snapshot", () => {
    const opened = drawerReducer(at({ tab: "notes", tracking: "pinned", pinned: PHRASE }), { type: "inspect", entry: { kind: "kanji", literal: "\u98df" } });
    const depthThree = drawerReducer(drawerReducer(opened, { type: "inspect", entry: { kind: "word", word: WORD } }), { type: "inspect", entry: { kind: "kanji", literal: "\u98df" } });
    expect(drawerReducer(depthThree, { type: "inspector-close" })).toMatchObject({ inspector: null, level: "collapsed", tab: "notes", tracking: "pinned", pinned: PHRASE });
  });

  it("an explicit Follow while inspecting closes the Inspector into its tab, at the current height, following", () => {
    const opened = drawerReducer(at({ tab: "notes", tracking: "pinned", pinned: PHRASE }), { type: "inspect", entry: { kind: "kanji", literal: "食" } });
    expect(drawerReducer(opened, { type: "follow" })).toMatchObject({ inspector: null, tab: "notes", level: "peek", tracking: "follow", pinned: null });
  });

  it("restores following without pinning after close (Review Focus 2)", () => {
    const opened = drawerReducer(initialDrawerState, { type: "inspect", entry: { kind: "kanji", literal: "\u98df" } });
    expect(drawerReducer(opened, { type: "inspector-close" })).toMatchObject({ tracking: "follow", pinned: null });
  });

  it("choosing a tab while inspecting restores its target before opening that tab (Review Focus 1)", () => {
    const opened = drawerReducer(at({ tab: "notes", tracking: "pinned", pinned: PHRASE }), { type: "inspect", entry: { kind: "kanji", literal: "\u98df" } });
    expect(drawerReducer(opened, { type: "select-tab", tab: "mining" })).toMatchObject({ inspector: null, tab: "mining", level: "peek", tracking: "pinned", pinned: PHRASE });
  });

  it("opens a row action while inspecting by closing it and pinning the new target", () => {
    const opened = drawerReducer(initialDrawerState, { type: "inspect", entry: { kind: "kanji", literal: "\u98df" } });
    expect(drawerReducer(opened, { type: "open", tab: "notes", target: LINE_42 })).toMatchObject({ inspector: null, tab: "notes", tracking: "pinned", pinned: LINE_42 });
  });

  it("returns the same state for inspector navigation with no inspector", () => {
    expect(drawerReducer(initialDrawerState, { type: "inspector-back" })).toBe(initialDrawerState);
    expect(drawerReducer(initialDrawerState, { type: "inspector-close" })).toBe(initialDrawerState);
  });
});

describe("effectiveTarget", () => {
  it("follows the current sentence", () => {
    expect(effectiveTarget(initialDrawerState, { lineId: "line-9" })).toEqual({ lineId: "line-9", span: null });
    expect(effectiveTarget(initialDrawerState, null)).toBeNull();
  });

  it("speaks about the pinned sentence whatever playback does (Review Focus 2)", () => {
    const pinned = at({ tracking: "pinned", pinned: LINE_42 });
    for (const current of [{ lineId: "line-43" }, { lineId: "line-72" }, null]) expect(effectiveTarget(pinned, current)).toEqual(LINE_42);
  });
});

describe("nearestDrawerLevel", () => {
  const metrics = { collapsed: 36, available: 480, viewport: 529 };
  it("snaps a dragged height to the closest of the four levels", () => {
    // Levels at 36, max(160, 211.6) = 211.6, 370.3 and 480.
    expect(nearestDrawerLevel(10, metrics)).toBe("collapsed");
    expect(nearestDrawerLevel(150, metrics)).toBe("peek");
    expect(nearestDrawerLevel(300, metrics)).toBe("expanded");
    expect(nearestDrawerLevel(460, metrics)).toBe("maximized");
    expect(DRAWER_LEVELS).toEqual(["collapsed", "peek", "expanded", "maximized"]);
  });
});
