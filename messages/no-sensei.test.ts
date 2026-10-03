import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * One persona (Ask Korume spec 2026-10-03 §0, §6.5): no user-visible string names "Sensei". Key names and code
 * identifiers may keep the word; values never. Walks every catalog file, so a new namespace is covered by default.
 */
function leaves(value: unknown, path: string[], out: [string, string][]): [string, string][] {
  if (typeof value === "string") out.push([path.join("."), value]);
  else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) leaves(child, [...path, key], out);
  return out;
}

describe("no Sensei in any catalog value", () => {
  for (const locale of ["en", "vi"]) {
    it(`messages/${locale}`, () => {
      const dir = join(__dirname, locale);
      const files = readdirSync(dir).filter((name) => name.endsWith(".json"));
      expect(files.length).toBeGreaterThan(10); // non-vacuous: the walk really reached the catalogs
      const hits = files.flatMap((file) => leaves(JSON.parse(readFileSync(join(dir, file), "utf8")), [file], []))
        .filter(([, value]) => /sensei/i.test(value)).map(([key]) => key);
      expect(hits).toEqual([]);
    });
  }
});
