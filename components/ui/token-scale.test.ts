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

// Scanned directories. `components/marketing` was added for the landing-page
// port (spec §2 of the screen-port workflow design): it is the largest body
// of new presentational code in the repo and must be held to the same rule
// as components/ui.
const SCANNED_DIRS = ["components/ui", "components/marketing"];

function collectSources(dir: string, root: string = dir): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSources(fullPath, root));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")) {
      files.push(path.relative(root, fullPath));
    }
  }
  return files;
}

describe("Rule #0 — semantic tokens are the API (spec §2)", () => {
  for (const scannedDir of SCANNED_DIRS) {
    const dir = path.join(process.cwd(), scannedDir);
    const sources = collectSources(dir);

    it(`scans a non-empty set of primitives in ${scannedDir}`, () => {
      expect(sources.length).toBeGreaterThan(0);
    });

    it.each(sources)(`${scannedDir}/%s hardcodes no absolute px/rem literal`, (file) => {
      const text = readFileSync(path.join(dir, file), "utf8");
      const hits = FORBIDDEN.filter((pattern) => pattern.test(text));
      expect(hits).toEqual([]);
    });
  }

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
