import { beforeEach, describe, expect, it } from "vitest";
import { AiNotConfiguredError } from "./errors";
import { capabilityGaps, getProvider, isAiEnabled, setProviderForTesting } from "./registry";
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
