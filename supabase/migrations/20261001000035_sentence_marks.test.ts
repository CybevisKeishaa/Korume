import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SENTENCE_MARK_KINDS } from "@/lib/preferences/options";

const directory = join(process.cwd(), "supabase/migrations");
const filename = "20261001000035_sentence_marks.sql";

function normalized(file: string): string {
  return readFileSync(join(directory, file), "utf8")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

describe("sentence marks SQL contract", () => {
  const sql = normalized(filename);

  it("keeps sentence_marks in exactly one migration", () => {
    const files = readdirSync(directory).filter((file) => file.endsWith(".sql") && normalized(file).includes("sentence_marks"));
    expect(files).toEqual([filename]);
  });

  it("owns a mark by user, line and kind, and cascades with both", () => {
    expect(sql).toContain("create table sentence_marks (");
    expect(sql).toContain("user_id uuid not null references users (id) on delete cascade");
    expect(sql).toContain("transcript_line_id uuid not null references transcript_lines (id) on delete cascade");
    expect(sql).toContain(`kind text not null check (kind in (${SENTENCE_MARK_KINDS.map((kind) => `'${kind}'`).join(", ")}))`);
    expect(sql).toContain("created_at timestamptz not null default now()");
    expect(sql).toContain("primary key (user_id, transcript_line_id, kind)");
  });

  it("lets a learner read, mark and unmark only their own rows, on lines they can read", () => {
    const policies = sql.match(/create policy sentence_marks_[a-z]+_own on sentence_marks/g) ?? [];
    expect(policies).toEqual([
      "create policy sentence_marks_select_own on sentence_marks",
      "create policy sentence_marks_insert_own on sentence_marks",
      "create policy sentence_marks_delete_own on sentence_marks",
    ]);
    expect(sql).toContain("alter table sentence_marks enable row level security");
    expect(sql).toContain("exists (select 1 from transcript_lines tl where tl.id = transcript_line_id)");
    expect(sql).toContain("revoke update on sentence_marks from authenticated");
  });
});
