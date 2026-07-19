import { describe, expect, it, vi } from "vitest";
import { createTranslator } from "use-intl/core";
import enAuth from "@/messages/en/auth.json";

/**
 * Proves `login()`/`register()` resolve every zod-emitted `validation.*`
 * catalog key (lib/validation/auth.ts) to real display text before it
 * reaches `fieldErrors` — the failure mode this refactor introduces is a
 * key leaking through unresolved (e.g. `"validation.emailInvalid"` rendered
 * literally inside the form's `role="alert"`), and that must be caught here,
 * not assumed.
 *
 * `@/lib/i18n/server`'s `getTranslations` is a thin re-export of
 * `next-intl/server`, which resolves to its React-Client build under Vite
 * (Next.js's webpack build sets a `react-server` resolve condition Vitest
 * doesn't apply) — calling it for real here throws "getTranslations is not
 * supported in Client Components" regardless of locale. `getTranslations` is
 * mocked below to `use-intl/core`'s `createTranslator` instead: the same
 * underlying ICU translation engine `next-intl` itself calls once the
 * request-locale plumbing has resolved a locale and loaded messages — so this
 * is genuine catalog resolution (real EN JSON, real ICU machinery), not a
 * hand-rolled string lookup that could drift from how the app actually
 * resolves keys. `enAuth` is imported only to seed the translator with real
 * messages, never to build an expected value — every assertion below is a
 * literal English string, so a typo in auth.json fails this test instead of
 * passing by comparing the file to itself (see auth-form.test.tsx).
 */
vi.mock("@/lib/i18n/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({
      locale: "en",
      messages: { [namespace]: enAuth },
      namespace,
    }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn(async () => ({ error: null })),
      signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

describe("login()/register() field-validation text", () => {
  it("resolves an invalid login email to real English copy, not the catalog key", async () => {
    const { login } = await import("./actions");

    const result = await login({}, formData({ email: "nope", password: "x" }));

    expect(result.fieldErrors?.email).toEqual([
      "Enter a valid email address.",
    ]);
  });

  it("resolves a blank login password to real English copy", async () => {
    const { login } = await import("./actions");

    const result = await login(
      {},
      formData({ email: "a@b.co", password: "" }),
    );

    expect(result.fieldErrors?.password).toEqual(["Password is required."]);
  });

  it("resolves a too-short register password to real English copy", async () => {
    const { register } = await import("./actions");

    const result = await register(
      {},
      formData({ name: "Aki", email: "a@b.co", password: "short" }),
    );

    expect(result.fieldErrors?.password).toEqual([
      "Password must be at least 8 characters.",
    ]);
  });

  it("resolves a blank register name to real English copy", async () => {
    const { register } = await import("./actions");

    const result = await register(
      {},
      formData({ name: "   ", email: "a@b.co", password: "12345678" }),
    );

    expect(result.fieldErrors?.name).toEqual(["Name is required."]);
  });

  it("resolves an invalid register email to real English copy", async () => {
    const { register } = await import("./actions");

    const result = await register(
      {},
      formData({ name: "Aki", email: "nope", password: "12345678" }),
    );

    expect(result.fieldErrors?.email).toEqual([
      "Enter a valid email address.",
    ]);
  });
});
