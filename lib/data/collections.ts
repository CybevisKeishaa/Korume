import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser, VIDEO_COLUMNS, type VideoRow } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import type { PronunciationMetric } from "@/lib/data/pronunciation-metrics";
import { getRecommendations, knowsAnyVocabulary } from "@/lib/data/recommendations";
import { containsPattern, fetchAllPages, fetchByIdChunks } from "@/lib/data/query-pagination";

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
  // Curated admin catalogue: cardinality stays far below PostgREST max_rows.
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
  /** The lesson the hero opens: `resume`'s lesson when there is one, else the first not completed. */
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
export interface CollectionProgressSummary {
  collection: Collection;
  total: number;
  completed: number;
  /** The lesson the card's action opens: the first not completed, else the first. */
  next: VideoRow | null;
  /** True once any member lesson has been watched or completed. */
  started: boolean;
  lessonCount: number;
  durationMinutes: number | null;
  /** The visible member lessons, in `position` order. */
  lessonIds: string[];
}

export interface PathSummary extends CollectionProgressSummary {
  saved: boolean;
}

/** A goal shares the paths' ordered-collection progress derivation, without path-only save state. */
export type PracticeGoalSummary = CollectionProgressSummary;

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

export interface CollectionView extends CollectionProgressSummary {
  memberRows: { collection_id: string; lesson_id: string; position: number }[];
  lessons: VideoRow[];
  progressById: Map<string, ProgressRow>;
}

/** The shared card projection for paths, goals, and pronunciation search results. */
export function toCollectionProgressSummary(view: CollectionView): CollectionProgressSummary {
  const { collection, total, completed, next, started, lessonCount, durationMinutes, lessonIds } = view;
  return { collection, total, completed, next, started, lessonCount, durationMinutes, lessonIds };
}

/**
 * A lesson's last activity: the later of the learner watching it and speaking
 * it (owner ruling 17). The one source for "recent activity" — the featured
 * course and "Continue where you left off" both read it.
 */
export function lastActivityAt(watchedAt: string | null | undefined, spokenAt: string | null | undefined): number | null {
  const times = [watchedAt, spokenAt].flatMap((value) => value ? [Date.parse(value)] : []);
  return times.length ? Math.max(...times) : null;
}

/** The shared per-collection progress view for paths and goals. */
export async function getCollectionViews(kind: "path" | "goal", options?: { ids?: string[] }): Promise<CollectionView[]> {
  if (options?.ids?.length === 0) return [];
  const supabase = createClient();
  // Curated paths and goals: cardinality stays far below PostgREST max_rows.
  let candidatesQuery = supabase.from("collections").select(COLLECTION_COLUMNS).eq("kind", kind);
  if (options?.ids) candidatesQuery = candidatesQuery.in("id", options.ids);
  const { data: candidateRows, error: candidateError } = await candidatesQuery.order("display_order", { ascending: true });
  if (candidateError) throw candidateError;
  const rows = ((candidateRows as CollectionRow[] | null) ?? []).map(toCollection);
  const candidates = options?.ids
    ? options.ids.flatMap((id) => rows.filter((collection) => collection.id === id))
    : rows;
  if (!candidates.length) return [];

  const memberships = await fetchByIdChunks(
    candidates.map((candidate) => candidate.id),
    (collectionIds) => fetchAllPages((from, to) => supabase
      .from("lesson_collections").select("collection_id, lesson_id, position")
      .in("collection_id", collectionIds)
      // Unique over the primary key, so pages neither repeat nor skip a row
      // shared by two collections at the same position.
      .order("position", { ascending: true }).order("lesson_id", { ascending: true }).order("collection_id", { ascending: true })
      .range(from, to),
    ),
  ) as { collection_id: string; lesson_id: string; position: number }[];
  const lessonIds = [...new Set(memberships.map((membership) => membership.lesson_id))];
  if (!lessonIds.length) return [];

  const [orderedVideos, progressRows] = await Promise.all([
    fetchByIdChunks(lessonIds, async (ids) => {
      const { data, error } = await supabase.from("videos").select(VIDEO_COLUMNS).in("id", ids).order("created_at", { ascending: false }).order("id", { ascending: true });
      if (error) throw error;
      return (data as VideoRow[] | null) ?? [];
    }),
    fetchByIdChunks(lessonIds, async (ids) => {
      const { data, error } = await supabase.from("user_video_progress").select("video_id, last_watched_position, completed_at, last_watched_at").in("video_id", ids);
      if (error) throw error;
      return (data as ProgressRow[] | null) ?? [];
    }),
  ]);
  const progressById = new Map(progressRows.map((row) => [row.video_id, row]));
  const isCompleted = (lessonId: string) => Boolean(progressById.get(lessonId)?.completed_at);

  return candidates.map((collection) => {
    const memberRows = memberships.filter((membership) => membership.collection_id === collection.id);
    const lessons = sortByPosition(
      orderedVideos.filter((video) => memberRows.some((membership) => membership.lesson_id === video.id)),
      new Map(memberRows.map((membership) => [membership.lesson_id, membership.position])),
    );
    const completed = lessons.filter((lesson) => isCompleted(lesson.id)).length;
    const next = lessons.find((lesson) => !isCompleted(lesson.id)) ?? lessons[0] ?? null;
    const started = lessons.some((lesson) => {
      const progress = progressById.get(lesson.id);
      return Boolean(progress && (progress.completed_at || progress.last_watched_position > 0));
    });
    const { lessonCount, durationMinutes } = collectionMeta(lessons);
    return { collection, memberRows, lessons, progressById, total: lessons.length, completed, next, started, lessonCount, durationMinutes, lessonIds: lessons.map((lesson) => lesson.id) };
  }).filter((view) => view.lessons.length > 0);
}

