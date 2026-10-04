import "server-only";
import type { AiProvider } from "@/lib/ai/port";
import { getProvider, isAiEnabled } from "@/lib/ai/registry";
import { staticAnalyses } from "@/lib/analysis/line-analysis";
import { getTranscript } from "@/lib/data/transcripts";
import { requireUser, selectVideoById } from "@/lib/data/videos";
import { readKnowledgeConfig, type KnowledgeConfig } from "@/lib/knowledge/config";
import { FOLLOWER_RETRY_MS, runLeasedGeneration } from "@/lib/knowledge/leased";
import { createSqlKnowledgeStore } from "@/lib/knowledge/store";
import type { KnowledgeKey, KnowledgeLocale, KnowledgeStore } from "@/lib/knowledge/types";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { SummaryLine } from "../snapshot";
import { finalizeAnalysis } from "./finalize";
import { hydrateAnalysis } from "./hydrate";
import { analysisFingerprint, buildAnalysisInput, type AnalysisInput } from "./input";
import { buildAnalysisPrompt } from "./prompt";
import { analysisAiSchema, LESSON_ANALYSIS, storedAnalysisSchema } from "./schema";
import type { AnalysisResponse, LessonAnalysisView } from "./view";

const READ_LIMIT = { limit: 60, windowMs: 60_000 };
const GENERATE_LIMIT = { limit: 10, windowMs: 60_000 };

export interface AnalysisDeps {
  store?: KnowledgeStore;
  provider?: AiProvider;
  config?: KnowledgeConfig;
  aiEnabled?: boolean;
  now?: Date;
}

export type AnalysisStatus =
  | { kind: "ready"; fingerprint: string; view: LessonAnalysisView }
  | { kind: "pending" }
  | { kind: "unusable" }
  | { kind: "absent" };

type Context =
  | { kind: "unauthorized" }
  | { kind: "not_found" }
  | { kind: "no_transcript"; userId: string }
  | {
    kind: "ok";
    supabase: ReturnType<typeof createClient>;
    userId: string;
    title: string;
    lines: SummaryLine[];
    input: AnalysisInput;
    key: KnowledgeKey;
  };

/** Everything both callers need: the learner, the lesson, its candidates and the shared cache key (spec §4.1). */
async function loadContext(videoId: string, locale: KnowledgeLocale): Promise<Context> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { kind: "unauthorized" };
  const video = await selectVideoById(supabase, videoId);
  if (!video) return { kind: "not_found" };
  const transcript = await getTranscript(videoId);
  if (!transcript.ok) return transcript.status === 401 ? { kind: "unauthorized" } : { kind: "not_found" };
  const lines: SummaryLine[] = (transcript.data?.lines ?? [])
    .filter((line) => line.text_jp.trim() !== "")
    .map((line, index) => ({
      id: line.id, index, textJp: line.text_jp, translation: line.text_translation,
      startTime: line.start_time, endTime: line.end_time,
    }));
  if (lines.length === 0) return { kind: "no_transcript", userId: user.id };
  const analyses = await staticAnalyses(supabase, lines.map((line) => ({ id: line.id, textJp: line.textJp })), undefined, "full");
  const input = buildAnalysisInput(lines, analyses);
  const key: KnowledgeKey = {
    fingerprint: analysisFingerprint(input),
    section: LESSON_ANALYSIS.section,
    locale,
    contextKey: videoId,
    schemaVersion: LESSON_ANALYSIS.schemaVersion,
    generatorVersion: LESSON_ANALYSIS.generatorVersion,
    contentVariant: "full",
  };
  return { kind: "ok", supabase, userId: user.id, title: video.title, lines, input, key };
}

type EntryState =
  | { kind: "ready"; content: unknown }
  | { kind: "pending" }
  | { kind: "failed"; retryAfter: string }
  | { kind: "absent" };

/** The entry's lifecycle state, read-only (service role: knowledge_entries has no learner policy). */
async function readEntryState(key: KnowledgeKey, now: Date): Promise<EntryState> {
  const { data, error } = await createServiceClient()
    .from("knowledge_entries")
    .select("status, content, lease_until, retry_after")
    .eq("fingerprint", key.fingerprint)
    .eq("section", key.section)
    .eq("locale", key.locale)
    .eq("context_key", key.contextKey)
    .eq("schema_version", key.schemaVersion)
    .eq("generator_version", key.generatorVersion)
    .eq("content_variant", key.contentVariant)
    .maybeSingle();
  if (error) throw error;
  const row = data as { status: string; content: unknown; lease_until: string | null; retry_after: string | null } | null;
  if (!row) return { kind: "absent" };
  if (row.status === "ready") return { kind: "ready", content: row.content };
  if (row.status === "pending" && row.lease_until && new Date(row.lease_until) > now) return { kind: "pending" };
  if (row.status === "failed" && row.retry_after && new Date(row.retry_after) > now) {
    return { kind: "failed", retryAfter: new Date(row.retry_after).toISOString() };
  }
  return { kind: "absent" };
}

