import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEXICAL_KEY_CASES } from "./lexical-key-fixture";
import { normalizeRef } from "./refs";

// The SQL literal for a case: E'' escapes for control and space characters so the gate file stays readable.
function sqlLiteral(text: string): string {
  const escaped = [...text].map((ch) => {
    const code = ch.codePointAt(0)!;
    return code < 0x20 || code === 0x85 || code === 0x200b || /\s/.test(ch) ?`\\u${code.toString(16).padStart(4, "0")}` : ch;
  }).join("");
  return escaped === text ? `'${text}'` : `E'${escaped}'`;
}

describe("lexical key parity (port-dashboard S3)", () => {
  it("normalizeRef produces every fixture key", () => {
    expect(LEXICAL_KEY_CASES).toHaveLength(8);
    for (const c of LEXICAL_KEY_CASES) expect(normalizeRef(c.input), JSON.stringify(c.input)).toBe(c.key);
  });

  it("the live SQL gate checks every fixture case", () => {
    const gate = readFileSync("supabase/tests/port-dashboard.sql", "utf8");
    for (const c of LEXICAL_KEY_CASES) expect(gate).toContain(`(${sqlLiteral(c.input)}, ${sqlLiteral(c.key)})`);
  });
});
