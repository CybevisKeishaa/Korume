import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EmailNotConfiguredError } from "./errors";
import { emailEnvSpec, getProvider, isEmailEnabled, setProviderForTesting } from "./registry";

beforeEach(() => setProviderForTesting(null));
afterEach(() => setProviderForTesting(null));

describe("isEmailEnabled", () => {
  it("is false when email is intentionally disabled", () => {
    expect(isEmailEnabled({ APP_ENV: "dev", EMAIL_PROVIDER: "none" })).toBe(false);
  });
  it("is true for a named provider", () => {
    expect(isEmailEnabled({ APP_ENV: "dev", EMAIL_PROVIDER: "console" })).toBe(true);
  });
});

describe("getProvider", () => {
  it("throws EmailNotConfiguredError when EMAIL_PROVIDER=none — never a silent no-op", () => {
    expect(() => getProvider({ APP_ENV: "dev", EMAIL_PROVIDER: "none" })).toThrow(EmailNotConfiguredError);
  });

  it("returns the console adapter when EMAIL_PROVIDER=console", () => {
    expect(getProvider({ APP_ENV: "dev", EMAIL_PROVIDER: "console" }).name).toBe("console");
  });

  it("throws rather than silently substituting when the config is invalid", () => {
    expect(() => getProvider({ APP_ENV: "production", EMAIL_PROVIDER: "console" })).toThrow();
  });

  it("returns the injected test provider over the real selection", () => {
    setProviderForTesting({ name: "console", send: async () => ({ id: "fixed" }) });
    expect(getProvider({ APP_ENV: "dev", EMAIL_PROVIDER: "none" }).name).toBe("console");
  });
});

describe("emailEnvSpec", () => {
  it("carries the schema so instrumentation.ts can register it like the AI/speech/scheduler specs", () => {
    expect(emailEnvSpec.name).toBe("email");
    expect(emailEnvSpec.schema).toBeDefined();
  });
});
