import { describe, expect, it } from "vitest";
import en from "./upcoming.json";

/**
 * Pin test for `messages/en/upcoming.json`.
 *
 * The `upcoming` namespace backs `UpcomingScreen`, the honest empty state Task
 * 6 renders on nine nav destinations whose feature is not built yet. There is
 * no single page.tsx to characterize against (nine routes will consume this
 * catalog), so this test pins the catalog directly: every value below is a
 * literal copied verbatim from the approved catalog in the Task 5 brief, so a
 * future copy change is a conscious test edit, never an accident.
 */
describe("upcoming.json EN — catalog literals", () => {
  it("pins the shared unlocks label", () => {
    expect(en.unlocksLabel).toBe("What fills this");
  });

  it("pins the review screen copy", () => {
    expect(en.review.title).toBe("Review");
    expect(en.review.body).toBe(
      "Your due cards from every module gather here — kanji, vocabulary and mined sentences in one queue.",
    );
    expect(en.review.unlocks).toBe(
      "Study anything with a card, and the queue starts filling itself.",
    );
  });

  it("pins the challenges screen copy", () => {
    expect(en.challenges.title).toBe("Challenges");
    expect(en.challenges.body).toBe(
      "Short, timed sets that push one skill harder than a normal session does.",
    );
    expect(en.challenges.unlocks).toBe(
      "Nothing yet. This screen arrives with the challenge engine.",
    );
  });

  it("pins the sensei screen copy", () => {
    expect(en.sensei.title).toBe("Sensei");
    expect(en.sensei.body).toBe(
      "A place to ask about anything you have studied, in your own words.",
    );
    expect(en.sensei.unlocks).toBe(
      "Nothing yet. Conversation practice already lives under Speaking.",
    );
  });

  it("pins the roadmap screen copy", () => {
    expect(en.roadmap.title).toBe("Roadmap");
    expect(en.roadmap.body).toBe(
      "The path your Companion is drawing from what you actually study, not from a fixed syllabus.",
    );
    expect(en.roadmap.unlocks).toBe(
      "Keep studying. A roadmap needs a few weeks of real sessions before it says anything true.",
    );
  });

  it("pins the weekly report screen copy", () => {
    expect(en.weeklyReport.title).toBe("Weekly Report");
    expect(en.weeklyReport.body).toBe(
      "One honest summary a week: what moved, what did not, and what your Companion adjusted.",
    );
    expect(en.weeklyReport.unlocks).toBe(
      "Finish a week of sessions and the first report writes itself.",
    );
  });

  it("pins the statistics screen copy", () => {
    expect(en.statistics.title).toBe("Statistics");
    expect(en.statistics.body).toBe(
      "The numbers behind your sessions — time, accuracy and coverage over time.",
    );
    expect(en.statistics.unlocks).toBe(
      "Nothing yet. This screen arrives once session history is being aggregated.",
    );
  });

  it("pins the achievements screen copy", () => {
    expect(en.achievements.title).toBe("Achievements");
    expect(en.achievements.body).toBe(
      "Badges you have earned, and the ones within reach.",
    );
    expect(en.achievements.unlocks).toBe(
      "Badges are awarded already; this screen is where they will be shown.",
    );
  });

  it("pins the settings screen copy", () => {
    expect(en.settings.title).toBe("Settings");
    expect(en.settings.body).toBe(
      "Account, language, motion, and control over your own data.",
    );
    expect(en.settings.unlocks).toBe(
      "Nothing yet. Data export and deletion land with this screen.",
    );
  });

  it("pins the explore lessons screen copy", () => {
    expect(en.explore.title).toBe("Explore Lessons");
    expect(en.explore.body).toBe(
      "Every lesson in Korume, arranged for discovery rather than for your own library.",
    );
    expect(en.explore.unlocks).toBe("Nothing yet. This screen is being built.");
  });
});
