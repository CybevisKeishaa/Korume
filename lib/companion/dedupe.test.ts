import { describe, expect, it } from "vitest";
import { dedupeKeyFor, memoryTitleFor, refFromDedupeKey } from "./dedupe";

describe("dedupeKeyFor", () => {
  it("is constant for once-in-a-lifetime types", () => {
    expect(dedupeKeyFor("first_shadow")).toBe("first_shadow");
  });
  it("scopes companion_grew per target phase", () => {
    expect(dedupeKeyFor("companion_grew", { phase: 2 })).toBe("companion_grew:2");
    expect(dedupeKeyFor("companion_grew", { phase: 3 })).toBe("companion_grew:3");
  });
  it("scopes line/card/jlpt types by their ref", () => {
    expect(dedupeKeyFor("line_mastered", { lineId: "L1" })).toBe("line_mastered:L1");
    expect(dedupeKeyFor("mining_saved", { cardId: "C1" })).toBe("mining_saved:C1");
    expect(dedupeKeyFor("jlpt_passed", { jlptLevel: "N4" })).toBe("jlpt_passed:N4");
    expect(dedupeKeyFor("pinned_line", { lineId: "L9" })).toBe("pinned_line:L9");
  });
  it("first_meeting and first_video_completed are once-per-lifetime constants", () => {
    expect(dedupeKeyFor("first_meeting")).toBe("first_meeting");
    // Constant (not per-video): the (user_id, dedupe_key) unique upsert is
    // what enforces "first EVER completed video" race-free at the DB. Since
    // no ref can influence the key, `MemoryRef` no longer carries a videoId.
    expect(dedupeKeyFor("first_video_completed")).toBe("first_video_completed");
  });
  it("throws when a required ref is missing", () => {
    expect(() => dedupeKeyFor("line_mastered")).toThrow();
  });
});

describe("memoryTitleFor", () => {
  it("returns a message descriptor (key + ICU values) for discovered types, never a rendered string", () => {
    expect(memoryTitleFor("first_shadow")).toEqual({ key: "memoryTitle.firstShadow", values: {} });
    expect(memoryTitleFor("line_mastered")).toEqual({ key: "memoryTitle.lineMastered", values: {} });
    expect(memoryTitleFor("mining_saved")).toEqual({ key: "memoryTitle.miningSaved", values: {} });
    expect(memoryTitleFor("first_video_completed")).toEqual({
      key: "memoryTitle.firstVideoCompleted",
      values: {},
    });
  });

  it("first_meeting maps to its own descriptor", () => {
    expect(memoryTitleFor("first_meeting")).toEqual({ key: "memoryTitle.firstMeeting", values: {} });
  });

  it("keys jlpt_passed off {level}", () => {
    expect(memoryTitleFor("jlpt_passed", { jlptLevel: "N4" })).toEqual({
      key: "memoryTitle.jlptPassed",
      values: { level: "N4" },
    });
  });

  it("scopes companion_grew's KEY by phase (not a rendered value) — the P12 regression guard", () => {
    // P12: "never called 'stage' — that imports a game/levelling mindset P12
    // rejects" (lib/companion/types.ts). The OLD `titleFor` leaked the raw
    // phase number straight into learner-facing copy ("...bước sang giai
    // đoạn 2"). A descriptor's `key` is an internal catalog lookup, never
    // rendered to the learner directly — so the phase number may appear
    // there — but its `values` (what actually gets interpolated into the
    // rendered message) must carry nothing numeric that exposes a stage.
    expect(memoryTitleFor("companion_grew", { phase: 2 })).toEqual({
      key: "memoryTitle.companionGrew.2",
      values: {},
    });
    expect(memoryTitleFor("companion_grew", { phase: 3 })).toEqual({
      key: "memoryTitle.companionGrew.3",
      values: {},
    });
  });

  it("P12 guard: companion_grew's `values` is always empty for every phase — nothing there can leak a stage number", () => {
    // `key` (e.g. "memoryTitle.companionGrew.2") is an internal catalog
    // lookup, never rendered to the learner — the phase digit belongs there.
    // `values` is what actually gets ICU-interpolated into the rendered
    // message, so THAT must carry nothing numeric. Asserted for every real
    // phase (1-4), not just one, so a future phase-specific value addition
    // can't slip past this guard unnoticed.
    for (const phase of [1, 2, 3, 4] as const) {
      const descriptor = memoryTitleFor("companion_grew", { phase });
      expect(descriptor?.values).toEqual({});
    }
  });

  it("P12 guard: jlpt_passed's {level} carries a real level, never a bare stage-shaped digit", () => {
    const descriptor = memoryTitleFor("jlpt_passed", { jlptLevel: "N4" });
    expect(descriptor?.values.level).toBe("N4");
    // A JLPT level ("N4") legitimately contains a digit — that's the exam
    // level, not a companion-relationship stage — so this is deliberately
    // NOT a blanket "no digits anywhere" assertion (unlike companion_grew's
    // guard above, which correctly requires exactly that).
  });

  it("returns null for gifted pins (learner supplies their own title, never translated)", () => {
    expect(memoryTitleFor("pinned_line")).toBeNull();
  });
});

describe("refFromDedupeKey (read-time inverse for title values)", () => {
  it("recovers the JLPT level and the phase", () => {
    expect(refFromDedupeKey("jlpt_passed", "jlpt_passed:N4")).toEqual({ jlptLevel: "N4" });
    expect(refFromDedupeKey("companion_grew", "companion_grew:3")).toEqual({ phase: 3 });
  });

  it("is total: null, malformed, and value-less keys yield {}", () => {
    expect(refFromDedupeKey("jlpt_passed", null)).toEqual({});
    expect(refFromDedupeKey("companion_grew", "companion_grew:9")).toEqual({});
    expect(refFromDedupeKey("first_meeting", "first_meeting")).toEqual({});
  });

  it("round-trips with dedupeKeyFor for the value-carrying types", () => {
    expect(refFromDedupeKey("jlpt_passed", dedupeKeyFor("jlpt_passed", { jlptLevel: "N2" }))).toEqual({
      jlptLevel: "N2",
    });
    expect(refFromDedupeKey("companion_grew", dedupeKeyFor("companion_grew", { phase: 2 }))).toEqual({ phase: 2 });
  });
});
