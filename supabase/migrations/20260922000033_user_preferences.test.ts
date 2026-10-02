import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DIFFICULTY_OPTIONS,
  DISPLAY_SCALE_OPTIONS,
  LEARNING_SCHEDULE_OPTIONS,
  PLAYBACK_LOOP_COUNT_OPTIONS,
  PLAYBACK_RATE_OPTIONS,
  READING_COLOR_PRESET_OPTIONS,
  READING_EMPHASIS_OPTIONS,
  READING_FURIGANA_OPTIONS,
  READING_JP_FONT_OPTIONS,
  READING_LINE_HEIGHT_OPTIONS,
  READING_TEXT_SIZE_OPTIONS,
  READING_TRANSLATION_OPTIONS,
  READING_WIDTH_OPTIONS,
  REVIEW_FREQUENCY_OPTIONS,
  RESUME_BEHAVIOR_OPTIONS,
  STUDY_ATMOSPHERE_OPTIONS,
} from "../../lib/preferences/options";

const directory = join(process.cwd(), "supabase/migrations");
const filename = "20260922000033_user_preferences.sql";

function migration(): string {
  const files = readdirSync(directory).filter((file) => file === filename);
  expect(files).toHaveLength(1);
  const file = files[0];
  if (!file) throw new Error("user preferences migration is missing");
  return readFileSync(join(directory, file), "utf8")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function subsystemMigrations(): string[] {
  return readdirSync(directory).filter(
    (file) => file.endsWith(".sql") && readFileSync(join(directory, file), "utf8").includes("user_preferences"),
  );
}

const quoted = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(", ");
const literals = (values: readonly (string | number)[]): string => values.map((value) => typeof value === "number" ? String(value) : `'${value}'`).join(", ");

describe("durable user preferences SQL contract", () => {
  it("keeps user_preferences in exactly one migration", () => {
    expect(subsystemMigrations()).toEqual([filename]);
  });

  it("pins the option lists from their one TypeScript home", () => {
    const sql = migration();
    expect(sql).toContain(`check (learning_schedule in (${quoted(LEARNING_SCHEDULE_OPTIONS)}))`);
    expect(sql).toContain(`check (review_frequency in (${quoted(REVIEW_FREQUENCY_OPTIONS)}))`);
    expect(sql).toContain(`check (difficulty in (${quoted(DIFFICULTY_OPTIONS)}))`);
    expect(sql).toContain(`check (display_scale in (${quoted(DISPLAY_SCALE_OPTIONS)}))`);
  });

  it("pins every reading and playback setting to its option list and default", () => {
    const sql = migration();
    const columns = [
      ["reading_furigana", READING_FURIGANA_OPTIONS, "'adaptive'"],
      ["reading_translation", READING_TRANSLATION_OPTIONS, "'always'"],
      ["reading_jp_font", READING_JP_FONT_OPTIONS, "'gothic'"],
      ["reading_text_size", READING_TEXT_SIZE_OPTIONS, "'m'"],
      ["reading_line_height", READING_LINE_HEIGHT_OPTIONS, "'comfortable'"],
      ["reading_width", READING_WIDTH_OPTIONS, "'normal'"],
      ["reading_emphasis", READING_EMPHASIS_OPTIONS, "'soft'"],
      ["reading_color_preset", READING_COLOR_PRESET_OPTIONS, "'warm_cream'"],
      ["playback_default_rate", PLAYBACK_RATE_OPTIONS, "1"],
      ["playback_loop_count", PLAYBACK_LOOP_COUNT_OPTIONS, "1"],
      ["resume_behavior", RESUME_BEHAVIOR_OPTIONS, "'resume'"],
      ["study_atmosphere", STUDY_ATMOSPHERE_OPTIONS, "'none'"],
    ] as const;
    expect(columns).toHaveLength(12);
    for (const [column, options, defaultValue] of columns) {
      const type = column === "playback_default_rate" ? "numeric(3, 2)" : column === "playback_loop_count" ? "smallint" : "text";
      expect(sql).toContain(`${column} ${type} not null default ${defaultValue}`);
      expect(sql).toContain(`check (${column} in (${literals(options)}))`);
    }
    expect(sql).toContain("playback_auto_pause boolean not null default false");
    expect(sql).toContain("show_shortcut_hints boolean not null default false");
  });

  it("enables only the three owner policies and denies direct deletion", () => {
    const sql = migration();
    const policies = sql.match(/create policy user_preferences_[a-z]+_own on user_preferences/g) ?? [];
    expect(policies).toHaveLength(3);
    expect(policies).toEqual([
      "create policy user_preferences_select_own on user_preferences",
      "create policy user_preferences_insert_own on user_preferences",
      "create policy user_preferences_update_own on user_preferences",
    ]);
    expect(sql).toContain("alter table user_preferences enable row level security");
    expect(sql).toContain("revoke delete on user_preferences from authenticated");
  });

  it("keeps memory erasure security invoker and callable only by authenticated users", () => {
    const sql = migration();
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = public");
    expect(sql).toContain("revoke all on function erase_companion_memory() from public");
    expect(sql).toContain("grant execute on function erase_companion_memory() to authenticated");
  });
});
