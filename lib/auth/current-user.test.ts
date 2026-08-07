import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

// React 18.3's published "react" package (what plain Vitest resolves,
// vs. Next.js's own RSC-aware build) does not export `cache` at all — only
// Next's bundled React does. `getCurrentUser` is this repo's only
// `cache()`-wrapped function, so there's no existing test precedent for this;
// stub it to identity so the module under test can load under plain Vitest.
// Per-test `vi.resetModules()` + dynamic import (below) already gives each
// test a fresh, uncached call, so identity is behaviourally equivalent to the
// real memoization for what this test observes.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T,>(fn: T): T => fn };
});

const USER = { id: "u1", email: "learner@example.com" };

const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

afterEach(() => {
  vi.mocked(createClient).mockReset();
  if (ORIGINAL_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
  if (ORIGINAL_ANON_KEY === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_ANON_KEY;
});

/**
 * Final whole-branch review F11 (2026-08-07): `createClient()` ->
 * `publicEnv.supabaseUrl()` throws when the public Supabase env is unset,
 * while `(app)/layout.tsx` (before this branch) guarded with
 * `hasPublicSupabaseEnv()` first. `(protected)/layout.tsx` redirects before
 * children render, so the throwing path is probably unreachable in practice
 * — but the codebase explicitly supports the "runs before `.env.local`
 * exists" state (`hasPublicSupabaseEnv`'s own doc comment), so this pins the
 * guard rather than relying on every future caller redirecting first.
 *
 * `vi.resetModules()` + a dynamic import gives each test a fresh module
 * instance, sidestepping any question about how React's `cache()` behaves
 * outside an actual request/render (`getCurrentUser` is this repo's only
 * `cache()`-wrapped function, so there's no existing precedent to lean on).
 */
describe("getCurrentUser", () => {
  it("returns null without calling createClient when the public Supabase env is unset", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    vi.resetModules();
    const { getCurrentUser } = await import("./current-user");
    const result = await getCurrentUser();

    expect(result).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("returns the signed-in user when the env is configured", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const supabase = createMockSupabase({ user: USER, tables: {} });
    vi.mocked(createClient).mockReturnValue(
      supabase as unknown as ReturnType<typeof createClient>,
    );

    vi.resetModules();
    const { getCurrentUser } = await import("./current-user");
    const result = await getCurrentUser();

    expect(result).toEqual(USER);
  });
});
