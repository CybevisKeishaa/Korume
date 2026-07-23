/** Spec 1 §5.8 — five states, no animation, just state. Motion maps looks
 * onto these later (Spec 2); the System owns only states and transitions. */
export type CompanionState = "idle" | "observing" | "listening" | "speaking" | "silent";

export type CompanionEvent =
  | { type: "context_arrived" }
  | { type: "address_granted"; speechKey: string }
  | { type: "address_denied" }
  | { type: "speech_dismissed" }
  | { type: "learner_active" }
  | { type: "learner_idle" }
  | { type: "settled" };

/** Pure, total transition function. Unknown (state, event) pairs are no-ops
 * so the machine is deterministic and never throws (§12.2). */
export function transition(state: CompanionState, event: CompanionEvent): CompanionState {
  switch (state) {
    case "idle":
      if (event.type === "context_arrived") return "observing";
      if (event.type === "learner_active") return "listening";
      return state;
    case "observing":
      if (event.type === "address_granted") return "speaking";
      if (event.type === "address_denied") return "silent";
      return state;
    case "listening":
      if (event.type === "learner_idle") return "idle";
      return state;
    case "speaking":
      if (event.type === "speech_dismissed") return "silent";
      return state;
    case "silent":
      if (event.type === "settled") return "idle";
      return state;
  }
}
