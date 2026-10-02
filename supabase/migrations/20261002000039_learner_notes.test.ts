import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LESSON_NOTE_MAX, SENTENCE_NOTE_MAX } from "@/lib/validation/notes";

const directory = join(process.cwd(), "supabase/migrations");
const filename = "20261002000039_learner_notes.sql";

function normalized(file: string): string {
  return readFileSync(join(directory, file), "utf8")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .replace(/\( /g, "(")
    .replace(/ \)/g, ")")
    .toLowerCase();
}

describe("learner notes SQL contract", () => {
  const sql = normalized(filename);

  it("keeps both note tables in exactly one migration", () => {
    for (const table of ["sentence_notes", "lesson_notes"]) {
      const files = readdirSync(directory).filter((file) => file.endsWith(".sql") && normalized(file).includes(table));
      expect(files, table).toEqual([filename]);
    }
  });

  it("keys a sentence note by user and line, bounds its body and cascades with both", () => {
    expect(sql).toContain("create table sentence_notes (");
    expect(sql).toContain("user_id uuid not null references users (id) on delete cascade, transcript_line_id uuid not null references transcript_lines (id) on delete cascade");
    expect(sql).toContain(`body text not null check (char_length(body) between 1 and ${SENTENCE_NOTE_MAX})`);
    expect(sql).toContain("primary key (user_id, transcript_line_id)");
  });

  it("keys a lesson note by user and video, bounds its body and cascades with both", () => {
    expect(sql).toContain("create table lesson_notes (");
    expect(sql).toContain("user_id uuid not null references users (id) on delete cascade, video_id uuid not null references videos (id) on delete cascade");
    expect(sql).toContain(`body text not null check (char_length(body) between 1 and ${LESSON_NOTE_MAX})`);
    expect(sql).toContain("primary key (user_id, video_id)");
  });

  it("stamps updated_at in the database on every upsert", () => {
    expect(sql.match(/updated_at timestamptz not null default now\(\)/g)).toHaveLength(2);
    expect(sql).toContain("create trigger sentence_notes_set_updated_at before update on sentence_notes for each row execute function set_updated_at()");
    expect(sql).toContain("create trigger lesson_notes_set_updated_at before update on lesson_notes for each row execute function set_updated_at()");
  });

  it.each([
    ["sentence_notes", "exists (select 1 from transcript_lines tl where tl.id = transcript_line_id)"],
    ["lesson_notes", "exists (select 1 from videos v where v.id = video_id)"],
  ])("lets a learner touch only their own %s, on rows they can read", (table, readable) => {
    expect(sql).toContain(`alter table ${table} enable row level security`);
    const policies = sql.match(new RegExp(`create policy ${table}_[a-z]+_own on ${table}`, "g")) ?? [];
    expect(policies).toEqual(["select", "insert", "update", "delete"].map((op) => `create policy ${table}_${op}_own on ${table}`));
    const guarded = `(user_id = auth.uid() and ${readable})`;
    expect(sql).toContain(`create policy ${table}_insert_own on ${table} for insert to authenticated with check ${guarded}`);
    expect(sql).toContain(`create policy ${table}_update_own on ${table} for update to authenticated using (user_id = auth.uid()) with check ${guarded}`);
    expect(sql).toContain(`grant select, insert, update, delete on ${table} to authenticated`);
    expect(sql).toContain(`revoke all on ${table} from anon`);
  });
});
