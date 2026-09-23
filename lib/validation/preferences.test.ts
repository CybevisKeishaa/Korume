import { describe, expect, it } from "vitest";
import { preferencesPatchSchema } from "./preferences";

const parse = (body: unknown) => preferencesPatchSchema.safeParse(body);

describe("preferencesPatchSchema — one logical control per PATCH (spec §3)", () => {
  it("accepts each single control", () => {
    for (const body of [
      { dailyMinutes: 20 },
      { learningSchedule: "weekdays" },
      { learningSchedule: "custom", scheduleDays: [3, 1] },
      { reviewFrequency: "relaxed" },
      { difficulty: "challenge" },
      { displayScale: "extra_large" },
      { reduceMotion: true },
      { microphoneEnabled: false },
      { cameraEnabled: true },
    ]) expect(parse(body).success, JSON.stringify(body)).toBe(true);
  });

  it("canonicalises schedule days", () => {
    expect(parse({ learningSchedule: "every_day" })).toMatchObject({
      success: true, data: { learningSchedule: "every_day", scheduleDays: [1, 2, 3, 4, 5, 6, 7] },
    });
    expect(parse({ learningSchedule: "custom", scheduleDays: [5, 1, 5] })).toMatchObject({
      success: true, data: { scheduleDays: [1, 5] },
    });
  });

  it("rejects custom with no days, a day out of range, or days sent for a fixed schedule", () => {
    expect(parse({ learningSchedule: "custom", scheduleDays: [] }).success).toBe(false);
    expect(parse({ learningSchedule: "custom", scheduleDays: [8] }).success).toBe(false);
    expect(parse({ learningSchedule: "custom" }).success).toBe(false);
    expect(parse({ learningSchedule: "weekdays", scheduleDays: [1] }).success).toBe(false);
  });

  it("rejects dailyMinutes mixed with any preferences field", () => {
    expect(parse({ dailyMinutes: 20, reduceMotion: true }).success).toBe(false);
  });

  it("rejects two controls, an empty body, unknown keys and off-list values", () => {
    expect(parse({ difficulty: "easy", displayScale: "large" }).success).toBe(false);
    expect(parse({}).success).toBe(false);
    expect(parse({ theme: "light" }).success).toBe(false);
    expect(parse({ dailyMinutes: 25 }).success).toBe(false);
  });
});
