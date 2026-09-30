import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const directory = join(process.cwd(), "supabase/migrations");
const filename = "20260929000034_user_saved_collections.sql";

function normalized(file: string): string {
  return readFileSync(join(directory, file), "utf8")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

describe("saved learning paths SQL contract", () => {
  const sql = normalized(filename);

  it("keeps user_saved_collections in exactly one migration", () => {
    const files = readdirSync(directory).filter((file) => file.endsWith(".sql") && normalized(file).includes("user_saved_collections"));
    expect(files).toEqual([filename]);
  });

  it("owns each row by user and path, and goes with the account", () => {
    expect(sql).toContain("user_id uuid not null references users (id) on delete cascade");
    expect(sql).toContain("collection_id uuid not null references collections (id) on delete cascade");
    expect(sql).toContain("primary key (user_id, collection_id)");
  });

  it("lets a learner read, save and unsave only their own rows, and save only a path", () => {
    const policies = sql.match(/create policy user_saved_collections_[a-z]+_own on user_saved_collections/g) ?? [];
    expect(policies).toEqual([
      "create policy user_saved_collections_select_own on user_saved_collections",
      "create policy user_saved_collections_insert_own on user_saved_collections",
      "create policy user_saved_collections_delete_own on user_saved_collections",
    ]);
    expect(sql).toContain("alter table user_saved_collections enable row level security");
    expect(sql).toContain("exists (select 1 from collections c where c.id = collection_id and c.kind = 'path')");
    expect(sql).toContain("revoke update on user_saved_collections from authenticated");
  });
});
