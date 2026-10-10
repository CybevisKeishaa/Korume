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
