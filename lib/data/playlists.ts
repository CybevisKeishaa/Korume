import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser, selectVideoById } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeTranscriptText } from "@/lib/transcript/sanitize";
import type {
  AddPlaylistItemInput,
  CreatePlaylistInput,
  ListPublicPlaylistsQuery,
  ReorderPlaylistItemInput,
  UpdatePlaylistInput,
} from "@/lib/validation/playlists";

/**
 * User video playlists (CLAUDE.md §5 community module, spec §5). Ownership
 * writes (create/update/delete playlist, add/remove/reorder items) check
 * auth explicitly and are RLS-backstopped by `playlists_own`/
 * `playlist_items_own` (migration 20260712000002_rls.sql); browsing (own list,
 * one playlist's detail, the public directory) follows the
 * `lib/data/jlpt.ts`/`forum.ts` convention of no explicit auth check — RLS
 * (`playlists_public_read`/`playlist_items_public_read`, migration
 * 20260714000014_community_admin.sql) already scopes visibility.
 *
 * G1 (docs/product/business-model.md §1.1): playlist activity is NOT a
 * learning outcome — this module never calls `recordActivity`.
 */

const CREATE_LIMIT = { limit: 20, windowMs: 60_000 };
const ITEM_WRITE_LIMIT = { limit: 60, windowMs: 60_000 };
const MODIFY_LIMIT = { limit: 30, windowMs: 60_000 };

export interface PlaylistOwner {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

/**
 * Batch-resolve {id, name, avatar_url} via the service role — `users_select_own`
 * confines the normal client to the caller's own row. NEVER selects `email`.
 * Duplicated (not shared) across the four Layer 7 community `lib/data/*`
 * files deliberately — see `lib/data/forum.ts::fetchAuthors` for the same note.
 */
async function fetchOwners(userIds: string[]): Promise<Map<string, PlaylistOwner>> {
  const uniqueIds = Array.from(new Set(userIds));
  const map = new Map<string, PlaylistOwner>();
  if (uniqueIds.length === 0) return map;

  const service = createServiceClient();
  const { data, error } = await service.from("users").select("id, name, avatar_url").in("id", uniqueIds);
  if (error) throw error;
  for (const row of (data as { id: string; name: string | null; avatar_url: string | null }[]) ?? []) {
    map.set(row.id, { id: row.id, name: row.name, avatarUrl: row.avatar_url });
  }
  return map;
}

interface PlaylistRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
}

const PLAYLIST_COLUMNS = "id, user_id, name, description, is_public, created_at";

export interface PlaylistListItem {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  itemCount: number;
}

export type ListPlaylistsResult = { ok: true; data: PlaylistListItem[] } | { ok: false; status: 401 };

/** The caller's own playlists, with item counts. */
export async function listPlaylists(): Promise<ListPlaylistsResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const { data, error } = await supabase
    .from("user_playlists")
    .select(PLAYLIST_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data as PlaylistRow[]) ?? [];

  const counts = await countItemsByPlaylist(
    supabase,
    rows.map((r) => r.id),
  );

  return {
    ok: true,
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isPublic: row.is_public,
      createdAt: row.created_at,
      itemCount: counts.get(row.id) ?? 0,
    })),
  };
}

async function countItemsByPlaylist(
  supabase: ReturnType<typeof createClient>,
  playlistIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (playlistIds.length === 0) return counts;

  const { data, error } = await supabase.from("user_playlist_items").select("video_id, playlist_id").in("playlist_id", playlistIds);
  if (error) throw error;
  for (const row of (data as { playlist_id: string }[]) ?? []) {
    counts.set(row.playlist_id, (counts.get(row.playlist_id) ?? 0) + 1);
  }
  return counts;
}

export type CreatePlaylistResult =
  | { ok: true; data: { id: string; createdAt: string } }
  | { ok: false; status: 401 }
  | { ok: false; status: 429; retryAfter: number };

