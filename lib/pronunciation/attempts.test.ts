import { describe, expect, it } from "vitest";
import { attemptsReducer, hasUnsaved, UNSAVED_PHASES, type AttemptAction, type AttemptPhase } from "./attempts";

const original = new Blob(["original"]);
const wav = new Blob(["wav"], { type: "audio/wav" });
const result = { pronunciationScore: 86, rhythmScore: 80, assessment: { v: 1 as const, accuracy: 90, completeness: 100, recognizedText: null, words: null } };
const run = (...actions: AttemptAction[]) => actions.reduce(attemptsReducer, {});
const saved = (lineId: string, sessionId: string): AttemptAction[] => [
  { type: "start", lineId }, { type: "recorded", lineId, original },
  { type: "converted", lineId, wav, pitch: null }, { type: "saving", lineId },
  { type: "saved", lineId, sessionId, signedUrl: `url:${sessionId}` },
];

describe("pronunciation attempts", () => {
  it("routes late scoring to the session owner after another line starts", () => {
    const state = run(...saved("L51", "S1"), { type: "start", lineId: "L52" },
      { type: "scoring", sessionId: "S1" });
    expect(Object.keys(state)).toHaveLength(2);
    expect(state.L51?.phase).toBe("scoring");
    const scored = attemptsReducer(state, { type: "scored", sessionId: "S1", result });
    expect(scored.L51).toMatchObject({ phase: "scored", result, sessionId: "S1", signedUrl: "url:S1" });
    expect(scored.L52).toMatchObject({ phase: "recording", result: null, sessionId: null });
    expect(state.L51?.result).toBeNull();
  });

  it("ignores unknown, discarded and superseded sessions without mutating state", () => {
    const states = [
      {},
      run(...saved("L1", "S1"), { type: "discard", lineId: "L1" }),
      run(...saved("L1", "S1"), { type: "start", lineId: "L1" }),
      run(...saved("L1", "S1"), ...saved("L1", "S2")),
    ];
    for (const state of states) {
      for (const action of [
        { type: "scoring", sessionId: "S1" }, { type: "scored", sessionId: "S1", result },
        { type: "score-failed", sessionId: "S1", kind: "error", retryAfter: null },
      ] satisfies AttemptAction[]) expect(attemptsReducer(state, action)).toBe(state);
    }
  });

  it("does not resurrect a discarded attempt from stale conversion or save actions", () => {
    const state = run({ type: "start", lineId: "L1" }, { type: "discard", lineId: "L1" });
    const stale: AttemptAction[] = [
      { type: "recorded", lineId: "L1", original }, { type: "converted", lineId: "L1", wav, pitch: null },
      { type: "convert-failed", lineId: "L1" }, { type: "saving", lineId: "L1" },
      { type: "saved", lineId: "L1", sessionId: "S1", signedUrl: "u" }, { type: "save-failed", lineId: "L1" },
    ];
    expect(stale).toHaveLength(6);
    for (const action of stale) expect(attemptsReducer(state, action)).toBe(state);
    expect(state).toEqual({});
  });

  it("keeps original and WAV through save failures, retries and conversion failures", () => {
    let state = run(...saved("L1", "S1").slice(0, -1), { type: "save-failed", lineId: "L1" });
    expect(state.L1).toMatchObject({ phase: "save-failed", original, wav, sessionId: null });
    expect(state.L1?.original).toBe(original);
    expect(state.L1?.wav).toBe(wav);
    state = attemptsReducer(state, { type: "saving", lineId: "L1" });
    expect(state.L1?.phase).toBe("saving");
    expect(state.L1?.wav).toBe(wav);
    const failed = run({ type: "start", lineId: "L2" }, { type: "recorded", lineId: "L2", original }, { type: "convert-failed", lineId: "L2" });
    expect(failed.L2).toMatchObject({ phase: "convert-failed", original, wav: null });
    const restarted = attemptsReducer(state, { type: "start", lineId: "L1" });
    expect(restarted.L1).toEqual({ lineId: "L1", phase: "recording", original: null, wav: null, pitch: null, sessionId: null, signedUrl: null, result: null, retryAfter: null });
  });

  it("reports all and only pre-201 phases as unsaved", () => {
    const phases: [AttemptPhase, boolean][] = [
      ["recording", true], ["converting", true], ["convert-failed", true], ["saving", true], ["save-failed", true],
      ["scoring", false], ["scored", false], ["unscored-unavailable", false], ["unscored-throttled", false], ["unscored-error", false],
    ];
    expect(phases).toHaveLength(10);
    expect(UNSAVED_PHASES.size).toBe(5);
    const base = run({ type: "start", lineId: "L1" }).L1;
    if (!base) throw new Error("missing attempt");
    for (const [phase, want] of phases) expect(hasUnsaved({ L1: { ...base, phase } })).toBe(want);
    expect(hasUnsaved({})).toBe(false);
    expect(hasUnsaved(run(...saved("L1", "S1"), { type: "start", lineId: "L2" }))).toBe(true);
  });

  it.each([
    ["unavailable", "unscored-unavailable", null], ["throttled", "unscored-throttled", 12],
    ["throttled", "unscored-throttled", null], ["error", "unscored-error", null],
  ] as const)("retains playable saved audio after %s (%s, %s)", (kind, phase, retryAfter) => {
    const base = run(...saved("L1", "S1"));
    const failed = attemptsReducer(base, { type: "score-failed", sessionId: "S1", kind, retryAfter });
    expect(failed.L1).toMatchObject({ phase, retryAfter, signedUrl: "url:S1", original, wav });
    const retry = attemptsReducer(failed, { type: "scoring", sessionId: "S1" });
    expect(retry.L1).toMatchObject({ phase: "scoring", retryAfter: null });
    const scored = attemptsReducer(retry, { type: "scored", sessionId: "S1", result });
    expect(scored.L1).toMatchObject({ phase: "scored", retryAfter: null, result });
  });
});
