import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  EnvValidationError,
  registerEnvSpec,
  resetEnvValidationForTesting,
  validateEnv,
} from "./validate";

describe("validateEnv", () => {
  beforeEach(() => resetEnvValidationForTesting());

  it("passes when every registered schema is satisfied", () => {
    registerEnvSpec({ name: "demo", schema: z.object({ FOO: z.string().min(1) }) });
    expect(() => validateEnv({ FOO: "ok" })).not.toThrow();
  });

  it("aggregates failures from every spec into one error", () => {
    registerEnvSpec({ name: "a", schema: z.object({ FOO: z.string().min(1) }) });
    registerEnvSpec({ name: "b", schema: z.object({ BAR: z.string().min(1) }) });

    let message = "";
    try {
      validateEnv({});
    } catch (err) {
      message = (err as Error).message;
    }
    // The 2026-07-14 audit found TWO env bugs at once; one restart must surface both.
    expect(message).toContain("FOO");
    expect(message).toContain("BAR");
  });

  it("never puts a credential value in the error message", () => {
    registerEnvSpec({
      name: "secret",
      schema: z.object({
        TOKEN: z.string().refine((v) => v.startsWith("sk-"), {
          message: "expected a key beginning with the documented prefix",
        }),
      }),
    });

    let message = "";
    try {
      validateEnv({ TOKEN: "super-secret-value" });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain("TOKEN");
    expect(message).not.toContain("super-secret-value");
  });

  it("reports check() errors alongside schema errors", () => {
    registerEnvSpec({
      name: "policy",
      schema: z.object({ MODE: z.string() }),
      check: (v) => (v.MODE === "bad" ? { errors: ["MODE is not allowed here"] } : {}),
    });
    expect(() => validateEnv({ MODE: "bad" })).toThrow(EnvValidationError);
  });

  it("logs warnings without throwing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    registerEnvSpec({
      name: "gap",
      schema: z.object({ MODE: z.string() }),
      check: () => ({ warnings: ["capability gap: streaming"] }),
    });
    expect(() => validateEnv({ MODE: "x" })).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("capability gap: streaming"));
    warn.mockRestore();
  });

  it("is memoized so any startup hook may call it twice", () => {
    const check = vi.fn(() => ({}));
    registerEnvSpec({ name: "once", schema: z.object({}), check });
    validateEnv({});
    validateEnv({});
    expect(check).toHaveBeenCalledTimes(1);
  });
});
