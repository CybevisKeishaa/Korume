import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec §8 (binding): the design system uses CSS logical properties so RTL is
 * not precluded. Physical inline-axis utilities lock the door on every
 * component they touch. Automated because "convention" decays (spec §2.9).
 *
 * Scope is components/ui/** only — the design system. Feature code migrates
 * when it moves onto the primitives (L9b), not here.
 *
 * Symmetric utilities (px-, mx-, inset-x-) are fine: they render identically
 * in RTL. Centering transforms (left-1/2 -translate-x-1/2) are genuinely
 * physical geometry and also fine — they are not in the forbidden list.
 */
const FORBIDDEN = [
  /\bp[lr]-/, // pl-4 / pr-2 → ps- / pe-
  /\bm[lr]-/, // ml-2 / mr-auto → ms- / me-
  /\btext-left\b/, // → text-start
  /\btext-right\b/, // → text-end
  /\bborder-[lr]\b/, // border-l → border-s
  /\bborder-[lr]-/, // border-l-2 → border-s-2
  /\brounded-[lr]\b/, // rounded-l → rounded-s
  /\brounded-[lr]-/, // rounded-l-md → rounded-s-md
];

const uiDir = path.join(process.cwd(), "components/ui");

/** Recursively collects .ts/.tsx source files under `dir`, excluding *.test.*,
 * and returns paths relative to `uiDir` (final review, Task 12, item 3c —
 * the previous scan was a flat readdirSync(uiDir) over .tsx only, so it
 * missed both subdirectories and .ts files). */
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

describe("design-system logical properties (spec §8)", () => {
  const sources = collectSources(uiDir);

  it("scans a non-empty set of primitives", () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it.each(sources)("%s uses no physical inline-axis utilities", (file) => {
    const text = readFileSync(path.join(uiDir, file), "utf8");
    const hits = FORBIDDEN.filter((pattern) => pattern.test(text));
    expect(hits).toEqual([]);
  });
});
