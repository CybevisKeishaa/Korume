import { describe, expect, it } from "vitest";
import { speechEnvSchema } from "./env";

// Fake keys matching the two verified real shapes. Never paste the real key here.
const VALID_KEY_LONG = "a".repeat(84); // the live 2026-07-15 shape
const VALID_KEY_CLASSIC = "0123456789abcdef0123456789abcdef"; // classic 32-hex Key1
const VALID_KEY = VALID_KEY_LONG;

const issues = (env: Record<string, string>) => {
  const parsed = speechEnvSchema.safeParse(env);
  return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
};

describe("speechEnvSchema", () => {
  it("requires SPEECH_PROVIDER — absence of a key is not a decision", () => {
    expect(issues({}).length).toBeGreaterThan(0);
  });

  it("accepts none and demands no credential — the deliberate 503 path (D9)", () => {
    expect(issues({ SPEECH_PROVIDER: "none" })).toEqual([]);
  });

  it("rejects azure without a key", () => {
    expect(issues({ SPEECH_PROVIDER: "azure", AZURE_SPEECH_REGION: "japanwest" }).length)
      .toBeGreaterThan(0);
  });

  it("rejects azure without a region", () => {
    expect(issues({ SPEECH_PROVIDER: "azure", AZURE_SPEECH_KEY: VALID_KEY }).length)
      .toBeGreaterThan(0);
  });

  it("rejects a resource id pasted in place of Key1 — the actual 2026-07-14 audit bug", () => {
    const guid = "8f14e45f-ceea-467a-9c1e-2b3f4d5a6b7c"; // 36 chars, what was really pasted
    const found = issues({
      SPEECH_PROVIDER: "azure",
      AZURE_SPEECH_KEY: guid,
      AZURE_SPEECH_REGION: "japanwest",
    });
    expect(found.length).toBeGreaterThan(0);
    expect(found.join(" ")).not.toContain(guid); // redaction contract (Task 3)
  });

  it("accepts both real Azure key shapes — the rule must not pin a single length", () => {
    // An earlier draft pinned 32-hex from memory; the live key is 84 chars.
    // A length-specific rule would have blocked boot on a working key.
    const base = { SPEECH_PROVIDER: "azure", AZURE_SPEECH_REGION: "japanwest" };
    expect(issues({ ...base, AZURE_SPEECH_KEY: VALID_KEY_LONG })).toEqual([]);
    expect(issues({ ...base, AZURE_SPEECH_KEY: VALID_KEY_CLASSIC })).toEqual([]);
  });
});
