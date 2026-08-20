import { beforeEach, describe, expect, it, vi } from "vitest";
import { cancelPendingDeletion, executeDeletion, liftBan, purgeAuthUser } from "./erase";

type ListEntry = { name: string; id: string | null };

/** Every mocked call pushes a tag here — the ONLY thing that can prove the
 *  eraser's steps ran in the required order (I4: three independent arrays
 *  cannot prove sequence, only a single shared log can). */
const sequence: string[] = [];

const removed: string[][] = [];
const deletedUsers: string[] = [];
const tombstones: unknown[] = [];
const bans: { id: string; attrs: unknown }[] = [];
const deletedAuthUsers: string[] = [];
const cancelFilters: { userId: string; statusEq: string }[] = [];

/** prefix -> pages of entries, consumed in order as `list()` is called
 *  repeatedly against that same prefix (models real pagination: each call
 *  advances to the next page). Reset per test in beforeEach. */
let listPages: Record<string, ListEntry[][]> = {};
let listCallCounts: Record<string, number> = {};

/** When true, `remove()` reports deleting one fewer object than it was
 *  asked to — the "Storage silently left something behind" case C1 must
 *  catch by comparing what it asked for against what Storage confirms. */
let removeShortfall = false;

/** userId -> the request id of a live pending row, or absent for "no
 *  pending request for this user". */
let pendingRequestsByUser: Record<string, string> = {};

/** When set, `auth.admin.deleteUser` reports this error instead of success —
 *  used to model both "already gone" (status 404, must be tolerated) and a
 *  real failure (any other status, must still throw). */
let deleteUserError: { status?: number; message: string } | null = null;

/** When set, `auth.admin.updateUserById` (the ban) reports this error
 *  instead of success — used to prove the ban runs FIRST and that nothing
 *  downstream of it runs when it fails (review N1). */
let banError: { message: string } | null = null;

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    storage: {
      from: () => ({
        list: (prefix: string, options?: { limit?: number; offset?: number }) => {
          sequence.push(`list:${prefix}`);
          void options;
          const idx = listCallCounts[prefix] ?? 0;
          listCallCounts[prefix] = idx + 1;
          const pages = listPages[prefix] ?? [[]];
          const page = pages[idx] ?? [];
          return Promise.resolve({ data: page, error: null });
        },
        remove: (paths: string[]) => {
          sequence.push("remove");
          removed.push(paths);
          const reported = removeShortfall ? paths.slice(0, paths.length - 1) : paths;
          return Promise.resolve({ data: reported.map((name) => ({ name })), error: null });
        },
      }),
    },
    from: (table: string) => ({
      // Real code path: `account_deletion_tombstones` upsert (I7 — not a
      // plain insert, so a retry after a partial failure doesn't collide on
      // the primary key).
      upsert: (values: unknown, opts: unknown) => {
        if (table === "account_deletion_tombstones") {
          sequence.push("tombstone");
          tombstones.push(values);
          void opts;
        }
        return Promise.resolve({ error: null });
      },
      // Real code path: `account_deletion_requests` cancel, chained
      // `.update().eq("user_id", …).eq("status", "pending").select("id")`.
      update: () => ({
        eq: (col1: string, val1: string) => ({
          eq: (col2: string, val2: string) => ({
            select: () => {
              if (table === "account_deletion_requests") {
                sequence.push("cancel-update");
                cancelFilters.push({
                  userId: col1 === "user_id" ? val1 : "",
                  statusEq: col2 === "status" ? val2 : "",
                });
                const reqId = col2 === "status" && val2 === "pending" ? pendingRequestsByUser[val1] : undefined;
                return Promise.resolve({ data: reqId ? [{ id: reqId }] : [], error: null });
              }
              return Promise.resolve({ data: [], error: null });
            },
          }),
        }),
      }),
      delete: () => ({
        eq: (_c: string, id: string) => {
          if (table === "users") {
            sequence.push("delete-user");
            deletedUsers.push(id);
          }
          return Promise.resolve({ error: null });
        },
      }),
    }),
    auth: {
      admin: {
        updateUserById: (id: string, attrs: unknown) => {
          sequence.push("ban");
          if (banError) return Promise.resolve({ error: banError });
          bans.push({ id, attrs });
          return Promise.resolve({ error: null });
        },
        deleteUser: (id: string) => {
          sequence.push("purge");
          if (deleteUserError) return Promise.resolve({ error: deleteUserError });
          deletedAuthUsers.push(id);
          return Promise.resolve({ error: null });
        },
      },
    },
  }),
}));

beforeEach(() => {
  sequence.length = 0;
  removed.length = 0;
  deletedUsers.length = 0;
  tombstones.length = 0;
  bans.length = 0;
  deletedAuthUsers.length = 0;
  cancelFilters.length = 0;
  listCallCounts = {};
  removeShortfall = false;
  pendingRequestsByUser = {};
  deleteUserError = null;
  banError = null;
  // Default fixture: `u1` holds one folder "shadowing", which holds one file
  // "a.webm" — `list()` is one level deep, so reaching the file requires
  // recursing into the folder entry.
  listPages = {
    u1: [[{ name: "shadowing", id: null }]],
    "u1/shadowing": [[{ name: "a.webm", id: "file-1" }]],
  };
});

const NOW = new Date("2026-08-27T10:00:00.000Z");

