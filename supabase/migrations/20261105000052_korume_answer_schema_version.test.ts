import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const normalized = (file: string): string => readFileSync(join(process.cwd(), "supabase/migrations", file), "utf8")
  .replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase();

it("stores the answer schema version the turn wrote, and keeps the function service-only", () => {
  const sql = normalized("20261105000052_korume_answer_schema_version.sql");
  expect(sql).toContain("drop function korume_complete_turn(uuid, uuid, uuid, uuid, int, numeric, text, jsonb, jsonb, text)");
  expect(sql).toContain("create function korume_complete_turn(");
  // default 1: the main checkout's v1 code still calls the 10-arg form against the shared local database
  expect(sql).toContain("p_content_schema_version smallint default 1");
  expect(sql).toContain("language plpgsql security definer set search_path = public");
  expect(sql).toContain("values (p_session, 'ai', p_content, p_content_json, p_content_schema_version, p_grounding_json, 1, p_turn)");
  expect(sql).toContain("on conflict (session_id, turn_id, role) where turn_id is not null do nothing");
  expect(sql.indexOf("if v_id is null then")).toBeLessThan(sql.indexOf("v_charged := ai_settle"));
  expect(sql).toContain("v_charged := ai_settle(p_reservation, p_generation, p_credits, p_usd)");
  expect(sql).toContain("title = coalesce(title, p_title)");
  expect(sql).toContain("revoke all on function korume_complete_turn(uuid, uuid, uuid, uuid, int, numeric, text, jsonb, jsonb, text, smallint) from public, anon, authenticated");
  expect(sql).toContain("grant execute on function korume_complete_turn(uuid, uuid, uuid, uuid, int, numeric, text, jsonb, jsonb, text, smallint) to service_role");
});
