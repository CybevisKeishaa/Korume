// supabase/migrations/20261004000043_lesson_summary.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261004000043_lesson_summary.sql"), "utf8")
  .replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase();

describe("lesson summary SQL contract (spec §3, §5.5, §6.2)", () => {
  it("aggregates evidence in SQL, as the invoker, for the caller only", () => {
    expect(sql).toMatch(/create function lesson_summary_evidence\(p_video uuid, p_mastery int\) returns jsonb language sql stable security invoker set search_path = public/);
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("revoke all on function lesson_summary_evidence(uuid, int) from public, anon");
    expect(sql).toContain("grant execute on function lesson_summary_evidence(uuid, int) to authenticated");
  });
  it("schedules Review Tomorrow as the invoker, idempotently, never pushing a due card later", () => {
    expect(sql).toMatch(/create function schedule_review_tomorrow\(p_video uuid, p_targets jsonb, p_due timestamptz\) returns int language plpgsql security invoker set search_path = public/);
    expect(sql).toContain("on conflict (user_id, transcript_line_id) where source_kind = 'sentence' do update");
    expect(sql).toContain("where sentence_mining_cards.next_review_at is not null and excluded.next_review_at < sentence_mining_cards.next_review_at");
    expect(sql).toContain("get diagnostics v_rows = row_count; v_count := v_count + v_rows;");
    expect(sql).toContain("revoke all on function schedule_review_tomorrow(uuid, jsonb, timestamptz) from public, anon");
  });
  it("lesson_reflections is user-owned, cascades, and is readable only by its owner", () => {
    expect(sql).toContain("user_id uuid not null references users (id) on delete cascade");
    expect(sql).toContain("video_id uuid not null references videos (id) on delete cascade");
    expect(sql).toContain("unique (user_id, video_id, locale, analysis_fingerprint, evidence_fingerprint, schema_version, generator_version)");
    expect(sql).toContain("create policy lesson_reflections_own_read on lesson_reflections for select to authenticated using (user_id = auth.uid())");
    expect(sql).toContain("revoke all on lesson_reflections from anon, authenticated");
    expect(sql).not.toMatch(/create policy [a-z_]+ on lesson_reflections for (insert|update|delete|all)/);
  });
  it("the reflection lease functions are definer, pinned, and service-role only", () => {
    for (const signature of [
      "reflection_claim_lease(uuid, jsonb, int)",
      "reflection_complete(uuid, uuid, jsonb, text, text)",
      "reflection_fail(uuid, uuid, text, timestamptz)",
    ]) {
      expect(sql).toContain(`revoke all on function ${signature} from public, anon, authenticated`);
      expect(sql).toContain(`grant execute on function ${signature} to service_role`);
    }
    expect(sql.match(/security definer set search_path = public/g)?.length).toBe(3);
  });
});