/**
 * Every `kind = 'path'` collection the viewer can use, and the one the studio
 * features, read together so the hero and the shelf cost one set of queries.
 *
 * Featured choice, in order: the first saved unfinished path, the path holding
 * the learner's latest session (unless finished), a path in progress, the first.
 */
export async function getLearningPaths(): Promise<LearningPaths> {
  const views = await getCollectionViews("path");
  if (!views.length) return { featured: null, paths: [] };

  const supabase = createClient();
  const [spokenRows, savedIds] = await Promise.all([
    // The newest session per lesson, aggregated in SQL: sessions outgrow max_rows.
    fetchByIdChunks([...new Set(views.flatMap((view) => view.lessonIds))], async (ids) => {
      const { data, error } = await supabase.rpc("lesson_last_spoken_at", { p_video_ids: ids });
      if (error) throw error;
      return (data as { video_id: string; spoken_at: string }[] | null) ?? [];
    }),
    savedCollectionIds(),
  ]);
  const spokenAtById = new Map(spokenRows.map((row) => [row.video_id, row.spoken_at]));
  const activityOf = (view: CollectionView, lessonId: string) =>
    lastActivityAt(view.progressById.get(lessonId)?.last_watched_at, spokenAtById.get(lessonId));
  const latestActivity = (view: CollectionView) => view.lessonIds.reduce<number | null>((latest, lessonId) => {
    const at = activityOf(view, lessonId);
    return at !== null && (latest === null || at > latest) ? at : latest;
  }, null);

  const paths: PathSummary[] = views.map((view) => ({ ...toCollectionProgressSummary(view), saved: savedIds.has(view.collection.id) }));

  const unfinished = (view: CollectionView) => view.completed < view.total;
  // Rule 2: the unfinished path the learner touched last, watching or speaking
  // (owner ruling 17); ties keep display order.
  const activitySelected = views.reduce<{ view: CollectionView; at: number } | undefined>((best, view) => {
    const at = latestActivity(view);
    return unfinished(view) && at !== null && (!best || at > best.at) ? { view, at } : best;
  }, undefined)?.view;
  const selected = views.find((view) => savedIds.has(view.collection.id) && unfinished(view))
    ?? activitySelected
    ?? views.find((view) => view.started && unfinished(view))
    ?? views[0];
  if (!selected) return { featured: null, paths };

  // Every unfinished lesson the learner started, by watching OR speaking: a
  // lesson only spoken has no watch position, yet it may be what put this
  // course in the hero, so the strip must be able to name it.
  const resumeCandidates = selected.lessons.flatMap((lesson, index) => {
    const progress = selected.progressById.get(lesson.id);
    if (progress?.completed_at) return [];
    const watched = (progress?.last_watched_position ?? 0) > 0;
    return watched || spokenAtById.has(lesson.id) ? [{ lesson, index: index + 1, position: progress?.last_watched_position ?? 0 }] : [];
  });
  // Most recent activity first, by the same rule the hero used (ruling 17);
  // rows with no known time last, in editorial order.
  const resumeCandidate = resumeCandidates.sort((left, right) => {
    const leftAt = activityOf(selected, left.lesson.id);
    const rightAt = activityOf(selected, right.lesson.id);
    if (leftAt !== null && rightAt !== null && leftAt !== rightAt) return rightAt - leftAt;
    if (leftAt !== null && rightAt === null) return -1;
    if (leftAt === null && rightAt !== null) return 1;
    return left.index - right.index;
  })[0];
  const resume = resumeCandidate ? {
    lesson: resumeCandidate.lesson,
    index: resumeCandidate.index,
    // No watch position (a lesson only spoken) is no percent, not 0%.
    percent: resumeCandidate.position > 0 && resumeCandidate.lesson.duration_seconds && resumeCandidate.lesson.duration_seconds > 0
      ? Math.min(99, Math.max(0, Math.round(100 * resumeCandidate.position / resumeCandidate.lesson.duration_seconds)))
      : null,
  } : null;

  return {
    featured: {
      collection: selected.collection,
      total: selected.total,
      completed: selected.completed,
      // One "continue" for the whole page: the hero opens the lesson the strip names.
      next: resume?.lesson ?? selected.next,
      lessons: selected.lessons,
      resume,
      coverUrl: selected.lessons.find((lesson) => lesson.thumbnail_url)?.thumbnail_url ?? null,
      selectedByRecentActivity: selected === activitySelected,
      ...collectionMeta(selected.lessons),
    },
    paths,
  };
}

