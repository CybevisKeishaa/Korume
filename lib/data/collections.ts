import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser, VIDEO_COLUMNS, type VideoRow } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";

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
  kind?: "shelf" | "path" | "goal";
  skillFocus?: "accuracy" | "pitch" | "rhythm" | null;
  /** A short decorative glyph for path and goal cards. */
  icon?: string | null;
}

interface CollectionRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  display_order: number;
  kind?: "shelf" | "path" | "goal";
  skill_focus?: "accuracy" | "pitch" | "rhythm" | null;
  icon?: string | null;
}

export const COLLECTION_COLUMNS = "id, slug, title, description, cover_image_url, display_order, kind, skill_focus, icon";

function toCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverImageUrl: row.cover_image_url,
    displayOrder: row.display_order,
    kind: row.kind ?? "shelf",
    skillFocus: row.skill_focus ?? null,
    icon: row.icon ?? null,
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

type CollectionMetaLesson = Pick<VideoRow, "duration_seconds" | "jlpt_level_estimate">;

const JLPT_ORDER = ["N5", "N4", "N3", "N2", "N1"] as const;
export type LevelBand = "beginner" | "intermediate" | "advanced";
const LEVEL_BANDS: readonly LevelBand[] = ["beginner", "beginner", "intermediate", "advanced", "advanced"];

/**
 * Summarises the member lessons; it does not classify the collection. The
 * level band is a catalog key pair, localised by the page, never English text.
 */
export function collectionMeta(lessons: CollectionMetaLesson[]): {
  /** Lessons the viewer can see; RLS hides the rest, so they cannot be timed or taken. */
  lessonCount: number;
  durationMinutes: number | null;
  jlptRange: string | null;
  levelBand: { from: LevelBand; to: LevelBand } | null;
} {
  const durations = lessons.map((lesson) => lesson.duration_seconds).filter((duration): duration is number => duration !== null);
  const durationMinutes = durations.length > 0
    ? Math.round(durations.reduce((total, duration) => total + duration, 0) / 60)
    : null;
  const indices = lessons
    .map((lesson) => JLPT_ORDER.indexOf(lesson.jlpt_level_estimate as typeof JLPT_ORDER[number]))
    .filter((index) => index >= 0);
  if (!indices.length) return { lessonCount: lessons.length, durationMinutes, jlptRange: null, levelBand: null };
  const min = Math.min(...indices);
  const max = Math.max(...indices);
  const jlptRange = min === max ? JLPT_ORDER[min]! : `${JLPT_ORDER[min]!}–${JLPT_ORDER[max]!}`;
  return { lessonCount: lessons.length, durationMinutes, jlptRange, levelBand: { from: LEVEL_BANDS[min]!, to: LEVEL_BANDS[max]! } };
}

export interface FeaturedCourse {
  collection: Collection;
  total: number;
  completed: number;
  next: VideoRow | null;
  lessons: VideoRow[];
  resume: { lesson: VideoRow; index: number; percent: number | null } | null;
  /** The first member lesson, in editorial order, that has a thumbnail. */
  coverUrl: string | null;
  lessonCount: number;
  durationMinutes: number | null;
  jlptRange: string | null;
  levelBand: { from: LevelBand; to: LevelBand } | null;
  selectedByRecentActivity: boolean;
}

/** One card on the Popular Learning Paths shelf. */
export interface PathSummary {
  collection: Collection;
  total: number;
  completed: number;
  /** The lesson the card's action opens: the first not completed, else the first. */
  next: VideoRow | null;
  /** True once any member lesson has been watched or completed. */
  started: boolean;
  saved: boolean;
  lessonCount: number;
  durationMinutes: number | null;
}

export interface LearningPaths {
  featured: FeaturedCourse | null;
  /** Paths with at least one lesson the viewer can see, in `display_order`. */
  paths: PathSummary[];
}

interface ProgressRow {
  video_id: string;
  last_watched_position: number;
  completed_at: string | null;
  last_watched_at: string | null;
}

