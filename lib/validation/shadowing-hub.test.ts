import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import { isPronunciationResultMode, pronunciationDisplaySchema, shadowingHubQuerySchema, pronunciationResultLimit, RESULT_MAX_LIMIT, RESULT_PAGE_SIZE } from "./shadowing-hub";

describe("shadowingHubQuerySchema", () => {
  it("normalizes a bounded search query and a two-axis filter", () => {
    expect(shadowingHubQuerySchema.parse({ q: "  restaurant  ", filter: "source:anime" })).toEqual({
      q: "restaurant",
      filter: "source:anime",
    });
  });

  it("rejects unknown filter axes and overlong search strings", () => {
    expect(shadowingHubQuerySchema.safeParse({ filter: "level:n3" }).success).toBe(true);
    expect(shadowingHubQuerySchema.safeParse({ filter: "level:N3" }).success).toBe(false);
    expect(shadowingHubQuerySchema.safeParse({ filter: "level:n6" }).success).toBe(false);
    expect(shadowingHubQuerySchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
  });

  it("falls back to the default for each invalid display value, and reads any as no band", () => {
    expect(pronunciationDisplaySchema.parse({ sort: "nope", duration: "wrong", hideCompleted: "yes" })).toMatchObject({
      sort: "recommended", duration: null, hideCompleted: false,
    });
    // `any` is the explicit "no band" a URL uses to override a saved band.
    expect(pronunciationDisplaySchema.parse({ duration: "any" })).toMatchObject({ duration: null });
    expect(pronunciationDisplaySchema.parse({ sort: "shortest", duration: "10_30", hideCompleted: "true" })).toMatchObject({
      sort: "shortest", duration: "10_30", hideCompleted: true,
    });
  });
});

describe("isPronunciationResultMode", () => {
  const defaults = {
    sort: DEFAULT_PREFERENCES.pronunciationSort,
    duration: DEFAULT_PREFERENCES.pronunciationDuration,
    hideCompleted: DEFAULT_PREFERENCES.pronunciationHideCompleted,
  };

  it.each([
    [{ q: "lesson" }, defaults],
    [{ q: "  lesson  " }, defaults],
    [{ filter: "situation:restaurant" }, defaults],
    [{}, { ...defaults, sort: "shortest" as const }],
    [{}, { ...defaults, duration: "under_10" as const }],
    [{}, { ...defaults, hideCompleted: true }],
  ])("enters result mode for each catalogue-affecting trigger", (query, display) => {
    expect(isPronunciationResultMode(query, display)).toBe(true);
  });

  it("keeps the curated surface only when every discovery setting is default", () => {
    expect(isPronunciationResultMode({}, defaults)).toBe(false);
  });
});

describe("pronunciationResultLimit", () => {
  it("starts at one page and grows by whole pages", () => {
    expect(pronunciationResultLimit(undefined)).toBe(RESULT_PAGE_SIZE);
    expect(pronunciationResultLimit("48")).toBe(48);
    // A hand-edited value rounds up to a whole page.
    expect(pronunciationResultLimit("30")).toBe(48);
  });

  it("falls back to one page for anything that is not a positive count", () => {
    for (const raw of ["", "0", "-24", "abc", "24.5", "1e3"]) expect(pronunciationResultLimit(raw)).toBe(RESULT_PAGE_SIZE);
  });

  it("stops where one PostgREST request can still say whether more exist", () => {
    expect(RESULT_MAX_LIMIT % RESULT_PAGE_SIZE).toBe(0);
    expect(RESULT_MAX_LIMIT + 1).toBeLessThanOrEqual(1_000);
    expect(pronunciationResultLimit("100000")).toBe(RESULT_MAX_LIMIT);
  });
});
