import { describe, expect, it } from "vitest";
import { DRAWER_LEVELS, drawerReducer, effectiveTarget, initialDrawerState, nearestDrawerLevel, type DrawerState } from "./drawer-state";

const LINE_42 = { lineId: "line-42", span: null };
const PHRASE = { lineId: "line-7", span: { start: 2, end: 5 } };
const at = (overrides: Partial<DrawerState>): DrawerState => ({ ...initialDrawerState, ...overrides });

describe("drawerReducer", () => {
  it("starts collapsed on Vocabulary, following playback", () => {
    expect(initialDrawerState).toEqual({ level: "collapsed", tab: "vocabulary", tracking: "follow", pinned: null, kanji: null, wordEntSeq: null });
  });

  it("opens a collapsed drawer to peek and pins the target; an open drawer keeps its level", () => {
    expect(drawerReducer(initialDrawerState, { type: "open", tab: "ai", target: LINE_42 }))
      .toEqual(at({ level: "peek", tab: "ai", tracking: "pinned", pinned: LINE_42 }));
    expect(drawerReducer(at({ level: "maximized" }), { type: "open", tab: "notes", target: PHRASE }))
      .toMatchObject({ level: "maximized", tab: "notes", pinned: PHRASE });
    // Without a target, opening a tab keeps whatever is pinned or followed.
    expect(drawerReducer(at({ tracking: "pinned", pinned: LINE_42 }), { type: "open", tab: "grammar" }))
      .toMatchObject({ level: "peek", tab: "grammar", tracking: "pinned", pinned: LINE_42 });
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
    const pinned = at({ level: "expanded", tab: "ai", tracking: "pinned", pinned: LINE_42 });
    expect(drawerReducer(pinned, { type: "collapse" })).toEqual({ ...pinned, level: "collapsed" });
    expect(drawerReducer(pinned, { type: "follow" })).toEqual({ ...pinned, tracking: "follow", pinned: null });
  });

  it("opens a word, then a kanji, in Vocabulary, and walks back one step at a time", () => {
    const word = drawerReducer(initialDrawerState, { type: "open-word", entSeq: 1358280, target: LINE_42 });
    expect(word).toMatchObject({ level: "peek", tab: "vocabulary", pinned: LINE_42, wordEntSeq: 1358280, kanji: null });
    const kanji = drawerReducer(word, { type: "open-kanji", literal: "食", target: LINE_42 });
    expect(kanji).toMatchObject({ wordEntSeq: 1358280, kanji: "食" });
    const back = drawerReducer(kanji, { type: "back" });
    expect(back).toMatchObject({ wordEntSeq: 1358280, kanji: null });
    expect(drawerReducer(back, { type: "back" })).toMatchObject({ wordEntSeq: null, kanji: null });
  });

  it("a new target drops the word and kanji of the old one", () => {
    const deep = at({ tracking: "pinned", pinned: LINE_42, wordEntSeq: 1, kanji: "食" });
    expect(drawerReducer(deep, { type: "open", tab: "vocabulary", target: PHRASE })).toMatchObject({ wordEntSeq: null, kanji: null });
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