/** Every visible goal, in authored display order, with the same progress derivation as paths. */
export async function getPracticeGoals(): Promise<PracticeGoalSummary[]> {
  const views = await getCollectionViews("goal");
  return views.map(toCollectionProgressSummary);
}

/** Exactly one recommended badge: the first authored goal training the weakest measured metric. */
export function recommendedPracticeGoalId(goals: PracticeGoalSummary[], weakest: PronunciationMetric | null): string | null {
  return weakest === null ? null : goals.find((goal) => goal.collection.skillFocus === weakest)?.collection.id ?? null;
}

/** AI Sensei's pick: a lesson the i+1 engine placed in the learner's band, and where it sits. */
export interface SenseiRecommendation {
  lesson: { id: string; title: string };
  /** Share of the lesson's content words the learner knows, 0–1 (the engine's measured reason). */
  knownRatio: number;
  /** The weakest metric, when the lesson comes from the goal that trains it. */
  focus: PronunciationMetric | null;
  /** The path or goal holding the lesson, with its 1-based place there. */
  home: { kind: "path" | "goal"; title: string; lessonNumber: number } | null;
}

/**
 * Ranks the lessons of the goal training the weakest metric through the i+1
 * engine, then the whole catalogue when that yields nothing. Only a pick
 * carrying a measured reason is returned — the engine never invents one.
 */
