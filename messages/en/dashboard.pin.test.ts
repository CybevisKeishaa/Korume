import { describe, expect, it } from "vitest";
import en from "./dashboard.json";
import vi from "../vi/dashboard.json";
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

describe("dashboard.json EN — card copy", () => {
  it("pins the card copy", () => {
    expect(en.continue.eyebrow).toEqual({ continue: "Continue learning", startNext: "Start next lesson", recommended: "Recommended for you", onboarding: "Start learning" });
    expect(en.continue.cta).toEqual({ continue: "Continue learning", start: "Start lesson", review: "Review lesson", explore: "Explore lessons" });
    expect(en.mission).toMatchObject({ eyebrow: "Today's mission", titleThree: "Three small promises", titleSome: "Today's missions", reward: "Reward", rewardEarned: "+{xp} XP earned" });
    expect(en.journey).toMatchObject({ eyebrow: "Learning journey", next: "Next milestone", authoring: "The JLPT journey is being prepared.", complete: "You've completed the current journey." });
    expect(en.korume).toEqual({ practice: "Practice now", viewWeakness: "View weakness" });
    expect(en.weekly).toMatchObject({ eyebrow: "Weekly evolution", notTracked: "Not yet tracked" });
    expect(en.activity).toMatchObject({ eyebrow: "Learning activity", noStreak: "No active streak" });
    expect(en.achievements).toMatchObject({ eyebrow: "Recent achievement", viewAll: "View achievements" });
    expect(en.title).toBe("Dashboard");
    expect(common.recommendations.heading).toBe("Recommended for you");
    expect(common.recommendations.loading).toBe("Finding videos at your level…");
  });
});

describe("dashboard.json Task 13 copy", () => {
  it("pins required EN and VI card copy", () => {
    expect(en).toMatchObject({ korume: { practice: "Practice now", viewWeakness: "View weakness" }, skills: { listening: "Listening", reading: "Reading", accuracy: "Pronunciation", pitch: "Pitch accent", rhythm: "Rhythm" }, weakness: { eyebrow: "Weakness snapshot", empty: "Keep learning so Korume can notice what to practise." }, weekly: { eyebrow: "Weekly evolution", title: "A quieter kind of progress", vocabulary: "{count, plural, one {+{count} vocabulary item} other {+{count} vocabulary items}}", points: "{value} points", hours: "{hours, plural, one {{hours, number} hour studied} other {{hours, number} hours studied}}", notTracked: "Not yet tracked", trackedFrom: "Study time recorded from {date}" }, activity: { eyebrow: "Learning activity", caption: "Consistency builds fluency.", streak: "{count}-day streak", noStreak: "No active streak", today: "Today", summary: "{streak}. {active} active days in the last 56. Rest days follow your schedule; faded days were before tracking began.", cell: { active: "{date}: {count, plural, one {{count} activity} other {{count} activities}}", empty: "{date}: no activity", rest: "{date}: rest day", unavailable: "{date}: not yet tracked" } }, achievements: { eyebrow: "Recent achievement", empty: "Your first achievement will appear here.", viewAll: "View achievements", earnedToday: "Earned today", earnedYesterday: "Earned yesterday", earnedOn: "Earned {date}", streakProgress: "Current streak {current}/{target}" } });
    expect(vi).toMatchObject({ korume: { practice: "Luy\u1ec7n ngay", viewWeakness: "Xem \u0111i\u1ec3m y\u1ebfu" }, skills: { listening: "Nghe", reading: "\u0110\u1ecdc", accuracy: "Ph\u00e1t \u00e2m", pitch: "Ng\u1eef \u0111i\u1ec7u", rhythm: "Nh\u1ecbp \u0111i\u1ec7u" }, weakness: { eyebrow: "\u0110i\u1ec3m c\u1ea7n luy\u1ec7n", empty: "H\u00e3y h\u1ecdc th\u00eam \u0111\u1ec3 Korume nh\u1eadn ra \u0111i\u1ec3m c\u1ea7n luy\u1ec7n." }, weekly: { eyebrow: "Ti\u1ebfn tri\u1ec3n h\u1eb1ng tu\u1ea7n", title: "M\u1ed9t ki\u1ec3u ti\u1ebfn b\u1ed9 l\u1eb7ng l\u1ebd", vocabulary: "{count, plural, other {+{count} t\u1eeb & c\u1ee5m t\u1eeb}}", points: "{value} \u0111i\u1ec3m", hours: "{hours, plural, other {{hours, number} gi\u1edd h\u1ecdc}}", notTracked: "Ch\u01b0a ghi nh\u1eadn", trackedFrom: "Th\u1eddi gian h\u1ecdc \u0111\u01b0\u1ee3c ghi t\u1eeb {date}" }, activity: { eyebrow: "Ho\u1ea1t \u0111\u1ed9ng h\u1ecdc", caption: "\u0110\u1ec1u \u0111\u1eb7n t\u1ea1o n\u00ean s\u1ef1 tr\u00f4i ch\u1ea3y.", streak: "Chu\u1ed7i {count} ng\u00e0y", noStreak: "Ch\u01b0a c\u00f3 chu\u1ed7i h\u1ecdc hi\u1ec7n t\u1ea1i", today: "H\u00f4m nay", summary: "{streak}. {active} ng\u00e0y c\u00f3 h\u1ecdc trong 56 ng\u00e0y qua. Ng\u00e0y ngh\u1ec9 theo l\u1ecbch c\u1ee7a b\u1ea1n; \u00f4 m\u1edd l\u00e0 tr\u01b0\u1edbc khi b\u1eaft \u0111\u1ea7u ghi nh\u1eadn.", cell: { active: "{date}: {count, plural, other {{count} ho\u1ea1t \u0111\u1ed9ng}}", empty: "{date}: kh\u00f4ng c\u00f3 ho\u1ea1t \u0111\u1ed9ng", rest: "{date}: ng\u00e0y ngh\u1ec9", unavailable: "{date}: ch\u01b0a ghi nh\u1eadn" } }, achievements: { eyebrow: "Th\u00e0nh t\u1ef1u g\u1ea7n \u0111\u00e2y", empty: "Th\u00e0nh t\u1ef1u \u0111\u1ea7u ti\u00ean c\u1ee7a b\u1ea1n s\u1ebd hi\u1ec7n \u1edf \u0111\u00e2y.", viewAll: "Xem th\u00e0nh t\u1ef1u", earnedToday: "\u0110\u1ea1t h\u00f4m nay", earnedYesterday: "\u0110\u1ea1t h\u00f4m qua", earnedOn: "\u0110\u1ea1t {date}", streakProgress: "Chu\u1ed7i hi\u1ec7n t\u1ea1i {current}/{target}" } });
  });
});
