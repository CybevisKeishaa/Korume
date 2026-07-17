import { describe, expect, it, vi } from "vitest";

/**
 * Proves the one behavior in this file that is easy to get wrong when
 * swapping `next/navigation`'s `redirect(path)` for the locale-aware
 * `redirect({ href, locale })` (Task 6): `redirectTo` — when present — is
 * built by `lib/supabase/middleware.ts`'s signed-out bounce and ALREADY
 * carries a locale prefix (e.g. "/en/dashboard"). The locale-aware `redirect`
 * always adds its own prefix for the given `locale`, so passing an
 * already-prefixed target through unstripped would double it
 * ("/en/en/dashboard") — an auth-flow regression Playwright would only catch
 * much later. `login()` strips it first (`stripLocale`); this test proves
 * the strip+re-add composes back to a single prefix, not two.
 *
 * next.js's `redirect()` always throws (it never returns), signalling the
 * destination via `error.digest` ("NEXT_REDIRECT;<type>;<url>;<status>;") —
 * see `node_modules/next/dist/client/components/redirect.js`. Catching that
 * digest is the only way to observe the resolved URL without a browser.
 */

const signInWithPassword = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { signInWithPassword },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

let mockLocale = "en";
vi.mock("@/lib/i18n/server", () => ({
  getLocale: async () => mockLocale,
}));

function redirectDestination(error: unknown): string {
  if (
    typeof error !== "object" ||
    error === null ||
    !("digest" in error) ||
    typeof (error as { digest: unknown }).digest !== "string"
  ) {
    throw new Error(`Expected a NEXT_REDIRECT error, got: ${String(error)}`);
  }
  return (error as { digest: string }).digest.split(";", 3)[2] ?? "";
}

function loginFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("login() redirect target (spec P2 — no double-prefixing)", () => {
  it("adds a single locale prefix to the fallback (no redirectTo)", async () => {
    mockLocale = "en";
    const { login } = await import("./actions");

    const error = await login(
      {},
      loginFormData({ email: "a@b.com", password: "secret" }),
    ).catch((e: unknown) => e);

    expect(redirectDestination(error)).toBe("/en/dashboard");
  });

  it("strips the existing prefix from an already-prefixed redirectTo instead of doubling it", async () => {
    mockLocale = "en";
    const { login } = await import("./actions");

    const error = await login(
      {},
      loginFormData({
        email: "a@b.com",
        password: "secret",
        redirectTo: "/en/videos/v1/shadowing",
      }),
    ).catch((e: unknown) => e);

    expect(redirectDestination(error)).toBe("/en/videos/v1/shadowing");
    expect(redirectDestination(error)).not.toContain("/en/en/");
  });

  it("does the same for vi", async () => {
    mockLocale = "vi";
    const { login } = await import("./actions");

    const error = await login(
      {},
      loginFormData({
        email: "a@b.com",
        password: "secret",
        redirectTo: "/vi/dashboard",
      }),
    ).catch((e: unknown) => e);

    expect(redirectDestination(error)).toBe("/vi/dashboard");
  });

  it("rejects an unsafe redirectTo (absolute URL) and falls back to the locale dashboard", async () => {
    mockLocale = "en";
    const { login } = await import("./actions");

    const error = await login(
      {},
      loginFormData({
        email: "a@b.com",
        password: "secret",
        redirectTo: "https://evil.example.com",
      }),
    ).catch((e: unknown) => e);

    expect(redirectDestination(error)).toBe("/en/dashboard");
  });
});
