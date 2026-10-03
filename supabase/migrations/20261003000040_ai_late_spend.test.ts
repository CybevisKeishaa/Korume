import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const normalized = (file: string): string => readFileSync(join(process.cwd(), "supabase/migrations", file), "utf8")
  .replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase();

it("settles Korume Plus credits through the live late-spend implementation", () => {
  const sql = normalized("20261003000040_ai_late_spend.sql");
  const settle = sql.slice(sql.indexOf("create or replace function ai_settle"), sql.indexOf("create or replace function ai_release("));
  expect(settle).toContain("perform ai_record_late_spend(p_reservation, p_actual_usd)");
  expect(settle).toContain("case when v_res.entitlement_kind in ('plus_section', 'korume_plus_turn') then greatest(p_actual_credits, 0) else 0 end");
});
