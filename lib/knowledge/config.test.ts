import { describe, expect, it } from "vitest";
import { knowledgeEnvSpec, readKnowledgeConfig } from "./config";

describe("readKnowledgeConfig", () => {
  it("uses the spec defaults when nothing is set", () => {
    expect(readKnowledgeConfig({ APP_ENV: "dev", AI_PROVIDER: "none" })).toEqual({
      freeSentencesPerDay: 3,
      plusCreditsPerMonth: 1000,
      plusMaxSectionsPerDay: 200,
      globalBudgetUsdPerDay: 5,
      creditUsdUnit: 0.001,
    });
  });

  it("reads every value from the environment", () => {
    expect(
      readKnowledgeConfig({
        APP_ENV: "production",
        AI_PROVIDER: "anthropic",
        AI_FREE_SENTENCES_PER_DAY: "4",
        AI_PLUS_CREDITS_PER_MONTH: "5000",
        AI_PLUS_MAX_SECTIONS_PER_DAY: "150",
        AI_GLOBAL_BUDGET_USD_PER_DAY: "12.5",
        AI_CREDIT_USD_UNIT: "0.002",
      }),
    ).toEqual({
      freeSentencesPerDay: 4,
      plusCreditsPerMonth: 5000,
      plusMaxSectionsPerDay: 150,
      globalBudgetUsdPerDay: 12.5,
      creditUsdUnit: 0.002,
    });
  });

  it("rejects malformed numbers", () => {
    expect(() => readKnowledgeConfig({ APP_ENV: "dev", AI_PROVIDER: "none", AI_GLOBAL_BUDGET_USD_PER_DAY: "five" })).toThrow();
    expect(() => readKnowledgeConfig({ APP_ENV: "dev", AI_PROVIDER: "none", AI_FREE_SENTENCES_PER_DAY: "-1" })).toThrow();
  });
});

describe("knowledgeEnvSpec", () => {
  const check = (env: Record<string, string>) => {
    const parsed = knowledgeEnvSpec.schema.parse(env);
    return knowledgeEnvSpec.check?.(parsed) ?? {};
  };

  it("fails production with AI enabled but no Plus credits or credit unit", () => {
    expect(check({ APP_ENV: "production", AI_PROVIDER: "anthropic" }).errors).toHaveLength(2);
  });

  it("only warns outside production, where the defaults apply", () => {
    const result = check({ APP_ENV: "dev", AI_PROVIDER: "gemini" });
    expect(result.errors ?? []).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it("checks nothing when AI is disabled", () => {
    expect(check({ APP_ENV: "production", AI_PROVIDER: "none" })).toEqual({});
  });
});