/**
 * Spec §4.2: `read` (GET) only ever reports the shared entry; `generate` (POST) runs the leased generation on the
 * system budget. Free = Plus: no plan tier is read anywhere on this path (R7).
 */
export async function requestLessonAnalysis(
  videoId: string,
  locale: KnowledgeLocale,
  mode: "read" | "generate",
  deps: AnalysisDeps = {},
): Promise<
  | { kind: "unauthorized" }
  | { kind: "not_found" }
  | { kind: "rate_limited"; retryAfter: number }
  | { kind: "ok"; body: AnalysisResponse }
> {
  const ok = (body: AnalysisResponse) => ({ kind: "ok" as const, body });
  const ctx = await loadContext(videoId, locale);
  if (ctx.kind === "unauthorized" || ctx.kind === "not_found") return ctx;

  const now = deps.now ?? new Date();
  const limited = rateLimit(
    `summary:analysis:${mode}:${ctx.userId}`,
    mode === "read" ? READ_LIMIT : GENERATE_LIMIT,
    now.getTime(),
  );
  if (!limited.ok) return { kind: "rate_limited", retryAfter: limited.retryAfter };
  if (ctx.kind === "no_transcript") return ok({ status: "no_transcript" });

  const aiEnabled = deps.aiEnabled ?? isAiEnabled();
  const ready = async (content: unknown): Promise<AnalysisResponse> => ({
    status: "ready",
    data: await hydrateAnalysis(ctx.supabase, storedAnalysisSchema.parse(content), ctx.lines),
  });

  if (mode === "read") {
    const state = await readEntryState(ctx.key, now);
    if (state.kind === "ready") return ok(await ready(state.content));
    if (state.kind === "pending") return ok({ status: "pending", retryAfterMs: FOLLOWER_RETRY_MS });
    if (state.kind === "failed") return ok({ status: "retryable_error", retryAfter: state.retryAfter });
    return ok(aiEnabled ? { status: "not_ready" } : { status: "unavailable" });
  }

  const store = deps.store ?? createSqlKnowledgeStore();
  if (!aiEnabled) {
    // The kill-switch reads without claiming: a disabled deployment writes nothing and still serves the cache.
    const hit = await store.readReady(ctx.key);
    return ok(hit ? await ready(hit.content) : { status: "unavailable" });
  }
  const outcome = await runLeasedGeneration({
    leases: store,
    budget: store,
    key: ctx.key,
    section: "lesson_analysis",
    knowledgeEntry: true,
    billing: { scope: "system", userId: ctx.userId, entitlementKind: null, chargesCredits: false },
    reserveFingerprint: ctx.key.fingerprint,
    prompt: buildAnalysisPrompt(ctx.input, locale, ctx.title),
    schema: analysisAiSchema,
    maxTokens: LESSON_ANALYSIS.maxOutputTokens,
    finalize: (parsed) => finalizeAnalysis(parsed, ctx.input),
    provider: () => deps.provider ?? getProvider(),
    config: () => deps.config ?? readKnowledgeConfig(),
    now,
  });
  switch (outcome.status) {
    case "ready": return ok(await ready(outcome.content));
    case "pending": return ok({ status: "pending", retryAfterMs: outcome.retryAfterMs });
    case "backoff": return ok({ status: "retryable_error", retryAfter: outcome.retryAfter });
    case "refused": return ok({ status: "unavailable" });
    default: return ok({ status: "retryable_error", retryAfter: outcome.retryAfter });
  }
}

/** Spec §5.3: what the reflection may build on. Never generates; auth was already answered by the caller. */
export async function analysisStatusForReflection(
  videoId: string,
  locale: KnowledgeLocale,
  deps: AnalysisDeps = {},
): Promise<AnalysisStatus> {
  const ctx = await loadContext(videoId, locale);
  if (ctx.kind !== "ok") return { kind: "unusable" };
  const state = await readEntryState(ctx.key, deps.now ?? new Date());
  if (state.kind === "ready") {
    const view = await hydrateAnalysis(ctx.supabase, storedAnalysisSchema.parse(state.content), ctx.lines);
    return { kind: "ready", fingerprint: ctx.key.fingerprint, view };
  }
  if (state.kind === "pending") return { kind: "pending" };
  if (state.kind === "failed") return { kind: "unusable" };
  return (deps.aiEnabled ?? isAiEnabled()) ? { kind: "absent" } : { kind: "unusable" };
}
