import { describe, expect, it } from "vitest";
import { emailOnlySchema, loginSchema, registerSchema, verifyEmailSchema } from "./auth";

/**
 * This schema is deliberately locale-free (see the comment in ./auth.ts): its
 * failure "messages" are `auth.validation.*` catalog KEYS, not display text.
 * That means this file's job is no longer to pin English prose — that
 * belongs to `lib/i18n/catalog.test.ts` (key-set/ICU parity across locales)
 * and `app/[locale]/(auth)/actions.test.ts` (key -> text resolution). What's
 * still worth pinning here, and what these tests assert, is the schema's own
 * contract: which field fails for which input, and the exact key literal it
 * emits for each — `translateValidationKey` in actions.ts switches on those
 * exact literals, so a silent rename here would make a validation error
 * fall through to its `default` case (the raw key leaking to the user)
 * without failing anywhere else.
 */
describe("loginSchema", () => {
  it("accepts a valid email + password", () => {
    const r = loginSchema.safeParse({ email: "a@b.co", password: "x" });
    expect(r.success).toBe(true);
  });

  it("rejects a malformed email with the emailInvalid key", () => {
    const r = loginSchema.safeParse({ email: "nope", password: "x" });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.flatten().fieldErrors.email).toEqual([
      "validation.emailInvalid",
    ]);
  });

  it("trims the email", () => {
    const r = loginSchema.safeParse({ email: "  a@b.co  ", password: "x" });
    expect(r.success && r.data.email).toBe("a@b.co");
  });

  it("rejects an empty password with the passwordRequired key", () => {
    const r = loginSchema.safeParse({ email: "a@b.co", password: "" });
    expect(!r.success && r.error.flatten().fieldErrors.password).toEqual([
      "validation.passwordRequired",
    ]);
  });
});

describe("registerSchema", () => {
  describe("confirmPassword", () => {
    const base = { name: "A", email: "a@b.com", password: "password123" };

    it("accepts a matching confirmation", () => {
      expect(
        registerSchema.safeParse({ ...base, confirmPassword: "password123" })
          .success,
      ).toBe(true);
    });

    it("reports a mismatch on confirmPassword with the catalog key", () => {
      const result = registerSchema.safeParse({
        ...base,
        confirmPassword: "password124",
      });

      expect(result.success).toBe(false);
      expect(
        !result.success && result.error.flatten().fieldErrors.confirmPassword,
      ).toEqual(["validation.passwordMismatch"]);
    });
  });

  it("requires a password of at least 8 characters, keyed passwordTooShort", () => {
    const short = registerSchema.safeParse({
      name: "Aki",
      email: "a@b.co",
      password: "1234567",
    });
    expect(short.success).toBe(false);
    expect(
      !short.success && short.error.flatten().fieldErrors.password,
    ).toEqual(["validation.passwordTooShort"]);

    const ok = registerSchema.safeParse({
      name: "Aki",
      email: "a@b.co",
      password: "12345678",
      confirmPassword: "12345678",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects a password over 72 characters, keyed passwordTooLong", () => {
    const r = registerSchema.safeParse({
      name: "Aki",
      email: "a@b.co",
      password: "a".repeat(73),
    });
    expect(!r.success && r.error.flatten().fieldErrors.password).toEqual([
      "validation.passwordTooLong",
    ]);
  });

  it("requires a non-empty name, keyed nameRequired", () => {
    const r = registerSchema.safeParse({
      name: "   ",
      email: "a@b.co",
      password: "12345678",
    });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.flatten().fieldErrors.name).toEqual([
      "validation.nameRequired",
    ]);
  });

  it("rejects a malformed email with the emailInvalid key", () => {
    const r = registerSchema.safeParse({
      name: "Aki",
      email: "nope",
      password: "12345678",
    });
    expect(!r.success && r.error.flatten().fieldErrors.email).toEqual([
      "validation.emailInvalid",
    ]);
  });
});

describe("verifyEmailSchema", () => {
  const email = "a@b.com";

  it.each(["12345", "1234567", "12345a"])(
    "rejects %s with the codeInvalid key",
    (token) => {
      const result = verifyEmailSchema.safeParse({ email, token });

      expect(!result.success && result.error.flatten().fieldErrors.token).toEqual([
        "validation.codeInvalid",
      ]);
    },
  );

  it("accepts six ASCII digits including a leading zero", () => {
    expect(verifyEmailSchema.safeParse({ email, token: "012345" }).success).toBe(true);
  });
});

describe("emailOnlySchema", () => {
  it("trims and accepts a valid email", () => {
    const result = emailOnlySchema.safeParse({ email: "  a@b.com  " });

    expect(result.success && result.data.email).toBe("a@b.com");
  });
});
