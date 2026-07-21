import { describe, expect, it } from "vitest";
import en from "./common.json";

/**
 * Characterization test for the `common.json` leaves Task 10 added when it
 * promoted the recommendation rail's strings out of per-module namespaces
 * (`dashboard`/`videos`) into `common` — a string needed by two or more
 * modules is promoted to `common`, not duplicated (CLAUDE.md P4).
 *
 * These leaves already have RTL coverage in
 * `components/learning/recommendation-rail.test.tsx` via EXACT
 * `getByText(...)` matches, which — unlike `toHaveTextContent` — perform
 * equality, not containment, so that RTL test does genuinely prove the
 * copy, not just the wiring. This file adds the belt-and-suspenders literal
 * `toBe` pin directly against the catalog anyway, per the standing
 * convention from the Task 10 review: the pin is a `toBe` assertion here,
 * RTL proves wiring. `recommendations.heading`/`.loading` (also promoted
 * from `dashboard.json` in the same task) are pinned in
 * `messages/en/dashboard.pin.test.ts`, not duplicated here.
 *
 * Every expected value below is a literal copied verbatim from
 * `messages/en/common.json` as authored in Task 10 (never derived from the
 * catalog itself — binding pattern 2).
 */
describe("common.json EN — recommendation-rail literals (Task 10)", () => {
  it("pins the shared 'no thumbnail' fallback (video-card.tsx + recommendation-rail.tsx)", () => {
    expect(en.noThumbnail).toBe("No thumbnail");
  });

  it("pins the empty-recommendations rich-text message", () => {
    expect(en.recommendations.empty).toBe(
      "No recommendations yet — <link>import a video</link> to get started.",
    );
  });

  it("pins the known-words percentage line", () => {
    expect(en.recommendations.knownWords).toBe("{percent}% words you know");
  });

  it("pins the ideal-band label", () => {
    expect(en.recommendations.band.ideal).toBe("Just right");
  });

  it("pins the too-easy-band label", () => {
    expect(en.recommendations.band.tooEasy).toBe("Easy review");
  });

  it("pins the too-hard-band label", () => {
    expect(en.recommendations.band.tooHard).toBe("Challenge");
  });
});
