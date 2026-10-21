import { describe, expect, it } from "vitest";
import { bankOrder } from "./shuffle";

describe("bankOrder", () => {
  it("is stable and a permutation", () => {
    const a = bankOrder(5, "line-1");
    expect(bankOrder(5, "line-1")).toEqual(a);
    expect([...a].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("is never the identity for n > 1", () => {
    for (let i = 0; i < 200; i++) expect(bankOrder(2, `seed-${i}`)).toEqual([1, 0]);
  });

  it("handles n = 1 and n = 0", () => {
    expect(bankOrder(1, "x")).toEqual([0]);
    expect(bankOrder(0, "x")).toEqual([]);
  });
});
