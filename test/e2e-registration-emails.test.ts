import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const E2E = join(process.cwd(), "tests/e2e");
/** A template literal that builds an email from the clock. */
const CLOCK_EMAIL = /`[^`]*\$\{Date\.now\(\)\}[^`]*@[^`]*`/;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

describe("e2e registration emails", () => {
  it("scans the real suite, not an empty directory", () => {
    expect(sources(E2E).length).toBeGreaterThanOrEqual(15);
  });

  it("never builds an email from Date.now(): parallel workers collide on the same millisecond", () => {
    const offenders = sources(E2E).filter((file) => CLOCK_EMAIL.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("detects the pattern it forbids (positive control)", () => {
    expect(CLOCK_EMAIL.test("const email = `e2e_journal_${Date.now()}@example.com`;")).toBe(true);
    expect(CLOCK_EMAIL.test('const email = uniqueEmail("e2e_journal");')).toBe(false);
  });

  it("keeps uniqueEmail on a random UUID", () => {
    expect(readFileSync(join(E2E, "fixtures/auth.ts"), "utf8")).toMatch(/return `\$\{prefix\}_\$\{randomUUID\(\)\}@example\.com`;/);
  });
});
