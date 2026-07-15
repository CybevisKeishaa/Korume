/**
 * Explicit provider selection. No inference, no fallback (Spec §2): the app
 * never substitutes a provider, and absence of a key is never read as intent.
 */
import type { EnvSource, EnvSpec } from "@/lib/env/validate";
import { REQUIRED_CAPABILITIES } from "./capabilities";
import { aiEnvSchema, readAiEnv, type AiEnvShape } from "./env";
import { AiNotConfiguredError } from "./errors";
import type { AiProvider } from "./port";
import { createAnthropicProvider } from "./providers/anthropic";
import { createGeminiProvider } from "./providers/gemini";

let testProvider: AiProvider | null = null;

/** Test-only injection point. */
export function setProviderForTesting(provider: AiProvider | null): void {
  testProvider = provider;
}

export function isAiEnabled(env: EnvSource = process.env): boolean {
  return readAiEnv(env).AI_PROVIDER !== "none";
}

export function getProvider(env: EnvSource = process.env): AiProvider {
  if (testProvider) return testProvider;

  const parsed = aiEnvSchema.safeParse(env);
  if (!parsed.success) {
    // Startup validation should have caught this; reaching here means a route
    // ran before validation, so fail loudly rather than degrade.
    throw new Error(
      `AI provider is misconfigured: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  const cfg = parsed.data;
  switch (cfg.AI_PROVIDER) {
    case "none":
      throw new AiNotConfiguredError();
    case "anthropic":
      return createAnthropicProvider(cfg.ANTHROPIC_API_KEY as string);
    case "gemini":
      return createGeminiProvider({
        apiKey: cfg.GEMINI_API_KEY as string,
        fastModel: cfg.GEMINI_MODEL_FAST as string,
        deepModel: cfg.GEMINI_MODEL_DEEP as string,
      });
  }
}

/** Capabilities the product requires that this provider does not declare. */
export function capabilityGaps(provider: AiProvider): string[] {
  return (Object.keys(REQUIRED_CAPABILITIES) as (keyof typeof REQUIRED_CAPABILITIES)[])
    .filter((key) => REQUIRED_CAPABILITIES[key] && !provider.capabilities[key])
    .map((key) => `provider "${provider.name}" does not support ${key}`);
}

/**
 * The registered startup spec, assembled HERE rather than in env.ts because the
 * capability comparison needs `getProvider`/`capabilityGaps` — and env.ts is
 * already imported by this module.
 *
 * Capability gaps ride in the same aggregated report as schema failures
 * (Spec §5.2). Production must never serve silently degraded output; dev shows
 * the gap and runs anyway (Spec §5.4).
 */
export const aiEnvSpec: EnvSpec<AiEnvShape> = {
  name: "ai",
  schema: aiEnvSchema,
  check: (env) => {
    if (env.AI_PROVIDER === "none") return {};
    const gaps = capabilityGaps(getProvider(env));
    if (gaps.length === 0) return {};
    return env.APP_ENV === "production" ? { errors: gaps } : { warnings: gaps };
  },
};
