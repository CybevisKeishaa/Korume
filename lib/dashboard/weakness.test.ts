import { describe, expect, it } from "vitest";
import { weaknessRows } from "./weakness";

describe("weaknessRows", () => {
  it("keeps only sufficiently evidenced family rows, preferring the weakest pronunciation metric", () => {
    expect(weaknessRows([
      { family: "pronunciation", metric: "accuracy", attempts: 3, score: 60 },
      { family: "pronunciation", metric: "pitch", attempts: 3, score: 60 },
      { family: "pronunciation", metric: "rhythm", attempts: 3, score: 70 },
      { family: "listening", metric: "accuracy", attempts: 2, score: 20 },
      { family: "reading", metric: "score", attempts: 3, score: 40 },
    ])).toEqual([{ family: "reading", metric: "score", score: 40 }, { family: "pronunciation", metric: "accuracy", score: 60 }]);
  });
  it("returns at most three in ascending score order and handles no evidence", () => {
    expect(weaknessRows([
      { family: "pronunciation", metric: "accuracy", attempts: 3, score: 60 },
      { family: "listening", metric: "accuracy", attempts: 3, score: 20 },
      { family: "reading", metric: "score", attempts: 3, score: 40 },
    ])).toEqual([
      { family: "listening", metric: "accuracy", score: 20 },
      { family: "reading", metric: "score", score: 40 },
      { family: "pronunciation", metric: "accuracy", score: 60 },
    ]);
    expect(weaknessRows([])).toEqual([]);
  });
});
