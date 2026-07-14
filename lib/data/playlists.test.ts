import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import {
  addPlaylistItem,
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  listPlaylists,
  listPublicPlaylists,
  removePlaylistItem,
  reorderPlaylistItem,
  updatePlaylist,
} from "./playlists";

const USER = { id: "u1" };
const OTHER = { id: "u2" };
const PLAYLIST_ID = "b0000000-0000-0000-0000-000000000001";
const VIDEO_ID = "b0000000-0000-0000-0000-000000000002";

function mockClient(tables: Parameters<typeof createMockSupabase>[0]["tables"], user: { id: string } | null = USER) {
  const supabase = createMockSupabase({ user, tables });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return supabase;
}

function mockService(tables: Parameters<typeof createMockSupabase>[0]["tables"]) {
  const supabase = createMockSupabase({ tables });
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
  return supabase;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(createServiceClient).mockReset();
});

const PLAYLIST_ROW = {
  id: PLAYLIST_ID,
  user_id: USER.id,
  name: "My list",
  description: null,
  is_public: false,
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("listPlaylists", () => {
  it("returns 401 when signed out", async () => {
    mockClient({}, null);
    expect(await listPlaylists()).toEqual({ ok: false, status: 401 });
  });

  it("returns the caller's playlists with item counts", async () => {
    mockClient({
      user_playlists: (calls: QueryCall[]) => {
        expect(calls.some((c) => c.op === "eq" && c.column === "user_id" && c.value === USER.id)).toBe(true);
        return { data: [PLAYLIST_ROW], error: null };
      },
      user_playlist_items: () => ({ data: [{ playlist_id: PLAYLIST_ID, video_id: VIDEO_ID }], error: null }),
    });

    const result = await listPlaylists();
    expect(result).toEqual({
      ok: true,
      data: [{ id: PLAYLIST_ID, name: "My list", description: null, isPublic: false, createdAt: PLAYLIST_ROW.created_at, itemCount: 1 }],
    });
  });
});

describe("createPlaylist", () => {
  it("sanitizes name/description", async () => {
    let insertedRow: unknown;
    mockClient({
      user_playlists: (calls: QueryCall[]) => {
        const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
        insertedRow = insertCall?.values;
        return { data: { id: PLAYLIST_ID, created_at: PLAYLIST_ROW.created_at }, error: null };
      },
    });

    const result = await createPlaylist({ name: "<b>list</b>", description: "desc" });
    expect(result).toEqual({ ok: true, data: { id: PLAYLIST_ID, createdAt: PLAYLIST_ROW.created_at } });
    expect((insertedRow as Record<string, unknown>).name).toBe("list");
    expect((insertedRow as Record<string, unknown>).user_id).toBe(USER.id);
  });
});

describe("getPlaylist", () => {
  it("returns null when not found / not visible", async () => {
    mockClient({ user_playlists: () => ({ data: null, error: null }) });
    expect(await getPlaylist(PLAYLIST_ID)).toBeNull();
  });

  it("returns the playlist with ordered items joined to video title/thumbnail", async () => {
    mockClient({
      user_playlists: () => ({ data: PLAYLIST_ROW, error: null }),
      user_playlist_items: () => ({
        data: [
          { video_id: VIDEO_ID, order_index: 0 },
        ],
        error: null,
      }),
      videos: () => ({ data: [{ id: VIDEO_ID, title: "Video A", thumbnail_url: "thumb.jpg" }], error: null }),
    });
    mockService({ users: () => ({ data: [{ id: USER.id, name: "Alice", avatar_url: null }], error: null }) });

    const detail = await getPlaylist(PLAYLIST_ID);
    expect(detail?.owner).toEqual({ id: USER.id, name: "Alice", avatarUrl: null });
    expect(detail?.items).toEqual([{ videoId: VIDEO_ID, orderIndex: 0, title: "Video A", thumbnailUrl: "thumb.jpg" }]);
  });
});

describe("updatePlaylist / deletePlaylist", () => {
  it("returns 404 when not owned", async () => {
    mockClient({ user_playlists: () => ({ data: null, error: null }) });
    expect(await updatePlaylist(PLAYLIST_ID, { name: "x" })).toEqual({ ok: false, status: 404 });
    expect(await deletePlaylist(PLAYLIST_ID)).toEqual({ ok: false, status: 404 });
  });

  it("updates isPublic and sanitized name together", async () => {
    mockClient({
      user_playlists: (calls: QueryCall[]) => {
        const updateCall = calls.find((c): c is Extract<QueryCall, { op: "update" }> => c.op === "update");
        expect(updateCall?.values).toEqual({ name: "clean", is_public: true });
        return { data: { id: PLAYLIST_ID }, error: null };
      },
    });
    const result = await updatePlaylist(PLAYLIST_ID, { name: "<i>clean</i>", isPublic: true });
    expect(result).toEqual({ ok: true, data: { id: PLAYLIST_ID } });
  });
});

describe("addPlaylistItem", () => {
  it("returns 404 when the playlist isn't owned by the caller", async () => {
    mockClient({ user_playlists: () => ({ data: null, error: null }) });
    const result = await addPlaylistItem(PLAYLIST_ID, { videoId: VIDEO_ID });
    expect(result).toEqual({ ok: false, status: 404 });
  });

  it("returns 400 when the video doesn't exist/isn't visible", async () => {
    mockClient({
      user_playlists: () => ({ data: { id: PLAYLIST_ID }, error: null }),
      videos: () => ({ data: null, error: null }),
    });
    const result = await addPlaylistItem(PLAYLIST_ID, { videoId: VIDEO_ID });
    expect(result).toEqual({ ok: false, status: 400 });
  });

  it("computes the next order_index and inserts", async () => {
    let insertedRow: unknown;
    mockClient({
      user_playlists: () => ({ data: { id: PLAYLIST_ID }, error: null }),
      videos: () => ({ data: { id: VIDEO_ID, title: "t", thumbnail_url: null }, error: null }),
      user_playlist_items: (calls: QueryCall[]) => {
        const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
        if (insertCall) {
          insertedRow = insertCall.values;
          return { data: null, error: null };
        }
        return { data: { order_index: 2 }, error: null };
      },
    });

    const result = await addPlaylistItem(PLAYLIST_ID, { videoId: VIDEO_ID });
    expect(result).toEqual({ ok: true, data: { videoId: VIDEO_ID, orderIndex: 3 } });
    expect(insertedRow).toEqual({ playlist_id: PLAYLIST_ID, video_id: VIDEO_ID, order_index: 3 });
  });

  it("maps a unique-violation (duplicate item) to 409", async () => {
    mockClient({
      user_playlists: () => ({ data: { id: PLAYLIST_ID }, error: null }),
      videos: () => ({ data: { id: VIDEO_ID, title: "t", thumbnail_url: null }, error: null }),
      user_playlist_items: (calls: QueryCall[]) => {
        const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
        if (insertCall) return { data: null, error: { message: "duplicate", code: "23505" } };
        return { data: null, error: null };
      },
    });

    const result = await addPlaylistItem(PLAYLIST_ID, { videoId: VIDEO_ID });
    expect(result).toEqual({ ok: false, status: 409 });
  });
});

describe("removePlaylistItem / reorderPlaylistItem", () => {
  it("removePlaylistItem returns 404 when no row matched", async () => {
    mockClient({ user_playlist_items: () => ({ data: null, error: null }) });
    expect(await removePlaylistItem(PLAYLIST_ID, VIDEO_ID)).toEqual({ ok: false, status: 404 });
  });

  it("reorderPlaylistItem updates order_index and returns 404 when no row matched", async () => {
    mockClient({ user_playlist_items: () => ({ data: null, error: null }) });
    expect(await reorderPlaylistItem(PLAYLIST_ID, { videoId: VIDEO_ID, orderIndex: 5 })).toEqual({ ok: false, status: 404 });
  });
});

describe("listPublicPlaylists", () => {
  it("returns public playlists with owner + item count and a cursor", async () => {
    mockClient({
      user_playlists: (calls: QueryCall[]) => {
        expect(calls.some((c) => c.op === "eq" && c.column === "is_public" && c.value === true)).toBe(true);
        return { data: [{ ...PLAYLIST_ROW, is_public: true, user_id: OTHER.id }], error: null };
      },
      user_playlist_items: () => ({ data: [], error: null }),
    });
    mockService({ users: () => ({ data: [{ id: OTHER.id, name: "Bob", avatar_url: null }], error: null }) });

    const page = await listPublicPlaylists({ limit: 1 });
    expect(page.playlists[0]?.owner).toEqual({ id: OTHER.id, name: "Bob", avatarUrl: null });
    expect(page.nextCursor).toBe(PLAYLIST_ROW.created_at);
  });
});
