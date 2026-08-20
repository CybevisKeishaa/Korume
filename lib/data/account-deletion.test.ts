import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { cancelDeletion, getPendingDeletion, requestDeletion } from "./account-deletion";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/account-deletion/erase", () => ({ cancelPendingDeletion: vi.fn().mockResolvedValue(false) }));

const NOW = new Date("2026-08-20T10:00:00.000Z");
const VALID = { tier: "erase_all", confirmation: "DELETE", acknowledged: true } as const;

function mount(supabase: unknown) {
  vi.mocked(createClient).mockReturnValue(supabase as ReturnType<typeof createClient>);
}

beforeEach(() => vi.clearAllMocks());

describe("requestDeletion", () => {
  it("refuses an anonymous caller before touching the table", async () => {
    let touched = false;
    mount(createMockSupabase({
      user: null,
      tables: { account_deletion_requests: () => { touched = true; return { data: null, error: null }; } },
    }));
    expect(await requestDeletion(VALID, NOW)).toEqual({ ok: false, status: 401 });
    expect(touched).toBe(false);
  });

  it("writes a pending row whose execute_after is the 7-day boundary, and purge_after the 90-day boundary for erase_all", async () => {
    let inserted: Record<string, unknown> | null = null;
    mount(createMockSupabase({
      user: { id: "u1" },
      tables: {
        account_deletion_requests: (calls) => {
          const insert = calls.find((c) => c.op === "insert");
          if (insert) inserted = (insert as { values: Record<string, unknown> }).values;
          return {
            data: {
              id: "req1", tier: "erase_all",
              requested_at: NOW.toISOString(),
              execute_after: "2026-08-27T10:00:00.000Z",
            },
            error: null,
          };
        },
      },
    }));
    const result = await requestDeletion(VALID, NOW);
    expect(result).toEqual({
      ok: true,
      data: { id: "req1", tier: "erase_all", requestedAt: NOW.toISOString(), executeAfter: "2026-08-27T10:00:00.000Z" },
    });
    expect(inserted).toMatchObject({
      user_id: "u1",
      tier: "erase_all",
      execute_after: "2026-08-27T10:00:00.000Z",
      // erase_all reserves the freed email for 90 days from the REQUEST.
      purge_after: "2026-11-18T10:00:00.000Z",
    });
    // The client never gets to choose its own status.
    expect(inserted).not.toHaveProperty("status");
  });

  it("writes purge_after null for close_account — that tier never reserves the email", async () => {
    let inserted: Record<string, unknown> | null = null;
    const input = { tier: "close_account", confirmation: "DELETE", acknowledged: true } as const;
    mount(createMockSupabase({
      user: { id: "u1" },
      tables: {
        account_deletion_requests: (calls) => {
          const insert = calls.find((c) => c.op === "insert");
          if (insert) inserted = (insert as { values: Record<string, unknown> }).values;
          return {
            data: {
              id: "req2", tier: "close_account",
              requested_at: NOW.toISOString(),
              execute_after: "2026-08-27T10:00:00.000Z",
            },
            error: null,
          };
        },
      },
    }));
    const result = await requestDeletion(input, NOW);
    expect(result.ok).toBe(true);
    expect(inserted).toMatchObject({
      user_id: "u1",
      tier: "close_account",
      execute_after: "2026-08-27T10:00:00.000Z",
      purge_after: null,
    });
  });

  it("maps the one-live-request unique violation to 409, not 500", async () => {
    mount(createMockSupabase({
      user: { id: "u1" },
      tables: { account_deletion_requests: () => ({ data: null, error: { code: "23505", message: "duplicate key" } }) },
    }));
    expect(await requestDeletion(VALID, NOW)).toEqual({ ok: false, status: 409 });
  });
});

describe("cancelDeletion", () => {
  it("returns 404 when nothing is pending", async () => {
    // cancelDeletion never calls `.from()` on this table — the actual
    // transition is delegated entirely to the module-mocked
    // `cancelPendingDeletion` (Task 5, service-role). No table resolver is
    // registered here on purpose: a registered-but-unused resolver would
    // mislead a reader into thinking the 404 comes from an empty read.
    mount(createMockSupabase({ user: { id: "u1" }, tables: {} }));
    expect(await cancelDeletion(NOW)).toEqual({ ok: false, status: 404 });
  });
});

describe("getPendingDeletion", () => {
  it("returns null when the user has no live request", async () => {
    mount(createMockSupabase({
      user: { id: "u1" },
      tables: { account_deletion_requests: () => ({ data: null, error: null }) },
    }));
    expect(await getPendingDeletion()).toEqual({ ok: true, data: null });
  });
});
