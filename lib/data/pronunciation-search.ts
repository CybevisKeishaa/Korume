import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCollectionViews, getShadowingCollections, savedCollectionIds, toCollectionProgressSummary, type PathSummary, type PracticeGoalSummary, type ShadowingCollectionSummary } from "@/lib/data/collections";
import { getHubDiscovery, getHubDiscoveryCount, type HubLesson } from "@/lib/data/shadowing-hub";
import { listPracticeSituations, type PracticeSituation } from "@/lib/data/lesson-taxonomy";
import { containsPattern } from "@/lib/data/query-pagination";
import type { SearchType } from "@/lib/validation/pronunciation-search";
import type { PronunciationDuration, PronunciationSort } from "@/lib/preferences/options";

export const SEARCH_PREVIEW_LIMIT = 4;

export type LibraryItem =
  | { kind: "collection"; id: string; label: string; summary: ShadowingCollectionSummary }
  | { kind: "situation"; id: string; label: string; situation: PracticeSituation };

export interface SearchGroup<T> {
  items: T[];
  total: number;
}

export interface SearchCounts {
  lessons: number;
  paths: number;
  goals: number;
  library: number;
}

export interface LessonSettings {
  filter?: string;
  sort?: PronunciationSort;
  duration?: PronunciationDuration;
  hideCompleted?: boolean;
}

export async function searchLessons(q: string, settings: LessonSettings, limit: number): Promise<SearchGroup<HubLesson>> {
  const { discovery } = await getHubDiscovery({ query: q, ...settings, browse: true, limit, withTotal: true });
  return { items: discovery?.lessons ?? [], total: discovery?.total ?? 0 };
}

async function learningCollectionPage(kind: "path" | "goal", q: string, limit: number): Promise<{ ids: string[]; total: number }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("search_learning_collections", { p_kind: kind, p_pattern: containsPattern(q), p_limit: limit, p_offset: 0 });
  if (error) throw error;
  const rows = (data as { collection_id: string; total: number }[] | null) ?? [];
  return { ids: rows.map((row) => row.collection_id), total: Number(rows[0]?.total ?? 0) };
}

export function searchLearningCollections(kind: "path", q: string, limit: number): Promise<SearchGroup<PathSummary>>;
export function searchLearningCollections(kind: "goal", q: string, limit: number): Promise<SearchGroup<PracticeGoalSummary>>;
export async function searchLearningCollections(kind: "path" | "goal", q: string, limit: number): Promise<SearchGroup<PathSummary | PracticeGoalSummary>> {
  const page = await learningCollectionPage(kind, q, limit);
  if (!page.ids.length) return { items: [], total: page.total };
  const [views, savedIds] = await Promise.all([
    getCollectionViews(kind, { ids: page.ids }),
    kind === "path" ? savedCollectionIds() : Promise.resolve(null),
  ]);
  const items = views.map((view) => kind === "path"
    ? { ...toCollectionProgressSummary(view), saved: savedIds?.has(view.collection.id) ?? false }
    : toCollectionProgressSummary(view));
  return { items, total: page.total };
}

// Editorial collections (five slugs) and curated situations (eight rows) are bounded by construction (ruling 19).
// `*` is dropped as `containsPattern` drops it for lessons, paths and goals, so
// one query matches the same way on every tab.
function libraryMatcher(q: string, locale: string): (text: string) => boolean {
  const needle = q.replace(/\*/g, "").toLocaleLowerCase(locale);
  return (text) => text.toLocaleLowerCase(locale).includes(needle);
}

export async function searchLibrary(q: string, situationLabels: Record<string, string>, locale: string, limit: number): Promise<SearchGroup<LibraryItem>> {
  const matches = libraryMatcher(q, locale);
  const [collections, situations] = await Promise.all([getShadowingCollections(), listPracticeSituations()]);
  const items: LibraryItem[] = [
    ...collections.filter((summary) => matches(summary.collection.title))
      .map((summary) => ({ kind: "collection" as const, id: summary.collection.id, label: summary.collection.title, summary })),
    ...situations.map((situation) => ({ situation, label: situationLabels[situation.slug] ?? situation.slug }))
      .filter(({ situation, label }) => matches(label) || matches(situation.slug))
      .map(({ situation, label }) => ({ kind: "situation" as const, id: situation.slug, label, situation })),
  ];
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  items.sort((left, right) => collator.compare(left.label, right.label)
    || (left.kind === right.kind ? 0 : left.kind === "collection" ? -1 : 1)
    || left.id.localeCompare(right.id));
  return { items: items.slice(0, limit), total: items.length };
}

/** The four counts are exactly the totals the groups' own reads report, so a count never disagrees with its rows. */
const COUNTERS = {
  lessons: (q: string, settings: LessonSettings) => getHubDiscoveryCount({ query: q, ...settings }),
  paths: async (q: string) => (await learningCollectionPage("path", q, 1)).total,
  goals: async (q: string) => (await learningCollectionPage("goal", q, 1)).total,
  // The library is bounded by construction, so its count is the same read with no rows kept.
  library: async (q: string, situationLabels: Record<string, string>, locale: string) => (await searchLibrary(q, situationLabels, locale, 0)).total,
};

export async function getSearchCounts(q: string, settings: LessonSettings, situationLabels: Record<string, string>, locale: string): Promise<SearchCounts> {
  const [lessons, paths, goals, library] = await Promise.all([
    COUNTERS.lessons(q, settings),
    COUNTERS.paths(q),
    COUNTERS.goals(q),
    COUNTERS.library(q, situationLabels, locale),
  ]);
  return { lessons, paths, goals, library };
}

/**
 * One page of the active tab; on All (type null) the ≤4 previews of every group.
 * A group whose rows are read reports its own total as its count; every other
 * group is only counted. All reads run in parallel.
 */
export async function getPronunciationSearch(input: {
  q: string;
  type: SearchType | null;
  settings: LessonSettings;
  limit: number;
  situationLabels: Record<string, string>;
  locale: string;
}): Promise<{
  counts: SearchCounts;
  lessons?: SearchGroup<HubLesson>;
  paths?: SearchGroup<PathSummary>;
  goals?: SearchGroup<PracticeGoalSummary>;
  library?: SearchGroup<LibraryItem>;
}> {
  const { q, settings, situationLabels, locale } = input;
  const read = async <T,>(type: SearchType, rows: (limit: number) => Promise<SearchGroup<T>>, count: () => Promise<number>) => {
    const limit = input.type === null ? SEARCH_PREVIEW_LIMIT : input.type === type ? input.limit : null;
    if (limit === null) return { group: undefined, total: await count() };
    const group = await rows(limit);
    return { group, total: group.total };
  };
  const [lessons, paths, goals, library] = await Promise.all([
    read("lessons", (limit) => searchLessons(q, settings, limit), () => COUNTERS.lessons(q, settings)),
    read("paths", (limit) => searchLearningCollections("path", q, limit), () => COUNTERS.paths(q)),
    read("goals", (limit) => searchLearningCollections("goal", q, limit), () => COUNTERS.goals(q)),
    read("library", (limit) => searchLibrary(q, situationLabels, locale, limit), () => COUNTERS.library(q, situationLabels, locale)),
  ]);
  return {
    counts: { lessons: lessons.total, paths: paths.total, goals: goals.total, library: library.total },
    ...(lessons.group && { lessons: lessons.group }),
    ...(paths.group && { paths: paths.group }),
    ...(goals.group && { goals: goals.group }),
    ...(library.group && { library: library.group }),
  };
}
