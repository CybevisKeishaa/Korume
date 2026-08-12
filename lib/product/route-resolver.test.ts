import { describe, expect, it } from "vitest";
import { listPageRoutes, resolvePageRoute } from "./route-resolver";

const P = "app/[locale]";

describe("resolvePageRoute", () => {
  it.each([
    ["static, one segment", `${P}/(protected)/(app)/dashboard/page.tsx`, "/dashboard", "app"],
    ["static, nested", `${P}/(protected)/(app)/community/peer-review/page.tsx`, "/community/peer-review", "app"],
    ["one dynamic segment", `${P}/(protected)/(app)/kanji/[id]/page.tsx`, "/kanji/[id]", "app"],
    ["static AFTER dynamic", `${P}/(protected)/(focus)/shadowing/[id]/dictation/page.tsx`, "/shadowing/[id]/dictation", "focus"],
    ["two dynamic segments (no repo counterpart)", `${P}/(protected)/(app)/a/[x]/b/[y]/page.tsx`, "/a/[x]/b/[y]", "app"],
    ["immersive chrome", `${P}/(protected)/(immersive)/journal/page.tsx`, "/journal", "immersive"],
    ["admin chrome", `${P}/(admin)/admin/style-guide/page.tsx`, "/admin/style-guide", "admin"],
    ["auth chrome", `${P}/(auth)/login/page.tsx`, "/login", "auth"],
  ])("%s", (_name, file, route, chrome) => {
    expect(resolvePageRoute(file)).toEqual({ route, chrome });
  });

  it("collapses a root-level group to the index route, not to an empty string", () => {
    // The `(marketing)` case. "" is the bug this pins.
    expect(resolvePageRoute(`${P}/(marketing)/page.tsx`)).toEqual({
      route: "/",
      chrome: "marketing",
    });
  });

  it("collapses two nested groups to nothing", () => {
    expect(resolvePageRoute(`${P}/(protected)/(app)/review/page.tsx`).route).toBe("/review");
  });

  it("reports null chrome when no known chrome group is present", () => {
    expect(resolvePageRoute(`${P}/something/page.tsx`).chrome).toBeNull();
  });

  it("accepts Windows-style separators", () => {
    // Glob results on win32 arrive backslashed; the resolver must not care.
    expect(resolvePageRoute(`app\\[locale]\\(protected)\\(app)\\vocab\\page.tsx`).route).toBe("/vocab");
  });
});

describe("listPageRoutes", () => {
  it("finds real page.tsx files under app/[locale] — never silently empty", () => {
    // A resolver that walks nothing would make Task 4's "every page has a
    // registry entry" check pass vacuously, agreeing with an empty registry.
    // This asserts the walk actually found the real app tree, not that it
    // ran without throwing.
    const routes = listPageRoutes(process.cwd());
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.some((r) => r.route === "/dashboard")).toBe(true);
  });
});
