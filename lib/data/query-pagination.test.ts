import { describe, expect, it } from "vitest";
import { containsPattern, fetchAllPages, fetchByIdChunks } from "./query-pagination";

describe("containsPattern", () => {
  it("matches the query literally: LIKE wildcards and the escape character are escaped", () => {
    expect(containsPattern("ramen")).toBe("%ramen%");
    expect(containsPattern("100%")).toBe("%100\\%%");
    expect(containsPattern("a_b")).toBe("%a\\_b%");
    // The escape character itself is escaped first, so it cannot swallow what follows.
    expect(containsPattern("a\\%")).toBe("%a\\\\\\%%");
  });

  it("drops `*`, which PostgREST would rewrite to a wildcard and cannot be escaped", () => {
    expect(containsPattern("*")).toBe("%%");
    expect(containsPattern("go*od")).toBe("%good%");
  });
});

describe("PostgREST pagination helpers", () => {
  it("fetches all 2,500 rows across pages", async () => {
    const rows = await fetchAllPages((from, to) => Promise.resolve({
      data: Array.from({ length: Math.min(to + 1, 2_500) - from }, (_, index) => from + index),
      error: null,
    }));
    expect(rows).toHaveLength(2_500);
    expect(rows.at(-1)).toBe(2_499);
  });

  it("stops after the first short page and rethrows page errors", async () => {
    await expect(fetchAllPages((from) => Promise.resolve({
      data: from === 0 ? [1, 2] : [],
      error: null,
    }))).resolves.toEqual([1, 2]);
    await expect(fetchAllPages(() => Promise.resolve({ data: null, error: new Error("denied") }))).rejects.toThrow("denied");
  });

  it("splits 250 ids into three bounded requests", async () => {
    const calls: string[][] = [];
    await fetchByIdChunks(Array.from({ length: 250 }, (_, index) => `id-${index}`), async (ids) => {
      calls.push(ids);
      return ids;
    });
    expect(calls.map((ids) => ids.length)).toEqual([100, 100, 50]);
  });
});
