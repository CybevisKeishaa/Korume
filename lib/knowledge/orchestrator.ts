import { z } from "zod/v4";
import { AiError } from "@/lib/ai/errors";
import { getProvider, isAiEnabled } from "@/lib/ai/registry";
import type { AiProvider, SystemBlock } from "@/lib/ai/port";
import { retryAfterFor } from "./backoff";
import { fingerprint } from "./canonical";
import { readKnowledgeConfig, type KnowledgeConfig } from "./config";
import { creditsFor, estimateCostUsd, upperBoundCostUsd } from "./pricing";
import { createSqlKnowledgeStore } from "./store";
import type {
  KnowledgeKey,
  KnowledgeLocale,
  KnowledgeStore,
  PlanTier,
  SectionDefinition,
  SectionPromptInput,
} from "./types";

/** A leader whose provider call outlives this is presumed dead; the next caller takes over (spec §5.3 step 3). */
export const LEASE_SECONDS = 90;
/** Outlives the lease, so a live leader never loses its hold; an abandoned hold frees itself. */
const RESERVATION_TTL_SECONDS = 180;
const FOLLOWER_RETRY_MS = 1500;

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

/**
 * Every token is at least one UTF-8 byte, so the byte length bounds the input tokens from above —
 * whatever the tokenizer does with rare kanji. Overstates English ~4x, which only over-reserves.
 */
function inputTokenUpperBound(system: SystemBlock[], user: string): number {
  return [...system.map((block) => block.text), user].reduce((sum, text) => sum + Buffer.byteLength(text, "utf8"), 0);
}

function isValidationError(error: unknown): boolean {
  return error instanceof z.ZodError || (error instanceof AiError && error.kind === "invalid_output");
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

  const claim = await store.claimLease(key, LEASE_SECONDS);
  if (claim.outcome === "ready") return { status: "ready", content: claim.content, access, model: claim.model };
  if (claim.outcome === "follower") return { status: "pending", retryAfterMs: FOLLOWER_RETRY_MS };
  if (claim.outcome === "backoff") return { status: "ai_unavailable", reason: "backoff" };

  const provider = deps.provider ?? getProvider();
  const config = deps.config ?? readKnowledgeConfig();
  const schema = variant === "preview" ? definition.previewSchema : definition.schema;
  const maxTokens = variant === "preview" ? definition.maxOutputTokens.preview : definition.maxOutputTokens.full;
  if (!schema || !maxTokens) throw new Error(`section ${definition.section} has no ${variant} variant`);
  const prompt = definition.buildPrompt(input.promptInput, variant);
  const upperUsd = upperBoundCostUsd(provider.name, inputTokenUpperBound(prompt.system, prompt.user), maxTokens);
  const { billing } = input;

  const reservation = await store.reserve({
    requestedBy: billing.userId,
    billingScope: billing.scope,
    entitlementKind: billing.scope === "system" ? null : tier === "free" ? "free_sentence" : "plus_section",
    fingerprint: input.parentFingerprint,
    reservedCredits: tier === "plus" && billing.scope === "learner" ? creditsFor(upperUsd, config.creditUsdUnit) : 0,
    reservedUsd: upperUsd,
    limits: {
      globalUsdPerDay: config.globalBudgetUsdPerDay,
      freeSentencesPerDay: config.freeSentencesPerDay,
      plusMaxSectionsPerDay: config.plusMaxSectionsPerDay,
      plusCreditsPerMonth: config.plusCreditsPerMonth,
      askKorumeFreeTurnsPerDay: config.askKorumeFreeTurnsPerDay,
      askKorumePlusTurnsPerDay: config.askKorumePlusTurnsPerDay,
    },
    ttlSeconds: RESERVATION_TTL_SECONDS,
  });
  if (!reservation.reservationId) {
    // Refused before any spend: free the lease so the entry is retryable at once (spec §5.3 step 4).
    await store.fail(claim.entryId, claim.leaseToken, reservation.outcome, now);
    if (reservation.outcome === "budget_exhausted") return { status: "ai_unavailable", reason: "budget" };
    return { status: "quota_exhausted", resetsAt: reservation.resetsAt ?? now.toISOString() };
  }

  const generation = {
    requestedByUserId: billing.userId,
    billingScope: billing.scope,
    knowledgeEntryId: claim.entryId,
    reservationId: reservation.reservationId,
    section: definition.section,
    provider: provider.name,
  };
  const started = Date.now();
  let result: Awaited<ReturnType<AiProvider["generateStructured"]>>;
  try {
    result = await provider.generateStructured(
      { tier: "fast", system: prompt.system, messages: [{ role: "user", content: prompt.user }], maxTokens, reasoning: false },
      schema,
    );
  } catch (error) {
    // A schema failure was a paid call whose usage the adapter cannot report: count the upper bound as spent.
    const validation = isValidationError(error);
    const spentUsd = validation ? upperUsd : 0;
    const outcome = validation ? "validation_error" : "provider_error";
    await store.recordGeneration({
      ...generation, model: "unknown", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
      latencyMs: Date.now() - started, estimatedCostUsd: spentUsd, outcome,
    });
    await store.release(reservation.reservationId, spentUsd);
    await store.fail(claim.entryId, claim.leaseToken, outcome, retryAfterFor(claim.attempts, now));
    return { status: "ai_unavailable", reason: "provider" };
  }

  const costUsd = result.usage ? estimateCostUsd(result.model, result.usage) : upperUsd;
  const generationId = await store.recordGeneration({
    ...generation,
    model: result.model,
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
    cacheReadTokens: result.usage?.cacheReadTokens ?? 0,
    latencyMs: Date.now() - started,
    estimatedCostUsd: costUsd,
    outcome: "success",
  });
  if (await store.complete(claim.entryId, claim.leaseToken, result.parsed, result.model, provider.name)) {
    await store.settle(reservation.reservationId, generationId, creditsFor(costUsd, config.creditUsdUnit), costUsd);
    return { status: "ready", content: result.parsed, access, model: result.model };
  }
  // Stale leader: another caller took the lease and owns the entry. The money is spent; the learner is not charged.
  await store.release(reservation.reservationId, costUsd);
  const winner = await store.readReady(key);
  return winner
    ? { status: "ready", content: winner.content, access, model: winner.model }
    : { status: "pending", retryAfterMs: FOLLOWER_RETRY_MS };
}
