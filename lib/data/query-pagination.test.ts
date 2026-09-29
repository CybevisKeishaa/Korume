import { describe, expect, it } from "vitest";
import { containsPattern } from "./query-pagination";

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
