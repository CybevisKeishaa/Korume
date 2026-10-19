import { describe, expect, it } from "vitest";
import { alignSequences } from "./align";

describe("alignSequences", () => {
  it("keeps indices for every op in reference order", () => {
    expect(alignSequences([..."abc"], [..."axcd"])).toEqual([
      { type: "match", refIndex: 0, hypIndex: 0 },
      { type: "wrong", refIndex: 1, hypIndex: 1 },
      { type: "match", refIndex: 2, hypIndex: 2 },
      { type: "extra", hypIndex: 3 },
    ]);
    expect(alignSequences([..."abc"], [..."ac"])).toEqual([
      { type: "match", refIndex: 0, hypIndex: 0 },
      { type: "missing", refIndex: 1 },
      { type: "match", refIndex: 2, hypIndex: 1 },
    ]);
  });

  it("handles empty sides", () => {
    expect(alignSequences([], [..."ab"])).toEqual([{ type: "extra", hypIndex: 0 }, { type: "extra", hypIndex: 1 }]);
    expect(alignSequences([..."a"], [])).toEqual([{ type: "missing", refIndex: 0 }]);
    expect(alignSequences([], [])).toEqual([]);
  });

  it("prefers matches, then substitutions, then deletions on ties", () => {
    expect(alignSequences([..."aa"], [..."a"])).toEqual([
      { type: "missing", refIndex: 0 },
      { type: "match", refIndex: 1, hypIndex: 0 },
    ]);
    expect(alignSequences([..."ab"], [..."ba"])).toEqual([
      { type: "wrong", refIndex: 0, hypIndex: 0 },
      { type: "wrong", refIndex: 1, hypIndex: 1 },
    ]);
    expect(alignSequences([..."aba"], [..."bab"])).toEqual([
      { type: "extra", hypIndex: 0 },
      { type: "match", refIndex: 0, hypIndex: 1 },
      { type: "match", refIndex: 1, hypIndex: 2 },
      { type: "missing", refIndex: 2 },
    ]);
  });
});
