import { describe, expect, it } from "vitest";
import { isHelped } from "./helped";

// The three cases pgTAP pins for `dictation_attempt_helped` (migration 049, spec §3.6).
describe("isHelped (TS twin of dictation_attempt_helped)", () => {
  it.each([
    [false, [], false],
    [true, [], true],
    [false, [1], true],
  ] as const)("easy %s, hinted %j -> %s", (easyMode, hintedUnits, expected) => {
    expect(isHelped({ easyMode, hintedUnits })).toBe(expected);
  });
});
