import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/**
 * Reads the migrations rather than the database, so the guard runs in CI
 * with no Docker. It proves the two halves agree: every slug the migrations
 * will generate has a file on disk.
 *
 * Discovers seed files dynamically rather than hardcoding a list — `badges`
 * is seeded in two migrations today (confirmed via
 * `grep -rln "insert into badges" supabase/migrations/`), but a hardcoded
 * list would silently stop covering a third one added later: the guard
 * would keep finding 11 names, keep passing, and a twelfth badge would ship
 * with `icon_url = NULL` undetected. Scanning every migration file for the
 * phrase closes that gap regardless of how many files it ends up in.
 */
function discoverBadgeSeedFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .filter((file) => /insert into badges/i.test(readFileSync(join(dir, file), "utf8")));
}

describe("badge icons", () => {
  it("has an SVG on disk for every badge name the seed migrations insert", () => {
    const seedFiles = discoverBadgeSeedFiles(MIGRATIONS_DIR);

    // A wrong directory or a renamed migrations convention must not
    // silently produce an empty scan — that would make every assertion
    // below vacuously true.
    expect(seedFiles.length).toBeGreaterThan(0);

    const names: string[] = seedFiles.flatMap((file) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
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
    // Deliberately NOT derived from `seedFiles` or from this same scan: a
    // pin that comes from the thing it's checking asserts nothing. Pinning
    // the real, measured number means a future migration adding a twelfth
    // badge fails this test loudly until its icon is authored.
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
