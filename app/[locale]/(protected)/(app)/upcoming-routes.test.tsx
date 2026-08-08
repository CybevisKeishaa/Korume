import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Task 7's nav test asserts every href resolves to a route. That test cannot
// distinguish "route missing" from "nav wrong", so this one pins the routes
// themselves.
const ROUTES = [
  "review", "challenges", "sensei", "roadmap", "weekly-report",
  "statistics", "achievements", "settings", "shadowing/explore",
];

describe("upcoming routes", () => {
  it.each(ROUTES)("%s has a page", (route) => {
    const file = path.join(
      process.cwd(), "app", "[locale]", "(protected)", "(app)", route, "page.tsx",
    );
    expect(existsSync(file)).toBe(true);
  });
});
