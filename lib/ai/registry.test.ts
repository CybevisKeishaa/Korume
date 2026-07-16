import { beforeEach, describe, expect, it } from "vitest";
import { AiNotConfiguredError } from "./errors";
import {
  aiEnvSpec,
  capabilityGaps,
  getProvider,
  isAiEnabled,
  setProviderForTesting,
} from "./registry";
import { createFakeProvider } from "./providers/fake";

beforeEach(() => setProviderForTesting(null));

describe("isAiEnabled", () => {
  it("is false when AI is intentionally disabled", () => {
    expect(isAiEnabled({ APP_ENV: "dev", AI_PROVIDER: "none" })).toBe(false);
  });
  it("is true for a named provider", () => {
    expect(isAiEnabled({ APP_ENV: "dev", AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-ant-x" })).toBe(true);
  });
});

describe("getProvider", () => {
  it("throws AiNotConfiguredError when AI_PROVIDER=none — the deliberate 503 path (D1)", () => {
    expect(() => getProvider({ APP_ENV: "dev", AI_PROVIDER: "none" })).toThrow(AiNotConfiguredError);
  });

  it("never falls back to another provider when the selected one is unusable", () => {
    // A missing credential is a startup failure, never a silent substitution.
    expect(() => getProvider({ APP_ENV: "dev", AI_PROVIDER: "anthropic" })).toThrow();
  });
});

describe("capabilityGaps", () => {
  it("is empty for a fully capable provider", () => {
    const fake = createFakeProvider();
    expect(capabilityGaps(fake.provider)).toEqual([]);
  });

  it("names each capability the product requires but the provider lacks", () => {
    const fake = createFakeProvider({ promptCaching: false });
    expect(capabilityGaps(fake.provider).join(" ")).toContain("promptCaching");
  });
});

describe("aiEnvSpec.check", () => {
  // Anthropic declares every REQUIRED_CAPABILITIES field, so this branch is
  // unreachable through normal config in production (a real gap only shows up
  // with a provider that under-declares — which is exactly why it needs a
  // provider injected directly, rather than a real credential).
  const gapEnv = { APP_ENV: "production" as const, AI_PROVIDER: "anthropic" as const, ANTHROPIC_API_KEY: "sk-ant-x" };

  // `check` is optional on EnvSpec<T> generally, but aiEnvSpec always defines
  // one; fail loudly (not silently skip) if that ever stops being true.
  const check: NonNullable<typeof aiEnvSpec.check> = (env) => {
    if (!aiEnvSpec.check) throw new Error("aiEnvSpec.check is unexpectedly undefined");
    return aiEnvSpec.check(env);
  };

  it("reports a capability gap as an error in production — real users are never served silently degraded output (Spec §5.4)", () => {
    const fake = createFakeProvider({ promptCaching: false });
    setProviderForTesting(fake.provider);

    const result = check({ ...gapEnv, APP_ENV: "production" });
    expect(result.errors?.join(" ")).toContain("promptCaching");
    expect(result.warnings).toBeUndefined();
  });

  it("reports the same capability gap as a warning in dev — the app still runs (Spec §5.4)", () => {
    const fake = createFakeProvider({ promptCaching: false });
    setProviderForTesting(fake.provider);

    const result = check({ ...gapEnv, APP_ENV: "dev" });
    expect(result.warnings?.join(" ")).toContain("promptCaching");
    expect(result.errors).toBeUndefined();
  });

  it("reports nothing when AI is intentionally off, regardless of environment", () => {
    expect(check({ APP_ENV: "production", AI_PROVIDER: "none" })).toEqual({});
  });

  it("reports nothing for a fully capable provider", () => {
    const fake = createFakeProvider();
    setProviderForTesting(fake.provider);

    expect(check({ ...gapEnv, APP_ENV: "production" })).toEqual({});
  });
});
