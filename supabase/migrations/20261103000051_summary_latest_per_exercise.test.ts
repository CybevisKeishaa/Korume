import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), "supabase/migrations", file), "utf8")
  .replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const sql = read("20261103000051_summary_latest_per_exercise.sql");
const before = read("20261026000049_listening_two_exercises.sql");

describe("summary latest per exercise SQL contract (ultra review 2026-11-03)", () => {
  it("picks each line's latest attempt per exercise, not per format", () => {
    expect(sql).toContain("select distinct on (line_id, exercise) line_id, format, status, accuracy_score, user_input, helped from attempts order by line_id, exercise, created_at desc, id desc");
    expect(sql).not.toContain("distinct on (line_id, format)");
  });

  it("redefines only lesson_summary_evidence, identical to 049 apart from that pick, with the same grants", () => {
    expect(sql.match(/create (or replace )?function/g)).toHaveLength(1);
    const fn = (text: string) => text.slice(text.indexOf("create or replace function lesson_summary_evidence("), text.indexOf("to authenticated;", text.indexOf("grant execute on function lesson_summary_evidence(")));
    expect(fn(sql)).toBe(fn(before)
      .replace("distinct on (line_id, format)", "distinct on (line_id, exercise)")
      .replace("order by line_id, format, created_at desc", "order by line_id, exercise, created_at desc"));
    expect(sql).toContain("revoke all on function lesson_summary_evidence(uuid, int) from public, anon;");
    expect(sql).toContain("grant execute on function lesson_summary_evidence(uuid, int) to authenticated;");
  });
});
