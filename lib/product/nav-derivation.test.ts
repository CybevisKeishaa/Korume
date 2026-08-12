import { describe, expect, it } from "vitest";
import { NAV_GROUPS } from "@/components/layout/app-nav";
import { NAV_BASELINE } from "./nav-baseline.fixture";

describe("nav baseline fixture", () => {
  it("is a faithful copy of the literal shipping today", () => {
    expect(NAV_BASELINE).toEqual(NAV_GROUPS);
  });
});
