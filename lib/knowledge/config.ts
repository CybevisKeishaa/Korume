import { z } from "zod";
import type { EnvCheckResult, EnvSource, EnvSpec } from "@/lib/env/validate";

export interface KnowledgeConfig {
  freeSentencesPerDay: number;
  plusCreditsPerMonth: number;
  plusMaxSectionsPerDay: number;
  globalBudgetUsdPerDay: number;
  creditUsdUnit: number;
}

const count = z.coerce.number().int().nonnegative();
const usd = z.coerce.number().positive();

/** Server-only Knowledge Economy limits (spec §4.3). Defaults outside production; production must set them. */
export const knowledgeEnvSchema = z.object({
  APP_ENV: z.enum(["dev", "staging", "production"]),
  AI_PROVIDER: z.enum(["none", "anthropic", "gemini"]),
  AI_FREE_SENTENCES_PER_DAY: count.default(3),
  AI_PLUS_CREDITS_PER_MONTH: count.optional(),
  AI_PLUS_MAX_SECTIONS_PER_DAY: count.default(200),
  AI_GLOBAL_BUDGET_USD_PER_DAY: usd.default(5),
  AI_CREDIT_USD_UNIT: usd.optional(),
});
type KnowledgeEnv = z.infer<typeof knowledgeEnvSchema>;

const DEV_PLUS_CREDITS_PER_MONTH = 1000;
const DEV_CREDIT_USD_UNIT = 0.001;

export const knowledgeEnvSpec: EnvSpec<KnowledgeEnv> = {
  name: "knowledge",
  // EnvSpec types input as output; the .default() fields make the input optional.
  schema: knowledgeEnvSchema as z.ZodType<KnowledgeEnv>,
  check(env): EnvCheckResult {
    if (env.AI_PROVIDER === "none") return {};
    const missing = (["AI_PLUS_CREDITS_PER_MONTH", "AI_CREDIT_USD_UNIT"] as const).filter((name) => env[name] === undefined);
    if (missing.length === 0) return {};
    if (env.APP_ENV === "production") {
      return { errors: missing.map((name) => `${name} is required when AI_PROVIDER is enabled in production.`) };
    }
    return {
      warnings: [`${missing.join(", ")} unset: using development defaults (${DEV_PLUS_CREDITS_PER_MONTH} credits / month, $${DEV_CREDIT_USD_UNIT} a credit).`],
    };
  },
};

export function readKnowledgeConfig(env: EnvSource = process.env): KnowledgeConfig {
  const parsed = knowledgeEnvSchema.parse({ APP_ENV: "dev", AI_PROVIDER: "none", ...env });
  return {
    freeSentencesPerDay: parsed.AI_FREE_SENTENCES_PER_DAY,
    plusCreditsPerMonth: parsed.AI_PLUS_CREDITS_PER_MONTH ?? DEV_PLUS_CREDITS_PER_MONTH,
    plusMaxSectionsPerDay: parsed.AI_PLUS_MAX_SECTIONS_PER_DAY,
    globalBudgetUsdPerDay: parsed.AI_GLOBAL_BUDGET_USD_PER_DAY,
    creditUsdUnit: parsed.AI_CREDIT_USD_UNIT ?? DEV_CREDIT_USD_UNIT,
  };
}
