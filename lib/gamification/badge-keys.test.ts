import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en/common.json";
import vi from "@/messages/vi/common.json";
import { BADGE_KEYS, humanizeBadgeKey, isBadgeKey } from "./badge-keys";

const migrations = join(process.cwd(), "supabase", "migrations");

/** Every badge name a migration inserts: `insert into badges (name, ...) values ('key', ...), ...`. */
function seededBadgeKeys(): string[] {
  const keys = new Set<string>();
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(join(migrations, file), "utf8");
    for (const insert of sql.matchAll(/insert into badges\s*\(\s*name\b[\s\S]*?;/gi)) {
      for (const row of insert[0].matchAll(/\(\s*'([a-z0-9_]+)'/g)) keys.add(row[1]!);
    }
  }
  return [...keys].sort();
}

describe("badge keys", () => {
  it("covers exactly the badges the migrations seed", () => {
    const seeded = seededBadgeKeys();
    expect(seeded.length).toBeGreaterThan(0);
    expect([...BADGE_KEYS].sort()).toEqual(seeded);
  });

  it("has a name and a description in both locales for every key", () => {
    for (const catalog of [en.badges, vi.badges]) {
      expect(Object.keys(catalog).sort()).toEqual([...BADGE_KEYS].sort());
      for (const key of BADGE_KEYS) {
        expect(catalog[key].name.trim()).not.toBe("");
        expect(catalog[key].description.trim()).not.toBe("");
      }
    }
  });

  it("humanizes an unknown key instead of showing snake_case", () => {
    expect(isBadgeKey("week_streak")).toBe(true);
    expect(isBadgeKey("future_badge")).toBe(false);
    expect(humanizeBadgeKey("future_badge")).toBe("Future badge");
  });
});
