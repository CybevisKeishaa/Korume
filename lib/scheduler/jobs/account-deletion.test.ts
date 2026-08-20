import { beforeEach, describe, expect, it, vi } from "vitest";

/** Recorded per-call so assertions can check exact arguments — this is the
 *  job's OWN branching/recovery logic under test, not erase.ts's internals
 *  (already covered by lib/account-deletion/erase.test.ts). */
const executeDeletionCalls: unknown[] = [];
const purgeAuthUserCalls: string[] = [];

/** Set per-test to make a specific user's executeDeletion call throw — the
 *  C1 scenario: "row 3 of 5 throws." */
let executeDeletionFailFor: Set<string> = new Set();
let purgeAuthUserFailFor: Set<string> = new Set();

vi.mock("@/lib/account-deletion/erase", () => ({
  executeDeletion: (request: { userId: string }) => {
    executeDeletionCalls.push(request);
    if (executeDeletionFailFor.has(request.userId)) {
      return Promise.reject(new Error(`storage erase incomplete for ${request.userId}`));
    }
    return Promise.resolve();
  },
  purgeAuthUser: (userId: string) => {
    purgeAuthUserCalls.push(userId);
    if (purgeAuthUserFailFor.has(userId)) {
      return Promise.reject(new Error(`purge failed for ${userId}`));
    }
    return Promise.resolve();
  },
}));

type ClaimedRow = {
  id: string;
  user_id: string;
  tier: "close_account" | "erase_all";
  purge_after: string | null;
};

let claimedRows: unknown[] = [];
let duePurgeRows: { user_id: string }[] = [];
let claimError: { message: string } | null = null;
let purgeQueryError: { message: string } | null = null;
/** Per-request-id, makes the tombstone-delete-after-purge report an error
 *  (review m10/I3 — the real client's `.delete().eq()` can fail and the
 *  error must be checked, not discarded). */
let tombstoneDeleteErrorFor: Set<string> = new Set();
/** Makes `revertToPending`'s own update().eq() report an error, to prove the
 *  revert failure is logged rather than silently swallowed or thrown. */
let revertError: { message: string } | null = null;

/** Every argument the job passes into the claim / revert / purge-query
 *  chains, so the "the claim IS the work" atomic-shape requirement is
 *  checkable: one update().eq().lte().select() call, never a select
 *  followed by a separate update. */
