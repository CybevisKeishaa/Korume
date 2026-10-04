import { z } from "zod/v4";
import { AiError } from "@/lib/ai/errors";
import type { AiProvider, SystemBlock } from "@/lib/ai/port";
import { retryAfterFor } from "./backoff";
import type { KnowledgeConfig } from "./config";
import { creditsFor, estimateCostUsd, upperBoundCostUsd } from "./pricing";
import type { ClaimResult, GenerationRow, KnowledgeStore, ReserveInput, ReserveLimits, ReserveOutcome } from "./types";

/** A leader whose provider call outlives this is presumed dead; the next caller takes over (spec §5.3 step 3). */
export const LEASE_SECONDS = 90;
/** Outlives the lease, so a live leader never loses its hold; an abandoned hold frees itself. */
export const RESERVATION_TTL_SECONDS = 180;
export const FOLLOWER_RETRY_MS = 1500;

/** The lease half of the migration 038 contract, for any table that runs its state machine. */
export interface LeaseStore<K> {
  claimLease(key: K, leaseSeconds: number): Promise<ClaimResult>;
  /** A ready entry's content, or null. Never writes. */
  readReady(key: K): Promise<{ content: unknown; model: string | null } | null>;
  complete(entryId: string, leaseToken: string, content: unknown, model: string, provider: string): Promise<boolean>;
  fail(entryId: string, leaseToken: string, errorCode: string, retryAfter: Date): Promise<boolean>;
}

/** The money half: the shared AI ledger, whatever table the entry lives in. */
export type BudgetStore = Pick<KnowledgeStore, "reserve" | "recordGeneration" | "settle" | "release">;

export interface LeasedGeneration<K, T> {
  leases: LeaseStore<K>;
  budget: BudgetStore;
  key: K;
  section: GenerationRow["section"];
  /** True when the claimed entry is a knowledge_entries row (ai_generations.knowledge_entry_id references it). */
  knowledgeEntry: boolean;
  billing: {
    scope: "learner" | "system";
    userId: string | null;
    entitlementKind: ReserveInput["entitlementKind"];
    chargesCredits: boolean;
  };
  reserveFingerprint: string;
  prompt: { system: SystemBlock[]; user: string };
  schema: z.ZodType<unknown>;
  maxTokens: number;
  /** Pure validation of the provider's parsed output. Any throw is a validation error (paid, retried with backoff). */
  finalize(parsed: unknown): T;
  provider: () => AiProvider;
  config: () => KnowledgeConfig;
  now: Date;
}

export type LeasedOutcome =
  | { status: "ready"; content: unknown; model: string | null }
  | { status: "pending"; retryAfterMs: number }
  | { status: "backoff"; retryAfter: string }
  | { status: "refused"; outcome: ReserveOutcome; resetsAt: string | null }
  | { status: "provider_error"; retryAfter: string }
  | { status: "validation_error"; retryAfter: string };

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

function limitsOf(config: KnowledgeConfig): ReserveLimits {
  return {
    globalUsdPerDay: config.globalBudgetUsdPerDay,
    freeSentencesPerDay: config.freeSentencesPerDay,
    plusMaxSectionsPerDay: config.plusMaxSectionsPerDay,
    plusCreditsPerMonth: config.plusCreditsPerMonth,
    askKorumeFreeTurnsPerDay: config.askKorumeFreeTurnsPerDay,
    askKorumePlusTurnsPerDay: config.askKorumePlusTurnsPerDay,
    systemGenerationsPerUserPerDay: config.systemGenerationsPerUserPerDay,
  };
}

