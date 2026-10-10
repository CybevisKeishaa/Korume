import { describe, expect, it } from "vitest";
import en from "./dashboard.json";
import common from "./common.json";

describe("dashboard.json EN — port dashboard", () => {
  it("pins the header, quick access, and card-error copy", () => {
    expect(en.header.eyebrow).toBe("{weekday} · {daypart}");
    expect(en.header.daypart).toEqual({ morning: "Morning", afternoon: "Afternoon", evening: "Evening", lateEvening: "Late evening" });
    expect(en.header.title).toBe("Welcome back, {name}");
    expect(en.header.titleNoName).toBe("Welcome back");
    expect(en.header.subtitle).toBe("Let's continue your Japanese journey.");
    expect(en.header.streak).toBe("{count}-day streak");
    expect(en.quick).toEqual({ eyebrow: "Quick access", due: "{count} due", caughtUp: "All caught up" });
    expect(en.card.error).toBe("This part couldn't load right now.");
  });
});

describe("dashboard.json EN — legacy cards", () => {
  it("pins legacy dashboard copy until Task 14 removes its remaining consumers", () => {
    expect(en.continue.eyebrow).toEqual({ continue: "Continue learning", startNext: "Start next lesson", recommended: "Recommended for you", onboarding: "Start learning" });
    expect(en.continue.cta).toEqual({ continue: "Continue learning", start: "Start lesson", review: "Review lesson", explore: "Explore lessons" });
    expect(en.mission).toMatchObject({ eyebrow: "Today's mission", titleThree: "Three small promises", titleSome: "Today's missions", reward: "Reward", rewardEarned: "+{xp} XP earned" });
    expect(en.journey).toMatchObject({ eyebrow: "Learning journey", next: "Next milestone", authoring: "The JLPT journey is being prepared.", complete: "You've completed the current journey." });
    expect(en.title).toBe("Dashboard");
    expect(en.subtitle).toBe("Pick a module to start studying.");
    expect(en.a11y.progress).toBe("Your progress");
    expect(en.badges.heading).toBe("Badges");
    expect(en.modules.heading).toBe("Modules");
    expect(en.modules.kanjiTitle).toBe("Kanji");
    expect(en.modules.vocabTitle).toBe("Vocabulary");
    expect(en.modules.grammarTitle).toBe("Grammar");
    expect(common.recommendations.heading).toBe("Recommended for you");
    expect(common.recommendations.loading).toBe("Finding videos at your level…");
  });
});
