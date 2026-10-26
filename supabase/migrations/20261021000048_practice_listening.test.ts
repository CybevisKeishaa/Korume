// supabase/migrations/20261021000048_practice_listening.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const directory = join(process.cwd(), "supabase/migrations");
const filename = "20261021000048_practice_listening.sql";
const normalized = (file: string): string =>
  readFileSync(join(directory, file), "utf8").replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase();
const sql = normalized(filename);

const READ_FUNCTIONS = [
  { name: "practice_stats", signature: "practice_stats(uuid, text, numeric)", revoke: "revoke all" },
  { name: "lesson_summary_evidence", signature: "lesson_summary_evidence(uuid, int)", revoke: "revoke all" },
  { name: "practice_activity", signature: "practice_activity(timestamptz)", revoke: "revoke execute" },
  { name: "weekly_skill_windows", signature: "weekly_skill_windows(text, date, date, date)", revoke: "revoke execute" },
  { name: "weakness_scores", signature: "weakness_scores(text, int)", revoke: "revoke execute" },
] as const;

describe("practice listening SQL contract (spec §5.3, §6.2, §7, §7.1; plan P3)", () => {
  it("adds the B2 columns and backfills legacy rows as typed (D21)", () => {
    expect(sql).toContain(
      "alter table dictation_attempts add column format text check (format in ('word_bank', 'typing')), " +
        "add column status text check (status in ('submitted', 'revealed', 'unscored')), " +
        "add column hint_unit text check (hint_unit in ('chunk', 'grapheme4')), " +
        "add column hinted_units int[] not null default '{}', add column chunk_order int[], " +
        "add column chunker_version smallint, add column chunk_snapshot text[];",
    );
    // supabase/tests/practice-listening.sql case 2 runs this same statement on a temp copy of the table.
    expect(sql).toContain(
      "update dictation_attempts set format = 'typing', status = case when accuracy_score is null then 'unscored' else 'submitted' end;",
    );
    expect(sql.indexOf("update dictation_attempts set format")).toBeLessThan(sql.indexOf("alter column format set not null"));
  });

  it("the listening gate runs the migration's own backfill on its temp copy (case 2)", () => {
    const gate = readFileSync(join(process.cwd(), "supabase/tests/practice-listening.sql"), "utf8")
      .replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase();
    const migrationBackfill = sql.match(/update dictation_attempts (set format [^;]*;)/)?.[1];
    const gateBackfill = gate.match(/update legacy_copy (set [^;]*;)/)?.[1];
    expect(migrationBackfill).toBeDefined();
    expect(gateBackfill).toBe(migrationBackfill);
    expect(sql).toContain("alter column format set not null, alter column status set not null");
  });

  it("ties a score to submitted, an arrangement to Word Bank, and keeps unscored legacy-only", () => {
    expect(sql).toContain("check ((status = 'submitted') = (accuracy_score is not null))");
    expect(sql).toContain("check (format <> 'word_bank' or chunk_order is not null or status = 'revealed')");
    expect(sql).toContain(
      "if new.status = 'unscored' and (tg_op = 'insert' or old.status is distinct from 'unscored') then " +
        "raise exception 'dictation_attempts: unscored is legacy-only' using errcode = '23514';",
    );
    expect(sql).toContain("create trigger dictation_attempts_no_new_unscored before insert or update on dictation_attempts");
    expect(sql.indexOf("create trigger dictation_attempts_no_new_unscored")).toBeGreaterThan(sql.indexOf("update dictation_attempts set format"));
    expect(sql).toContain("create index idx_dictation_line_format on dictation_attempts (user_id, transcript_line_id, format, created_at desc)");
  });

  it("revokes learner writes on attempts (D25)", () => {
    expect(sql).toContain("revoke insert, update on dictation_attempts from authenticated, anon;");
  });

  it("defines each read function as the invoker, pinned, authenticated-only", () => {
    expect(sql).toMatch(
      /create or replace function practice_stats\(p_video uuid, p_mode text, p_review_below numeric\) returns jsonb language plpgsql stable security invoker set search_path = public/,
    );
    expect(sql).toMatch(
      /create or replace function lesson_summary_evidence\(p_video uuid, p_mastery int\) returns jsonb language sql stable security invoker set search_path = public/,
    );
    for (const fn of ["practice_activity", "weekly_skill_windows", "weakness_scores"]) {
      expect(sql).toMatch(new RegExp(`create or replace function ${fn}\\([^)]*\\) returns table \\([^)]*\\) language sql stable security invoker set search_path = public`));
    }
    for (const { signature, revoke } of READ_FUNCTIONS) {
      expect(sql).toContain(`${revoke} on function ${signature} from public, anon;`);
      expect(sql).toContain(`grant execute on function ${signature} to authenticated;`);
    }
  });

  it("reads Listening per format: R1 scores, R2 states, Typing-only Dashboard, submitted missions", () => {
    expect(sql).toContain("where d.user_id = auth.uid() and d.format = p_mode");
    expect(sql).toContain("'wordbankmean', (select avg(accuracy_score) from latest_submitted where format = 'word_bank')");
    expect(sql).toContain("'typingmean', (select avg(accuracy_score) from latest_submitted where format = 'typing')");
    expect(sql).not.toContain("dictationmean");
    expect(sql.match(/from dictation_attempts where user_id = auth.uid\(\) and format = 'typing' and status = 'submitted'/g)).toHaveLength(2);
    expect(sql).toContain("select 'dictation_lines', count(distinct transcript_line_id)::int");
    expect(sql).toContain("from dictation_attempts where user_id = auth.uid() and created_at >= p_since and status = 'submitted';");
  });

  // 049 redefines four of these; its own test pins the later homes (20261026000049_listening_two_exercises.test.ts).
  it("is the first home of every function that reads a B2 column (AGENTS §6, plan P3)", () => {
    const files = readdirSync(directory).filter((file) => file.endsWith(".sql")).sort();
    expect(files.length).toBeGreaterThan(40);
    for (const { name } of READ_FUNCTIONS) {
      const homes = files.filter((file) => new RegExp(`create (or replace )?function (public\\.)?${name}\\(`).test(normalized(file)));
      expect(homes[0], name).toBe(filename);
    }
  });
});
