import { describe, expect, it } from "vitest";
import {
  DAILY_MINUTES_OPTIONS, DEFAULT_PREFERENCES, DIFFICULTY_OPTIONS, DISPLAY_SCALE_OPTIONS,
  LEARNING_SCHEDULE_OPTIONS, REVIEW_FREQUENCY_OPTIONS, canonicalScheduleDays,
} from "./options";

describe("preference options", () => {
  it("pins every option list the spec names", () => {
    expect(LEARNING_SCHEDULE_OPTIONS).toEqual(["every_day", "weekdays", "custom"]);
    expect(REVIEW_FREQUENCY_OPTIONS).toEqual(["normal", "more", "relaxed"]);
    expect(DIFFICULTY_OPTIONS).toEqual(["adaptive", "easy", "challenge"]);
    expect(DISPLAY_SCALE_OPTIONS).toEqual(["normal", "large", "extra_large"]);
    expect(DAILY_MINUTES_OPTIONS).toEqual([5, 10, 15, 20, 30, 45, 60]);
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
    });
  });
});
