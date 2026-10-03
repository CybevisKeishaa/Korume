import { describe, expect, it } from "vitest";
import { RETRIEVAL_DEADLINE_MS, TOOL_DEADLINE_MS, TURN_RESERVATION_TTL_SECONDS, turnLifetimeUpperBoundMs } from "./limits";

describe("turn time budget", () => {
  it("holds the reservation longer than the slowest possible turn (spec §3.4)", () => {
    expect(TURN_RESERVATION_TTL_SECONDS * 1000).toBeGreaterThan(turnLifetimeUpperBoundMs());
  });
  it("gives each tool less time than the whole retrieval stage", () => {
    expect(TOOL_DEADLINE_MS).toBeLessThan(RETRIEVAL_DEADLINE_MS);
  });
});
