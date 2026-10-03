import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const directory = join(process.cwd(), "supabase/migrations");

function normalized(file: string): string {
  return readFileSync(join(directory, file), "utf8")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

describe("ask korume threads SQL contract", () => {
  const sql = normalized("20261003000041_ask_korume_threads.sql");

  it("discriminates sessions by kind without breaking scenario rows", () => {
    expect(sql).toContain("add column kind text not null default 'scenario'");
    expect(sql).toContain("check (kind in ('scenario', 'ask_korume'))");
    expect(sql).not.toMatch(/kind = 'scenario' and scenario_type is not null/);
    expect(sql).toMatch(/kind = 'scenario' and origin_video_id is null and origin_line_id is null and origin_span is null and origin_route is null and title is null/);
    expect(sql).toMatch(/kind = 'ask_korume' and scenario_type is null/);
  });

  it("shapes the anchor", () => {
    expect(sql).toContain("check (origin_span is null or origin_line_id is not null)");
    expect(sql).toContain("check (origin_line_id is null or origin_video_id is not null)");
    expect(sql).toMatch(/jsonb_typeof\(origin_span->'start'\) = 'number'/);
    expect(sql).toMatch(/\(origin_span - 'start' - 'end'\) = '\{\}'::jsonb/);
    expect(sql).toContain("origin_route like '/%' and origin_route not like '//%' and position(':' in origin_route) = 0");
  });

  it("versions structured content and grounding and keys turns", () => {
    expect(sql).toContain("add column content_json jsonb");
    expect(sql).toContain("add column grounding_json jsonb");
    expect(sql).toContain("check ((content_json is null) = (content_schema_version is null))");
    expect(sql).toContain("check ((grounding_json is null) = (grounding_schema_version is null))");
    expect(sql).toContain("check (role <> 'user' or (content_json is null and grounding_json is null))");
    expect(sql).toContain("create unique index conversation_messages_turn_role on conversation_messages (session_id, turn_id, role) where turn_id is not null");
    expect(sql).not.toMatch(/rename column content/);
  });

  it("reserves Ask Korume writes for the server while retaining scenario writes", () => {
    expect(sql).toContain("create policy korume_sessions_insert on conversation_sessions as restrictive for insert to authenticated with check (kind = 'scenario')");
    expect(sql).toContain("create policy korume_sessions_update on conversation_sessions as restrictive for update to authenticated using (kind = 'scenario') with check (kind = 'scenario')");
    expect(sql).toContain("create policy korume_messages_insert on conversation_messages as restrictive for insert to authenticated");
    expect(sql).toContain("create policy korume_messages_update on conversation_messages as restrictive for update to authenticated");
    expect(sql).toContain("create policy korume_messages_delete on conversation_messages as restrictive for delete to authenticated");
  });

  it("clears anchors before their sources are deleted", () => {
    expect(sql).toContain("before delete on transcript_lines for each row execute function korume_clear_line_anchor()");
    expect(sql).toContain("before delete on videos for each row execute function korume_clear_video_anchor()");
    for (const f of ["korume_clear_line_anchor", "korume_clear_video_anchor"]) {
      expect(sql).toContain(`revoke all on function ${f}() from public, anon, authenticated`);
    }
  });

  it("correlates generations with a turn", () => {
    expect(sql).toContain("create index conversation_sessions_user_kind_updated on conversation_sessions (user_id, kind, updated_at desc)");
    expect(sql).not.toContain("create or replace function ai_record_generation");
    const knowledgeSql = normalized("20261002000038_knowledge.sql");
    expect(knowledgeSql).toContain("turn_id uuid");
    expect(knowledgeSql).toContain("(p_row->>'turnid')::uuid");
    expect(knowledgeSql).toContain("revoke all on function ai_record_generation(jsonb) from public, anon, authenticated");
    expect(knowledgeSql).toContain("grant execute on function ai_record_generation(jsonb) to service_role");
  });
});