/** §5.3 of the 1b spec, for any leased entry: exactly one caller generates, and it reserves before it spends. */
export async function runLeasedGeneration<K, T>(job: LeasedGeneration<K, T>): Promise<LeasedOutcome> {
  const claim = await job.leases.claimLease(job.key, LEASE_SECONDS);
  if (claim.outcome === "ready") return { status: "ready", content: claim.content, model: claim.model };
  if (claim.outcome === "follower") return { status: "pending", retryAfterMs: FOLLOWER_RETRY_MS };
  if (claim.outcome === "backoff") return { status: "backoff", retryAfter: claim.retryAfter };

  const provider = job.provider();
  const config = job.config();
  const upperUsd = upperBoundCostUsd(provider.name, inputTokenUpperBound(job.prompt.system, job.prompt.user), job.maxTokens);
  const reservation = await job.budget.reserve({
    requestedBy: job.billing.userId,
    billingScope: job.billing.scope,
    entitlementKind: job.billing.entitlementKind,
    fingerprint: job.reserveFingerprint,
    reservedCredits: job.billing.chargesCredits ? creditsFor(upperUsd, config.creditUsdUnit) : 0,
    reservedUsd: upperUsd,
    limits: limitsOf(config),
    ttlSeconds: RESERVATION_TTL_SECONDS,
  });
  if (!reservation.reservationId) {
    // Refused before any spend: free the lease so the entry is retryable at once (spec §5.3 step 4).
    await job.leases.fail(claim.entryId, claim.leaseToken, reservation.outcome, job.now);
    return { status: "refused", outcome: reservation.outcome, resetsAt: reservation.resetsAt };
  }

  const generation = {
    requestedByUserId: job.billing.userId,
    billingScope: job.billing.scope,
    knowledgeEntryId: job.knowledgeEntry ? claim.entryId : null,
    reservationId: reservation.reservationId,
    section: job.section,
    provider: provider.name,
  };
  const failLease = async (outcome: "provider_error" | "validation_error") => {
    const until = retryAfterFor(claim.attempts, job.now);
    await job.leases.fail(claim.entryId, claim.leaseToken, outcome, until);
    return { status: outcome, retryAfter: until.toISOString() } as const;
  };
  const started = Date.now();
  let result: Awaited<ReturnType<AiProvider["generateStructured"]>>;
  try {
    result = await provider.generateStructured(
      { tier: "fast", system: job.prompt.system, messages: [{ role: "user", content: job.prompt.user }], maxTokens: job.maxTokens, reasoning: false },
      job.schema,
    );
  } catch (error) {
    // A schema failure was a paid call whose usage the adapter cannot report: count the upper bound as spent.
    const validation = isValidationError(error);
    const spentUsd = validation ? upperUsd : 0;
    const outcome = validation ? "validation_error" : "provider_error";
    await job.budget.recordGeneration({
      ...generation, model: "unknown", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
      latencyMs: Date.now() - started, estimatedCostUsd: spentUsd, outcome,
    });
    await job.budget.release(reservation.reservationId, spentUsd);
    return failLease(outcome);
  }

  const costUsd = result.usage ? estimateCostUsd(result.model, result.usage) : upperUsd;
  const usage = {
    model: result.model,
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
    cacheReadTokens: result.usage?.cacheReadTokens ?? 0,
    latencyMs: Date.now() - started,
    estimatedCostUsd: costUsd,
  };
  let content: T;
  try {
    content = job.finalize(result.parsed);
  } catch {
    // Parsed but semantically invalid (e.g. an id outside the candidate pool): paid, not charged, retried later.
    await job.budget.recordGeneration({ ...generation, ...usage, outcome: "validation_error" });
    await job.budget.release(reservation.reservationId, costUsd);
    return failLease("validation_error");
  }

  const generationId = await job.budget.recordGeneration({ ...generation, ...usage, outcome: "success" });
  if (await job.leases.complete(claim.entryId, claim.leaseToken, content, result.model, provider.name)) {
    await job.budget.settle(reservation.reservationId, generationId, creditsFor(costUsd, config.creditUsdUnit), costUsd);
    return { status: "ready", content, model: result.model };
  }
  // Stale leader: another caller took the lease and owns the entry. The money is spent; nobody is charged.
  await job.budget.release(reservation.reservationId, costUsd);
  const winner = await job.leases.readReady(job.key);
  return winner
    ? { status: "ready", content: winner.content, model: winner.model }
    : { status: "pending", retryAfterMs: FOLLOWER_RETRY_MS };
}
