import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { eraseMyMemory } from "./memory-erase";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

function mockClient(opts: Parameters<typeof createMockSupabase>[0]) {
  const client = createMockSupabase(opts);
  vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
  return client;
}

/** A fresh user id per test, so the module-level rate-limit map never leaks across them. */
let nextUser = 0;
const freshUser = () => ({ id: `u-erase-${(nextUser += 1)}` });

describe("eraseMyMemory", () => {
  it("refuses an anonymous caller without touching the database", async () => {
    const client = mockClient({ user: null, tables: {} });

    expect(await eraseMyMemory()).toEqual({ ok: false, status: 401 });
    expect(client.rpcCalls).toHaveLength(0);
  });

  // The RLS function is the whole safety mechanism: it deletes `auth.uid()`
  // rows only, and both deletes commit together. This asserts the data layer
  // calls THAT function and nothing else — an implementation that hand-rolled
  // two `.delete()` calls would pass a "memory is gone" test and lose the
  // single-transaction guarantee spec §4.8 requires.
  it("calls erase_companion_memory exactly once", async () => {
    const client = mockClient({
      user: freshUser(),
      tables: {},
      rpcs: { erase_companion_memory: () => ({ data: null, error: null }) },
    });

    expect(await eraseMyMemory()).toEqual({ ok: true, data: { erased: true } });
    expect(client.rpcCalls).toHaveLength(1);
    expect(client.rpcCalls?.[0]?.name).toBe("erase_companion_memory");
  });

  it("rate limits after three erases in the hour, and reports when to retry", async () => {
    const user = freshUser();
    const start = new Date("2026-09-23T10:00:00Z");
    const at = (minutes: number) => new Date(start.getTime() + minutes * 60_000);

    for (const minute of [0, 1, 2]) {
      mockClient({
        user,
        tables: {},
        rpcs: { erase_companion_memory: () => ({ data: null, error: null }) },
      });
      expect((await eraseMyMemory(at(minute))).ok).toBe(true);
    }

    const client = mockClient({
      user,
      tables: {},
      rpcs: { erase_companion_memory: () => ({ data: null, error: null }) },
    });
    const fourth = await eraseMyMemory(at(3));

    expect(fourth).toMatchObject({ ok: false, status: 429 });
    // 3 minutes into a 60-minute window, so 57 minutes remain on the oldest hit.
    if (fourth.ok || fourth.status !== 429) throw new Error("expected a 429");
    expect(fourth.retryAfter).toBe(57 * 60_000);
    // The limit is refused BEFORE the rpc, or a limited caller still erases.
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("rethrows the rpc error rather than reporting a successful erase", async () => {
    mockClient({
      user: freshUser(),
      tables: {},
      rpcs: { erase_companion_memory: () => ({ data: null, error: { message: "boom" } }) },
    });

    await expect(eraseMyMemory()).rejects.toMatchObject({ message: "boom" });
  });
});
