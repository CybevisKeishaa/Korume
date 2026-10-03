import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { cacheKeyJson } from "./cache-key";
import type { ClaimResult, KnowledgeStore, ReserveOutcome } from "./types";

interface ClaimRow {
  entry_id: string;
  outcome: ClaimResult["outcome"];
  lease_token: string | null;
  content: unknown;
  retry_after: string | null;
  attempts: number;
  model: string | null;
}

/** Every call is one security-definer function of migration 038; money decisions never happen in TypeScript. */
export function createSqlKnowledgeStore(): KnowledgeStore {
  const supabase = createServiceClient();

  async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;
    return data as T;
  }
  async function firstRow<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const [row] = await call<T[]>(name, args);
    if (!row) throw new Error(`${name} returned no row`);
    return row;
  }

  return {
    async claimLease(key, leaseSeconds) {
      const row = await firstRow<ClaimRow>("knowledge_claim_lease", { p_key: cacheKeyJson(key), p_lease_seconds: leaseSeconds });
      switch (row.outcome) {
        case "ready": return { outcome: "ready", entryId: row.entry_id, content: row.content, model: row.model };
        case "leader": return { outcome: "leader", entryId: row.entry_id, leaseToken: row.lease_token ?? "", attempts: row.attempts };
        case "backoff": return { outcome: "backoff", entryId: row.entry_id, retryAfter: row.retry_after ?? "" };
        default: return { outcome: "follower", entryId: row.entry_id };
      }
    },

    async readReady(key) {
      const { data, error } = await supabase
        .from("knowledge_entries")
        .select("content, model")
        .eq("fingerprint", key.fingerprint)
        .eq("section", key.section)
        .eq("locale", key.locale)
        .eq("context_key", key.contextKey)
        .eq("schema_version", key.schemaVersion)
        .eq("generator_version", key.generatorVersion)
        .eq("content_variant", key.contentVariant)
        .eq("status", "ready")
        .maybeSingle();
      if (error) throw error;
      const row = data as { content: unknown; model: string | null } | null;
      return row ? { content: row.content, model: row.model } : null;
    },

    complete: (entryId, leaseToken, content, model, provider) => call<boolean>("knowledge_complete", {
      p_entry: entryId, p_lease_token: leaseToken, p_content: content, p_model: model, p_provider: provider,
    }),

    fail: (entryId, leaseToken, errorCode, retryAfter) => call<boolean>("knowledge_fail", {
      p_entry: entryId, p_lease_token: leaseToken, p_error_code: errorCode, p_retry_after: retryAfter.toISOString(),
    }),

    async reserve(input) {
      const row = await firstRow<{ reservation_id: string | null; outcome: ReserveOutcome; resets_at: string | null }>("ai_reserve", {
        p_requested_by: input.requestedBy,
        p_billing_scope: input.billingScope,
        p_entitlement_kind: input.entitlementKind,
        p_fingerprint: input.fingerprint,
        p_reserved_credits: input.reservedCredits,
        p_reserved_usd: input.reservedUsd,
        p_limits: input.limits,
        p_ttl_seconds: input.ttlSeconds,
        p_turn_id: input.turnId ?? null,
      });
      return { outcome: row.outcome, reservationId: row.reservation_id, resetsAt: row.resets_at };
    },

    recordGeneration: (row) => call<string>("ai_record_generation", { p_row: row }),

    settle: (reservationId, generationId, actualCredits, actualUsd) => call<boolean>("ai_settle", {
      p_reservation: reservationId, p_generation: generationId, p_actual_credits: actualCredits, p_actual_usd: actualUsd,
    }),

    release: (reservationId, spentUsd) => call<boolean>("ai_release", { p_reservation: reservationId, p_spent_usd: spentUsd }),
  };
}