export async function createPlaylist(input: CreatePlaylistInput, now: Date = new Date()): Promise<CreatePlaylistResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`playlists:create:${user.id}`, CREATE_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data: inserted, error } = await supabase
    .from("user_playlists")
    .insert({
      user_id: user.id,
      name: sanitizeTranscriptText(input.name),
      description: input.description !== undefined ? sanitizeTranscriptText(input.description) : null,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;

  const row = inserted as { id: string; created_at: string };
  return { ok: true, data: { id: row.id, createdAt: row.created_at } };
}

interface PlaylistItemRow {
  video_id: string;
  order_index: number;
}

export interface PlaylistItemView {
  videoId: string;
  orderIndex: number;
  title: string;
  thumbnailUrl: string | null;
}

export interface PlaylistDetail {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  owner: PlaylistOwner | null;
  items: PlaylistItemView[];
}

/** One playlist (own OR public — RLS scopes visibility) with its items, ordered. */
export async function getPlaylist(id: string): Promise<PlaylistDetail | null> {
  const supabase = createClient();
  const { data: playlist, error: playlistError } = await supabase.from("user_playlists").select(PLAYLIST_COLUMNS).eq("id", id).maybeSingle();
  if (playlistError) throw playlistError;
  if (!playlist) return null;
  const playlistRow = playlist as PlaylistRow;

  const { data: items, error: itemsError } = await supabase
    .from("user_playlist_items")
    .select("video_id, order_index")
    .eq("playlist_id", id)
    .order("order_index", { ascending: true });
  if (itemsError) throw itemsError;
  const itemRows = (items as PlaylistItemRow[]) ?? [];

  const videoIds = itemRows.map((r) => r.video_id);
  const [owners, videos] = await Promise.all([fetchOwners([playlistRow.user_id]), fetchVideosById(supabase, videoIds)]);

  return {
    id: playlistRow.id,
    name: playlistRow.name,
    description: playlistRow.description,
    isPublic: playlistRow.is_public,
    createdAt: playlistRow.created_at,
    owner: owners.get(playlistRow.user_id) ?? null,
    items: itemRows.map((row) => {
      const video = videos.get(row.video_id);
      return {
        videoId: row.video_id,
        orderIndex: row.order_index,
        title: video?.title ?? "",
        thumbnailUrl: video?.thumbnail_url ?? null,
      };
    }),
  };
}

async function fetchVideosById(
  supabase: ReturnType<typeof createClient>,
  videoIds: string[],
): Promise<Map<string, { title: string; thumbnail_url: string | null }>> {
  const map = new Map<string, { title: string; thumbnail_url: string | null }>();
  if (videoIds.length === 0) return map;

  const { data, error } = await supabase.from("videos").select("id, title, thumbnail_url").in("id", videoIds);
  if (error) throw error;
  for (const row of (data as { id: string; title: string; thumbnail_url: string | null }[]) ?? []) {
    map.set(row.id, { title: row.title, thumbnail_url: row.thumbnail_url });
  }
  return map;
}

export type UpdatePlaylistResult =
  | { ok: true; data: { id: string } }
  | { ok: false; status: 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

export async function updatePlaylist(id: string, input: UpdatePlaylistInput, now: Date = new Date()): Promise<UpdatePlaylistResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`playlists:modify:${user.id}`, MODIFY_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const patch: { name?: string; description?: string | null; is_public?: boolean } = {};
  if (input.name !== undefined) patch.name = sanitizeTranscriptText(input.name);
  if (input.description !== undefined) patch.description = sanitizeTranscriptText(input.description);
  if (input.isPublic !== undefined) patch.is_public = input.isPublic;

  const { data, error } = await supabase.from("user_playlists").update(patch).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true, data: { id: (data as { id: string }).id } };
}

export type DeletePlaylistResult =
  | { ok: true }
  | { ok: false; status: 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

export async function deletePlaylist(id: string, now: Date = new Date()): Promise<DeletePlaylistResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`playlists:modify:${user.id}`, MODIFY_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data, error } = await supabase.from("user_playlists").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true };
}

