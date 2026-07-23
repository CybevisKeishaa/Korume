import { describe, expect, it } from "vitest";
import { transition, type CompanionEvent, type CompanionState } from "./state-machine";

const ALL_STATES: readonly CompanionState[] = [
  "idle",
  "observing",
  "listening",
  "speaking",
  "silent",
];

/** One representative event per event type; `address_granted` carries a stable
 * payload so the table stays deterministic. */
const EVENT_BY_TYPE: Record<CompanionEvent["type"], CompanionEvent> = {
  context_arrived: { type: "context_arrived" },
  address_granted: { type: "address_granted", speechKey: "speech.finishedShadowing" },
  address_denied: { type: "address_denied" },
  speech_dismissed: { type: "speech_dismissed" },
  learner_active: { type: "learner_active" },
  learner_idle: { type: "learner_idle" },
  settled: { type: "settled" },
};

const ALL_EVENT_TYPES = Object.keys(EVENT_BY_TYPE) as CompanionEvent["type"][];

/** The complete 5×7 truth table, written out independently of the
 * implementation: every pair not listed as a real transition is a no-op. */
const EXPECTED: Record<CompanionState, Record<CompanionEvent["type"], CompanionState>> = {
  idle: {
    context_arrived: "observing",
    address_granted: "idle",
    address_denied: "idle",
    speech_dismissed: "idle",
    learner_active: "listening",
    learner_idle: "idle",
    settled: "idle",
  },
  observing: {
    context_arrived: "observing",
    address_granted: "speaking",
    address_denied: "silent",
    speech_dismissed: "observing",
    learner_active: "observing",
    learner_idle: "observing",
    settled: "observing",
  },
  listening: {
    context_arrived: "listening",
    address_granted: "listening",
    address_denied: "listening",
    speech_dismissed: "listening",
    learner_active: "listening",
    learner_idle: "idle",
    settled: "listening",
  },
  speaking: {
    context_arrived: "speaking",
    address_granted: "speaking",
    address_denied: "speaking",
    speech_dismissed: "silent",
    learner_active: "speaking",
    learner_idle: "speaking",
    settled: "speaking",
  },
  silent: {
    context_arrived: "silent",
    address_granted: "silent",
    address_denied: "silent",
    speech_dismissed: "silent",
    learner_active: "silent",
    learner_idle: "silent",
    settled: "idle",
  },
};

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

  it("is total: all 5 states × 7 event types are defined in the table", () => {
    expect(ALL_STATES.length).toBe(5);
    expect(ALL_EVENT_TYPES.length).toBe(7);
    for (const state of ALL_STATES) {
      expect(Object.keys(EXPECTED[state]).sort()).toEqual([...ALL_EVENT_TYPES].sort());
    }
  });

  for (const state of ALL_STATES) {
    for (const eventType of ALL_EVENT_TYPES) {
      const expected = EXPECTED[state][eventType];
      const label = expected === state ? "no-op" : `→ ${expected}`;
      it(`${state} + ${eventType} ${label} (deterministic, never throws)`, () => {
        expect(() => transition(state, EVENT_BY_TYPE[eventType])).not.toThrow();
        expect(transition(state, EVENT_BY_TYPE[eventType])).toBe(expected);
      });
    }
  }
});
