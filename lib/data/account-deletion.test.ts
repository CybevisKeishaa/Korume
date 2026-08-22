import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cancelDeletion, getPendingDeletion, requestDeletion } from "./account-deletion";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/account-deletion/erase", () => ({ cancelPendingDeletion: vi.fn().mockResolvedValue(false) }));

const NOW = new Date("2026-08-20T10:00:00.000Z");
const VALID = { tier: "erase_all", confirmation: "DELETE", acknowledged: true } as const;

/** The USER's client — auth only, on the write paths. */
function mount(supabase: unknown) {
  vi.mocked(createClient).mockReturnValue(supabase as ReturnType<typeof createClient>);
}

/**
 * The SERVICE-ROLE client, which owns the deletion-request INSERT since the
 * whole-branch review's C2 fix. Registered separately from `mount` so a test
 * can prove WHICH client the write went through, not merely that a write
 * happened somewhere.
 */
function mountService(supabase: unknown) {
  vi.mocked(createServiceClient).mockReturnValue(supabase as ReturnType<typeof createServiceClient>);
}

/**
 * A user client that throws the moment anything asks it for a table. Every
 * `requestDeletion` test below mounts this: the ONLY thing that client is
 * allowed to do on the request path is `auth.getUser()`.
 */
function userClientWithNoTables(user: { id: string } | null) {
  return createMockSupabase({ user, tables: {} });
}

beforeEach(() => vi.clearAllMocks());

describe("requestDeletion", () => {
  it("refuses an anonymous caller before touching the table", async () => {
    let touched = false;
    mount(userClientWithNoTables(null));
    mountService(
      createMockSupabase({
        user: null,
        tables: { account_deletion_requests: () => { touched = true; return { data: null, error: null }; } },
      }),
    );
    expect(await requestDeletion(VALID, NOW)).toEqual({ ok: false, status: 401 });
    expect(touched).toBe(false);
  });

  /**
   * Whole-branch review C2. The insert used to run through the USER's client,
   * which forced `authenticated` to keep an INSERT grant on
   * `account_deletion_requests` — and the insert policy constrained only
   * `user_id` and `status`, leaving `execute_after`/`purge_after`/`tier`
   * free. Anyone holding a session token could POST straight to PostgREST
   * with `execute_after: now()` and have the scheduler erase them inside one
   * 60-second tick, skipping the typed confirmation, the acknowledgement and
   * the entire 7-day cancellation window. Reproduced against a real local
   * database at `ba28de2` (HTTP 201, both timestamps already in the past).
   *
   * The grant is what actually closes that hole (migration
   * `20260820000031`), and `L-005` is explicit that no mocked test can see a
   * grant — the real-database probe is the evidence. What THIS test guards is
   * the other half: that the application never needs the grant back. The user
   * client here has NO table resolver at all, so routing the insert back
   * through it throws rather than quietly re-opening the requirement.
   */
  it("writes through the service-role client, never the user's — the user client has no table access on this path", async () => {
    let insertedVia: "service" | null = null;
    mount(userClientWithNoTables({ id: "u1" }));
    mountService(
      createMockSupabase({
        user: { id: "u1" },
        tables: {
          account_deletion_requests: (calls) => {
            if (calls.some((c) => c.op === "insert")) insertedVia = "service";
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
      }),
    );

    const result = await requestDeletion(VALID, NOW);

    expect(result.ok).toBe(true);
    expect(insertedVia).toBe("service");
    expect(vi.mocked(createServiceClient)).toHaveBeenCalledTimes(1);
  });

  it("writes a pending row whose execute_after is the 7-day boundary, and purge_after the 90-day boundary for erase_all", async () => {
    let inserted: Record<string, unknown> | null = null;
    mount(userClientWithNoTables({ id: "u1" }));
    mountService(createMockSupabase({
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
    mount(userClientWithNoTables({ id: "u1" }));
    mountService(createMockSupabase({
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
    mount(userClientWithNoTables({ id: "u1" }));
    mountService(createMockSupabase({
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
  /**
   * The read stays on the USER's client on purpose (C2 keeps the SELECT
   * policy): `user_id = auth.uid()` is what scopes it, and a service-role
   * read would be scoped by nothing but the `.eq()` the caller remembered to
   * write. No service client is mounted here — reaching for one would throw.
   */
  it("returns null when the user has no live request", async () => {
    mount(createMockSupabase({
      user: { id: "u1" },
      tables: { account_deletion_requests: () => ({ data: null, error: null }) },
    }));
    expect(await getPendingDeletion()).toEqual({ ok: true, data: null });
  });

  it("rate-limits repeated reads, the same as POST and DELETE", async () => {
    mount(createMockSupabase({
      user: { id: "u-getlimit" },
      tables: { account_deletion_requests: () => ({ data: null, error: null }) },
    }));

    // The budget is the module's DELETION_LIMIT (5 per 60s). Five succeed on
    // one fixed clock reading; the sixth must be refused — spec §8 says
    // rate-limit every route, and the GET was the one that was not.
    const start = NOW.getTime();
    for (let i = 0; i < 5; i += 1) {
      expect(await getPendingDeletion(new Date(start))).toEqual({ ok: true, data: null });
    }
    const sixth = await getPendingDeletion(new Date(start));
    expect(sixth.ok).toBe(false);
    expect(sixth).toMatchObject({ status: 429 });
  });
});
