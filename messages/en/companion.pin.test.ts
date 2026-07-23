import { describe, expect, it } from "vitest";
import en from "./companion.json";

/**
 * Characterization test for `companion.json` (Task 17). Unlike every other
 * `*.pin.test.ts` in this plan, there is no PRE-extraction JSX source to pin
 * against: `memoryTitleFor`'s descriptor keys never existed as hardcoded EN
 * strings anywhere in the app (the old `titleFor()` in `lib/companion/dedupe.ts`
 * only ever returned Vietnamese copy — see `docs/superpowers/plans/
 * 2026-07-19-l9a-string-extraction-vietnamese.md`, Task 17). So this pins the
 * catalog leaves literally, against the plan's own authored EN strings —
 * the plan IS the source of truth here, not a refactored component.
 *
 * There is no Journal UI yet (L9b) — this namespace has zero UI consumers at
 * ship; `dedupe.test.ts` is what actually exercises `memoryTitleFor()`.
 *
 * P12 regression guard (spec: "never called 'stage' — that imports a
 * game/levelling mindset P12 rejects"): none of the four `companionGrew`
 * phrasings may contain a bare digit exposing the phase number to the
 * learner (the OLD `titleFor` did: "...bước sang giai đoạn 2").
 */
describe("companion.json EN — memoryTitleFor descriptors (spec §4.4)", () => {
  it("pins the four once-in-a-lifetime discovered-memory titles", () => {
    expect(en.memoryTitle.firstShadow).toBe("The first line you shadowed successfully.");
    expect(en.memoryTitle.lineMastered).toBe("The line you practiced until you could finally say it.");
    expect(en.memoryTitle.miningSaved).toBe("A line you decided to save.");
    expect(en.memoryTitle.firstVideoCompleted).toBe("The first video you finished.");
  });

  it("pins the jlptPassed template with its {level} placeholder", () => {
    expect(en.memoryTitle.jlptPassed).toBe("JLPT {level} milestone");
  });

  it("pins all four companionGrew phasings, keyed by phase", () => {
    expect(en.memoryTitle.companionGrew["1"]).toBe("The day the two of you met.");
    expect(en.memoryTitle.companionGrew["2"]).toBe("The day your companion started to feel closer.");
    expect(en.memoryTitle.companionGrew["3"]).toBe("The day your companion truly came to understand you.");
    expect(en.memoryTitle.companionGrew["4"]).toBe(
      "The day your companion had been with you long enough to remember the whole journey.",
    );
  });

  it("P12 guard: no companionGrew phrasing contains a bare digit-as-stage", () => {
    for (const phrase of Object.values(en.memoryTitle.companionGrew)) {
      expect(phrase).not.toMatch(/\d/);
    }
  });
});
