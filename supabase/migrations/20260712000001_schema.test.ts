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

describe("user_video_progress recency SQL contract", () => {
  const schema = normalized("20260712000001_schema.sql");

  it("keeps last_watched_at nullable, so no row is given a fabricated time", () => {
    expect(schema).toContain("completed_at timestamptz, last_watched_at timestamptz, primary key (user_id, video_id)");
  });

  it("stamps the time only on insert or when the position or completion actually changes", () => {
    expect(schema).toContain("create or replace function set_user_video_progress_last_watched_at()");
    expect(schema).toContain("new.last_watched_position is distinct from old.last_watched_position");
    expect(schema).toContain("new.completed_at is distinct from old.completed_at");
    expect(schema).toContain(
      "before insert or update on user_video_progress for each row execute function set_user_video_progress_last_watched_at()",
    );
  });

  it("stores an optional bounded channel title in the videos definition", () => {
    expect(schema).toContain("thumbnail_url text, channel_title text check (char_length(channel_title) <= 200),");
    const altering = readdirSync(directory)
      .filter((file) => file.endsWith(".sql") && file !== "20260712000001_schema.sql")
      // One statement only (`[^;]`): the learner_videos view in a later file SELECTS v.channel_title, which is not adding it.
      .filter((file) => /alter table videos add\b[^;]*channel_title/.test(normalized(file)));
    expect(altering).toEqual([]);
  });

  it("is edited in place: no later migration alters user_video_progress (AGENTS.md §6)", () => {
    const altering = readdirSync(directory)
      .filter((file) => file.endsWith(".sql"))
      .filter((file) => /alter table user_video_progress add\b/.test(normalized(file)));
    expect(altering).toEqual([]);
  });
});
