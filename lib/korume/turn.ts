import "server-only";
import { z } from "zod/v4";
import { AiError } from "@/lib/ai/errors";
import { getProvider, isAiEnabled } from "@/lib/ai/registry";
import type { AiProvider, SystemBlock } from "@/lib/ai/port";
import type { createClient } from "@/lib/supabase/server";
import { getActivePlanTier } from "@/lib/data/subscriptions";
import { readKnowledgeConfig, type KnowledgeConfig } from "@/lib/knowledge/config";
import { creditsFor, estimateCostUsd, upperBoundCostUsdForTier } from "@/lib/knowledge/pricing";
import { createSqlKnowledgeStore } from "@/lib/knowledge/store";
import type { GenerationRow, KnowledgeLocale, KnowledgeStore, PlanTier } from "@/lib/knowledge/types";
import { answerToPlainText, answerV1Schema, dropUngroundedCards } from "./answer";
import { buildGroundedEntities } from "./grounding";
import { MAX_RECENT_TURNS, TURN_RESERVATION_TTL_SECONDS } from "./limits";
import { toMessageView } from "./messages";
import { fallbackPlan, planSchema, validatePlan, type PlanStep } from "./plan";
import { answerInputBytesUpperBound, answerPrompt, plannerPrompt, type PromptAnchor, type RecentTurn } from "./prompts";
import { DEFAULT_TOOLS, runRetrieval, type Tool, type ToolName } from "./retrieval";
import { sqlKorumeStore, type KorumeStore, type MessageRow } from "./store";
import { normalizeTurnText, threadTitle } from "./text";
import type { ExposureData } from "./tools/exposure";
import type { KorumeMessageView } from "./types";

type Supabase = ReturnType<typeof createClient>;

export const PLAN_MAX_TOKENS = 512;
export const ANSWER_MAX_TOKENS = 2_048;
const RECENT_TEXT_MAX = 600;

export type TurnOutcome =
  | { status: "answered"; message: KorumeMessageView }
  | { status: "pending" }
  | { status: "conflict" }
  | { status: "quota_exhausted"; reason: "free_daily_limit"; limit: number; resetsAt: string }
  | { status: "quota_exhausted"; reason: "plus_credits_exhausted"; resetsAt: string }
  | { status: "fuse_tripped"; resetsAt: string }
  | { status: "ai_unavailable"; reason: "disabled" | "budget" }
  | { status: "answer_failed" };

export interface TurnInput { supabase: Supabase; userId: string; threadId: string; turnId: string; text: string; locale: KnowledgeLocale }

export interface TurnDeps {
  korume?: KorumeStore;
  knowledge?: KnowledgeStore;
  provider?: AiProvider;
  config?: KnowledgeConfig;
  aiEnabled?: boolean;
  tier?: PlanTier;
  tools?: Partial<Record<ToolName, Tool>>;
  clock?: { toolMs: number; stageMs: number };
}

const bytes = (system: SystemBlock[], user: string) =>
  [...system.map((b) => b.text), user].reduce((sum, t) => sum + Buffer.byteLength(t, "utf8"), 0);

function isValidationError(error: unknown): boolean {
  return error instanceof z.ZodError || (error instanceof AiError && error.kind === "invalid_output");
}

const clip = (s: string) => (s.length > RECENT_TEXT_MAX ? `${s.slice(0, RECENT_TEXT_MAX)}…` : s);

/** The last completed exchanges before this turn, oldest first, for both prompts. */
function recentTurns(rows: MessageRow[], turnId: string): RecentTurn[] {
  const answers = new Map(rows.filter((m) => m.role === "ai" && m.turnId).map((m) => [m.turnId as string, m.content]));
  return rows
    .filter((m) => m.role === "user" && m.turnId && m.turnId !== turnId && answers.has(m.turnId))
    .slice(-MAX_RECENT_TURNS)
    .map((m) => ({ question: clip(m.content), answer: clip(answers.get(m.turnId as string) as string) }));
}

/** Spec §5.1 idempotency: a different question under a known turn id is a conflict; an answered turn replays. */
function settledTurn(rows: MessageRow[], turnId: string, text: string): TurnOutcome | null {
  const user = rows.find((m) => m.role === "user" && m.turnId === turnId);
  if (user && normalizeTurnText(user.content) !== text) return { status: "conflict" };
  const answer = rows.find((m) => m.role === "ai" && m.turnId === turnId);
  return answer ? { status: "answered", message: toMessageView(answer) } : null;
}

/**
 * One Ask Korume turn (spec §5): idempotency → one reservation → fast planner → validated, allowlisted retrieval
 * → deep answer → one SQL transaction that stores the answer with its grounding and settles. A failure after the
 * reservation releases it with what was actually spent: the money counts against the global budget, the learner
 * is not charged.
 */
