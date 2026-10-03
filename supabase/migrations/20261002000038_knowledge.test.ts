import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const directory = join(process.cwd(), "supabase/migrations");

function normalized(file: string): string {
  return readFileSync(join(directory, file), "utf8")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const TABLES = ["knowledge_entries", "ai_generations", "ai_reservations", "ai_usage_charges", "ai_budget_days"];
const FUNCTIONS = [
  "knowledge_claim_lease",
  "knowledge_complete",
  "knowledge_fail",
  "ai_reserve",
  "ai_record_generation",
  "ai_release_expired",
  "ai_record_late_spend",
  "ai_settle",
  "ai_release",
  "ai_usage_snapshot",
];

describe("knowledge and AI ledger SQL contract", () => {
  const sql = normalized("20261002000038_knowledge.sql");

  it("keys the knowledge cache on seven dimensions", () => {
    expect(sql).toContain(
      "unique (fingerprint, section, locale, context_key, schema_version, generator_version, content_variant)",
    );
    expect(sql).toContain("check (status in ('pending', 'ready', 'failed'))");
    expect(sql).toContain("check (content_variant in ('full', 'preview'))");
    expect(sql).toContain("check (locale in ('vi', 'en'))");
    expect(sql).toContain("lease_token uuid");
  });

  it("ties entitlement kind to billing scope", () => {
    expect(sql).toContain("billing_scope text not null check (billing_scope in ('learner', 'system'))");
    expect(sql).toContain("entitlement_kind text check (entitlement_kind in ('free_sentence', 'plus_section', 'korume_free_turn', 'korume_plus_turn'))");
    expect(sql).toContain("entitlement_kind text not null check (entitlement_kind in ('free_sentence', 'plus_section', 'korume_free_turn', 'korume_plus_turn'))");
    expect(sql).toContain("check ((billing_scope = 'system') = (entitlement_kind is null))");
    expect(sql).toContain("check (status in ('held', 'settled', 'released'))");
  });

  it("allows one Free charge per sentence per day and one Plus charge per generation", () => {
    expect(sql).toContain(
      "create unique index ai_usage_charges_free_sentence_once on ai_usage_charges (user_id, period_day, fingerprint) where entitlement_kind = 'free_sentence'",
    );
    expect(sql).toContain(
      "create unique index ai_usage_charges_plus_generation_once on ai_usage_charges (generation_id) where entitlement_kind in ('plus_section', 'korume_plus_turn')",
    );
  });

  it("keeps cost history when an account is deleted, but not the learner's charges", () => {
    expect(sql).toMatch(/create table ai_generations \(.*requested_by_user_id uuid references users \(id\) on delete set null/);
    expect(sql).toMatch(/create table ai_reservations \(.*requested_by_user_id uuid references users \(id\) on delete set null/);
    expect(sql).toMatch(/create table ai_usage_charges \(.*user_id uuid not null references users \(id\) on delete cascade/);
  });

  it("records optional Korume turn IDs in generation telemetry", () => {
    expect(sql).toContain("turn_id uuid");
    expect(sql).toContain("create index ai_generations_turn on ai_generations (turn_id) where turn_id is not null");
    expect(sql).toContain("(p_row->>'turnid')::uuid");
  });

  it("gives learners no direct access to the cache or the ledger", () => {
    for (const table of TABLES) {
      expect(sql).toContain(`alter table ${table} enable row level security`);
      expect(sql).toContain(`revoke all on ${table} from anon, authenticated`);
      expect(sql).toContain(`grant all on ${table} to service_role`);
      expect(sql).not.toMatch(new RegExp(`create policy [a-z_]+ on ${table}\\b`));
    }
  });

  it("makes every function a service-role-only security definer", () => {
    for (const fn of FUNCTIONS) {
      expect(sql).toMatch(new RegExp(`create function ${fn}\\(.*?security definer set search_path = public`));
      expect(sql).toMatch(new RegExp(`revoke all on function ${fn}\\([^)]*\\) from public, anon, authenticated`));
      expect(sql).toMatch(new RegExp(`grant execute on function ${fn}\\([^)]*\\) to service_role`));
    }
  });

  it("guards completion with the caller's lease token", () => {
    const complete = sql.slice(sql.indexOf("create function knowledge_complete"), sql.indexOf("create function knowledge_fail"));
    expect(complete).toContain("lease_token = p_lease_token");
    expect(complete).toContain("status = 'pending'");
  });

  it("locks the per-day budget row before checking it", () => {
    const reserve = sql.slice(sql.indexOf("create function ai_reserve"), sql.indexOf("create function ai_record_generation"));
    expect(reserve).toContain("pg_advisory_xact_lock");
    expect(reserve).toMatch(/from ai_budget_days where period_day = v_day for update/);
  });

  it("keys one active reservation per turn and checks it after reclaiming expired holds", () => {
    const reserve = sql.slice(sql.indexOf("create function ai_reserve"), sql.indexOf("create function ai_record_generation"));
    expect(sql).toContain("turn_id uuid");
    expect(sql).toContain("create unique index ai_reservations_turn_active on ai_reservations (turn_id) where turn_id is not null and status in ('held', 'settled')");
    expect(reserve).toContain("p_turn_id uuid default null");
    expect(reserve.indexOf("perform ai_release_expired()")).toBeLessThan(reserve.indexOf("r.turn_id = p_turn_id"));
    expect(reserve.indexOf("r.turn_id = p_turn_id")).toBeLessThan(reserve.indexOf("from ai_budget_days where period_day = v_day for update"));
    expect(reserve).toContain("'turn_exists'::text");
    expect(sql).toContain("revoke all on function ai_reserve(uuid, text, text, text, int, numeric, jsonb, int, uuid) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function ai_reserve(uuid, text, text, text, int, numeric, jsonb, int, uuid) to service_role");
  });

  it("caps system-funded generations per user under the shared user lock", () => {
    const reserve = sql.slice(sql.indexOf("create function ai_reserve"), sql.indexOf("create function ai_record_generation"));
    expect(reserve).toContain("p_billing_scope = 'learner' or (p_billing_scope = 'system' and p_requested_by is not null)");
    expect(reserve).toContain("r.billing_scope = 'system'");
    expect(reserve).toContain("p_limits->>'systemgenerationsperuserperday'");
    expect(reserve).toContain("'quota_exhausted'::text, v_next_day");
  });

  it("serializes every expiry sweep before it updates expired reservations", () => {
    const releaseExpired = sql.slice(sql.indexOf("create function ai_release_expired"), sql.indexOf("create function ai_reserve"));
    expect(releaseExpired).toContain("pg_advisory_xact_lock(hashtext('ai-release-expired'))");
    expect(releaseExpired.indexOf("pg_advisory_xact_lock(hashtext('ai-release-expired'))")).toBeLessThan(
      releaseExpired.indexOf("update ai_reservations"),
    );
  });

  it("keeps late-spend settlement in the defining migration", () => {
    const settle = sql.slice(sql.indexOf("create function ai_settle"), sql.indexOf("create function ai_release("));
    expect(sql).toContain("expired_at timestamptz");
    expect(sql).toContain("late_spent_at timestamptz");
    expect(sql).toContain("create function ai_record_late_spend");
    expect(sql).not.toContain("create or replace function");
    expect(settle).toContain("perform ai_record_late_spend(p_reservation, p_actual_usd)");
    expect(settle).toContain("case when v_res.entitlement_kind in ('plus_section', 'korume_plus_turn') then greatest(p_actual_credits, 0) else 0 end");
  });

  it("defines every reservation lifecycle function only in the defining migration", () => {
    const files = readdirSync(directory).filter((file) => file.endsWith(".sql"));
    expect(files).not.toHaveLength(0);
    expect(files).toContain("20261002000038_knowledge.sql");

    const definitions = /create(?:\s+or\s+replace)?\s+function\s+(ai_release_expired|ai_settle|ai_release|ai_record_late_spend)\b/gi;
    const definingFiles = files.filter((file) => definitions.test(readFileSync(join(directory, file), "utf8")));
    expect(definingFiles).toEqual(["20261002000038_knowledge.sql"]);
  });

  it("shares Plus credit capacity while keeping the two daily fuses separate", () => {
    const reserve = sql.slice(sql.indexOf("create function ai_reserve"), sql.indexOf("create function ai_record_generation"));
    const settle = sql.slice(sql.indexOf("create function ai_settle"), sql.indexOf("create function ai_release("));
    const snapshot = sql.slice(sql.indexOf("create function ai_usage_snapshot"));
    expect(reserve).toContain("r.entitlement_kind = 'korume_free_turn'");
    expect(reserve).toContain("p_limits->>'askkorumefreeturnsperday'");
    expect(reserve).toContain("r.entitlement_kind = p_entitlement_kind");
    expect(reserve).toContain("p_limits->>'askkorumeplusturnsperday'");
    expect(reserve.split("entitlement_kind in ('plus_section', 'korume_plus_turn')").length - 1).toBe(4);
    expect(settle).toContain("case when v_res.entitlement_kind in ('plus_section', 'korume_plus_turn') then greatest(p_actual_credits, 0) else 0 end");
    expect(snapshot.split("entitlement_kind in ('plus_section', 'korume_plus_turn')").length - 1).toBe(2);
    expect(snapshot).toContain("'askkorumeturnsused'");
  });
});
