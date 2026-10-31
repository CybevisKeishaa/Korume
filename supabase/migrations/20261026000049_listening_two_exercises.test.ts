// supabase/migrations/20261026000049_listening_two_exercises.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const directory = join(process.cwd(), "supabase/migrations");
const filename = "20261026000049_listening_two_exercises.sql";
const normalized = (file: string): string =>
  readFileSync(join(directory, file), "utf8").replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase();
const sql = normalized(filename);

const REDEFINED = [
  { name: "practice_stats", signature: "practice_stats(uuid, text, numeric)", revoke: "revoke all" },
  { name: "lesson_summary_evidence", signature: "lesson_summary_evidence(uuid, int)", revoke: "revoke all" },
  { name: "weekly_skill_windows", signature: "weekly_skill_windows(text, date, date, date)", revoke: "revoke execute" },
  { name: "weakness_scores", signature: "weakness_scores(text, int)", revoke: "revoke execute" },
] as const;

describe("listening two exercises SQL contract (spec 2026-10-26 §3.6, §3.10)", () => {
  it("widens format and hint_unit, adds easy mode and the cloze columns", () => {
    expect(sql).toContain(
      "alter table dictation_attempts drop constraint dictation_attempts_format_check, " +
        "drop constraint dictation_attempts_hint_unit_check, " +
        "add constraint dictation_attempts_format_check check (format in ('word_bank', 'typing', 'cloze')), " +
        "add constraint dictation_attempts_hint_unit_check check (hint_unit in ('chunk', 'grapheme4', 'grapheme1')), " +
        "add column easy_mode boolean not null default false, add column cloze_selector_version smallint, " +
        "add column cloze_blanks smallint[], add column cloze_answers text[];",
    );
  });

  it("backfills every Word Bank row as easy mode before the check that requires it", () => {
    expect(sql).toContain("update dictation_attempts set easy_mode = true where format = 'word_bank';");
    expect(sql).toContain("check (format <> 'word_bank' or easy_mode)");
    expect(sql.indexOf("set easy_mode = true")).toBeLessThan(sql.indexOf("check (format <> 'word_bank' or easy_mode)"));
    expect(sql).toContain("check ((format = 'cloze') = (cloze_selector_version is not null and cloze_blanks is not null))");
    expect(sql).toContain("check (format <> 'cloze' or status = 'revealed' or cloze_answers is not null)");
  });

  it("defines helped once, immutable, authenticated-only", () => {
    expect(sql).toContain(
      "create function dictation_attempt_helped(p_easy boolean, p_hinted int[]) returns boolean " +
        "language sql immutable set search_path = public as $$ select p_easy or cardinality(p_hinted) > 0 $$;",
    );
    expect(sql).toContain("revoke execute on function dictation_attempt_helped(boolean, int[]) from public, anon;");
    expect(sql).toContain("grant execute on function dictation_attempt_helped(boolean, int[]) to authenticated;");
  });

  it("redefines each read function as the invoker, pinned, authenticated-only", () => {
    expect(sql).toMatch(
      /create or replace function practice_stats\(p_video uuid, p_mode text, p_review_below numeric\) returns jsonb language plpgsql stable security invoker set search_path = public/,
    );
    expect(sql).toMatch(
      /create or replace function lesson_summary_evidence\(p_video uuid, p_mastery int\) returns jsonb language sql stable security invoker set search_path = public/,
    );
    for (const fn of ["weekly_skill_windows", "weakness_scores"]) {
      expect(sql).toMatch(new RegExp(`create or replace function ${fn}\\([^)]*\\) returns table \\([^)]*\\) language sql stable security invoker set search_path = public`));
    }
    for (const { signature, revoke } of REDEFINED) {
      expect(sql).toContain(`${revoke} on function ${signature} from public, anon;`);
      expect(sql).toContain(`grant execute on function ${signature} to authenticated;`);
    }
  });

  it("reads Chép chính tả across typing + word_bank, Điền từ alone, and orders needs_review before helped", () => {
    expect(sql).toContain("if p_mode in ('dictation', 'cloze') then");
    expect(sql).toContain("d.format = any (case p_mode when 'dictation' then array['typing', 'word_bank'] else array['cloze'] end)");
    expect(sql).toContain("'helpedlines', (select count(*) from latest_scored where helped)");
    expect(sql).toContain("case when ls.score < p_review_below then 'needs_review' when ls.helped then 'helped' else 'scored' end");
    expect(sql).not.toMatch(/p_mode in \('word_bank', 'typing'\)/);
  });

  it("gives Summary two rows, never averaged, and per-line helped", () => {
    expect(sql).not.toContain("wordbankmean");
    expect(sql).not.toContain("typingmean");
    expect(sql).toContain("case d.format when 'cloze' then 'cloze' else 'dictation' end as exercise");
    for (const exercise of ["dictation", "cloze"]) {
      expect(sql).toContain(
        `'${exercise}', (select jsonb_build_object('mean', avg(accuracy_score), 'done', count(*), 'selfdone', count(*) filter (where not helped)) ` +
          `from latest_submitted where exercise = '${exercise}')`,
      );
    }
    expect(sql).toContain("'input', la.user_input, 'helped', la.status = 'submitted' and la.helped)");
  });

  it("counts Dashboard Listening as typed without help only (narrows D20)", () => {
    expect(
      sql.match(/from dictation_attempts where user_id = auth.uid\(\) and format = 'typing' and status = 'submitted' and not dictation_attempt_helped\(easy_mode, hinted_units\)/g),
    ).toHaveLength(2);
  });

  it("is the latest home of every function that reads a listening column; practice_activity stays in 048", () => {
    const files = readdirSync(directory).filter((file) => file.endsWith(".sql")).sort();
    expect(files.length).toBeGreaterThan(40);
    const homes = (name: string) =>
      files.filter((file) => new RegExp(`create (or replace )?function (public\\.)?${name}\\(`).test(normalized(file)));
    for (const { name } of REDEFINED) expect(homes(name), name).toEqual(["20261021000048_practice_listening.sql", filename]);
    expect(homes("practice_activity")).toEqual(["20261021000048_practice_listening.sql"]);
    expect(homes("dictation_attempt_helped")).toEqual([filename]);
  });
});
