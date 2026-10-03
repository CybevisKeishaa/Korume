import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const normalized = (file: string): string => readFileSync(join(process.cwd(), "supabase/migrations", file), "utf8")
  .replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase();

it("completes one assistant turn, settles once, and keeps the function service-only", () => {
  const sql = normalized("20261003000042_ask_korume_entitlement.sql");
  expect(sql).toContain("create function korume_complete_turn(");
  expect(sql).toContain("language plpgsql security definer set search_path = public");
  expect(sql).toContain("values (p_session, 'ai', p_content, p_content_json, 1, p_grounding_json, 1, p_turn)");
  expect(sql).toContain("on conflict (session_id, turn_id, role) where turn_id is not null do nothing");
  expect(sql.indexOf("if v_id is null then")).toBeLessThan(sql.indexOf("v_charged := ai_settle"));
  expect(sql).toContain("v_charged := ai_settle(p_reservation, p_generation, p_credits, p_usd)");
  expect(sql).toContain("title = coalesce(title, p_title)");
  expect(sql).toContain("revoke all on function korume_complete_turn(uuid, uuid, uuid, uuid, int, numeric, text, jsonb, jsonb, text) from public, anon, authenticated");
  expect(sql).toContain("grant execute on function korume_complete_turn(uuid, uuid, uuid, uuid, int, numeric, text, jsonb, jsonb, text) to service_role");
});
