import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const directory = join(process.cwd(), "supabase/migrations");
const filename = "20260925000034_collection_ordering.sql";

function normalizedMigration(filenameToRead: string): string {
  return readFileSync(join(directory, filenameToRead), "utf8")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

describe("collection ordering SQL contract", () => {
  it("adds the position column with the safe unordered default", () => {
    expect(normalizedMigration(filename)).toContain(
      "alter table lesson_collections add column position int not null default 0",
    );
  });

  it("adds the lesson_collections position column in exactly one migration", () => {
    const migrations = readdirSync(directory)
      .filter((file) => file.endsWith(".sql"))
      .filter((file) => /alter table lesson_collections add column position\b/.test(normalizedMigration(file)));
    expect(migrations).toEqual([filename]);
  });
});
