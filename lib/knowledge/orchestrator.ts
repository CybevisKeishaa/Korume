import { getProvider, isAiEnabled } from "@/lib/ai/registry";
import type { AiProvider } from "@/lib/ai/port";
import { fingerprint } from "./canonical";
import { readKnowledgeConfig, type KnowledgeConfig } from "./config";
import { runLeasedGeneration } from "./leased";
import { createSqlKnowledgeStore } from "./store";
import type {
  KnowledgeKey,
  KnowledgeLocale,
  KnowledgeStore,
  PlanTier,
  SectionDefinition,
  SectionPromptInput,
} from "./types";

export { LEASE_SECONDS } from "./leased";

export type GenerateOutcome =
  | { status: "ready"; content: unknown; access: "full" | "preview"; model: string | null }
  | { status: "pending"; retryAfterMs: number }
  | { status: "quota_exhausted"; resetsAt: string }
  | { status: "ai_unavailable"; reason: "disabled" | "budget" | "provider" | "backoff" };

export interface GenerateInput {
  definition: SectionDefinition;
  locale: KnowledgeLocale;
  /** The text the entry is about (sentence, or the snapped phrase). */
  targetText: string;
  contextKey: string;
  /** The sentence a Free slot is charged against — a phrase's parent sentence (spec §5.3). */
  parentFingerprint: string;
  tier: PlanTier;
  billing: { scope: "learner"; userId: string } | { scope: "system"; userId: string | null };
  promptInput: SectionPromptInput;
  now?: Date;
}

export interface GenerateDeps {
  store?: KnowledgeStore;
  provider?: AiProvider;
  config?: KnowledgeConfig;
  aiEnabled?: boolean;
}

type ReadyOutcome = Extract<GenerateOutcome, { status: "ready" }>;
type CacheInput = Pick<GenerateInput, "definition" | "locale" | "targetText" | "contextKey" | "tier">;

/**
 * The key this learner reads, and — for Free on a locked section — the projection of a cached full entry.
 * Free never receives a full payload: a full entry leaves the server only as its projection (§5.4).
 */
async function resolveKey(input: CacheInput, store: KnowledgeStore): Promise<{ key: KnowledgeKey; projected: ReadyOutcome | null }> {
  const { definition } = input;
  const base: Omit<KnowledgeKey, "contentVariant"> = {
    fingerprint: fingerprint(input.targetText),
    section: definition.section,
    locale: input.locale,
    contextKey: input.contextKey,
    schemaVersion: definition.schemaVersion,
    generatorVersion: definition.generatorVersion,
  };
  const freePreview = input.tier === "free" && definition.access === "free_preview";
  if (freePreview) {
    const full = await store.readReady({ ...base, contentVariant: "full" });
    if (full) {
      return {
        key: { ...base, contentVariant: "full" },
        projected: { status: "ready", content: definition.projectPreview(full.content), access: "preview", model: full.model },
      };
    }
  }
  return { key: { ...base, contentVariant: freePreview ? "preview" : "full" }, projected: null };
}

/** A read-only cache lookup with the exact key a generation would use. Never claims, reserves or writes. */
export async function readCachedSection(input: CacheInput, deps: Pick<GenerateDeps, "store"> = {}): Promise<ReadyOutcome | null> {
  const store = deps.store ?? createSqlKnowledgeStore();
  const { key, projected } = await resolveKey(input, store);
  if (projected) return projected;
  const hit = await store.readReady(key);
  return hit ? { status: "ready", content: hit.content, access: key.contentVariant, model: hit.model } : null;
}

/** §5.3: read through the shared cache; on a miss exactly one caller generates, reserving before it spends. */
export async function getOrGenerateSection(input: GenerateInput, deps: GenerateDeps = {}): Promise<GenerateOutcome> {
  const { definition, tier } = input;
  const store = deps.store ?? createSqlKnowledgeStore();
  const now = input.now ?? new Date();

  // The kill-switch reads without claiming: a disabled deployment writes nothing and still serves the cache.
  if (!(deps.aiEnabled ?? isAiEnabled())) {
    return (await readCachedSection(input, { store })) ?? { status: "ai_unavailable", reason: "disabled" };
  }
  const { key, projected } = await resolveKey(input, store);
  if (projected) return projected;
  const variant = key.contentVariant;
  const access = variant;

  const schema = variant === "preview" ? definition.previewSchema : definition.schema;
  const maxTokens = variant === "preview" ? definition.maxOutputTokens.preview : definition.maxOutputTokens.full;
  if (!schema || !maxTokens) throw new Error(`section ${definition.section} has no ${variant} variant`);
  const { billing } = input;
  const outcome = await runLeasedGeneration({
    leases: store,
    budget: store,
    key,
    section: definition.section,
    knowledgeEntry: true,
    billing: {
      scope: billing.scope,
      userId: billing.userId,
      entitlementKind: billing.scope === "system" ? null : tier === "free" ? "free_sentence" : "plus_section",
      chargesCredits: tier === "plus" && billing.scope === "learner",
    },
    reserveFingerprint: input.parentFingerprint,
    prompt: definition.buildPrompt(input.promptInput, variant),
    schema,
    maxTokens,
    finalize: (parsed) => parsed,
    provider: () => deps.provider ?? getProvider(),
    config: () => deps.config ?? readKnowledgeConfig(),
    now,
  });
  switch (outcome.status) {
    case "ready":
      return { status: "ready", content: outcome.content, access, model: outcome.model };
    case "pending":
      return { status: "pending", retryAfterMs: outcome.retryAfterMs };
    case "backoff":
      return { status: "ai_unavailable", reason: "backoff" };
    case "refused":
      return outcome.outcome === "budget_exhausted"
        ? { status: "ai_unavailable", reason: "budget" }
        : { status: "quota_exhausted", resetsAt: outcome.resetsAt ?? now.toISOString() };
    default:
      return { status: "ai_unavailable", reason: "provider" };
  }
}
