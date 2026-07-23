import { describe, expect, it } from "vitest";
import en from "./profile.json";

/**
 * Characterization test for `profile.json` (Task 16): a literal `toBe` pin
 * for every `profile.*` leaf, copied verbatim from the pre-extraction source
 * of `app/[locale]/(app)/profile/page.tsx` on `layer-9a-string-extraction`
 * before Task 16 (never derived from the catalog itself — binding pattern
 * 2). This is an async server component with no client sub-components, so
 * it is the whole namespace.
 *
 * `streakDays` ("{count} days") is a plain interpolation, NOT an ICU plural —
 * the pre-extraction source always rendered the literal " days" suffix
 * regardless of count (never "1 day"), so the extraction preserves that
 * byte-identically rather than "fixing" it into a plural the source never had.
 */
describe("profile.json EN — profile/page.tsx", () => {
  it("pins the page heading and the account card", () => {
    expect(en.page.heading).toBe("Profile");
    expect(en.page.accountHeading).toBe("Account");
    expect(en.page.emailLabel).toBe("Email:");
    expect(en.page.emailFallback).toBe("—");
  });

  it("pins the stats card's heading and the five stat labels", () => {
    expect(en.page.statsHeading).toBe("Stats");
    expect(en.page.levelLabel).toBe("Level");
    expect(en.page.xpLabel).toBe("XP");
    expect(en.page.currentStreakLabel).toBe("Current streak");
    expect(en.page.longestStreakLabel).toBe("Longest streak");
    expect(en.page.badgesEarnedLabel).toBe("Badges earned");
  });

  it("pins the non-pluralized streak-days template and the badges-earned fraction template", () => {
    expect(en.page.streakDays).toBe("{count} days");
    expect(en.page.badgesCount).toBe("{earned} / {total}");
  });

  it("pins the view-full-dashboard link", () => {
    expect(en.page.viewDashboard).toBe("View full dashboard");
  });
});
