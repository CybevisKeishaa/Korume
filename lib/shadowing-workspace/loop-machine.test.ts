import { describe, expect, it } from "vitest";
import { decideAtSentenceEnd, resetLoop, type LoopState } from "./loop-machine";

describe("loop machine", () => {
  it("continues or pauses with looping off", () => {
    expect(decideAtSentenceEnd({ enabled: false, count: 3, autoPause: false }, { sentenceIndex: 1, playsCompleted: 0 }).decision).toEqual({ kind: "continue" });
    expect(decideAtSentenceEnd({ enabled: false, count: 3, autoPause: true }, { sentenceIndex: 1, playsCompleted: 0 }).decision).toEqual({ kind: "pause" });
  });

  it("counts current play toward a three-play cycle", () => {
    let state: LoopState = { sentenceIndex: 1, playsCompleted: 0 };
    let result = decideAtSentenceEnd({ enabled: true, count: 3, autoPause: false }, state);
    expect(result).toEqual({ decision: { kind: "replay" }, next: { sentenceIndex: 1, playsCompleted: 1 } });
    state = result.next;
    result = decideAtSentenceEnd({ enabled: true, count: 3, autoPause: false }, state);
    expect(result).toEqual({ decision: { kind: "replay" }, next: { sentenceIndex: 1, playsCompleted: 2 } });
    expect(decideAtSentenceEnd({ enabled: true, count: 3, autoPause: false }, result.next)).toEqual({ decision: { kind: "continue" }, next: { sentenceIndex: 1, playsCompleted: 0 } });
    expect(decideAtSentenceEnd({ enabled: true, count: 3, autoPause: true }, result.next).decision).toEqual({ kind: "pause" });
  });

  it("does not replay an already complete one-play cycle", () => {
    expect(decideAtSentenceEnd({ enabled: true, count: 1, autoPause: false }, { sentenceIndex: 1, playsCompleted: 0 }).decision).toEqual({ kind: "continue" });
    expect(decideAtSentenceEnd({ enabled: true, count: 1, autoPause: true }, { sentenceIndex: 1, playsCompleted: 0 }).decision).toEqual({ kind: "pause" });
  });

  it("replays infinitely without auto-pause", () => {
    let state: LoopState = { sentenceIndex: 1, playsCompleted: 0 };
    for (let i = 0; i < 100; i += 1) {
      const result = decideAtSentenceEnd({ enabled: true, count: 0, autoPause: true }, state);
      expect(result.decision).toEqual({ kind: "replay" });
      state = result.next;
    }
    expect(state.playsCompleted).toBe(100);
  });

  it("resets a sentence cycle", () => {
    expect(resetLoop(5)).toEqual({ sentenceIndex: 5, playsCompleted: 0 });
  });
});
