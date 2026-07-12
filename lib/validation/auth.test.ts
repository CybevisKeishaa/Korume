import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth";

describe("loginSchema", () => {
  it("accepts a valid email + password", () => {
    const r = loginSchema.safeParse({ email: "a@b.co", password: "x" });
    expect(r.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const r = loginSchema.safeParse({ email: "nope", password: "x" });
    expect(r.success).toBe(false);
  });

  it("trims the email", () => {
    const r = loginSchema.safeParse({ email: "  a@b.co  ", password: "x" });
    expect(r.success && r.data.email).toBe("a@b.co");
  });
});

describe("registerSchema", () => {
  it("requires a password of at least 8 characters", () => {
    const short = registerSchema.safeParse({
      name: "Aki",
      email: "a@b.co",
      password: "1234567",
    });
    expect(short.success).toBe(false);

    const ok = registerSchema.safeParse({
      name: "Aki",
      email: "a@b.co",
      password: "12345678",
    });
    expect(ok.success).toBe(true);
  });

  it("requires a non-empty name", () => {
    const r = registerSchema.safeParse({
      name: "   ",
      email: "a@b.co",
      password: "12345678",
    });
    expect(r.success).toBe(false);
  });
});
