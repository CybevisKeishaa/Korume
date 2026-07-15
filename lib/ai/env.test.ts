import { describe, expect, it } from "vitest";
import { aiEnvSchema, readAiEnv } from "./env";

const base = { APP_ENV: "dev", AI_PROVIDER: "none" };

// Matches the 53-char `AQ.` shape verified against the live API on 2026-07-15
// (spec §7 V3). `AIza…` is equally valid and must also be accepted.
const VERIFIED_GEMINI_KEY_SAMPLE = "AQ.Ab" + "x".repeat(48);

describe("readAiEnv", () => {
  it("requires APP_ENV — it is never inferred from NODE_ENV", () => {
    expect(() => readAiEnv({ AI_PROVIDER: "none" })).toThrow();
  });

  it("requires AI_PROVIDER — absence of a key is not a decision", () => {
    expect(() => readAiEnv({ APP_ENV: "dev" })).toThrow();
  });

  it("accepts none without demanding any credential", () => {
    expect(readAiEnv(base)).toEqual({ APP_ENV: "dev", AI_PROVIDER: "none" });
  });
});

describe("aiEnvSchema + policy", () => {
  const validate = (env: Record<string, string>) => {
    const parsed = aiEnvSchema.safeParse(env);
    if (!parsed.success) return parsed.error.issues.map((i) => i.message);
    return [];
  };

  it("rejects a named provider whose credential is absent", () => {
    expect(validate({ APP_ENV: "dev", AI_PROVIDER: "gemini" }).length).toBeGreaterThan(0);
  });

  it("rejects a credential that fails its structural marker", () => {
    const issues = validate({
      APP_ENV: "dev",
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "not-a-real-key-shape",
      GEMINI_MODEL_FAST: "m",
      GEMINI_MODEL_DEEP: "m",
    });
    expect(issues.length).toBeGreaterThan(0);
    // Redaction contract from Task 3.
    expect(issues.join(" ")).not.toContain("not-a-real-key-shape");
  });

  it("refuses Gemini in production — its free tier trains on submitted data (CLAUDE.md §2)", () => {
    const issues = validate({
      APP_ENV: "production",
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: VERIFIED_GEMINI_KEY_SAMPLE,
      GEMINI_MODEL_FAST: "m",
      GEMINI_MODEL_DEEP: "m",
    });
    expect(issues.join(" ")).toMatch(/production/i);
  });

  it("allows production with AI intentionally off — the launch state (D1)", () => {
    expect(validate({ APP_ENV: "production", AI_PROVIDER: "none" })).toEqual([]);
  });

  it("accepts both documented Google key shapes", () => {
    const base = { APP_ENV: "dev", AI_PROVIDER: "gemini", GEMINI_MODEL_FAST: "m", GEMINI_MODEL_DEEP: "m" };
    expect(validate({ ...base, GEMINI_API_KEY: VERIFIED_GEMINI_KEY_SAMPLE })).toEqual([]);
    expect(validate({ ...base, GEMINI_API_KEY: "AIza" + "x".repeat(35) })).toEqual([]);
  });
});
