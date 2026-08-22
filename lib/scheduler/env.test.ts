import { describe, expect, it } from "vitest";
import { schedulerEnvSpec } from "./env";

/**
 * Whole-branch review, I2. `SCHEDULER_ENABLED` was read raw by
 * `lib/scheduler/start.ts` and registered with `registerEnvSpec` nowhere, so
 * a value that MEANT "on" but was not spelled `"true"` silently disabled
 * every account deletion — while the app kept accepting requests and kept
 * telling users their data was scheduled for a date. The deploy target is a
 * hand-configured single Node instance, so this is a plausible production
 * outcome, and it is invisible for seven days by construction.
 *
 * The near-misses below are the actual point of the test: unset and "false"
 * must PASS (off is the correct default for a build, a test run and every
 * developer machine), and everything else must FAIL startup rather than being
 * read as "off".
 */
describe("schedulerEnvSpec", () => {
  const parse = (env: Record<string, string>) => schedulerEnvSpec.schema.safeParse(env);

  it("accepts unset — off is the correct default and must not need an opt-out", () => {
    expect(parse({}).success).toBe(true);
  });

  it("accepts the two literal values", () => {
    expect(parse({ SCHEDULER_ENABLED: "true" }).success).toBe(true);
    expect(parse({ SCHEDULER_ENABLED: "false" }).success).toBe(true);
  });

  // Each of these previously meant "off, silently". `it.each` over an empty
  // list generates zero tests and reports green, so the list's own length is
  // asserted first (CLAUDE.md §7).
  const NEAR_MISSES = ["1", "TRUE", "True", "yes", "on", "0", "", " true"];

  it("checks every near-miss, not an empty list", () => {
    expect(NEAR_MISSES).toHaveLength(8);
    expect(new Set(NEAR_MISSES).size).toBe(NEAR_MISSES.length);
  });

  it.each(NEAR_MISSES)("rejects %o rather than reading it as off", (value) => {
    const result = parse({ SCHEDULER_ENABLED: value });
    expect(result.success).toBe(false);
  });

  it("explains what went wrong without the operator having to read the source", () => {
    const result = parse({ SCHEDULER_ENABLED: "1" });
    expect(result.success).toBe(false);
    const message = result.success ? "" : result.error.issues.map((i) => i.message).join(" ");
    expect(message).toContain("SCHEDULER_ENABLED");
    expect(message).toContain("true");
    expect(message).toContain("false");
  });

  it("is registered under a name the aggregated startup report can group by", () => {
    expect(schedulerEnvSpec.name).toBe("scheduler");
  });
});