export async function runTurn(input: TurnInput, deps: TurnDeps = {}): Promise<TurnOutcome | { status: "not_found" }> {
  const korume = deps.korume ?? sqlKorumeStore;
  const { supabase, userId, threadId, turnId } = input;
  const text = normalizeTurnText(input.text);

  const thread = await korume.readThreadRow(supabase, threadId);
  if (!thread || thread.kind !== "ask_korume") return { status: "not_found" };
  const rows = await korume.readMessages(supabase, threadId);
  const known = settledTurn(rows, turnId, text);
  if (known) return known;
  if (!(deps.aiEnabled ?? isAiEnabled())) return { status: "ai_unavailable", reason: "disabled" };

  const knowledge = deps.knowledge ?? createSqlKnowledgeStore();
  const provider = deps.provider ?? getProvider();
  const config = deps.config ?? readKnowledgeConfig();
  const tier = deps.tier ?? await getActivePlanTier(userId);

  const anchorLine = thread.originLineId ? (await korume.readAnchorLines(supabase, [thread.originLineId])).get(thread.originLineId) : undefined;
  const anchor = anchorLine && anchorLine.videoId === thread.originVideoId ? anchorLine : null;
  const promptAnchor: PromptAnchor | null = anchor ? { lineText: anchor.lineText, videoTitle: anchor.videoTitle } : null;
  const recent = recentTurns(rows, turnId);

  const planner = plannerPrompt({ question: text, anchor: promptAnchor, recent });
  const planUpper = upperBoundCostUsdForTier(provider.name, "fast", bytes(planner.system, planner.user), PLAN_MAX_TOKENS);
  const answerUpper = upperBoundCostUsdForTier(provider.name, "deep", answerInputBytesUpperBound(), ANSWER_MAX_TOKENS);
  const upperUsd = planUpper + answerUpper;

  const reservation = await knowledge.reserve({
    requestedBy: userId,
    billingScope: "learner",
    entitlementKind: tier === "free" ? "korume_free_turn" : "korume_plus_turn",
    fingerprint: `korume:${turnId}`,
    turnId,
    reservedCredits: tier === "plus" ? creditsFor(upperUsd, config.creditUsdUnit) : 0,
    reservedUsd: upperUsd,
    limits: {
      globalUsdPerDay: config.globalBudgetUsdPerDay,
      freeSentencesPerDay: config.freeSentencesPerDay,
      plusMaxSectionsPerDay: config.plusMaxSectionsPerDay,
      plusCreditsPerMonth: config.plusCreditsPerMonth,
      askKorumeFreeTurnsPerDay: config.askKorumeFreeTurnsPerDay,
      askKorumePlusTurnsPerDay: config.askKorumePlusTurnsPerDay,
    },
    ttlSeconds: TURN_RESERVATION_TTL_SECONDS,
  });
  const resetsAt = reservation.resetsAt ?? new Date().toISOString();
  switch (reservation.outcome) {
    case "reserved": break;
    case "turn_exists": {
      // Another request owns this turn id. Its answer, if already stored, is the answer; otherwise poll.
      const replay = settledTurn(await korume.readMessages(supabase, threadId), turnId, text);
      return replay ?? { status: "pending" };
    }
    case "quota_exhausted": return { status: "quota_exhausted", reason: "free_daily_limit", limit: config.askKorumeFreeTurnsPerDay, resetsAt };
    case "credits_exhausted": return { status: "quota_exhausted", reason: "plus_credits_exhausted", resetsAt };
    case "fuse_tripped": return { status: "fuse_tripped", resetsAt };
    case "budget_exhausted": return { status: "ai_unavailable", reason: "budget" };
    case "already_charged": throw new Error("ai_reserve answered already_charged for a Korume turn");
  }
  const reservationId = reservation.reservationId;
  if (!reservationId) throw new Error("ai_reserve reserved without a reservation id");

  let spentUsd = 0;
  try {
    await korume.insertUserMessage(threadId, turnId, text);
    const generation = {
      requestedByUserId: userId, billingScope: "learner", knowledgeEntryId: null, reservationId, turnId, provider: provider.name,
    } satisfies Partial<GenerationRow>;

    // Stage 1: the planner. Its failure never fails the turn — retrieval falls back to the anchor.
    let steps: PlanStep[];
    let started = Date.now();
    try {
      const plan = await provider.generateStructured(
        { tier: "fast", system: planner.system, messages: [{ role: "user", content: planner.user }], maxTokens: PLAN_MAX_TOKENS, reasoning: false },
        planSchema,
      );
      const cost = plan.usage ? estimateCostUsd(plan.model, plan.usage) : planUpper;
      spentUsd += cost;
      await knowledge.recordGeneration({
        ...generation, section: "korume_plan", model: plan.model, inputTokens: plan.usage?.inputTokens ?? 0,
        outputTokens: plan.usage?.outputTokens ?? 0, cacheReadTokens: plan.usage?.cacheReadTokens ?? 0,
        latencyMs: Date.now() - started, estimatedCostUsd: cost, outcome: "success",
      });
      steps = validatePlan(plan.parsed, { hasAnchor: anchor !== null });
    } catch (error) {
      const validation = isValidationError(error);
      const cost = validation ? planUpper : 0;
      spentUsd += cost;
      await knowledge.recordGeneration({
        ...generation, section: "korume_plan", model: "unknown", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
        latencyMs: Date.now() - started, estimatedCostUsd: cost, outcome: validation ? "validation_error" : "provider_error",
      });
      steps = fallbackPlan({ hasAnchor: anchor !== null });
    }

    const results = await runRetrieval(steps, {
      supabase, userId, tier, locale: input.locale,
      anchor: anchor ? { lineId: anchor.lineId, videoId: anchor.videoId, lineText: anchor.lineText, videoTitle: anchor.videoTitle } : null,
    }, deps.tools ?? DEFAULT_TOOLS, deps.clock);
    const linkVideos = results.flatMap((r) => {
      const first = r.tool === "learner_exposure" && r.status === "ok" ? (r.data as ExposureData).firstSeen : undefined;
      return first ? [first.videoId] : [];
    });
    const readable = await korume.readableVideoIds(supabase, [...new Set(linkVideos)]);
    if (anchor) readable.add(anchor.videoId);
    const grounding = buildGroundedEntities(results, readable);

    // Stage 2: the answer. Its failure fails the turn and releases the hold.
    const prompt = answerPrompt({
      question: text, locale: input.locale, anchor: promptAnchor, recent,
      retrieval: results.map(({ tool, status, data, errorCode }) => ({ tool, status, data, errorCode })),
      entities: grounding.map(({ id, label, kind }) => ({ id, label, kind })),
    });
    started = Date.now();
    let answered;
    try {
      answered = await provider.generateStructured(
        { tier: "deep", system: prompt.system, messages: [{ role: "user", content: prompt.user }], maxTokens: ANSWER_MAX_TOKENS, reasoning: false },
        answerV1Schema,
      );
    } catch (error) {
      const validation = isValidationError(error);
      const cost = validation ? answerUpper : 0;
      spentUsd += cost;
      await knowledge.recordGeneration({
        ...generation, section: "korume_answer", model: "unknown", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
        latencyMs: Date.now() - started, estimatedCostUsd: cost, outcome: validation ? "validation_error" : "provider_error",
      });
      await knowledge.release(reservationId, spentUsd);
      return { status: "answer_failed" };
    }
    const answerUsd = answered.usage ? estimateCostUsd(answered.model, answered.usage) : answerUpper;
    spentUsd += answerUsd;
    const answer = dropUngroundedCards(answered.parsed, grounding);
    const usable = answer.blocks.some((b) => b.type !== "followups");
    const generationId = await knowledge.recordGeneration({
      ...generation, section: "korume_answer", model: answered.model, inputTokens: answered.usage?.inputTokens ?? 0,
      outputTokens: answered.usage?.outputTokens ?? 0, cacheReadTokens: answered.usage?.cacheReadTokens ?? 0,
      latencyMs: Date.now() - started, estimatedCostUsd: answerUsd, outcome: usable ? "success" : "validation_error",
    });
    if (!usable) {
      // Nothing left to show once ungrounded cards are gone: a paid call, but not an answer.
      await knowledge.release(reservationId, spentUsd);
      return { status: "answer_failed" };
    }

    const content = answerToPlainText(answer, grounding);
    const done = await korume.completeTurn({
      sessionId: threadId, turnId, reservationId, generationId,
      credits: tier === "plus" ? creditsFor(spentUsd, config.creditUsdUnit) : 0,
      usd: spentUsd, content, contentJson: answer, groundingJson: grounding, title: threadTitle(text),
    });
    return {
      status: "answered",
      message: { id: done.messageId, turnId, role: "assistant", text: content, answer, grounding, createdAt: new Date().toISOString() },
    };
  } catch (error) {
    // Anything unexpected after the hold: give it back with what was spent, then let the route answer 500.
    await knowledge.release(reservationId, spentUsd).catch(() => false);
    throw error;
  }
}
