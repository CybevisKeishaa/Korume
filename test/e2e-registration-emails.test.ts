import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uniqueEmail } from "../tests/e2e/fixtures/auth";

const E2E = join(process.cwd(), "tests/e2e");
/** A call, not a mention: the fixture's doc comment explains the bug in prose. */
const CLOCK_CALL = /Date\.now\(\)/;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

/** Source without comments, so prose about the old bug does not trip the guard. */
function code(file: string): string {
  return readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("e2e registration emails", () => {
  it("scans the real suite, not an empty directory", () => {
    expect(sources(E2E).length).toBeGreaterThanOrEqual(15);
  });

  it("never reads the clock in an e2e source: parallel workers collided on the same millisecond", () => {
    // Stricter than matching an email template: `const t = Date.now()` then `${t}@…` would slip past that.
    const offenders = sources(E2E).filter((file) => CLOCK_CALL.test(code(file)));
    expect(offenders).toEqual([]);
  });

  it("detects the pattern it forbids (positive control)", () => {
    expect(CLOCK_CALL.test("const email = `e2e_journal_${Date.now()}@example.com`;")).toBe(true);
    expect(CLOCK_CALL.test('const email = uniqueEmail("e2e_journal");')).toBe(false);
  });

  it("gives a different, well-formed address on every call", () => {
    const first = uniqueEmail("p");
    const second = uniqueEmail("p");
    expect(first).not.toBe(second);
    expect(first).toMatch(/^p_[0-9a-f-]{36}@example\.com$/);
  });
});
