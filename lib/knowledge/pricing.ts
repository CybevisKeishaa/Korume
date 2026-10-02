import type { AiProviderName } from "@/lib/ai/env";

export interface ModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
}

/** USD per million tokens, read 2026-10-02 (claude-api skill, cached 2026-09-25). */
const CLAUDE_HAIKU_4_5: ModelPrice = { inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.1 };
/** Gemini runs only outside production, on its free tier (lib/ai/env.ts forbids it in production). */
const GEMINI_FREE_TIER: ModelPrice = { inputPerMTok: 0, outputPerMTok: 0, cacheReadPerMTok: 0 };

const MODEL_PRICES: Record<string, ModelPrice> = {
  "claude-haiku-4-5-20251001": CLAUDE_HAIKU_4_5,
  "claude-haiku-4-5": CLAUDE_HAIKU_4_5,
};

/**
 * The model a provider's `fast` tier resolves to, for the upper bound reserved BEFORE the call (the port
 * reveals the model only in the result). Must follow `lib/ai/providers/anthropic.ts` MODEL_BY_TIER.fast.
 */
const FAST_TIER_PRICE: Partial<Record<AiProviderName, ModelPrice>> = {
  anthropic: CLAUDE_HAIKU_4_5,
  gemini: GEMINI_FREE_TIER,
};

function priceFor(model: string): ModelPrice {
  const price = MODEL_PRICES[model] ?? (model.startsWith("gemini-") ? GEMINI_FREE_TIER : undefined);
  if (!price) throw new Error(`no price for model ${model}: add it to lib/knowledge/pricing.ts`);
  return price;
}

export function estimateCostUsd(
  model: string,
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number },
): number {
  const price = priceFor(model);
  return (
    (usage.inputTokens * price.inputPerMTok + usage.outputTokens * price.outputPerMTok + usage.cacheReadTokens * price.cacheReadPerMTok) /
    1_000_000
  );
}

/** Every input token uncached and the full output budget spent: what a reservation must hold. */
export function upperBoundCostUsd(provider: AiProviderName, inputTokens: number, maxOutputTokens: number): number {
  const price = FAST_TIER_PRICE[provider];
  if (!price) throw new Error(`no price for provider ${provider}`);
  return (inputTokens * price.inputPerMTok + maxOutputTokens * price.outputPerMTok) / 1_000_000;
}

/** credits = ceil(cost / unit); any paid call costs at least one credit. */
export function creditsFor(costUsd: number, creditUsdUnit: number): number {
  if (costUsd <= 0) return 0;
  // Round away float noise first: 0.0045 / 0.001 is 4.499999… in binary.
  return Math.max(1, Math.ceil(Number((costUsd / creditUsdUnit).toFixed(9))));
}
