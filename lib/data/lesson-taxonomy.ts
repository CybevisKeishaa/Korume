import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * A taxonomy row. `slug` only — display labels live in the i18n catalog
 * (`shadowing.situations.*` / `shadowing.sources.*`), never in the database
 * and never in a map in code (spec §3.5).
 */
export interface LessonTag {
  id: string;
  slug: string;
  displayOrder: number;
}

interface TagRow {
  id: string;
  slug: string;
  display_order: number;
}

function toTag(row: TagRow): LessonTag {
  return { id: row.id, slug: row.slug, displayOrder: row.display_order };
}

async function listTable(table: "lesson_situations" | "lesson_sources"): Promise<LessonTag[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(table)
    .select("id, slug, display_order")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return ((data as TagRow[] | null) ?? []).map(toTag);
}

export async function listSituations(): Promise<LessonTag[]> {
  return listTable("lesson_situations");
}

export async function listSources(): Promise<LessonTag[]> {
  return listTable("lesson_sources");
}

/**
 * Returns ARRAYS deliberately. `videos.situation_id` is a single FK today —
 * the minimum that serves a single-select chip row — but that is a provisional
 * cardinality, not a domain claim (spec D11). Consumers never read the column
 * directly, so introducing a join table later changes only this file.
 */
async function lessonTags(
  lessonId: string,
  column: "situation_id" | "source_id",
  table: "lesson_situations" | "lesson_sources",
): Promise<LessonTag[]> {
  const supabase = createClient();
  const { data: lesson, error: lessonError } = await supabase
    .from("videos")
    .select(column)
    .eq("id", lessonId)
    .maybeSingle();
  if (lessonError) throw lessonError;

  const tagId = (lesson as Record<string, string | null> | null)?.[column] ?? null;
  if (!tagId) return [];

  const { data, error } = await supabase
    .from(table)
    .select("id, slug, display_order")
    .eq("id", tagId);
  if (error) throw error;
  return ((data as TagRow[] | null) ?? []).map(toTag);
}

export async function getLessonSituations(lessonId: string): Promise<LessonTag[]> {
  return lessonTags(lessonId, "situation_id", "lesson_situations");
}

export async function getLessonSources(lessonId: string): Promise<LessonTag[]> {
  return lessonTags(lessonId, "source_id", "lesson_sources");
}

/** A Practice by Situation tile: a situation the viewer has lessons for. */
export interface PracticeSituation {
  slug: string;
  icon: string | null;
}

/**
 * Situations, in `display_order`, that tag at least one lesson the viewer can
 * see — a tile that opened an empty search would be a dead end.
 */
export async function listPracticeSituations(): Promise<PracticeSituation[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lesson_situations")
    .select("id, slug, icon")
    .order("display_order", { ascending: true });
  if (error) throw error;
  const situations = (data as { id: string; slug: string; icon: string | null }[] | null) ?? [];
  // One existence probe per situation: correct at any catalog size, where a
  // read of every tagged lesson would stop at PostgREST's max_rows.
  const probes = await Promise.all(situations.map((situation) => (
    supabase.from("videos").select("id").eq("situation_id", situation.id).limit(1)
  )));
  return situations.flatMap(({ slug, icon }, index) => {
    const probe = probes[index]!;
    if (probe.error) throw probe.error;
    return (probe.data as unknown[] | null)?.length ? [{ slug, icon }] : [];
  });
}
