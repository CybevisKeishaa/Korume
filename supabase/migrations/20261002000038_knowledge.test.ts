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

const TABLES = ["knowledge_entries", "ai_generations", "ai_reservations", "ai_usage_charges", "ai_budget_days"];
const FUNCTIONS = [
  "knowledge_claim_lease",
  "knowledge_complete",
  "knowledge_fail",
  "ai_reserve",
  "ai_record_generation",
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
    expect(sql).toContain("entitlement_kind text check (entitlement_kind in ('free_sentence', 'plus_section'))");
    expect(sql).toContain("check ((billing_scope = 'system') = (entitlement_kind is null))");
    expect(sql).toContain("check (status in ('held', 'settled', 'released'))");
  });

  it("allows one Free charge per sentence per day and one Plus charge per generation", () => {
    expect(sql).toContain(
      "create unique index ai_usage_charges_free_sentence_once on ai_usage_charges (user_id, period_day, fingerprint) where entitlement_kind = 'free_sentence'",
    );
    expect(sql).toContain(
      "create unique index ai_usage_charges_plus_generation_once on ai_usage_charges (generation_id) where entitlement_kind = 'plus_section'",
    );
  });

  it("keeps cost history when an account is deleted, but not the learner's charges", () => {
    expect(sql).toMatch(/create table ai_generations \(.*requested_by_user_id uuid references users \(id\) on delete set null/);
    expect(sql).toMatch(/create table ai_reservations \(.*requested_by_user_id uuid references users \(id\) on delete set null/);
    expect(sql).toMatch(/create table ai_usage_charges \(.*user_id uuid not null references users \(id\) on delete cascade/);
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
});
