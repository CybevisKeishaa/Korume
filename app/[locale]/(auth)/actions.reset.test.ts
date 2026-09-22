import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "use-intl/core";
import enAuth from "@/messages/en/auth.json";
import { requestPasswordReset, updatePassword } from "./actions";

const { getUser, resetPasswordForEmail, updateUser } = vi.hoisted(() => ({
  getUser: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser, resetPasswordForEmail, updateUser } }),
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
vi.mock("next/headers", () => ({
  headers: () => new Headers({ origin: "http://localhost:3000" }),
}));

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

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "u" } } });
  resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  updateUser.mockResolvedValue({ data: {}, error: null });
});

describe("requestPasswordReset", () => {
  it("sends a valid email to Supabase then reports the neutral sent state", async () => {
    await expect(requestPasswordReset({}, formData({ email: "a@b.com" }))).resolves.toEqual({
      sent: true,
    });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("a@b.com", {
      redirectTo: "http://localhost:3000/auth/callback?next=/en/reset-password",
    });
  });

  it("returns the same neutral state when Supabase reports an error", async () => {
    resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: { message: "no account" } });

    const result = await requestPasswordReset({}, formData({ email: "a@b.com" }));

    expect(result).toEqual({ sent: true });
  });

  it("rejects an invalid email before calling Supabase", async () => {
    await expect(requestPasswordReset({}, formData({ email: "nope" }))).resolves.toEqual({
      fieldErrors: { email: ["Enter a valid email address."] },
    });
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe("updatePassword", () => {
  const fields = { password: "password123", confirmPassword: "password123" };

  it("returns an expired-link message without updating when there is no user", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });

    await expect(updatePassword({}, formData(fields))).resolves.toEqual({
      error: "This reset link has expired. Request a new one.",
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("updates a matching password then redirects to the locale dashboard", async () => {
    const destination = await updatePassword({}, formData(fields)).catch(redirectDestination);

    expect(destination).toBe("/en/dashboard");
    expect(updateUser).toHaveBeenCalledWith({ password: "password123" });
  });

  it("maps same_password to a distinct instruction", async () => {
    updateUser.mockResolvedValueOnce({ data: {}, error: { code: "same_password" } });

    await expect(updatePassword({}, formData(fields))).resolves.toEqual({
      error: "Choose a password different from your current one.",
    });
  });

  it("maps other update failures to one retry message", async () => {
    updateUser.mockResolvedValueOnce({ data: {}, error: { code: "unexpected" } });

    await expect(updatePassword({}, formData(fields))).resolves.toEqual({
      error: "We couldn't update your password. Try again.",
    });
  });
});
