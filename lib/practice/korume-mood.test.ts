import { describe, expect, it } from "vitest";
import { korumeMood, type MoodEntry, type MoodOutcome } from "./korume-mood";

const e = (line: string, outcome: MoodOutcome, score: number | null = outcome === "perfect" ? 100 : 50): MoodEntry => ({ line, outcome, score });
const mood = (log: MoodEntry[], entry: MoodEntry, opts?: { close?: boolean; extraOnly?: boolean }) => korumeMood(log, entry, opts).mood;

describe("korumeMood", () => {
  it("a first-try perfect is ace; a perfect run across sentences climbs smug → hype → proud", () => {
    expect(mood([], e("a", "perfect"))).toBe("ace");
    expect(mood([e("a", "perfect")], e("b", "perfect"))).toBe("smug");
    expect(mood([e("a", "perfect"), e("b", "perfect")], e("c", "perfect"))).toBe("hype");
    const four = ["a", "b", "c", "d"].map((l) => e(l, "perfect"));
    const result = korumeMood(four, e("x", "perfect"));
    expect(result).toEqual({ mood: "proud", streak: 5, turn: 4 });
  });

  it("a miss anywhere breaks the run; a helped answer is not part of it", () => {
    expect(mood([e("a", "perfect"), e("b", "partial"), e("c", "perfect")], e("d", "perfect"))).toBe("smug");
    expect(mood([e("a", "perfect"), e("b", "helped")], e("c", "perfect"))).toBe("ace");
  });

  it("perfect after a miss on the same sentence is a comeback; helped is a giggle", () => {
    expect(mood([e("a", "partial")], e("a", "perfect"))).toBe("comeback");
    expect(mood([e("a", "revealed", null)], e("a", "perfect"))).toBe("comeback");
    expect(mood([e("b", "partial")], e("a", "perfect"))).toBe("ace");
    expect(mood([], e("a", "helped"))).toBe("giggle");
  });

  it("Show answer before any try on the sentence is furious, after one it is a peek", () => {
    expect(mood([e("b", "partial")], e("a", "revealed", null))).toBe("furious");
    expect(mood([e("a", "partial")], e("a", "revealed", null))).toBe("peek");
  });

  it("partial: zero is shock, close is close, extra-only is laugh, otherwise focus", () => {
    expect(mood([], e("a", "partial", 0))).toBe("shock");
    expect(mood([], e("a", "partial", 85), { close: true })).toBe("close");
    expect(mood([], e("a", "partial", 85), { extraOnly: true })).toBe("laugh");
    expect(mood([], e("a", "partial", 40))).toBe("focus");
  });

  it("partial against the same sentence's last score: better is improved, worse is sulk, worse after 2 misses is tantrum", () => {
    expect(mood([e("a", "partial", 40)], e("a", "partial", 60))).toBe("improved");
    expect(mood([e("a", "partial", 60)], e("a", "partial", 40))).toBe("sulk");
    expect(mood([e("a", "partial", 70), e("a", "partial", 60)], e("a", "partial", 40))).toBe("tantrum");
  });

  it("missing the same sentence again and again: dizzy at the third miss, cry at the fifth", () => {
    expect(mood([e("a", "partial", 50), e("a", "partial", 50)], e("a", "partial", 50))).toBe("dizzy");
    expect(mood([1, 2, 3, 4].map(() => e("a", "partial", 50)), e("a", "partial", 50))).toBe("cry");
  });

  it("precedence: shock beats cry, a drop beats the across-sentence slide, improved and dizzy beat laugh", () => {
    expect(mood([1, 2, 3, 4].map(() => e("a", "partial", 50)), e("a", "partial", 0))).toBe("shock");
    expect(mood([e("b", "partial", 90), e("a", "partial", 70), e("a", "partial", 60)], e("a", "partial", 50))).toBe("tantrum");
    expect(mood([e("a", "partial", 40)], e("a", "partial", 60), { extraOnly: true })).toBe("improved");
    expect(mood([e("a", "partial", 50), e("a", "partial", 50)], e("a", "partial", 50), { extraOnly: true })).toBe("dizzy");
  });

  it("weaker and weaker across sentences is sulk", () => {
    expect(mood([e("a", "partial", 90), e("b", "partial", 70)], e("c", "partial", 50))).toBe("sulk");
    expect(mood([e("a", "partial", 70), e("b", "partial", 90)], e("c", "partial", 50))).toBe("focus");
  });
});
