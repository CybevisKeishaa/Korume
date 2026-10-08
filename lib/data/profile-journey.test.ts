import { describe, expect, it } from "vitest";
import { mapJourney } from "./profile-journey";

describe("mapJourney", () => {
  it("normalises timestamps, keeps order and nulls a missing label", () => {
    expect(
      mapJourney([
        { kind: "pinned_line", at: "2026-05-04T00:00:00+00:00", label: "こんにちは" },
        { kind: "first_activity", at: "2026-01-01T00:00:00+00:00", label: null },
      ]),
    ).toEqual([
      { kind: "pinned_line", at: "2026-05-04T00:00:00.000Z", label: "こんにちは" },
      { kind: "first_activity", at: "2026-01-01T00:00:00.000Z", label: null },
    ]);
  });

  it("drops a kind this build does not know", () => {
    expect(mapJourney([{ kind: "companion_grew", at: "2026-01-01T00:00:00Z", label: "x" }])).toEqual([]);
  });

  it("treats a null result as empty", () => {
    expect(mapJourney(null)).toEqual([]);
  });
});
