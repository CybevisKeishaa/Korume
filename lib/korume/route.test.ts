import { describe, expect, it } from "vitest";
import { originRouteFor } from "./route";

describe("originRouteFor", () => {
  it("builds the Shadowing deep link the workspace honours (Task 0)", () => {
    const v = "a0000000-0000-0000-0000-000000000001";
    const l = "b0000000-0000-0000-0000-000000000002";
    expect(originRouteFor(v, l)).toBe(`/shadowing/${v}?line=${l}`);
  });
});