/**
 * Every `kind = 'path'` collection the viewer can use, and the one the studio
 * features, read together so the hero and the shelf cost one set of queries.
 *
 * Featured choice, in order: the path holding the learner's latest session
 * (unless finished), a saved unfinished path, a path in progress, the first.
 */
export async function getLearningPaths(): Promise<LearningPaths> {
  const supabase = createClient();
  const { data: candidateRows, error: candidateError } = await supabase
    .from("collections").select(COLLECTION_COLUMNS).eq("kind", "path").order("display_order", { ascending: true });
  if (candidateError) throw candidateError;
  const candidates = ((candidateRows as CollectionRow[] | null) ?? []).map(toCollection);
  if (!candidates.length) return { featured: null, paths: [] };

  const { data: membershipRows, error: membershipError } = await supabase
    .from("lesson_collections").select("collection_id, lesson_id, position")
    .in("collection_id", candidates.map((candidate) => candidate.id))
    .order("position", { ascending: true }).order("lesson_id", { ascending: true });
  if (membershipError) throw membershipError;
  const memberships = (membershipRows as { collection_id: string; lesson_id: string; position: number }[] | null) ?? [];
  const lessonIds = [...new Set(memberships.map((membership) => membership.lesson_id))];
  if (!lessonIds.length) return { featured: null, paths: [] };

  const [
    { data: videos, error: videoError },
    { data: progressRows, error: progressError },
    { data: sessions, error: sessionError },
    { data: savedRows, error: savedError },
  ] = await Promise.all([
    supabase.from("videos").select(VIDEO_COLUMNS).in("id", lessonIds).order("created_at", { ascending: false }).order("id", { ascending: true }),
    supabase.from("user_video_progress").select("video_id, last_watched_position, completed_at, last_watched_at").in("video_id", lessonIds),
    supabase.from("shadowing_sessions").select("video_id, created_at").order("created_at", { ascending: false }).limit(1),
    // RLS scopes both user tables to the caller.
    supabase.from("user_saved_collections").select("collection_id"),
  ]);
  if (videoError) throw videoError;
  if (progressError) throw progressError;
  if (sessionError) throw sessionError;
  if (savedError) throw savedError;
  const orderedVideos = (videos as VideoRow[] | null) ?? [];
  const progressById = new Map(((progressRows as ProgressRow[] | null) ?? []).map((row) => [row.video_id, row]));
  const savedIds = new Set(((savedRows as { collection_id: string }[] | null) ?? []).map((row) => row.collection_id));
  const isCompleted = (lessonId: string) => Boolean(progressById.get(lessonId)?.completed_at);

  const views = candidates.map((collection) => {
    const memberRows = memberships.filter((membership) => membership.collection_id === collection.id);
    const lessons = sortByPosition(
      orderedVideos.filter((video) => memberRows.some((membership) => membership.lesson_id === video.id)),
      new Map(memberRows.map((membership) => [membership.lesson_id, membership.position])),
    );
    const completed = memberRows.filter((membership) => isCompleted(membership.lesson_id)).length;
    const next = lessons.find((lesson) => !isCompleted(lesson.id)) ?? lessons[0] ?? null;
    const started = memberRows.some((membership) => {
      const progress = progressById.get(membership.lesson_id);
      return Boolean(progress && (progress.completed_at || progress.last_watched_position > 0));
    });
    return { collection, memberRows, lessons, total: memberRows.length, completed, next, started, saved: savedIds.has(collection.id) };
  }).filter((view) => view.lessons.length > 0);

  const paths: PathSummary[] = views.map((view) => ({
    collection: view.collection,
    total: view.total,
    completed: view.completed,
    next: view.next,
    started: view.started,
    saved: view.saved,
    lessonCount: view.lessons.length,
    durationMinutes: collectionMeta(view.lessons).durationMinutes,
  }));
  if (!views.length) return { featured: null, paths };

  const unfinished = (view: (typeof views)[number]) => view.completed < view.total;
  const latestVideoId = (sessions as { video_id: string; created_at: string }[] | null)?.[0]?.video_id;
  const activitySelected = latestVideoId
    ? views.find((view) => view.memberRows.some((membership) => membership.lesson_id === latestVideoId) && unfinished(view))
    : undefined;
  const selected = activitySelected
    ?? views.find((view) => view.saved && unfinished(view))
    ?? views.find((view) => view.completed > 0 && unfinished(view))
    ?? views[0];
  if (!selected) return { featured: null, paths };

  const resumeCandidates = selected.lessons.flatMap((lesson, index) => {
    const progress = progressById.get(lesson.id);
    return progress && progress.last_watched_position > 0 && progress.completed_at === null ? [{ lesson, index: index + 1, progress }] : [];
  });
  // Most recently watched first; rows with no known time (null) last, in editorial order.
  const resumeCandidate = resumeCandidates.sort((left, right) => {
    const leftAt = left.progress.last_watched_at ? Date.parse(left.progress.last_watched_at) : null;
    const rightAt = right.progress.last_watched_at ? Date.parse(right.progress.last_watched_at) : null;
    if (leftAt !== null && rightAt !== null && leftAt !== rightAt) return rightAt - leftAt;
    if (leftAt !== null && rightAt === null) return -1;
    if (leftAt === null && rightAt !== null) return 1;
    return left.index - right.index;
  })[0];
  const resume = resumeCandidate ? {
    lesson: resumeCandidate.lesson,
    index: resumeCandidate.index,
    percent: resumeCandidate.lesson.duration_seconds && resumeCandidate.lesson.duration_seconds > 0
      ? Math.min(99, Math.max(0, Math.round(100 * resumeCandidate.progress.last_watched_position / resumeCandidate.lesson.duration_seconds)))
      : null,
  } : null;

  return {
    featured: {
      collection: selected.collection,
      total: selected.total,
      completed: selected.completed,
      next: selected.next,
      lessons: selected.lessons,
      resume,
      coverUrl: selected.lessons.find((lesson) => lesson.thumbnail_url)?.thumbnail_url ?? null,
      selectedByRecentActivity: Boolean(activitySelected),
      ...collectionMeta(selected.lessons),
    },
    paths,
  };
}

