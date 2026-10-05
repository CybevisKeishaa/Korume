import "server-only";
import type { LeaseStore } from "@/lib/knowledge/leased";
import type { ClaimResult, KnowledgeLocale } from "@/lib/knowledge/types";
import { createServiceClient } from "@/lib/supabase/service";

/** A reflection's identity besides its owner (spec §5.4): the user is fixed per store. */
export interface ReflectionKey {
  videoId: string;
  locale: KnowledgeLocale;
  analysisFingerprint: string;
  evidenceFingerprint: string;
  schemaVersion: number;
  generatorVersion: number;
}

export interface ReflectionRow {
  status: "pending" | "ready" | "failed";
  content: unknown;
  leaseUntil: string | null;
  retryAfter: string | null;
  updatedAt: string;
}

export interface ReflectionStore extends LeaseStore<ReflectionKey> {
  entry(key: ReflectionKey): Promise<ReflectionRow | null>;
  /** The newest READY row for this user + lesson + locale, whatever its identity. */
  latestReady(videoId: string, locale: KnowledgeLocale): Promise<{ content: unknown; updatedAt: string } | null>;
}

interface ClaimRow {
  entry_id: string;
  outcome: ClaimResult["outcome"];
  lease_token: string | null;
  content: unknown;
  retry_after: string | null;
  attempts: number;
  model: string | null;
}

/** Every lease call is one SECURITY DEFINER function of migration 043; the user id is the session's, never the client's. */
export function createSqlReflectionStore(userId: string): ReflectionStore {
  const supabase = createServiceClient();
  const byKey = (key: ReflectionKey) => supabase
    .from("lesson_reflections")
    .select("status, content, lease_until, retry_after, updated_at")
    .eq("user_id", userId)
    .eq("video_id", key.videoId)
    .eq("locale", key.locale)
    .eq("analysis_fingerprint", key.analysisFingerprint)
    .eq("evidence_fingerprint", key.evidenceFingerprint)
    .eq("schema_version", key.schemaVersion)
    .eq("generator_version", key.generatorVersion);
  return {
    async claimLease(key, leaseSeconds) {
      const { data, error } = await supabase.rpc("reflection_claim_lease", {
        p_user: userId, p_key: { ...key }, p_lease_seconds: leaseSeconds,
      });
      if (error) throw error;
      const row = (data as ClaimRow[] | null)?.[0];
      if (!row) throw new Error("reflection_claim_lease returned no row");
      switch (row.outcome) {
        case "ready": return { outcome: "ready", entryId: row.entry_id, content: row.content, model: row.model };
        case "leader": return { outcome: "leader", entryId: row.entry_id, leaseToken: row.lease_token ?? "", attempts: row.attempts };
        case "backoff": return { outcome: "backoff", entryId: row.entry_id, retryAfter: row.retry_after ?? "" };
        default: return { outcome: "follower", entryId: row.entry_id };
      }
    },
    async readReady(key) {
      const { data, error } = await byKey(key).eq("status", "ready").maybeSingle();
      if (error) throw error;
      return data ? { content: (data as { content: unknown }).content, model: null } : null;
    },
    async complete(entryId, leaseToken, content, model, provider) {
      const { data, error } = await supabase.rpc("reflection_complete", {
        p_entry: entryId, p_lease_token: leaseToken, p_content: content, p_model: model, p_provider: provider,
      });
      if (error) throw error;
      return data as boolean;
    },
    async fail(entryId, leaseToken, errorCode, retryAfter) {
      const { data, error } = await supabase.rpc("reflection_fail", {
        p_entry: entryId, p_lease_token: leaseToken, p_error_code: errorCode, p_retry_after: retryAfter.toISOString(),
      });
      if (error) throw error;
      return data as boolean;
    },
    async entry(key) {
      const { data, error } = await byKey(key).maybeSingle();
      if (error) throw error;
      const row = data as {
        status: ReflectionRow["status"]; content: unknown; lease_until: string | null; retry_after: string | null; updated_at: string;
      } | null;
      return row
        ? { status: row.status, content: row.content, leaseUntil: row.lease_until, retryAfter: row.retry_after, updatedAt: row.updated_at }
        : null;
    },
    async latestReady(videoId, locale) {
      const { data, error } = await supabase
        .from("lesson_reflections")
        .select("content, updated_at")
        .eq("user_id", userId)
        .eq("video_id", videoId)
        .eq("locale", locale)
        .eq("status", "ready")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const row = data as { content: unknown; updated_at: string } | null;
      return row ? { content: row.content, updatedAt: row.updated_at } : null;
    },
  };
}