describe("executeDeletion — erase_all", () => {
  it("recurses into folder entries and removes the actual file keys (not the folder name)", async () => {
    await executeDeletion(
      { id: "req1", userId: "u1", tier: "erase_all", purgeAfter: "2026-11-18T10:00:00.000Z" },
      NOW,
    );
    expect(sequence.filter((s) => s.startsWith("list:"))).toEqual(["list:u1", "list:u1/shadowing"]);
    expect(removed).toEqual([["u1/shadowing/a.webm"]]);
  });

  it("bans FIRST, THEN erases storage, THEN writes the tombstone, THEN deletes the users row — in that exact order", async () => {
    await executeDeletion(
      { id: "req1", userId: "u1", tier: "erase_all", purgeAfter: "2026-11-18T10:00:00.000Z" },
      NOW,
    );
    expect(sequence).toEqual(["ban", "list:u1", "list:u1/shadowing", "remove", "tombstone", "delete-user"]);
  });

  it("throws when the ban fails, and touches nothing downstream — storage, tombstone, and the users row are all untouched (N1)", async () => {
    banError = { message: "auth service unreachable" };
    await expect(
      executeDeletion(
        { id: "req6", userId: "u1", tier: "erase_all", purgeAfter: "2026-11-18T10:00:00.000Z" },
        NOW,
      ),
    ).rejects.toEqual(banError);
    expect(sequence).toEqual(["ban"]);
    expect(removed).toEqual([]);
    expect(tombstones).toEqual([]);
    expect(deletedUsers).toEqual([]);
  });

  it("pages through more than one page of listings before recursing (list() defaults to 100 per page)", async () => {
    listPages = {
      u1: [
        Array.from({ length: 100 }, (_, i) => ({ name: `f${i}.webm`, id: `id-${i}` })),
        [{ name: "f100.webm", id: "id-100" }],
      ],
    };
    await executeDeletion(
      { id: "req3", userId: "u1", tier: "erase_all", purgeAfter: "2026-11-18T10:00:00.000Z" },
      NOW,
    );
    expect(sequence.filter((s) => s === "list:u1")).toHaveLength(2);
    expect(removed[0]).toHaveLength(101);
  });

  it("throws when Storage reports removing fewer objects than it was asked to, and never reaches the users delete", async () => {
    removeShortfall = true;
    await expect(
      executeDeletion(
        { id: "req4", userId: "u1", tier: "erase_all", purgeAfter: "2026-11-18T10:00:00.000Z" },
        NOW,
      ),
    ).rejects.toThrow();
    expect(deletedUsers).toEqual([]);
  });

  it("writes a tombstone carrying the purge date", async () => {
    await executeDeletion({ id: "req1", userId: "u1", tier: "erase_all", purgeAfter: "2026-11-18T10:00:00.000Z" }, NOW);
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0]).toMatchObject({ user_id: "u1", tier: "erase_all", purge_after: "2026-11-18T10:00:00.000Z" });
  });

  it("bans the auth user rather than deleting it", async () => {
    await executeDeletion({ id: "req1", userId: "u1", tier: "erase_all", purgeAfter: "2026-11-18T10:00:00.000Z" }, NOW);
    expect(bans.map((b) => b.id)).toEqual(["u1"]);
  });
});

describe("executeDeletion — close_account", () => {
  it("bans the account and touches neither storage nor the users row", async () => {
    await executeDeletion({ id: "req2", userId: "u2", tier: "close_account", purgeAfter: null }, NOW);
    expect(bans.map((b) => b.id)).toEqual(["u2"]);
    expect(removed).toEqual([]);
    expect(deletedUsers).toEqual([]);
    expect(tombstones).toEqual([]);
  });
});

describe("cancelPendingDeletion", () => {
  it("cancels a live pending request, filtering on user_id then status = 'pending', and returns true", async () => {
    pendingRequestsByUser = { u5: "req5" };
    const result = await cancelPendingDeletion("u5", NOW);
    expect(result).toBe(true);
    expect(cancelFilters).toEqual([{ userId: "u5", statusEq: "pending" }]);
  });

  it("returns false when the user has no pending request", async () => {
    pendingRequestsByUser = {};
    const result = await cancelPendingDeletion("u6", NOW);
    expect(result).toBe(false);
  });
});

describe("purgeAuthUser", () => {
  it("deletes the auth user (the 90-day purge step, not a ban)", async () => {
    await purgeAuthUser("u7");
    expect(deletedAuthUsers).toEqual(["u7"]);
  });

  it("tolerates a 404 (auth user already gone) rather than throwing, so a retry converges", async () => {
    deleteUserError = { status: 404, message: "User not found" };
    await expect(purgeAuthUser("u8")).resolves.toBeUndefined();
  });

  it("still throws on a non-404 auth error", async () => {
    deleteUserError = { status: 500, message: "internal error" };
    await expect(purgeAuthUser("u9")).rejects.toEqual(deleteUserError);
  });
});

describe("liftBan", () => {
  it("calls updateUserById with ban_duration: 'none' — the inverse of the ban executeDeletion applies", async () => {
    await liftBan("u10");
    expect(bans).toEqual([{ id: "u10", attrs: { ban_duration: "none" } }]);
  });

  it("throws when the unban call itself fails", async () => {
    banError = { message: "auth service unreachable" };
    await expect(liftBan("u11")).rejects.toEqual(banError);
  });
});
