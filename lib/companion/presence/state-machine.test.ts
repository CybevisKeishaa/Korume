import { describe, expect, it } from "vitest";
import { transition, type CompanionState } from "./state-machine";

describe("transition (spec 1 §5.8)", () => {
  it("walks the address path: idle → observing → speaking → silent → idle", () => {
    let s: CompanionState = "idle";
    s = transition(s, { type: "context_arrived" });
    expect(s).toBe("observing");
    s = transition(s, { type: "address_granted", speechKey: "speech.finishedShadowing" });
    expect(s).toBe("speaking");
    s = transition(s, { type: "speech_dismissed" });
    expect(s).toBe("silent");
    s = transition(s, { type: "settled" });
    expect(s).toBe("idle");
  });

  it("denied address goes deliberately silent, never speaking", () => {
    expect(transition("observing", { type: "address_denied" })).toBe("silent");
  });

  it("listening is entered and left only by learner activity", () => {
    expect(transition("idle", { type: "learner_active" })).toBe("listening");
    expect(transition("listening", { type: "learner_idle" })).toBe("idle");
  });

  it("unknown transitions are no-ops (deterministic, never throws)", () => {
    expect(transition("speaking", { type: "context_arrived" })).toBe("speaking");
    expect(transition("idle", { type: "settled" })).toBe("idle");
  });
});
