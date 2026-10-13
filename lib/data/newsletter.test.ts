import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { getNewsletterState, setNewsletterOptIn } from "./newsletter";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

const asClient = (mock: ReturnType<typeof createMockSupabase>) => mock as unknown as ReturnType<typeof createClient>;

describe("getNewsletterState", () => {
  it("reports the account email and an opted-in learner", async () => {
    vi.mocked(createClient).mockReturnValue(asClient(createMockSupabase({
      user: { id: "u1", email: "learner@example.com" },
      tables: { users: () => ({ data: { newsletter_opt_in_at: "2026-10-13T00:00:00Z" }, error: null }) },
    })));
    expect(await getNewsletterState()).toEqual({ email: "learner@example.com", optedIn: true });
  });

  it("reports not subscribed when the instant is null", async () => {
    vi.mocked(createClient).mockReturnValue(asClient(createMockSupabase({
      user: { id: "u1", email: "learner@example.com" },
      tables: { users: () => ({ data: { newsletter_opt_in_at: null }, error: null }) },
    })));
    expect(await getNewsletterState()).toEqual({ email: "learner@example.com", optedIn: false });
  });

  it("returns null when signed out", async () => {
    vi.mocked(createClient).mockReturnValue(asClient(createMockSupabase({ user: null, tables: {} })));
    expect(await getNewsletterState()).toBeNull();
  });

  it("fails closed on a read error and never throws", async () => {
    vi.mocked(createClient).mockReturnValue(asClient(createMockSupabase({
      user: { id: "u1", email: "learner@example.com" },
      tables: { users: () => ({ data: null, error: { message: "connection reset" } }) },
    })));
    await expect(getNewsletterState()).resolves.toEqual({ email: "learner@example.com", optedIn: false });
  });
});

describe("setNewsletterOptIn", () => {
  it("refuses a signed-out caller without calling the RPC", async () => {
    const mock = createMockSupabase({ user: null, tables: {}, rpcs: {} });
    vi.mocked(createClient).mockReturnValue(asClient(mock));
    expect(await setNewsletterOptIn({ optIn: true })).toEqual({ ok: false, status: 401 });
    expect(mock.rpcCalls ?? []).toEqual([]);
  });

  it("calls the definer RPC with only the boolean and reports the stored state", async () => {
    const mock = createMockSupabase({
      user: { id: "u1", email: "learner@example.com" },
      tables: {},
      rpcs: { set_newsletter_opt_in: () => ({ data: "2026-10-13T00:00:00Z", error: null }) },
    });
    vi.mocked(createClient).mockReturnValue(asClient(mock));
    expect(await setNewsletterOptIn({ optIn: true })).toEqual({ ok: true, data: { optedIn: true } });
    expect(mock.rpcCalls ?? []).toEqual([{ name: "set_newsletter_opt_in", args: { p_opt_in: true } }]);
  });

  it("reports opted out when the RPC returns null", async () => {
    vi.mocked(createClient).mockReturnValue(asClient(createMockSupabase({
      user: { id: "u1" },
      tables: {},
      rpcs: { set_newsletter_opt_in: () => ({ data: null, error: null }) },
    })));
    expect(await setNewsletterOptIn({ optIn: false })).toEqual({ ok: true, data: { optedIn: false } });
  });

  it("rate-limits per user", async () => {
    vi.mocked(createClient).mockReturnValue(asClient(createMockSupabase({
      user: { id: "rate-limited-user" },
      tables: {},
      rpcs: { set_newsletter_opt_in: () => ({ data: null, error: null }) },
    })));
    const now = new Date("2026-10-13T00:00:00Z");
    for (let i = 0; i < 10; i += 1) await setNewsletterOptIn({ optIn: false }, now);
    const limited = await setNewsletterOptIn({ optIn: false }, now);
    expect(limited).toMatchObject({ ok: false, status: 429 });
  });

  it("rethrows a database error for the route to make opaque", async () => {
    vi.mocked(createClient).mockReturnValue(asClient(createMockSupabase({
      user: { id: "u1" },
      tables: {},
      rpcs: { set_newsletter_opt_in: () => ({ data: null, error: { message: "boom" } }) },
    })));
    await expect(setNewsletterOptIn({ optIn: true })).rejects.toBeTruthy();
  });
});
