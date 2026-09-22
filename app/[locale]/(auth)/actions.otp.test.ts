import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "use-intl/core";
import enAuth from "@/messages/en/auth.json";
import type { AuthState } from "./actions";
import { login, register } from "./actions";
import * as actions from "./actions";

const { signInWithPassword, signUp, verifyOtp, resend } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  verifyOtp: vi.fn(),
  resend: vi.fn(),
}));

const { verifyEmail = login, resendCode = login } = actions as typeof actions & {
  verifyEmail?: typeof login;
  resendCode?: typeof login;
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { resend, signInWithPassword, signUp, verifyOtp },
  }),
}));

vi.mock("@/lib/i18n/server", () => ({
  getLocale: async () => "en",
  getTranslations: async (namespace: string) =>
    createTranslator({
      locale: "en",
      messages: { [namespace]: enAuth },
      namespace,
    }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function redirectDestination(error: unknown): string {
  if (
    typeof error !== "object" ||
    error === null ||
    !("digest" in error) ||
    typeof (error as { digest: unknown }).digest !== "string"
  ) {
    throw error;
  }
  return (error as { digest: string }).digest.split(";", 3)[2] ?? "";
}

async function resultOf(action: () => Promise<AuthState>): Promise<AuthState | string> {
  return action().catch(redirectDestination);
}

beforeEach(() => {
  vi.clearAllMocks();
  signInWithPassword.mockResolvedValue({ error: null });
  signUp.mockResolvedValue({ data: { user: { id: "u" }, session: null }, error: null });
  verifyOtp.mockResolvedValue({ data: {}, error: null });
  resend.mockResolvedValue({ data: {}, error: null });
});

describe("register â€” both confirmation modes (spec 4.1)", () => {
  const fields = {
    name: "A",
    email: "a+b@c.com",
    password: "password123",
    confirmPassword: "password123",
  };

  it("sends a present session to the dashboard", async () => {
    signUp.mockResolvedValueOnce({
      data: { user: { id: "u" }, session: { access_token: "t" } },
      error: null,
    });

    expect(await resultOf(() => register({}, formData(fields)))).toBe("/en/dashboard");
  });

  it("sends a user without a session to the encoded verify-email route", async () => {
    expect(await resultOf(() => register({}, formData(fields)))).toBe(
      "/en/verify-email?email=a%2Bb%40c.com",
    );
  });
});

describe("login â€” unconfirmed email", () => {
  it("sends email_not_confirmed to verify-email with resend=1", async () => {
    signInWithPassword.mockResolvedValueOnce({
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });

    expect(
      await resultOf(() => login({}, formData({ email: "a@b.com", password: "x" }))),
    ).toBe("/en/verify-email?email=a%40b.com&resend=1");
  });

  it("keeps the single invalid-credentials message for other errors", async () => {
    signInWithPassword.mockResolvedValueOnce({
      error: { code: "invalid_credentials", message: "x" },
    });

    expect(await login({}, formData({ email: "a@b.com", password: "x" }))).toEqual({
      error: "Invalid email or password.",
    });
  });
});

describe("verifyEmail", () => {
  it("verifies an email token and redirects to the dashboard", async () => {
    expect(
      await resultOf(() => verifyEmail({}, formData({ email: "a@b.com", token: "123456" }))),
    ).toBe("/en/dashboard");
    expect(verifyOtp).toHaveBeenCalledWith({ email: "a@b.com", token: "123456", type: "email" });
  });

  it("maps every Supabase error to one generic message", async () => {
    verifyOtp.mockResolvedValueOnce({
      data: {},
      error: { code: "otp_expired", message: "x" },
    });

    expect(
      await verifyEmail({}, formData({ email: "a@b.com", token: "123456" })),
    ).toEqual({ error: "That code is wrong or has expired." });
  });

  it("rejects a malformed code before calling Supabase", async () => {
    const result = await verifyEmail({}, formData({ email: "a@b.com", token: "12a456" }));

    expect(result.fieldErrors?.token).toEqual(["Enter the 6-digit code."]);
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

describe("resendCode", () => {
  it("resends a signup code and reports sent", async () => {
    expect(await resendCode({}, formData({ email: "a@b.com" }))).toEqual({ status: "sent" });
    expect(resend).toHaveBeenCalledWith({ type: "signup", email: "a@b.com" });
  });

  it("maps the email rate limit to rateLimited", async () => {
    resend.mockResolvedValueOnce({
      data: {},
      error: { code: "over_email_send_rate_limit", message: "x" },
    });

    expect(await resendCode({}, formData({ email: "a@b.com" }))).toEqual({ status: "rateLimited" });
  });

  it("reports sent for any other error without enumerating accounts", async () => {
    resend.mockResolvedValueOnce({ data: {}, error: { code: "user_not_found", message: "x" } });

    expect(await resendCode({}, formData({ email: "a@b.com" }))).toEqual({ status: "sent" });
  });
});
