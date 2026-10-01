import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import { shadowingHubQuerySchema } from "@/lib/validation/shadowing-hub";
import { normalizeSearchQuery, parseSearchType, pronunciationSurface, searchHref } from "./pronunciation-search";

const defaults = {
  sort: DEFAULT_PREFERENCES.pronunciationSort,
  duration: DEFAULT_PREFERENCES.pronunciationDuration,
  hideCompleted: DEFAULT_PREFERENCES.pronunciationHideCompleted,
};

describe("normalizeSearchQuery", () => {
  it("trims, and treats nothing but spaces as no query", () => {
    expect(normalizeSearchQuery("  ramen ")).toBe("ramen");
    for (const raw of [undefined, "", "   "]) expect(normalizeSearchQuery(raw)).toBeNull();
  });

  it("cuts a term to the Hub schema's bound, so the schema never rejects it", () => {
    const query = normalizeSearchQuery(`${"a".repeat(99)} ${"b".repeat(20)}`);
    expect(query).toBe("a".repeat(99));
    expect(shadowingHubQuerySchema.safeParse({ q: normalizeSearchQuery("x".repeat(250)) }).success).toBe(true);
  });

  it("keeps LIKE metacharacters verbatim for the data layer to escape", () => {
    expect(normalizeSearchQuery("%_\\*")).toBe("%_\\*");
  });
});

describe("parseSearchType", () => {
  it("accepts the four concrete tabs", () => {
    for (const type of ["lessons", "paths", "goals", "library"]) expect(parseSearchType(type)).toEqual({ type, canonical: true });
  });

  it("reads absence as All, canonically", () => {
    expect(parseSearchType(undefined)).toEqual({ type: null, canonical: true });
  });

  it("reads all, unknown and cased values as All, and asks for the canonical URL", () => {
    for (const raw of ["all", "xyz", "Lessons", ""]) expect(parseSearchType(raw)).toEqual({ type: null, canonical: false });
  });
});

describe("pronunciationSurface", () => {
  it("is Default with no query and default settings", () => {
    expect(pronunciationSurface({ q: null, display: defaults, type: null })).toEqual({ state: "default" });
  });

  it("is Browse with no query and a non-default lesson setting", () => {
    expect(pronunciationSurface({ q: null, display: { ...defaults, sort: "shortest" }, type: null })).toEqual({ state: "browse" });
  });

  it("is Browse with a filter and no query", () => {
    expect(pronunciationSurface({ q: null, filter: "level:n5", display: defaults, type: null })).toEqual({ state: "browse" });
  });

  it("ignores a concrete type when there is no query", () => {
    expect(pronunciationSurface({ q: null, display: { ...defaults, sort: "shortest" }, type: "paths" })).toEqual({ state: "browse" });
  });

  it("is Search whenever a query is present", () => {
    expect(pronunciationSurface({ q: "ramen", display: defaults, type: "goals" })).toEqual({ state: "search", q: "ramen", type: "goals" });
  });
});

describe("searchHref", () => {
  const lesson = { sort: "shortest", filter: "level:n5" };

  it("omits type for All and keeps the lesson settings", () => {
    const url = new URL(searchHref({ q: "ramen", type: null, lesson }), "http://x");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "ramen", sort: "shortest", filter: "level:n5" });
  });

  it("carries shown only on a concrete tab, including zero", () => {
    expect(new URL(searchHref({ q: "ramen", type: "paths", lesson: {}, shown: 48 }), "http://x").searchParams.get("shown")).toBe("48");
    expect(new URL(searchHref({ q: "ramen", type: "paths", lesson: {}, shown: 0 }), "http://x").searchParams.get("shown")).toBe("0");
    expect(new URL(searchHref({ q: "ramen", type: null, lesson: {}, shown: 48 }), "http://x").searchParams.has("shown")).toBe(false);
  });

  it("does not let a non-concrete parsed type reach the href", () => {
    const { type } = parseSearchType("all");
    expect(searchHref({ q: "ramen", type, lesson: {}, shown: 48 })).toBe("/pronunciation?q=ramen");
  });

  it("drops empty lesson values", () => {
    expect(searchHref({ q: "a b", type: "lessons", lesson: { sort: "", duration: undefined } })).toBe("/pronunciation?q=a+b&type=lessons");
  });
});
