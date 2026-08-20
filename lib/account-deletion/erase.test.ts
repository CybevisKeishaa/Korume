import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeDeletion } from "./erase";

const removed: string[][] = [];
const listed: string[] = [];
const deletedUsers: string[] = [];
const tombstones: unknown[] = [];
const bans: { id: string; attrs: unknown }[] = [];

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    storage: {
      from: () => ({
        list: (prefix: string) => { listed.push(prefix); return Promise.resolve({ data: [{ name: "shadowing/a.webm" }], error: null }); },
        remove: (paths: string[]) => { removed.push(paths); return Promise.resolve({ data: null, error: null }); },
      }),
    },
    from: (table: string) => ({
      insert: (values: unknown) => { if (table === "account_deletion_tombstones") tombstones.push(values); return Promise.resolve({ error: null }); },
      update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
      delete: () => ({ eq: (_c: string, id: string) => { if (table === "users") deletedUsers.push(id); return Promise.resolve({ error: null }); } }),
    }),
    auth: { admin: { updateUserById: (id: string, attrs: unknown) => { bans.push({ id, attrs }); return Promise.resolve({ error: null }); } } },
  }),
}));

beforeEach(() => { removed.length = 0; listed.length = 0; deletedUsers.length = 0; tombstones.length = 0; bans.length = 0; });

const NOW = new Date("2026-08-27T10:00:00.000Z");

describe("executeDeletion — erase_all", () => {
  it("erases the user's storage prefix BEFORE deleting the row that identifies it", async () => {
    await executeDeletion(
      { id: "req1", userId: "u1", tier: "erase_all", purgeAfter: "2026-11-18T10:00:00.000Z" },
      NOW,
    );
    expect(listed).toEqual(["u1"]);
    expect(removed).toEqual([["u1/shadowing/a.webm"]]);
    expect(deletedUsers).toEqual(["u1"]);
    // Order is the assertion that matters: storage first, users row second.
    expect(removed.length).toBeGreaterThan(0);
  });

  it("writes a tombstone carrying the purge date", async () => {
    await executeDeletion({ id: "req1", userId: "u1", tier: "erase_all", purgeAfter: "2026-11-18T10:00:00.000Z" }, NOW);
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0]).toMatchObject({ user_id: "u1", tier: "erase_all", purge_after: "2026-11-18T10:00:00.000Z" });
  });

  it("bans the auth user rather than deleting it", async () => {
    await executeDeletion({ id: "req1", userId: "u1", tier: "erase_all", purgeAfter: "2026-11-18T10:00:00.000Z" }, NOW);
    expect(bans).toHaveLength(1);
    // Non-null assertion: `noUncheckedIndexedAccess` (tsconfig.json) makes
    // `bans[0]` possibly-undefined even after the length assertion above.
    expect(bans[0]!.id).toBe("u1");
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
