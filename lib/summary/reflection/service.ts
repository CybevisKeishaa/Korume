import "server-only";
import type { AiProvider } from "@/lib/ai/port";
import { getProvider, isAiEnabled } from "@/lib/ai/registry";
import { readKnowledgeConfig, type KnowledgeConfig } from "@/lib/knowledge/config";
import { FOLLOWER_RETRY_MS, runLeasedGeneration, type BudgetStore } from "@/lib/knowledge/leased";
import { createSqlKnowledgeStore } from "@/lib/knowledge/store";
import type { KnowledgeLocale } from "@/lib/knowledge/types";
import { rateLimit } from "@/lib/rate-limit";
import { analysisStatusForReflection } from "../analysis/service";
import { authenticateSummary, loadLessonSummary } from "../load-snapshot";
import { evidenceFingerprint, isEmptyEvidence, projectEvidence } from "./evidence";
import { buildReflectionInput } from "./prompt";
import { finalizeReflection, LESSON_REFLECTION, reflectionAiSchema, storedReflectionSchema } from "./schema";
import { createSqlReflectionStore, type ReflectionKey, type ReflectionStore } from "./store";
import type { ReflectionResponse, ReflectionView } from "./view";

const READ_LIMIT = { limit: 60, windowMs: 60_000 };
const GENERATE_LIMIT = { limit: 10, windowMs: 60_000 };

export interface ReflectionDeps {
  reflections?: (userId: string) => ReflectionStore;
  budget?: BudgetStore;
  provider?: AiProvider;
  config?: KnowledgeConfig;
  aiEnabled?: boolean;
  now?: Date;
  authenticate?: typeof authenticateSummary;
  loadSummary?: typeof loadLessonSummary;
  analysisStatus?: typeof analysisStatusForReflection;
}

/**
 * Spec §5.2–§5.4. The order of the checks is the contract: no evidence → fallback, no usable analysis → fallback,
 * analysis not there yet → pending, then the exact identity (ready / pending / backoff), and only then a stale row
 * (read) or a generation (generate). A stale row is never reported as ready.
 */
export async function requestLessonReflection(
  videoId: string,
  locale: KnowledgeLocale,
  mode: "read" | "generate",
  deps: ReflectionDeps = {},
): Promise<
  | { kind: "unauthorized" }
  | { kind: "not_found" }
  | { kind: "rate_limited"; retryAfter: number }
  | { kind: "ok"; body: ReflectionResponse }
> {
  const ok = (body: ReflectionResponse) => ({ kind: "ok" as const, body });
  const auth = await (deps.authenticate ?? authenticateSummary)();
  if (!auth) return { kind: "unauthorized" };
  const { userId } = auth;
  const now = deps.now ?? new Date();
  const limited = rateLimit(`summary:reflection:${mode}:${userId}`, mode === "read" ? READ_LIMIT : GENERATE_LIMIT, now.getTime());
  if (!limited.ok) return { kind: "rate_limited", retryAfter: limited.retryAfter };
  const summary = await (deps.loadSummary ?? loadLessonSummary)(videoId, auth);
  if (!summary.ok) return summary.status === 401 ? { kind: "unauthorized" } : { kind: "not_found" };
  const { snapshot, video, lines, analyses } = summary.data;

  const store = (deps.reflections ?? createSqlReflectionStore)(userId);
  const toView = (content: unknown, at: string): ReflectionView => ({ ...storedReflectionSchema.parse(content), generatedAt: at });
  const latest = async () => {
    const row = await store.latestReady(videoId, locale);
    return row ? toView(row.content, row.updatedAt) : null;
  };

  const evidence = projectEvidence(snapshot);
  if (isEmptyEvidence(evidence)) return ok({ state: "fallback", reason: "no_evidence" });
  const analysis = await (deps.analysisStatus ?? analysisStatusForReflection)(videoId, locale, { supabase: auth.supabase, lines, analyses });
  if (analysis.kind === "unusable") return ok({ state: "fallback", reason: "analysis_unusable" });
  if (analysis.kind !== "ready") return ok({ state: "pending", retryAfterMs: FOLLOWER_RETRY_MS, reflection: await latest() });

  const key: ReflectionKey = {
    videoId,
    locale,
    analysisFingerprint: analysis.fingerprint,
    evidenceFingerprint: evidenceFingerprint(evidence),
    schemaVersion: LESSON_REFLECTION.schemaVersion,
    generatorVersion: LESSON_REFLECTION.generatorVersion,
  };
  const current = await store.entry(key);
  if (current?.status === "ready") return ok({ state: "ready", reflection: toView(current.content, current.updatedAt) });
  if (current?.status === "pending" && current.leaseUntil && new Date(current.leaseUntil) > now) {
    return ok({ state: "pending", retryAfterMs: FOLLOWER_RETRY_MS, reflection: await latest() });
  }
  if (current?.status === "failed" && current.retryAfter && new Date(current.retryAfter) > now) {
    return ok({ state: "fallback", reason: "backoff", retryAfter: new Date(current.retryAfter).toISOString() });
  }
  if (mode === "read") {
    const stale = await latest();
    return ok(stale ? { state: "stale", stale: true, reflection: stale } : { state: "not_found" });
  }
  if (!(deps.aiEnabled ?? isAiEnabled())) return ok({ state: "fallback", reason: "unavailable" });

  const prompt = buildReflectionInput(evidence, analysis.view, video.title, locale);
  const outcome = await runLeasedGeneration({
    leases: store,
    budget: deps.budget ?? createSqlKnowledgeStore(),
    key,
    section: "lesson_reflection",
    knowledgeEntry: false,
    billing: { scope: "system", userId, entitlementKind: null, chargesCredits: false },
    reserveFingerprint: key.evidenceFingerprint,
    prompt: { system: prompt.system, user: prompt.user },
    schema: reflectionAiSchema,
    maxTokens: LESSON_REFLECTION.maxOutputTokens,
    finalize: (parsed) => finalizeReflection(parsed, prompt.lines),
    provider: () => deps.provider ?? getProvider(),
    config: () => deps.config ?? readKnowledgeConfig(),
    now,
  });
  switch (outcome.status) {
    case "ready": return ok({ state: "ready", reflection: toView(outcome.content, now.toISOString()) });
    case "pending": return ok({ state: "pending", retryAfterMs: outcome.retryAfterMs, reflection: await latest() });
    case "refused": return ok({ state: "fallback", reason: "unavailable" });
    default: return ok({ state: "fallback", reason: "backoff", retryAfter: outcome.retryAfter });
  }
}
