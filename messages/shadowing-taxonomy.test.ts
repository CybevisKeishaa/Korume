import { describe, expect, it } from "vitest";
import en from "./en/shadowing.json";
import vi from "./vi/shadowing.json";

const seededSituations = ["conversation", "restaurant", "business", "daily-life", "travel", "office", "shopping", "cafe"];
const seededSources = ["youtube", "nhk", "podcast", "drama", "anime", "vlog", "news"];

describe("Shadowing taxonomy translations", () => {
  it.each([
    ["en", en],
    ["vi", vi],
  ] as const)("pins every seeded situation and source label in %s", (_locale, catalog) => {
    expect(Object.keys(catalog.situations).sort()).toEqual([...seededSituations].sort());
    expect(Object.keys(catalog.sources).sort()).toEqual([...seededSources].sort());
  });
});
