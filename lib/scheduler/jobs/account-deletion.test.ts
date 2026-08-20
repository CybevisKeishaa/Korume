import { beforeEach, describe, expect, it, vi } from "vitest";

/** Recorded per-call so assertions can check exact arguments — this is the
 *  job's OWN branching/recovery logic under test, not erase.ts's internals
 *  (already covered by lib/account-deletion/erase.test.ts). */
const executeDeletionCalls: unknown[] = [];
const purgeAuthUserCalls: string[] = [];
const liftBanCalls: string[] = [];

/** Shared, ordered log of "liftBan:userId" / "revert:requestId" tags — the
 *  only thing that can PROVE the ban was lifted BEFORE the row was
 *  reverted; two independent arrays cannot prove relative order, only a
 *  single shared sequence can (same technique as erase.test.ts's I4 note). */
const banThenRevertSequence: string[] = [];

/** Set per-test to make a specific user's executeDeletion call throw — the
 *  C1 scenario: "row 3 of 5 throws." */
let executeDeletionFailFor: Set<string> = new Set();
let purgeAuthUserFailFor: Set<string> = new Set();
/** Makes `liftBan` itself reject for a given user — proves a failed unban
 *  is logged loudly but never prevents the row revert that follows it
 *  (review round 3). */
let liftBanFailFor: Set<string> = new Set();

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
  liftBan: (userId: string) => {
    liftBanCalls.push(userId);
    banThenRevertSequence.push(`liftBan:${userId}`);
    if (liftBanFailFor.has(userId)) {
      return Promise.reject(new Error(`unban failed for ${userId}`));
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
/** Makes `revertToPending`'s own update().eq().select() report an error, to
 *  prove the revert failure is logged rather than silently swallowed or
 *  thrown. */
let revertError: { message: string } | null = null;
/** Per-request-id, makes the revert's own UPDATE match zero rows — models
 *  the N1 scenario: the request row already cascaded away because
 *  executeDeletion got past the users-row delete before something else
 *  failed, so there is genuinely nothing left to revert. */
let revertRowMissingFor: Set<string> = new Set();
/** Per-request-id, makes the revert's own update().eq().eq().select() chain
 *  REJECT rather than resolve with { error } — the shape a genuine network
 *  failure takes, as opposed to a well-formed PostgREST error response.
 *  Proves N4's try/catch around revertToPending's whole body actually
 *  catches a rejection, not just an { error } result (review round 3 item 2
 *  — round 2's N4 fix was itself unmutation-checked). */
let revertRejectsFor: Set<string> = new Set();

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
const revertSelectCalls: string[] = [];
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
                // .eq("id", requestId) — models the real chain, which then
                // requires a SECOND .eq("status", "executed") (review round
                // 3 item 1) before .select("id"): reverting must only ever
                // touch a row still in "executed" status, never one an
                // admin already moved to "cancelled".
                eq: (col1: string, requestId: string) => {
                  revertEqCalls.push([col1, requestId]);
                  banThenRevertSequence.push(`revert:${requestId}`);
                  return {
                    eq: (col2: string, val2: string) => {
                      revertEqCalls.push([col2, val2]);
                      return {
                        select: (cols: string) => {
                          revertSelectCalls.push(cols);
                          if (revertRejectsFor.has(requestId)) {
                            return Promise.reject(new Error(`network failure reverting ${requestId}`));
                          }
                          // Real client resolves { data, error, count, status, statusText }
                          // (review N6 — same shape fix m10 already applied to the
                          // tombstone delete mock).
                          if (revertError) {
                            return Promise.resolve({
                              data: null,
                              error: revertError,
                              count: null,
                              status: 500,
                              statusText: "Internal Server Error",
                            });
                          }
                          const matched = !revertRowMissingFor.has(requestId);
                          return Promise.resolve({
                            data: matched ? [{ id: requestId }] : [],
                            error: null,
                            count: matched ? 1 : 0,
                            status: 200,
                            statusText: "OK",
                          });
                        },
                      };
                    },
                  };
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
  liftBanCalls.length = 0;
  banThenRevertSequence.length = 0;
  executeDeletionFailFor = new Set();
  purgeAuthUserFailFor = new Set();
  liftBanFailFor = new Set();
  claimedRows = [];
  duePurgeRows = [];
  claimError = null;
  purgeQueryError = null;
  tombstoneDeleteErrorFor = new Set();
  revertError = null;
  revertRowMissingFor = new Set();
  revertRejectsFor = new Set();
  requestsUpdateCalls.length = 0;
  requestsEqCalls.length = 0;
  requestsLteCalls.length = 0;
  requestsSelectCalls.length = 0;
  revertUpdateCalls.length = 0;
  revertEqCalls.length = 0;
  revertSelectCalls.length = 0;
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

      // The revert is a real update(status: 'pending', executed_at: null)
      //   .eq('id', 'bad').eq('status', 'executed').select('id') —
      // this is what makes C2's fix different from merely skipping; the
      // second .eq (round 3 item 1) is the status guard, and .select('id')
      // is the N1 belt-and-braces proof it actually matched a row.
      expect(revertUpdateCalls).toEqual([{ status: "pending", executed_at: null }]);
      expect(revertEqCalls).toEqual([
        ["id", "bad"],
        ["status", "executed"],
      ]);
      expect(revertSelectCalls).toEqual(["id"]);

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
    expect(revertEqCalls).toEqual([
      ["id", "forged"],
      ["status", "executed"],
    ]);
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
    expect(revertEqCalls).toEqual([
      ["id", "r3"],
      ["status", "executed"],
    ]);
    // 4 executed successfully; row 3 counts as failed, not executed.
    expect(handled).toBe(4);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("r3"), expect.any(Error));

    errorSpy.mockRestore();
  });

  it(
    "lifts the ban on the user BEFORE reverting the row when a downstream step throws — " +
      "otherwise, since executeDeletion bans FIRST, the row goes back to 'pending' while the " +
      "account stays banned for ~100 years with no self-service way to sign in and cancel (round 3)",
    async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      executeDeletionFailFor = new Set(["u1"]);
      claimedRows = [row({ id: "r1", user_id: "u1", tier: "erase_all", purge_after: "2026-11-18T10:00:00.000Z" })];

      await accountDeletionJob.run(NOW);

      expect(liftBanCalls).toEqual(["u1"]);
      // Ban lifted BEFORE the row is reverted — a locked-out account is the
      // more urgent problem than a row stuck as "executed". Proved via the
      // shared sequence array, not two independent arrays (I4/erase.test.ts
      // technique) — that's the only thing that can show relative order.
      expect(banThenRevertSequence).toEqual(["liftBan:u1", "revert:r1"]);
      expect(revertEqCalls).toEqual([
        ["id", "r1"],
        ["status", "executed"],
      ]);

      errorSpy.mockRestore();
    },
  );

  it("logs loudly (with the user id) but STILL reverts the row when lifting the ban itself fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    executeDeletionFailFor = new Set(["u1"]);
    liftBanFailFor = new Set(["u1"]);
    claimedRows = [row({ id: "r1", user_id: "u1", tier: "erase_all", purge_after: "2026-11-18T10:00:00.000Z" })];

    await accountDeletionJob.run(NOW);

    expect(liftBanCalls).toEqual(["u1"]);
    // The revert must still happen even though the unban failed.
    expect(revertEqCalls).toEqual([
      ["id", "r1"],
      ["status", "executed"],
    ]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("LOCKED OUT"),
      expect.any(Error),
    );
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("u1"), expect.any(Error));

    errorSpy.mockRestore();
  });

  it(
    "does not crash or escape the row loop when the revert chain itself REJECTS (not just " +
      "returns { error }) — proves N4's try/catch genuinely catches a rejection, and row 2 " +
      "still runs (round 3 item 2 — round 2's N4 fix was unmutation-checked)",
    async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      executeDeletionFailFor = new Set(["u1"]);
      revertRejectsFor = new Set(["r1"]);
      claimedRows = [row({ id: "r1", user_id: "u1" }), row({ id: "r2", user_id: "u2" })];

      const handled = await accountDeletionJob.run(NOW);

      // row 2 still ran — the rejection from row 1's revert did not escape
      // and abort the loop.
      expect(executeDeletionCalls.map((c) => (c as { userId: string }).userId)).toEqual(["u1", "u2"]);
      expect(handled).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("FAILED to revert request r1"),
        expect.any(Error),
      );

      errorSpy.mockRestore();
    },
  );

  it("logs (but does not throw on) a revert that itself fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    executeDeletionFailFor = new Set(["u1"]);
    revertError = { message: "revert update failed" };
    claimedRows = [row({ id: "r1", user_id: "u1" })];

    await expect(accountDeletionJob.run(NOW)).resolves.toBe(0);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("FAILED to revert"), revertError);

    errorSpy.mockRestore();
  });

  it(
    "logs a DISTINCT message (not the generic revert-failed one) when the revert's UPDATE " +
      "matches zero rows — the request row already cascaded away past the users delete (N1) — " +
      "and does not throw",
    async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      executeDeletionFailFor = new Set(["u1"]);
      revertRowMissingFor = new Set(["r1"]);
      claimedRows = [row({ id: "r1", user_id: "u1" })];

      await expect(accountDeletionJob.run(NOW)).resolves.toBe(0);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("could not be reverted"),
      );
      expect(revertSelectCalls).toEqual(["id"]);

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

  it(
    "rejects a malformed tombstone row (missing/wrong-typed user_id) rather than trusting it " +
      "via a cast — an irreversible auth deletion must not run on unvalidated input (N3)",
    async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      duePurgeRows = [{ user_id: 12345 as unknown as string }, { user_id: "u14" }];

      const handled = await accountDeletionJob.run(NOW);

      // Only the valid row was ever handed to purgeAuthUser.
      expect(purgeAuthUserCalls).toEqual(["u14"]);
      expect(handled).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("malformed tombstone row"),
        expect.anything(),
      );

      errorSpy.mockRestore();
    },
  );
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
