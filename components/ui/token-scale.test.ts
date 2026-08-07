import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Rule #0 (spec §2): pixel values in Figma are not an API. A primitive that
 * hardcodes `text-[12px]` has copied a number instead of mapping a role, and
 * every screen that imitates the primitive inherits the mistake.
 *
 * Only ABSOLUTE literals are forbidden. Arbitrary values that express a
 * relationship are fine and deliberately allowed: CSS custom properties
 * (min-w-[--radix-select-trigger-width]), viewport units (h-[80vh]), calc(),
 * and percentages. The distinction is the whole point of the rule.
 *
 * Exceptions require an inline comment saying why no token can express the
 * value — see spec §7. Deleting this test is not an exception.
 */
const FORBIDDEN = [
  /\btext-\[[\d.]+(px|rem|em)\]/, // text-[12px] → text-caption
  /\b[pm][trblxy]?-\[[\d.]+(px|rem|em)\]/, // p-[10px] → p-sm
  /\bgap(-[xy])?-\[[\d.]+(px|rem|em)\]/, // gap-[6px] → gap-xs
  /\brounded(-[a-z]+)?-\[[\d.]+(px|rem|em)\]/, // rounded-[22px] → rounded-lg
  /\bleading-\[[\d.]+(px|rem|em)\]/, // leading-[18px] → a paired token
  /\bshadow-\[[^\]]*#/, // shadow-[0_0_12px_#FF8A3D] → shadow-raised
];

const uiDir = path.join(process.cwd(), "components/ui");

function collectSources(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSources(fullPath));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")) {
      files.push(path.relative(uiDir, fullPath));
    }
  }
  return files;
}

describe("Rule #0 — semantic tokens are the API (spec §2)", () => {
  const sources = collectSources(uiDir);

  it("scans a non-empty set of primitives", () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it.each(sources)("%s hardcodes no absolute px/rem literal", (file) => {
    const text = readFileSync(path.join(uiDir, file), "utf8");
    const hits = FORBIDDEN.filter((pattern) => pattern.test(text));
    expect(hits).toEqual([]);
  });

  // The three sites outside components/ui that already violated the rule
  // before it existed. Pinned individually so that fixing them cannot silently
  // regress, without widening the scan to all of components/** (spec §7).
  it.each([
    "components/layout/notification-bell.tsx",
    "components/learning/badges-grid.tsx",
  ])("%s uses no arbitrary font size", (file) => {
    const text = readFileSync(path.join(process.cwd(), file), "utf8");
    expect(/\btext-\[[\d.]+(px|rem|em)\]/.test(text)).toBe(false);
  });
});
