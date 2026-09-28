import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const directory = join(process.cwd(), "supabase/migrations");

function normalized(filename: string): string {
  return readFileSync(join(directory, filename), "utf8")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

describe("collections SQL contract", () => {
  const schema = normalized("20260731000019_collections.sql");
  const seed = normalized("20260807000026_collections_seed.sql");

  it("defines kind, goal-only skill focus and membership position in the table definitions", () => {
    expect(schema).toContain("kind text not null default 'shelf' check (kind in ('shelf', 'path', 'goal'))");
    expect(schema).toContain("skill_focus text check (skill_focus in ('accuracy', 'pitch', 'rhythm'))");
    expect(schema).toContain("check ((kind = 'goal') = (skill_focus is not null))");
    expect(schema).toContain("position int not null default 0, primary key (lesson_id, collection_id)");
  });

  it("seeds the frame's four paths and three goals with their skill focus", () => {
    for (const slug of ["everyday-conversation", "business-japanese", "it-engineer-communication", "travel-in-japan"]) {
      expect(seed).toMatch(new RegExp(`\('${slug}', [^)]*, 'path', null\)`));
    }
    expect(seed).toMatch(/\('improve-pitch-accent', [^)]*, 'goal', 'pitch'\)/);
    expect(seed).toMatch(/\('improve-fluency', [^)]*, 'goal', 'rhythm'\)/);
    expect(seed).toMatch(/\('native-rhythm-training', [^)]*, 'goal', 'rhythm'\)/);
  });

  it("is edited in place: no later migration alters either table (AGENTS.md §6)", () => {
    const altering = readdirSync(directory)
      .filter((file) => file.endsWith(".sql"))
      .filter((file) => /alter table (lesson_)?collections add\b/.test(normalized(file)));
    expect(altering).toEqual([]);
  });
});
