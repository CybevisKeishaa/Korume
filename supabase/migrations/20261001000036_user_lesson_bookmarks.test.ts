import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const directory = join(process.cwd(), "supabase/migrations");
const filename = "20261001000036_user_lesson_bookmarks.sql";

function normalized(file: string): string {
  return readFileSync(join(directory, file), "utf8")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

describe("lesson bookmarks SQL contract", () => {
  const sql = normalized(filename);

  it("keeps user_lesson_bookmarks in exactly one migration", () => {
    const files = readdirSync(directory).filter((file) => file.endsWith(".sql") && normalized(file).includes("user_lesson_bookmarks"));
    expect(files).toEqual([filename]);
  });

  it("owns a bookmark by user and video, and cascades with both", () => {
    expect(sql).toContain("create table user_lesson_bookmarks (");
    expect(sql).toContain("user_id uuid not null references users (id) on delete cascade");
    expect(sql).toContain("video_id uuid not null references videos (id) on delete cascade");
    expect(sql).toContain("created_at timestamptz not null default now()");
    expect(sql).toContain("primary key (user_id, video_id)");
  });

  it("lets a learner read, bookmark and unbookmark only their own visible lessons", () => {
    const policies = sql.match(/create policy user_lesson_bookmarks_[a-z]+_own on user_lesson_bookmarks/g) ?? [];
    expect(policies).toEqual([
      "create policy user_lesson_bookmarks_select_own on user_lesson_bookmarks",
      "create policy user_lesson_bookmarks_insert_own on user_lesson_bookmarks",
      "create policy user_lesson_bookmarks_delete_own on user_lesson_bookmarks",
    ]);
    expect(sql).toContain("alter table user_lesson_bookmarks enable row level security");
    expect(sql).toContain("exists (select 1 from videos v where v.id = video_id)");
    expect(sql).toContain("revoke update on user_lesson_bookmarks from authenticated");
  });
});
