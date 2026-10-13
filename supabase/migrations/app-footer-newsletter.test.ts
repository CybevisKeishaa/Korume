// supabase/migrations/app-footer-newsletter.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = "supabase/migrations/20261013000046_app_footer_newsletter.sql";

describe("app footer newsletter migration (spec N1–N2)", () => {
  const sql = readFileSync(SQL, "utf8");

  it("adds a nullable consent instant on users", () => {
    expect(sql).toContain("alter table public.users add column newsletter_opt_in_at timestamptz;");
  });

  it("writes it only through a definer function with an empty search_path", () => {
    expect(sql).toContain("create function public.set_newsletter_opt_in(p_opt_in boolean) returns timestamptz");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("where id = v_uid");
  });

  it("is closed to anon and grants no column update", () => {
    expect(sql).toContain("revoke all on function public.set_newsletter_opt_in(boolean) from public, anon;");
    expect(sql).toContain("grant execute on function public.set_newsletter_opt_in(boolean) to authenticated;");
    expect(sql).not.toMatch(/grant\s+update\s*\(\s*newsletter_opt_in_at/i);
  });
});