const requestsUpdateCalls: unknown[] = [];
const requestsEqCalls: [string, string][] = [];
const requestsLteCalls: [string, string][] = [];
const requestsSelectCalls: string[] = [];
const revertUpdateCalls: unknown[] = [];
const revertEqCalls: [string, string][] = [];
const tombstoneSelectCalls: string[] = [];
const tombstoneLteCalls: [string, string][] = [];
const tombstoneDeleteEqCalls: [string, string][] = [];

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === "account_deletion_requests") {
        return {
          update: (values: Record<string, unknown>) => {
            // Two distinct update() call shapes share this table: the claim
            // (status -> "executed") and the revert (status -> "pending").
            // Branching on the values themselves models the real chain each
            // one builds downstream.
            if (values.status === "executed") {
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
            }
            if (values.status === "pending") {
              revertUpdateCalls.push(values);
              return {
                eq: (col: string, val: string) => {
                  revertEqCalls.push([col, val]);
                  if (revertError) return Promise.resolve({ error: revertError });
                  return Promise.resolve({ error: null });
                },
              };
            }
            throw new Error(`unexpected update() values on account_deletion_requests: ${JSON.stringify(values)}`);
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
              // Real client resolves { data, error, count, status, statusText } —
              // not just { error } (review m10).
              if (tombstoneDeleteErrorFor.has(val)) {
                return Promise.resolve({
                  data: null,
                  error: { message: `delete failed for ${val}` },
                  count: null,
                  status: 400,
                  statusText: "Bad Request",
                });
              }
              return Promise.resolve({ data: null, error: null, count: null, status: 200, statusText: "OK" });
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
  executeDeletionFailFor = new Set();
  purgeAuthUserFailFor = new Set();
  claimedRows = [];
  duePurgeRows = [];
  claimError = null;
  purgeQueryError = null;
  tombstoneDeleteErrorFor = new Set();
  revertError = null;
  requestsUpdateCalls.length = 0;
  requestsEqCalls.length = 0;
  requestsLteCalls.length = 0;
  requestsSelectCalls.length = 0;
  revertUpdateCalls.length = 0;
  revertEqCalls.length = 0;
  tombstoneSelectCalls.length = 0;
  tombstoneLteCalls.length = 0;
  tombstoneDeleteEqCalls.length = 0;
});

const NOW = new Date("2026-08-27T10:00:00.000Z");

function row(overrides: Partial<ClaimedRow>): ClaimedRow {
  return { id: "req", user_id: "u", tier: "close_account", purge_after: null, ...overrides };
}

describe("accountDeletionJob — the claim", () => {
  it("claims with a single update().eq('status','pending').lte('execute_after', now).select(...) chain", async () => {
    await accountDeletionJob.run(NOW);
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
    claimedRows = [row({ id: "req1", user_id: "u1", tier: "erase_all", purge_after: "2026-11-18T10:00:00.000Z" })];
    const handled = await accountDeletionJob.run(NOW);
    expect(executeDeletionCalls).toEqual([
      { id: "req1", userId: "u1", tier: "erase_all", purgeAfter: "2026-11-18T10:00:00.000Z" },
    ]);
    expect(handled).toBe(1);
    expect(revertUpdateCalls).toEqual([]);
  });

  it("executes a close_account row with purgeAfter forced to null", async () => {
    claimedRows = [row({ id: "req2", user_id: "u2", tier: "close_account" })];
    const handled = await accountDeletionJob.run(NOW);
    expect(executeDeletionCalls).toEqual([{ id: "req2", userId: "u2", tier: "close_account", purgeAfter: null }]);
    expect(handled).toBe(1);
  });
});

describe("accountDeletionJob — the malformed-row guard reverts to pending (C2)", () => {
  it(
    "skips a claimed erase_all row whose purge_after is null: logs an error, reverts it to " +
      "pending (not left as executed), does not call executeDeletion for it, does not throw, " +
      "and still processes the other rows in the pass",
    async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      claimedRows = [
        row({ id: "bad", user_id: "u-bad", tier: "erase_all", purge_after: null }),
        row({ id: "req3", user_id: "u3", tier: "close_account" }),
      ];
      const handled = await accountDeletionJob.run(NOW);

      expect(executeDeletionCalls).toEqual([{ id: "req3", userId: "u3", tier: "close_account", purgeAfter: null }]);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("bad"));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("u-bad"));
      expect(handled).toBe(1);

      // The revert is a real update(status: 'pending', executed_at: null).eq('id', 'bad') —
      // this is what makes C2's fix different from merely skipping.
      expect(revertUpdateCalls).toEqual([{ status: "pending", executed_at: null }]);
      expect(revertEqCalls).toEqual([["id", "bad"]]);

      errorSpy.mockRestore();
    },
  );

  it("rejects a claimed row that fails schema validation (e.g. an unrecognized tier) and reverts it to pending", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    claimedRows = [
      { id: "forged", user_id: "u-forged", tier: "not_a_real_tier", purge_after: null },
      row({ id: "req4", user_id: "u4", tier: "close_account" }),
    ];
    const handled = await accountDeletionJob.run(NOW);

    expect(executeDeletionCalls).toEqual([{ id: "req4", userId: "u4", tier: "close_account", purgeAfter: null }]);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("forged"), expect.anything());
    expect(revertEqCalls).toEqual([["id", "forged"]]);
    expect(handled).toBe(1);

    errorSpy.mockRestore();
  });
});

