import { describe, expect, it } from "vitest";
import { emailEnvSchema, readEmailEnv } from "./env";

const base = { APP_ENV: "dev", EMAIL_PROVIDER: "none" };

describe("readEmailEnv", () => {
  it("requires APP_ENV — it is never inferred from NODE_ENV", () => {
    expect(() => readEmailEnv({ EMAIL_PROVIDER: "none" })).toThrow();
  });

  it("requires EMAIL_PROVIDER — absence of a selection is not a decision", () => {
    expect(() => readEmailEnv({ APP_ENV: "dev" })).toThrow();
  });

  it("accepts none without demanding anything else", () => {
    expect(readEmailEnv(base)).toEqual({ APP_ENV: "dev", EMAIL_PROVIDER: "none" });
  });

  it("accepts console outside production", () => {
    expect(readEmailEnv({ APP_ENV: "dev", EMAIL_PROVIDER: "console" })).toEqual({
      APP_ENV: "dev",
      EMAIL_PROVIDER: "console",
    });
  });
});

describe("emailEnvSchema + policy", () => {
  const validate = (env: Record<string, string>) => {
    const parsed = emailEnvSchema.safeParse(env);
    if (!parsed.success) return parsed.error.issues.map((i) => i.message);
    return [];
  };

  it("refuses console in production — it only logs to the server console and never reaches a real inbox", () => {
    const issues = validate({ APP_ENV: "production", EMAIL_PROVIDER: "console" });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.join(" ")).toMatch(/production/i);
  });

  it("allows production with email intentionally off — the launch state until a real transport is chosen", () => {
    expect(validate({ APP_ENV: "production", EMAIL_PROVIDER: "none" })).toEqual([]);
  });

  it("allows console in staging", () => {
    expect(validate({ APP_ENV: "staging", EMAIL_PROVIDER: "console" })).toEqual([]);
  });

  it("rejects an EMAIL_PROVIDER value that is neither documented option", () => {
    expect(validate({ APP_ENV: "dev", EMAIL_PROVIDER: "resend" })).not.toEqual([]);
  });
});
