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

export async function listCollectionLessons(collectionId: string): Promise<VideoRow[]> {
  const supabase = createClient();
  const { data: memberships, error: membershipError } = await supabase
    .from("lesson_collections")
    .select("lesson_id")
    .eq("collection_id", collectionId);
  if (membershipError) throw membershipError;

  const ids = ((memberships as { lesson_id: string }[] | null) ?? []).map((m) => m.lesson_id);
  if (ids.length === 0) return [];

  // RLS on `videos` still applies: a PLUS lesson the viewer cannot read is
  // filtered by the database, not by this function.
  const { data, error } = await supabase.from("videos").select(VIDEO_COLUMNS).in("id", ids);
  if (error) throw error;
  return (data as VideoRow[] | null) ?? [];
}
