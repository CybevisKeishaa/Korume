import { describe, expect, it } from "vitest";
import en from "./nav.json";

/**
 * Pin test for the nav literals `NAV_GROUPS`/`NAV_ITEMS` add in Plan C1 Task
 * 7: the new "insights" group heading and the eight destination labels for
 * the routes Task 6 shipped as an honest empty state (review, challenges,
 * sensei, roadmap, weeklyReport, statistics, achievements, settings). Every
 * value below is copied verbatim from the approved catalog in the Task 7
 * brief, so a future copy change is a conscious test edit, never an
 * accident.
 *
 * The pre-existing nav literals (learn/study/progress/account groups, the 14
 * previously-shipped destination labels) are pinned inline in
 * `components/layout/app-nav.test.tsx`'s `EXPECTED_LABELS` /
 * `EXPECTED_GROUP_LABELS` — this file covers only what Task 7 adds, to avoid
 * duplicating those pins in two places.
 */
describe("nav.json EN — Task 7 literals", () => {
  it("pins the insights group heading", () => {
    expect(en.groups.insights).toBe("Insights");
  });

  it("pins the eight newly-wired destination labels", () => {
    expect(en.review).toBe("Review");
    expect(en.challenges).toBe("Challenges");
    expect(en.sensei).toBe("Sensei");
    expect(en.roadmap).toBe("Roadmap");
    expect(en.weeklyReport).toBe("Weekly Report");
    expect(en.statistics).toBe("Statistics");
    expect(en.achievements).toBe("Achievements");
    expect(en.settings).toBe("Settings");
  });
});
