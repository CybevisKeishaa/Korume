import { describe, expect, it } from "vitest";
import { insertPiece, movePiece, removePiece, withHints } from "./word-bank-answer";

describe("word-bank answer model", () => {
  it("insert at 0 lands after the hinted prefix", () => {
    expect(insertPiece([0, 1], 5, 0, 2)).toEqual([0, 1, 5]);
  });
  it("insert clamps past the end", () => {
    expect(insertPiece([0, 1, 4], 5, 99, 2)).toEqual([0, 1, 4, 5]);
  });
  it("inserting a placed piece moves it", () => {
    expect(insertPiece([0, 1, 4, 5, 6], 6, 2, 2)).toEqual([0, 1, 6, 4, 5]);
    expect(insertPiece([0, 1, 4, 5, 6], 4, 5, 2)).toEqual([0, 1, 5, 6, 4]);
  });
  it("remove of a prefix piece is a no-op; a free piece leaves", () => {
    expect(removePiece([0, 1, 4], 1, 2)).toEqual([0, 1, 4]);
    expect(removePiece([0, 1, 4], 4, 2)).toEqual([0, 1]);
  });
  it("movePiece swaps inside the free part and is a no-op at both edges", () => {
    expect(movePiece([0, 1, 4, 5], 5, -1, 2)).toEqual([0, 1, 5, 4]);
    expect(movePiece([0, 1, 4, 5], 4, -1, 2)).toEqual([0, 1, 4, 5]);
    expect(movePiece([0, 1, 4, 5], 5, 1, 2)).toEqual([0, 1, 4, 5]);
    expect(movePiece([0, 1, 4, 5], 1, 1, 2)).toEqual([0, 1, 4, 5]);
  });
  it("withHints puts the hinted pieces first", () => {
    expect(withHints([5, 0, 3], [0, 1])).toEqual([0, 1, 5, 3]);
  });

  it("property: no duplicate, prefix stays 0..k-1", () => {
    let seed = 12345;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
    for (let run = 0; run < 200; run++) {
      const n = 1 + rnd(20);
      const k = rnd(Math.min(n, 5) + 1);
      let a = withHints([], Array.from({ length: k }, (_, i) => i));
      for (let step = 0; step < 60; step++) {
        const p = rnd(n);
        const op = rnd(4);
        if (op === 0) a = insertPiece(a, p, rnd(n + 2) - 1, k);
        else if (op === 1) a = removePiece(a, p, k);
        else if (op === 2) a = movePiece(a, p, rnd(2) ? 1 : -1, k);
        else a = withHints(a, Array.from({ length: k }, (_, i) => i));
        expect(new Set(a).size).toBe(a.length);
        expect(a.slice(0, k)).toEqual(Array.from({ length: k }, (_, i) => i));
      }
    }
  });
});