export type AddPlaylistItemResult =
  | { ok: true; data: { videoId: string; orderIndex: number } }
  | { ok: false; status: 401 | 404 | 400 }
  | { ok: false; status: 409 }
  | { ok: false; status: 429; retryAfter: number };

export async function addPlaylistItem(playlistId: string, input: AddPlaylistItemInput, now: Date = new Date()): Promise<AddPlaylistItemResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`playlists:item:write:${user.id}`, ITEM_WRITE_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data: playlist, error: playlistError } = await supabase.from("user_playlists").select("id").eq("id", playlistId).eq("user_id", user.id).maybeSingle();
  if (playlistError) throw playlistError;
  if (!playlist) return { ok: false, status: 404 };

  const video = await selectVideoById(supabase, input.videoId);
  if (!video) return { ok: false, status: 400 };

  const { data: maxRow, error: maxError } = await supabase
    .from("user_playlist_items")
    .select("order_index")
    .eq("playlist_id", playlistId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxError) throw maxError;
  const nextOrderIndex = maxRow ? (maxRow as { order_index: number }).order_index + 1 : 0;

  const { error: insertError } = await supabase.from("user_playlist_items").insert({
    playlist_id: playlistId,
    video_id: input.videoId,
    order_index: nextOrderIndex,
  });
  if (insertError) {
    if (insertError.code === "23505") return { ok: false, status: 409 };
    return { ok: false, status: 400 };
  }

  return { ok: true, data: { videoId: input.videoId, orderIndex: nextOrderIndex } };
}

export type RemovePlaylistItemResult =
  | { ok: true }
  | { ok: false; status: 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

export async function removePlaylistItem(playlistId: string, videoId: string, now: Date = new Date()): Promise<RemovePlaylistItemResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`playlists:item:write:${user.id}`, ITEM_WRITE_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data, error } = await supabase
    .from("user_playlist_items")
    .delete()
    .eq("playlist_id", playlistId)
    .eq("video_id", videoId)
    .select("video_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true };
}

export type ReorderPlaylistItemResult =
  | { ok: true; data: { videoId: string; orderIndex: number } }
  | { ok: false; status: 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

export async function reorderPlaylistItem(
  playlistId: string,
  input: ReorderPlaylistItemInput,
  now: Date = new Date(),
): Promise<ReorderPlaylistItemResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`playlists:item:write:${user.id}`, ITEM_WRITE_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data, error } = await supabase
    .from("user_playlist_items")
    .update({ order_index: input.orderIndex })
    .eq("playlist_id", playlistId)
    .eq("video_id", input.videoId)
    .select("video_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true, data: { videoId: input.videoId, orderIndex: input.orderIndex } };
}

export interface PublicPlaylistListItem {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  owner: PlaylistOwner | null;
  itemCount: number;
}

export interface PublicPlaylistsPage {
  playlists: PublicPlaylistListItem[];
  nextCursor: string | null;
}

/** Browse public playlists, newest first, cursor-paginated. */
export async function listPublicPlaylists(query: ListPublicPlaylistsQuery): Promise<PublicPlaylistsPage> {
  const supabase = createClient();
  let dbQuery = supabase
    .from("user_playlists")
    .select(PLAYLIST_COLUMNS)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(query.limit);
  if (query.cursor) dbQuery = dbQuery.lt("created_at", query.cursor);

  const { data, error } = await dbQuery;
  if (error) throw error;
  const rows = (data as PlaylistRow[]) ?? [];

  const [owners, counts] = await Promise.all([
    fetchOwners(rows.map((r) => r.user_id)),
    countItemsByPlaylist(
      supabase,
      rows.map((r) => r.id),
    ),
  ]);

  const playlists: PublicPlaylistListItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    owner: owners.get(row.user_id) ?? null,
    itemCount: counts.get(row.id) ?? 0,
  }));

  const nextCursor = rows.length === query.limit ? (rows[rows.length - 1]?.created_at ?? null) : null;
  return { playlists, nextCursor };
}
