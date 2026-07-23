import { describe, expect, it } from "vitest";
import { CONTEXT_PRIORITY, type ExperienceContext } from "./contexts";

describe("CONTEXT_PRIORITY (spec 1 §5.10 bands)", () => {
  it("covers every context with an ambient-band priority (≥50) — no context in this plan is a milestone", () => {
    const entries = Object.entries(CONTEXT_PRIORITY) as [ExperienceContext, number][];
    expect(entries.length).toBe(4);
    for (const [, priority] of entries) expect(priority).toBeGreaterThanOrEqual(50);
  });

  it("assigns every context a distinct priority so arbitration is deterministic (§5.10)", () => {
    expect(new Set(Object.values(CONTEXT_PRIORITY)).size).toBe(4);
  });

  it("post-session address outranks empty-state guidance", () => {
    expect(CONTEXT_PRIORITY.finished_shadowing).toBeLessThan(CONTEXT_PRIORITY.empty_library);
  });
});
