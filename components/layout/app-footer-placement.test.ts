import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Spec F1, verbatim. Static half of T2 (plan P3); the runtime "exactly one" half is tests/e2e/app-footer.spec.ts. */
const APP = "app/[locale]/(protected)/(app)";
const WITH_FOOTER = new Set([
  "shadowing", "shadowing/explore",
  "pronunciation", "pronunciation/collections/[slug]", "pronunciation/paths",
  "kanji", "grammar", "conversation", "certification",
  "playlists", "playlists/[id]", "mining", "profile",
].map((route) => `${APP}/${route}/page.tsx`));

const posix = (p: string) => p.split(path.sep).join("/");
const pages = readdirSync("app", { recursive: true, encoding: "utf8" })
  .map((rel) => posix(path.join("app", rel)))
  .filter((file) => file.endsWith("/page.tsx"));

describe("AppFooter placement (spec F1/F2, T2 static)", () => {
  it("lists 13 routes and every one exists", () => {
    expect(WITH_FOOTER.size).toBe(13);
    for (const file of WITH_FOOTER) expect(pages, file).toContain(file);
  });

  it("is rendered by exactly the listed pages", () => {
    for (const file of pages) {
      const renders = /<AppFooter\b/.test(readFileSync(file, "utf8"));
      expect(renders, file).toBe(WITH_FOOTER.has(file));
    }
  });

  it("is never rendered by a layout", () => {
    const layouts = readdirSync("app", { recursive: true, encoding: "utf8" })
      .map((rel) => posix(path.join("app", rel)))
      .filter((file) => file.endsWith("/layout.tsx"));
    expect(layouts.length).toBeGreaterThan(0);
    for (const file of layouts) expect(/AppFooter/.test(readFileSync(file, "utf8")), file).toBe(false);
  });
});