export async function getSenseiRecommendation(
  goals: PracticeGoalSummary[],
  paths: CollectionProgressSummary[],
  weakest: PronunciationMetric | null,
): Promise<SenseiRecommendation | null> {
  // Owner ruling 15 (B): with no known word no pick can carry a reason, so
  // neither engine pass could return anything; skip them both.
  if (!(await knowsAnyVocabulary().catch(() => false))) return null;
  const goalId = recommendedPracticeGoalId(goals, weakest);
  const goal = goals.find((candidate) => candidate.collection.id === goalId) ?? null;
  // A rail card only suggests: an engine failure empties it instead of failing the page,
  // as getHubDiscovery treats the same engine.
  const pick = async (candidateIds?: string[]) => {
    const result = await getRecommendations({ limit: 24, candidateIds }).catch(() => null);
    return result?.ok ? result.data.find((recommendation) => recommendation.reason !== null) ?? null : null;
  };
  const fromGoal = goal?.lessonIds.length ? await pick(goal.lessonIds) : null;
  const recommendation = fromGoal ?? await pick();
  if (!recommendation?.reason) return null;

  const home = [...(fromGoal && goal ? [goal] : []), ...paths, ...goals]
    .find((collection) => collection.lessonIds.includes(recommendation.videoId));
  return {
    lesson: { id: recommendation.videoId, title: recommendation.title },
    knownRatio: recommendation.reason.knownRatio,
    focus: fromGoal ? weakest : null,
    home: home ? {
      kind: home.collection.kind === "goal" ? "goal" : "path",
      title: home.collection.title,
      lessonNumber: home.lessonIds.indexOf(recommendation.videoId) + 1,
    } : null,
  };
}

/**
 * The shadowing collections, in their authored sequence: the shelves of
 * /shadowing/explore, re-shelved by the Pronunciation Studio. Editorial
 * collections (`featured`) stay on the Hub.
 */
export const SHADOWING_COLLECTION_SLUGS = [
  "beginner-foundation",
  "daily-conversation",
  "natural-japanese",
  "advanced-expression",
  "native-fluency",
] as const;

type ShadowingCollectionSlug = (typeof SHADOWING_COLLECTION_SLUGS)[number];

export function selectShadowingCollections(collections: Collection[]): Collection[] {
  const rank = new Map<string, number>(SHADOWING_COLLECTION_SLUGS.map((slug, index) => [slug, index]));
  return collections
    .filter((collection) => rank.has(collection.slug as ShadowingCollectionSlug))
    .sort((a, b) => (rank.get(a.slug) ?? 0) - (rank.get(b.slug) ?? 0));
}

/** One card on the studio's Shadowing Collections shelf. */
export interface ShadowingCollectionSummary {
  collection: Collection;
  /** Lessons the viewer can see; RLS hides the rest. */
  lessonCount: number;
  durationMinutes: number | null;
  levelBand: { from: LevelBand; to: LevelBand } | null;
  /** Lines of each visible lesson's latest transcript the viewer can read. */
  sentenceCount: number | null;
}

/** The shadowing collections with at least one lesson the viewer can see. */
export async function getShadowingCollections(): Promise<ShadowingCollectionSummary[]> {
  const supabase = createClient();
  // Fixed five-slug editorial shelf, so this cannot approach max_rows.
  const { data: collectionRows, error: collectionError } = await supabase
    .from("collections").select(COLLECTION_COLUMNS).in("slug", [...SHADOWING_COLLECTION_SLUGS]);
  if (collectionError) throw collectionError;
  const collections = selectShadowingCollections(((collectionRows as CollectionRow[] | null) ?? []).map(toCollection));
  if (!collections.length) return [];

  const memberships = await fetchByIdChunks(
    collections.map((collection) => collection.id),
    (collectionIds) => fetchAllPages((from, to) => supabase
      .from("lesson_collections").select("collection_id, lesson_id")
      .in("collection_id", collectionIds)
      // A paged read needs a total order; the primary key is one.
      .order("collection_id", { ascending: true }).order("lesson_id", { ascending: true })
      .range(from, to),
    ),
  ) as { collection_id: string; lesson_id: string }[];
  const lessonIds = [...new Set(memberships.map((membership) => membership.lesson_id))];
  if (!lessonIds.length) return [];

  const videos = await fetchByIdChunks(lessonIds, async (ids) => {
    const { data, error } = await supabase.from("videos").select(VIDEO_COLUMNS).in("id", ids);
    if (error) throw error;
    return (data as VideoRow[] | null) ?? [];
  });
  const videoById = new Map(videos.map((video) => [video.id, video]));
  if (!videoById.size) return [];

  const countRows = await fetchByIdChunks([...videoById.keys()], async (ids) => {
    const { data, error } = await supabase.rpc("video_sentence_counts", { p_video_ids: ids });
    if (error) throw error;
    return (data as { video_id: string; sentence_count: number }[] | null) ?? [];
  });
  const sentencesById = new Map(countRows
    .map((row) => [row.video_id, row.sentence_count]));

  return collections.flatMap((collection) => {
    const lessons = memberships
      .filter((membership) => membership.collection_id === collection.id)
      .flatMap((membership) => videoById.get(membership.lesson_id) ?? []);
    if (!lessons.length) return [];
    const { lessonCount, durationMinutes, levelBand } = collectionMeta(lessons);
    const sentenceCount = lessons.every((lesson) => sentencesById.has(lesson.id))
      ? lessons.reduce((total, lesson) => total + (sentencesById.get(lesson.id) ?? 0), 0)
      : null;
    return [{ collection, lessonCount, durationMinutes, levelBand, sentenceCount }];
  });
}

