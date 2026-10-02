import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createServiceClient } from "@/lib/supabase/service";
import { createSqlKnowledgeStore } from "./store";
import type { KnowledgeKey } from "./types";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const KEY: KnowledgeKey = {
  fingerprint: "f".repeat(64), section: "lite", locale: "vi", contextKey: "", schemaVersion: 1, generatorVersion: 2, contentVariant: "full",
};

let mock: ReturnType<typeof createMockSupabase>;
const queries: QueryCall[][] = [];

beforeEach(() => {
  vi.clearAllMocks();
  queries.length = 0;
  const claim = { entry_id: "e1", outcome: "leader", lease_token: "t1", content: null, retry_after: null, attempts: 2, model: null };
  mock = createMockSupabase({
    tables: { knowledge_entries: (calls) => { queries.push(calls); return { data: { content: { a: 1 }, model: "m" }, error: null }; } },
    rpcs: {
      knowledge_claim_lease: () => ({ data: [claim], error: null }),
      knowledge_complete: () => ({ data: true, error: null }),
      knowledge_fail: () => ({ data: true, error: null }),
      ai_reserve: () => ({ data: [{ reservation_id: "r1", outcome: "already_charged", resets_at: null }], error: null }),
      ai_record_generation: () => ({ data: "g1", error: null }),
      ai_settle: () => ({ data: true, error: null }),
      ai_release: () => ({ data: false, error: null }),
    },
  });
  vi.mocked(createServiceClient).mockReturnValue(mock as unknown as ReturnType<typeof createServiceClient>);
});

describe("createSqlKnowledgeStore", () => {
  it("is server-only", () => {
    expect(readFileSync(join(process.cwd(), "lib/knowledge/store.ts"), "utf8")).toMatch(/^import "server-only";/);
  });

  it("calls each migration 038 function by name with its parameter names", async () => {
    const store = createSqlKnowledgeStore();
    await expect(store.claimLease(KEY, 90)).resolves.toEqual({ outcome: "leader", entryId: "e1", leaseToken: "t1", attempts: 2 });
    await expect(store.complete("e1", "t1", { a: 1 }, "m", "anthropic")).resolves.toBe(true);
    await expect(store.fail("e1", "t1", "provider_error", new Date("2026-10-02T09:00:30Z"))).resolves.toBe(true);
    const limits = { globalUsdPerDay: 5, freeSentencesPerDay: 3, plusMaxSectionsPerDay: 200, plusCreditsPerMonth: 1000 };
    await expect(store.reserve({
      requestedBy: "u", billingScope: "learner", entitlementKind: "free_sentence", fingerprint: "p", reservedCredits: 0,
      reservedUsd: 0.01, limits, ttlSeconds: 180,
    })).resolves.toEqual({ outcome: "already_charged", reservationId: "r1", resetsAt: null });
    await expect(store.settle("r1", "g1", 2, 0.0019)).resolves.toBe(true);
    await expect(store.release("r1", 0.02)).resolves.toBe(false);

    expect(mock.rpcCalls).toEqual([
      { name: "knowledge_claim_lease", args: { p_key: { fingerprint: KEY.fingerprint, section: "lite", locale: "vi", contextKey: "", schemaVersion: 1, generatorVersion: 2, contentVariant: "full" }, p_lease_seconds: 90 } },
      { name: "knowledge_complete", args: { p_entry: "e1", p_lease_token: "t1", p_content: { a: 1 }, p_model: "m", p_provider: "anthropic" } },
      { name: "knowledge_fail", args: { p_entry: "e1", p_lease_token: "t1", p_error_code: "provider_error", p_retry_after: "2026-10-02T09:00:30.000Z" } },
      { name: "ai_reserve", args: {
        p_requested_by: "u", p_billing_scope: "learner", p_entitlement_kind: "free_sentence", p_fingerprint: "p",
        p_reserved_credits: 0, p_reserved_usd: 0.01, p_limits: limits, p_ttl_seconds: 180,
      } },
      { name: "ai_settle", args: { p_reservation: "r1", p_generation: "g1", p_actual_credits: 2, p_actual_usd: 0.0019 } },
      { name: "ai_release", args: { p_reservation: "r1", p_spent_usd: 0.02 } },
    ]);
  });

  it("records a generation row under the JSON keys ai_record_generation reads", async () => {
    const row = {
      requestedByUserId: "u", billingScope: "learner" as const, knowledgeEntryId: "e1", reservationId: "r1", section: "lite" as const,
      provider: "anthropic", model: "claude-haiku-4-5", inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, latencyMs: 4,
      estimatedCostUsd: 0.5, outcome: "success" as const,
    };
    await expect(createSqlKnowledgeStore().recordGeneration(row)).resolves.toBe("g1");
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261002000038_knowledge.sql"), "utf8");
    for (const field of Object.keys(row)) expect(sql, field).toContain(`p_row->>'${field}'`);
    expect(mock.rpcCalls).toEqual([{ name: "ai_record_generation", args: { p_row: row } }]);
  });

  it("reads a ready entry on all seven key columns without writing", async () => {
    await expect(createSqlKnowledgeStore().readReady(KEY)).resolves.toEqual({ content: { a: 1 }, model: "m" });
    const eqs = Object.fromEntries((queries[0] ?? []).flatMap((c) => (c.op === "eq" ? [[c.column, c.value]] : [])));
    expect(eqs).toEqual({
      fingerprint: KEY.fingerprint, section: "lite", locale: "vi", context_key: "", schema_version: 1, generator_version: 2,
      content_variant: "full", status: "ready",
    });
    expect((queries[0] ?? []).some((c) => ["insert", "upsert", "update", "delete"].includes(c.op))).toBe(false);
    expect(mock.rpcCalls).toEqual([]);
  });
});