describe("accountDeletionJob — a row's throw reverts only that row (C1)", () => {
  it("reverts row 3 of 5 to pending when its executeDeletion throws, and still processes rows 4 and 5", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    executeDeletionFailFor = new Set(["u3"]);
    claimedRows = [
      row({ id: "r1", user_id: "u1" }),
      row({ id: "r2", user_id: "u2" }),
      row({ id: "r3", user_id: "u3" }),
      row({ id: "r4", user_id: "u4" }),
      row({ id: "r5", user_id: "u5" }),
    ];

    const handled = await accountDeletionJob.run(NOW);

    // All five were attempted — row 3's failure did not stop the loop.
    expect(executeDeletionCalls.map((c) => (c as { userId: string }).userId)).toEqual(["u1", "u2", "u3", "u4", "u5"]);
    // Only row 3 was reverted.
    expect(revertEqCalls).toEqual([["id", "r3"]]);
    // 4 executed successfully; row 3 counts as failed, not executed.
    expect(handled).toBe(4);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("r3"), expect.any(Error));

    errorSpy.mockRestore();
  });

  it("logs (but does not throw on) a revert that itself fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    executeDeletionFailFor = new Set(["u1"]);
    revertError = { message: "revert update failed" };
    claimedRows = [row({ id: "r1", user_id: "u1" })];

    await expect(accountDeletionJob.run(NOW)).resolves.toBe(0);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("FAILED to revert"), revertError);

    errorSpy.mockRestore();
  });
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

  it("counts a failed tombstone delete as failed, logs it, and continues to the next row (I3/m10)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    tombstoneDeleteErrorFor = new Set(["u10"]);
    duePurgeRows = [{ user_id: "u10" }, { user_id: "u11" }];

    const handled = await accountDeletionJob.run(NOW);

    expect(purgeAuthUserCalls).toEqual(["u10", "u11"]);
    expect(handled).toBe(1); // only u11 fully completed
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("u10"), expect.anything());

    errorSpy.mockRestore();
  });

  it("counts a purgeAuthUser throw as failed and continues to the next row", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    purgeAuthUserFailFor = new Set(["u12"]);
    duePurgeRows = [{ user_id: "u12" }, { user_id: "u13" }];

    const handled = await accountDeletionJob.run(NOW);

    expect(handled).toBe(1); // only u13
    expect(tombstoneDeleteEqCalls).toEqual([["user_id", "u13"]]); // never reached for u12
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("u12"), expect.any(Error));

    errorSpy.mockRestore();
  });
});

describe("accountDeletionJob — structured pass logging (I6)", () => {
  it("logs a single structured counts object on a clean pass, even when nothing was due", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const handled = await accountDeletionJob.run(NOW);
    expect(handled).toBe(0);
    expect(infoSpy).toHaveBeenCalledWith(
      "[scheduler] account-deletion pass",
      { claimed: 0, executed: 0, skipped: 0, purged: 0, failed: 0 },
    );
    infoSpy.mockRestore();
  });

  it("logs the accumulated counts before rethrowing when the claim query errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    claimError = { message: "connection reset" };
    await expect(accountDeletionJob.run(NOW)).rejects.toEqual(claimError);
    expect(errorSpy).toHaveBeenCalledWith(
      "[scheduler] account-deletion pass FAILED",
      { claimed: 0, executed: 0, skipped: 0, purged: 0, failed: 0 },
      claimError,
    );
    errorSpy.mockRestore();
  });

  it("reflects a mix of executed/skipped/purged/failed in one pass", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    executeDeletionFailFor = new Set(["u-fail"]);
    claimedRows = [
      row({ id: "ok1", user_id: "u-ok1" }),
      row({ id: "bad", user_id: "u-bad", tier: "erase_all", purge_after: null }),
      row({ id: "fail1", user_id: "u-fail" }),
    ];
    duePurgeRows = [{ user_id: "u-purged" }];

    const handled = await accountDeletionJob.run(NOW);

    expect(handled).toBe(2); // ok1 executed + u-purged purged
    expect(infoSpy).toHaveBeenCalledWith(
      "[scheduler] account-deletion pass",
      { claimed: 3, executed: 1, skipped: 1, purged: 1, failed: 1 },
    );
    infoSpy.mockRestore();
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