export async function getFeaturedCourse(): Promise<FeaturedCourse | null> {
  return (await getLearningPaths()).featured;
}

/** At most one saved row per collection for this caller (primary key). */
export async function savedCollectionIds(): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase.from("user_saved_collections").select("collection_id");
  if (error) throw error;
  return new Set(((data as { collection_id: string }[] | null) ?? []).map((row) => row.collection_id));
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
/**
 * Editorial order, then newest, then id: a total order of its own, so a list
 * merged from several chunked reads sorts exactly as one query would.
 */
function sortByPosition(videos: VideoRow[], positionById: Map<string, number>): VideoRow[] {
  return [...videos].sort((left, right) =>
    (positionById.get(left.id) ?? 0) - (positionById.get(right.id) ?? 0)
    || right.created_at.localeCompare(left.created_at)
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

export async function listMemberships(
  collectionId: string,
): Promise<{ lessonId: string; position: number }[]> {
  const supabase = createClient();
  const data = await fetchAllPages((from, to) => supabase
    .from("lesson_collections")
    .select("lesson_id, position")
    .eq("collection_id", collectionId)
    .order("position", { ascending: true })
    .order("lesson_id", { ascending: true })
    .range(from, to),
  ) as { lesson_id: string; position: number }[];
  return data.map(
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
  const videos = await fetchByIdChunks(ids, async (chunk) => {
    let query = supabase.from("videos").select(VIDEO_COLUMNS).in("id", chunk);
    if (options.situationId) query = query.eq("situation_id", options.situationId);
    if (options.query) query = query.ilike("title", containsPattern(options.query));
    const { data, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: true });
    if (error) throw error;
    return (data as VideoRow[] | null) ?? [];
  });
  const positionById = new Map(memberships.map(({ lessonId, position }) => [lessonId, position]));
  const lessons = sortByPosition(videos, positionById);
  return options.limit ? lessons.slice(0, options.limit) : lessons;
}

export async function getCollectionProgress(
  collectionId: string,
): Promise<{ total: number; completed: number }> {
  const memberships = await listMemberships(collectionId);
  const ids = memberships.map(({ lessonId }) => lessonId);
  if (ids.length === 0) return { total: 0, completed: 0 };

  const supabase = createClient();
  const [videos, progress] = await Promise.all([
    fetchByIdChunks(ids, async (chunk) => {
      const { data, error } = await supabase.from("videos").select("id").in("id", chunk);
      if (error) throw error;
      return (data as { id: string }[] | null) ?? [];
    }),
    fetchByIdChunks(ids, async (chunk) => {
      const { data, error } = await supabase.from("user_video_progress").select("video_id, completed_at").in("video_id", chunk);
      if (error) throw error;
      return (data as { video_id: string; completed_at: string | null }[] | null) ?? [];
    }),
  ]);
  const visibleIds = new Set(videos.map((video) => video.id));
  const completed = progress.filter(({ video_id, completed_at }) => visibleIds.has(video_id) && completed_at !== null).length;
  return { total: visibleIds.size, completed };
}
