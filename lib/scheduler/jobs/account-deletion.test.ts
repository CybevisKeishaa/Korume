import { beforeEach, describe, expect, it, vi } from "vitest";

/** Recorded per-call so assertions can check exact arguments — this is the
 *  job's OWN branching logic under test, not erase.ts's internals (already
 *  covered by lib/account-deletion/erase.test.ts). */
const executeDeletionCalls: unknown[] = [];
const purgeAuthUserCalls: string[] = [];

vi.mock("@/lib/account-deletion/erase", () => ({
  executeDeletion: (request: unknown) => {
    executeDeletionCalls.push(request);
    return Promise.resolve();
  },
  purgeAuthUser: (userId: string) => {
    purgeAuthUserCalls.push(userId);
    return Promise.resolve();
  },
}));

type ClaimedRow = {
  id: string;
  user_id: string;
  tier: "close_account" | "erase_all";
  purge_after: string | null;
};

let claimedRows: ClaimedRow[] = [];
let duePurgeRows: { user_id: string }[] = [];
let claimError: { message: string } | null = null;
let purgeQueryError: { message: string } | null = null;

/** Every argument the job passes into the claim / purge-query chains, so the
 *  "the claim IS the work" atomic-shape requirement is checkable: one
 *  update().eq().lte().select() call, not a select followed by a separate
 *  update. */
const requestsUpdateCalls: unknown[] = [];
const requestsEqCalls: [string, string][] = [];
const requestsLteCalls: [string, string][] = [];
const requestsSelectCalls: string[] = [];
const tombstoneSelectCalls: string[] = [];
const tombstoneLteCalls: [string, string][] = [];
const tombstoneDeleteEqCalls: [string, string][] = [];

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === "account_deletion_requests") {
        return {
          update: (values: unknown) => {
            requestsUpdateCalls.push(values);
            return {
              eq: (col: string, val: string) => {
                requestsEqCalls.push([col, val]);
                return {
                  lte: (col2: string, val2: string) => {
                    requestsLteCalls.push([col2, val2]);
                    return {
                      select: (cols: string) => {
                        requestsSelectCalls.push(cols);
                        if (claimError) return Promise.resolve({ data: null, error: claimError });
                        return Promise.resolve({ data: claimedRows, error: null });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "account_deletion_tombstones") {
        return {
          select: (cols: string) => {
            tombstoneSelectCalls.push(cols);
            return {
              lte: (col: string, val: string) => {
                tombstoneLteCalls.push([col, val]);
                if (purgeQueryError) return Promise.resolve({ data: null, error: purgeQueryError });
                return Promise.resolve({ data: duePurgeRows, error: null });
              },
            };
          },
          delete: () => ({
            eq: (col: string, val: string) => {
              tombstoneDeleteEqCalls.push([col, val]);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  }),
}));

import { accountDeletionJob } from "./account-deletion";

beforeEach(() => {
  executeDeletionCalls.length = 0;
  purgeAuthUserCalls.length = 0;
  claimedRows = [];
  duePurgeRows = [];
  claimError = null;
  purgeQueryError = null;
  requestsUpdateCalls.length = 0;
  requestsEqCalls.length = 0;
  requestsLteCalls.length = 0;
  requestsSelectCalls.length = 0;
  tombstoneSelectCalls.length = 0;
  tombstoneLteCalls.length = 0;
  tombstoneDeleteEqCalls.length = 0;
});

const NOW = new Date("2026-08-27T10:00:00.000Z");

describe("accountDeletionJob — the claim", () => {
  it("claims with a single update().eq('status','pending').lte('execute_after', now).select(...) chain", async () => {
    await accountDeletionJob.run(NOW);
    // One call each — never a separate select-then-update, which would race.
    expect(requestsUpdateCalls).toEqual([{ status: "executed", executed_at: NOW.toISOString() }]);
    expect(requestsEqCalls).toEqual([["status", "pending"]]);
    expect(requestsLteCalls).toEqual([["execute_after", NOW.toISOString()]]);
    expect(requestsSelectCalls).toEqual(["id, user_id, tier, purge_after"]);
  });

  it("throws when the claim query errors, without touching the purge query", async () => {
    claimError = { message: "connection reset" };
    await expect(accountDeletionJob.run(NOW)).rejects.toEqual(claimError);
    expect(tombstoneSelectCalls).toEqual([]);
  });
});

describe("accountDeletionJob — tier branching", () => {
  it("executes an erase_all row, passing tier and the row's purgeAfter through", async () => {
    claimedRows = [
      { id: "req1", user_id: "u1", tier: "erase_all", purge_after: "2026-11-18T10:00:00.000Z" },
    ];
    const handled = await accountDeletionJob.run(NOW);
    expect(executeDeletionCalls).toEqual([
      { id: "req1", userId: "u1", tier: "erase_all", purgeAfter: "2026-11-18T10:00:00.000Z" },
    ]);
    expect(handled).toBe(1);
  });

  it("executes a close_account row with purgeAfter forced to null", async () => {
    claimedRows = [{ id: "req2", user_id: "u2", tier: "close_account", purge_after: null }];
    const handled = await accountDeletionJob.run(NOW);
    expect(executeDeletionCalls).toEqual([
      { id: "req2", userId: "u2", tier: "close_account", purgeAfter: null },
    ]);
    expect(handled).toBe(1);
  });

  it(
    "skips a claimed erase_all row whose purge_after is null: logs an error, does not call " +
      "executeDeletion for it, does not throw, and still processes the other rows in the pass",
    async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      claimedRows = [
        { id: "bad", user_id: "u-bad", tier: "erase_all", purge_after: null },
        { id: "req3", user_id: "u3", tier: "close_account", purge_after: null },
      ];
      const handled = await accountDeletionJob.run(NOW);

      expect(executeDeletionCalls).toEqual([
        { id: "req3", userId: "u3", tier: "close_account", purgeAfter: null },
      ]);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("bad"));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("u-bad"));
      // Only the one genuinely-handled row counts.
      expect(handled).toBe(1);

      errorSpy.mockRestore();
    },
  );
});

describe("accountDeletionJob — the 90-day purge", () => {
  it("purges auth users whose tombstone purge_after is due, and deletes the tombstone row", async () => {
    duePurgeRows = [{ user_id: "u9" }];
    const handled = await accountDeletionJob.run(NOW);
    expect(purgeAuthUserCalls).toEqual(["u9"]);
    expect(tombstoneDeleteEqCalls).toEqual([["user_id", "u9"]]);
    expect(handled).toBe(1);
  });

  it("throws when the purge query errors", async () => {
    purgeQueryError = { message: "timeout" };
    await expect(accountDeletionJob.run(NOW)).rejects.toEqual(purgeQueryError);
  });
});

describe("accountDeletionJob — an empty pass", () => {
  it("returns 0 and calls neither executeDeletion nor purgeAuthUser when nothing is due", async () => {
    const handled = await accountDeletionJob.run(NOW);
    expect(handled).toBe(0);
    expect(executeDeletionCalls).toEqual([]);
    expect(purgeAuthUserCalls).toEqual([]);
  });
});
