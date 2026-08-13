import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Pins the placeholder routes themselves. The registry's T2/T11
// (lib/product/screen-registry.routes.test.ts) assert that entries claiming
// built/placeholder resolve and that every nav row leads somewhere, but they
// read the registry — this list is independent of it, so deleting a page AND
// its registry entry together still fails here.
//
// ⚠️ Hand-kept, and therefore exactly the kind of list L-023 warns about: it
// does not discover anything. Phase 1b added `companion` and `pronunciation`
// and the whole-branch review caught them missing from here.
const ROUTES = [
  "review", "challenges", "sensei", "roadmap", "weekly-report",
  "statistics", "achievements", "settings", "shadowing/explore",
  "companion", "pronunciation",
];

describe("upcoming routes", () => {
  it.each(ROUTES)("%s has a page", (route) => {
    const file = path.join(
      process.cwd(), "app", "[locale]", "(protected)", "(app)", route, "page.tsx",
    );
    expect(existsSync(file)).toBe(true);
  });
});