export async function getFeaturedCourse(): Promise<FeaturedCourse | null> {
  return (await getLearningPaths()).featured;
}

const SAVE_LIMIT = { limit: 30, windowMs: 60_000 };

export type SaveCollectionResult =
  | { ok: true }
  | { ok: false; status: 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Save or unsave a learning path for the caller. Idempotent both ways: saving
 * a saved path and unsaving an unsaved one both succeed. Only a `kind = 'path'`
 * collection can be saved: the insert policy enforces it, and its refusal
 * (like an unknown id) reads as 404.
 */
export async function setCollectionSaved(collectionId: string, saved: boolean): Promise<SaveCollectionResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };
  const limit = rateLimit(`collection-save:${user.id}`, SAVE_LIMIT);
  if (!limit.ok) return { ok: false, status: 429, retryAfter: limit.retryAfter };

  if (!saved) {
    const { error } = await supabase.from("user_saved_collections").delete().eq("user_id", user.id).eq("collection_id", collectionId);
    if (error) throw error;
    return { ok: true };
  }

  const { error } = await supabase.from("user_saved_collections").insert({ user_id: user.id, collection_id: collectionId });
  if (!error || error.code === "23505") return { ok: true };
  // 42501: the insert policy refused (not a path); 23503: no such collection.
  if (error.code === "42501" || error.code === "23503") return { ok: false, status: 404 };
  throw error;
}

/**
 * Editorial order, shared by every reader of a collection's lessons. The sort
 * is stable, so equal positions (0 = unordered) keep the videos query order
 * (`created_at desc, id`).
 */
function sortByPosition(videos: VideoRow[], positionById: Map<string, number>): VideoRow[] {
  return [...videos].sort((left, right) => (positionById.get(left.id) ?? 0) - (positionById.get(right.id) ?? 0));
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
  const lessons = sortByPosition((data as VideoRow[] | null) ?? [], positionById);
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
