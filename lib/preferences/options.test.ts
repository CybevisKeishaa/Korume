import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DAILY_MINUTES_OPTIONS, DEFAULT_PREFERENCES, DIFFICULTY_OPTIONS, DISPLAY_SCALE_OPTIONS,
  LEARNING_SCHEDULE_OPTIONS, PRONUNCIATION_DURATION_OPTIONS, PRONUNCIATION_SORT_OPTIONS, REVIEW_FREQUENCY_OPTIONS, canonicalScheduleDays,
} from "./options";

describe("preference options", () => {
  it("pins every option list the spec names", () => {
    expect(LEARNING_SCHEDULE_OPTIONS).toEqual(["every_day", "weekdays", "custom"]);
    expect(REVIEW_FREQUENCY_OPTIONS).toEqual(["normal", "more", "relaxed"]);
    expect(DIFFICULTY_OPTIONS).toEqual(["adaptive", "easy", "challenge"]);
    expect(DISPLAY_SCALE_OPTIONS).toEqual(["normal", "large", "extra_large"]);
    expect(DAILY_MINUTES_OPTIONS).toEqual([5, 10, 15, 20, 30, 45, 60]);
    expect(PRONUNCIATION_SORT_OPTIONS).toEqual(["recommended", "newest", "shortest", "in_progress"]);
    expect(PRONUNCIATION_DURATION_OPTIONS).toEqual(["under_10", "10_30", "over_30"]);
  });

  it("allows in the database exactly the display values the app offers", () => {
    const sql = readFileSync("supabase/migrations/20260922000033_user_preferences.sql", "utf8");
    const allowed = (column: string) => {
      const list = sql.split(`check (${column} in (`)[1]?.split(")")[0] ?? "";
      return [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]);
    };
    expect(allowed("pronunciation_sort")).toEqual([...PRONUNCIATION_SORT_OPTIONS]);
    expect(allowed("pronunciation_duration")).toEqual([...PRONUNCIATION_DURATION_OPTIONS]);
  });

  it("canonicalises the fixed schedules and normalises custom days", () => {
    expect(canonicalScheduleDays("every_day", [])).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(canonicalScheduleDays("weekdays", [6])).toEqual([1, 2, 3, 4, 5]);
    expect(canonicalScheduleDays("custom", [5, 1, 5, 3])).toEqual([1, 3, 5]);
  });

  it("defaults match the migration defaults", () => {
    expect(DEFAULT_PREFERENCES).toEqual({
      learningSchedule: "every_day", scheduleDays: [1, 2, 3, 4, 5, 6, 7],
      reviewFrequency: "normal", difficulty: "adaptive", displayScale: "normal",
      reduceMotion: false, microphoneEnabled: true, cameraEnabled: false, dailyMinutes: 15,
      pronunciationSort: "recommended", pronunciationDuration: null, pronunciationHideCompleted: false,
      readingFurigana: "adaptive", readingTranslation: "always", readingJpFont: "gothic", readingTextSize: "m",
      readingLineHeight: "comfortable", readingWidth: "normal", readingEmphasis: "soft",
      readingColorPreset: "warm_cream", playbackDefaultRate: 1, playbackLoopCount: 1, playbackAutoPause: false,
      showShortcutHints: false, resumeBehavior: "resume", studyAtmosphere: "none",
    });
  });
});
