import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Reads the migrations rather than the database, so the guard runs in CI
 * with no Docker. It proves the two halves agree: every slug the migrations
 * will generate has a file on disk.
 *
 * `badges` is seeded in TWO migrations (confirmed via
 * `grep -rln "insert into badges" supabase/migrations/`), not one — a guard
 * that reads only the first would cover 3 of 11 rows and pass with 8 badges
 * iconless. Read both.
 */
const SEED_FILES = [
  "supabase/migrations/20260712000005_content_n5_n4.sql",
  "supabase/migrations/20260713000013_gamification.sql",
];

describe("badge icons", () => {
  it("has an SVG on disk for every badge name the seed migrations insert", () => {
    const names: string[] = SEED_FILES.flatMap((file) => {
      const sql = readFileSync(join(process.cwd(), file), "utf8");
      const inserts = [...sql.matchAll(/insert into badges[\s\S]*?values([\s\S]*?);/gi)];
      return inserts.flatMap((insertMatch) => {
        const tuples = insertMatch[1];
        if (!tuples) return [];
        return [...tuples.matchAll(/\('([^']+)'/g)]
          .map((tupleMatch) => tupleMatch[1])
          .filter((name): name is string => Boolean(name));
      });
    });

    // An empty or partial match would make every assertion below vacuously
    // (or misleadingly) true — pin the exact count found, per CLAUDE.md §7.
    expect(names.length).toBeGreaterThan(0);
    expect(names.length).toBe(11);

    for (const name of names) {
      // Badge names are snake_case with no spaces (e.g. "first_steps"), so
      // this replace is a deliberate no-op that keeps underscores intact —
      // it must match the migration's `lower(replace(name, ' ', '-'))`
      // exactly, which is also a no-op on these names.
      const slug = name.toLowerCase().replace(/ /g, "-");
      expect(existsSync(join(process.cwd(), "public", "badges", `${slug}.svg`))).toBe(true);
    }
  });
});
