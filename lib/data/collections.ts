import "server-only";
import { createClient } from "@/lib/supabase/server";
import { VIDEO_COLUMNS, type VideoRow } from "@/lib/data/videos";

/**
 * A curated set that CONTAINS lessons. Not an attribute of a lesson, and not
 * derived from `videos.jlpt_level_estimate` — see the seed migration's comment
 * (spec §3.5).
 */
export interface Collection {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  displayOrder: number;
}

interface CollectionRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  display_order: number;
}

const COLLECTION_COLUMNS = "id, slug, title, description, cover_image_url, display_order";

function toCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverImageUrl: row.cover_image_url,
    displayOrder: row.display_order,
  };
}

export async function listCollections(): Promise<Collection[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("collections")
    .select(COLLECTION_COLUMNS)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return ((data as CollectionRow[] | null) ?? []).map(toCollection);
}

export async function getCollectionBySlug(slug: string): Promise<Collection | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("collections")
    .select(COLLECTION_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? toCollection(data as CollectionRow) : null;
}

export async function listMemberships(
  collectionId: string,
): Promise<{ lessonId: string; position: number }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lesson_collections")
    .select("lesson_id, position")
    .eq("collection_id", collectionId)
    .order("position", { ascending: true })
    .order("lesson_id", { ascending: true });
  if (error) throw error;
  return ((data as { lesson_id: string; position: number }[] | null) ?? []).map(
    ({ lesson_id, position }) => ({ lessonId: lesson_id, position }),
  );
}

export async function listCollectionLessons(
  collectionId: string,
  options: { situationId?: string; query?: string; limit?: number } = {},
): Promise<VideoRow[]> {
  const supabase = createClient();
  const memberships = await listMemberships(collectionId);
  const ids = memberships.map(({ lessonId }) => lessonId);
  if (ids.length === 0) return [];

  // RLS on `videos` still applies: a PLUS lesson the viewer cannot read is
  // filtered by the database, not by this function.
  let query = supabase.from("videos").select(VIDEO_COLUMNS).in("id", ids);
  if (options.situationId) query = query.eq("situation_id", options.situationId);
  if (options.query) query = query.ilike("title", `%${options.query}%`);
  const { data, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: true });
  if (error) throw error;
  const positionById = new Map(memberships.map(({ lessonId, position }) => [lessonId, position]));
  const lessons = ((data as VideoRow[] | null) ?? []).sort(
    (left, right) => (positionById.get(left.id) ?? 0) - (positionById.get(right.id) ?? 0),
  );
  return options.limit ? lessons.slice(0, options.limit) : lessons;
}

export async function getCollectionProgress(
  collectionId: string,
): Promise<{ total: number; completed: number }> {
  const memberships = await listMemberships(collectionId);
  const ids = memberships.map(({ lessonId }) => lessonId);
  if (ids.length === 0) return { total: 0, completed: 0 };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_video_progress")
    .select("video_id, completed_at")
    .in("video_id", ids);
  if (error) throw error;
  const completed = ((data as { video_id: string; completed_at: string | null }[] | null) ?? [])
    .filter(({ completed_at }) => completed_at !== null).length;
  return { total: ids.length, completed };
}
