# Pronunciation search surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `/pronunciation` result surface into (a) a compact, density-stable lesson browser when there is no query and (b) a grouped, tabbed search (lessons · paths · goals · collections & situations) when there is one — the default Figma screen untouched.

**Architecture:** Server-rendered URL state (`q`, `type`, `shown`, lesson settings) on the existing page. A thin data facade (`lib/data/pronunciation-search.ts`) over one typed function per kind plus light counts; paths/goals come from a SQL function that pages and counts in one place. One CSS result grid (`auto-fill, minmax(12rem, 1fr)`) inside a container-query pane that hides preview items past one row.

**Tech Stack:** Next.js 14 App Router (RSC), next-intl, Supabase/PostgREST + SQL functions, Tailwind 3.4 + native CSS container queries, Vitest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-01-pronunciation-search-surface-design.md` — read it first; it is the acceptance test.

## Global Constraints

- Worktree `C:\Users\tplon\Documents\GitHub\JPWeb\japan-web\.worktrees\pronunciation-show-more`, branch `pronunciation-show-more`. Never build or serve in the main checkout.
- Migrations are edited **in place** (AGENTS.md §6); after any migration edit: `npx supabase db reset` + `npm run verify:db:pronunciation`.
- Every SQL function: `security invoker` (unless stated), `set search_path = public`, `revoke all ... from public, anon`, `grant execute ... to authenticated`.
- PostgREST `max_rows` = 1000: no count/rank/filter over an unpaginated select (ruling 19). Every text match goes through `containsPattern` (`lib/data/query-pagination.ts`).
- Client Components receive **strings/numbers only** — never a formatter function (memory: RSC client props).
- Copy lives in `messages/en/pronunciation.json` and `messages/vi/pronunciation.json`; add both; follow `messages/README.md`. `t()` on a template without values breaks in `next dev` — use `t.raw` there.
- Token rule (`components/ui/token-scale.test.ts`): no arbitrary `text-[..px]`, `p-[..]`, `gap-[..]`, radius or shadow literals in scanned dirs; its per-directory `sources` count must be bumped when a file is added to a scanned dir.
- The `/shadowing` and `/shadowing/explore` pages and `HubLessonCard` must render exactly as before.
- Each task ends with `npx tsc --noEmit`, `npm run lint`, `npm run verify:protocol`, `npx vitest run --reporter=dot` all exit 0 (judge the exit code; never pipe through `tail`), plus the mutation checks the task names (AGENTS.md §7).
- Code blocks here are **unverified drafts** (memory: plan snippets were wrong six times on one branch) — compile and grep them, do not trust them.

## Review Focus

1. A query of only spaces, or of `%`, `_`, `\`, `*` → spaces mean no search (Default/Browse); the others match literally, never as wildcards.
2. `type=foo&shown=48&sort=shortest` → one redirect to the same URL without `type` (and without `shown`, which All ignores), keeping `q` and the lesson settings; no redirect loop.
3. A path whose every lesson is hidden by `videos` RLS (another learner's PRIVATE lesson) → absent from the Paths rows **and** from `Learning paths (N)`; never "count 4, three cards". (Correction 2026-10-01: PLUS lessons are NOT hidden — `20260731000023_plus_metadata_visible.sql` shows them to everyone for upsell, so a PLUS-only path is visible and counted, exactly as `getCollectionViews` shows it. The Task 2 gate draft below is superseded by `.superpowers/sdd/pronunciation-show-more/task-2-brief.md`.)
4. Library ordering with Vietnamese diacritics and equal labels → `Intl.Collator` order for the request locale, ties by kind then id; the All preview is the first four of exactly that order.
5. Toggling the AppNav on the result page → the grid reflows from 3 to 4 columns without reload, and the hidden preview items leave the accessibility tree.

Each line has its test in the task that owns the code (Tasks 1, 1, 2, 3, 6).

---

## File map

| File | Responsibility |
|---|---|
| `lib/validation/pronunciation-search.ts` (new) | URL contract: `q`, `type`, surface state, tab hrefs |
| `supabase/migrations/20260731000019_collections.sql` | + `search_learning_collections` (paths/goals rows + count) |
| `supabase/tests/pronunciation-studio.sql` | + live gate for that function |
| `lib/data/collections.ts` | `getCollectionViews` gains an `ids` filter; exports `savedCollectionIds` |
| `lib/data/shadowing-hub.ts` | `getHubDiscovery` gains `withTotal` → `total` |
| `lib/data/pronunciation-search.ts` (new) | facade + `searchLessons/searchLearningCollections/searchLibrary/getSearchCounts` |
| `app/globals.css` | `.result-pane`, `.result-grid`, `.result-preview` + container queries |
| `components/shadowing/hub-lesson-result-card.tsx` (new) | compact lesson card |
| `components/shadowing/pronunciation-search-results.tsx` (new) | tabs, groups, previews, pagers |
| `components/shadowing/hub-results-pager.tsx` | reused as is (Show more + focus) |
| `components/shadowing/hub-discovery-controls.tsx` | drop the pronunciation-only result props |
| `app/[locale]/(protected)/(app)/pronunciation/page.tsx` | three states, redirect, wiring |
| `tests/e2e/fixtures/search-data.ts` (new) | service-role seed + cleanup |
| `tests/e2e/pronunciation-search.spec.ts` (new) | geometry + behaviour acceptance |

---

### Task 1: URL contract

**Files:**
- Create: `lib/validation/pronunciation-search.ts`
- Test: `lib/validation/pronunciation-search.test.ts`

**Interfaces:**
- Consumes: `isPronunciationResultMode`, `PronunciationDisplay` (`lib/validation/shadowing-hub.ts`).
- Produces:
  - `SEARCH_TYPES = ["lessons","paths","goals","library"] as const`, `type SearchType`
  - `normalizeSearchQuery(raw: string | undefined): string | null`
  - `parseSearchType(raw: string | undefined): { type: SearchType | null; canonical: boolean }` — `null` = All; `canonical` false when `raw` is present but not one of `SEARCH_TYPES` (including `"all"`).
  - `type PronunciationSurface = { state: "default" } | { state: "browse" } | { state: "search"; q: string; type: SearchType | null }`
  - `pronunciationSurface(input: { q: string | null; filter?: string; display: PronunciationDisplay; type: SearchType | null }): PronunciationSurface`
  - `type LessonParams = Partial<Record<"filter" | "sort" | "duration" | "hideCompleted", string>>`
  - `searchHref(input: { q: string; type: SearchType | null; lesson: LessonParams; shown?: number }): string` — `/pronunciation?...`; omits `type` for All; `shown` only when given **and** `type` is concrete.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import { normalizeSearchQuery, parseSearchType, pronunciationSurface, searchHref } from "./pronunciation-search";

const defaults = { sort: DEFAULT_PREFERENCES.pronunciationSort, duration: DEFAULT_PREFERENCES.pronunciationDuration, hideCompleted: DEFAULT_PREFERENCES.pronunciationHideCompleted };

describe("normalizeSearchQuery", () => {
  it("trims, and treats nothing but spaces as no query", () => {
    expect(normalizeSearchQuery("  ramen ")).toBe("ramen");
    for (const raw of [undefined, "", "   "]) expect(normalizeSearchQuery(raw)).toBeNull();
  });
  it("keeps LIKE metacharacters for the data layer to escape", () => {
    expect(normalizeSearchQuery(" 100% ")).toBe("100%");
  });
});

describe("parseSearchType", () => {
  it("accepts the four concrete tabs", () => {
    for (const type of ["lessons", "paths", "goals", "library"]) expect(parseSearchType(type)).toEqual({ type, canonical: true });
  });
  it("reads absence as All, canonically", () => {
    expect(parseSearchType(undefined)).toEqual({ type: null, canonical: true });
  });
  it("reads all, unknown and cased values as All, and asks for the canonical URL", () => {
    for (const raw of ["all", "xyz", "Lessons", ""]) expect(parseSearchType(raw)).toEqual({ type: null, canonical: false });
  });
});

describe("pronunciationSurface", () => {
  it("is Default with no query and default settings", () => {
    expect(pronunciationSurface({ q: null, display: defaults, type: null })).toEqual({ state: "default" });
  });
  it("is Browse with no query and any non-default lesson setting, and ignores type there", () => {
    expect(pronunciationSurface({ q: null, display: { ...defaults, sort: "shortest" }, type: "paths" })).toEqual({ state: "browse" });
    expect(pronunciationSurface({ q: null, filter: "level:n5", display: defaults, type: null })).toEqual({ state: "browse" });
  });
  it("is Search whenever a query is present", () => {
    expect(pronunciationSurface({ q: "ramen", display: defaults, type: "goals" })).toEqual({ state: "search", q: "ramen", type: "goals" });
  });
});

describe("searchHref", () => {
  const lesson = { sort: "shortest", filter: "level:n5" };
  it("omits type for All and keeps the lesson settings", () => {
    const url = new URL(searchHref({ q: "ramen", type: null, lesson }), "http://x");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "ramen", sort: "shortest", filter: "level:n5" });
  });
  it("carries shown only on a concrete tab", () => {
    expect(new URL(searchHref({ q: "ramen", type: "paths", lesson: {}, shown: 48 }), "http://x").searchParams.get("shown")).toBe("48");
    expect(new URL(searchHref({ q: "ramen", type: null, lesson: {}, shown: 48 }), "http://x").searchParams.has("shown")).toBe(false);
  });
  it("drops empty lesson values", () => {
    expect(searchHref({ q: "a b", type: "lessons", lesson: { sort: "", duration: undefined } })).toBe("/pronunciation?q=a+b&type=lessons");
  });
});
```

- [ ] **Step 2: Run to see it fail** — `npx vitest run lib/validation/pronunciation-search.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
import { isPronunciationResultMode, type PronunciationDisplay } from "@/lib/validation/shadowing-hub";

/** The concrete search tabs; absence of `type` is All (never written as `type=all`). */
export const SEARCH_TYPES = ["lessons", "paths", "goals", "library"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

/** A trimmed query; nothing but spaces is no query at all. */
export function normalizeSearchQuery(raw: string | undefined): string | null {
  const q = raw?.trim() ?? "";
  return q ? q : null;
}

/** `canonical: false` means the URL spelled All some other way and should redirect without `type`. */
export function parseSearchType(raw: string | undefined): { type: SearchType | null; canonical: boolean } {
  if (raw === undefined) return { type: null, canonical: true };
  return (SEARCH_TYPES as readonly string[]).includes(raw)
    ? { type: raw as SearchType, canonical: true }
    : { type: null, canonical: false };
}

export type PronunciationSurface =
  | { state: "default" }
  | { state: "browse" }
  | { state: "search"; q: string; type: SearchType | null };

/** Default → curated shelves; Browse → lesson grid (no tabs); Search → grouped results. */
export function pronunciationSurface(input: { q: string | null; filter?: string; display: PronunciationDisplay; type: SearchType | null }): PronunciationSurface {
  if (input.q) return { state: "search", q: input.q, type: input.type };
  return isPronunciationResultMode({ filter: input.filter }, input.display) ? { state: "browse" } : { state: "default" };
}

export type LessonParams = Partial<Record<"filter" | "sort" | "duration" | "hideCompleted", string>>;

/** A search URL: lesson settings ride along everywhere (preserved, ignored outside lessons). */
export function searchHref(input: { q: string; type: SearchType | null; lesson: LessonParams; shown?: number }): string {
  const params = new URLSearchParams({ q: input.q });
  if (input.type) params.set("type", input.type);
  for (const key of ["filter", "sort", "duration", "hideCompleted"] as const) {
    const value = input.lesson[key];
    if (value) params.set(key, value);
  }
  if (input.type && input.shown) params.set("shown", String(input.shown));
  return `/pronunciation?${params.toString()}`;
}
```

- [ ] **Step 4: Run** — same command → PASS. Then the four gates.
- [ ] **Step 5: Mutations** — make `"all"` canonical; let `shown` through on All; drop the trim. Each must go red.
- [ ] **Step 6: Commit** — `feat(pronunciation): the search URL contract`.

---

### Task 2: SQL — paths and goals, paged and counted in one place

**Files:**
- Modify: `supabase/migrations/20260731000019_collections.sql` (after the policies)
- Modify: `supabase/tests/pronunciation-studio.sql` (new block before the final cleanup)

**Interfaces:**
- Produces: RPC `search_learning_collections(p_kind text, p_pattern text, p_limit int, p_offset int) returns table (collection_id uuid, total bigint)` — collections of `p_kind` whose `title ilike p_pattern` **and** that hold at least one lesson the caller can see (RLS on `videos` applies: security invoker), ordered `display_order, id`; `total` = the full match count on every row. A count-only call passes `p_limit => 1`.

- [ ] **Step 1: Write the live gate first** (`supabase/tests/pronunciation-studio.sql`, before the final `delete` lines):

```sql
-- Search: paths the caller can open, paged, with one count. A path whose
-- only lesson is PLUS is invisible to a Free learner — in rows AND in total.
insert into public.videos (youtube_video_id, title, library_access) values
  ('jlptgate-search-free', 'Search gate free', 'FREE'),
  ('jlptgate-search-plus', 'Search gate plus', 'PLUS');
insert into public.collections (slug, title, kind, display_order) values
  ('jlptgate-search-open', 'Gate Ramen Path Open', 'path', 900),
  ('jlptgate-search-plus', 'Gate Ramen Path Plus', 'path', 901);
insert into public.lesson_collections (collection_id, lesson_id, position)
select c.id, v.id, 0 from public.collections c join public.videos v
  on (c.slug, v.youtube_video_id) in (('jlptgate-search-open', 'jlptgate-search-free'), ('jlptgate-search-plus', 'jlptgate-search-plus'));
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
do $$
declare got text[]; total bigint;
begin
  select array_agg(c.slug order by r.ord), max(r.total) into got, total
  from search_learning_collections('path', '%Gate Ramen%', 10, 0) with ordinality as r(collection_id, total, ord)
  join collections c on c.id = r.collection_id;
  if got is distinct from array['jlptgate-search-open'] or total <> 1 then
    raise exception 'FAIL search paths: got % total %, want only the open path, total 1', got, total;
  end if;
  if (select count(*) from search_learning_collections('path', '%Gate Ramen%', 1, 1)) <> 0 then
    raise exception 'FAIL search paths: offset past the end returned rows';
  end if;
end $$;
commit;
begin;
set local role anon;
do $$ begin perform search_learning_collections('path', '%', 1, 0); raise exception 'FAIL grant: anon can search collections'; exception when insufficient_privilege then raise notice 'PASS grant: anon denied collection search'; end $$;
commit;
delete from public.collections where slug like 'jlptgate-search-%';
```

(Check the `collections` and `lesson_collections` column names against `20260731000019_collections.sql` before running; `uid_a` is the gate's Free learner.)

- [ ] **Step 2: Run it red** — `npx supabase db reset` then `npm run verify:db:pronunciation` → FAIL `function search_learning_collections ... does not exist`.

- [ ] **Step 3: Add the function** to `20260731000019_collections.sql`:

```sql
-- The pronunciation search's paths and goals: a page of the collections of one
-- kind whose title matches, that the caller can open (at least one member
-- lesson visible under videos RLS — invoker rights), with the full match count
-- on every row. One home for rows and count, so "Learning paths (N)" never
-- counts a path the list cannot show. A count-only call passes p_limit 1.
create function search_learning_collections(p_kind text, p_pattern text, p_limit int, p_offset int)
  returns table (collection_id uuid, total bigint)
  language sql
  stable
  security invoker
  set search_path = public
as $$
  select c.id, count(*) over ()
  from collections c
  where c.kind = p_kind
    and c.title ilike p_pattern
    and exists (
      select 1 from lesson_collections lc join videos v on v.id = lc.lesson_id
      where lc.collection_id = c.id
    )
  order by c.display_order, c.id
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
$$;

revoke all on function search_learning_collections(text, text, int, int) from public, anon;
grant execute on function search_learning_collections(text, text, int, int) to authenticated;
```

- [ ] **Step 4: Run green** — reset + `npm run verify:db:pronunciation` → PASS; also `verify:db:settings`, `verify:db:lesson-jobs`.
- [ ] **Step 5: Mutations (live)** — drop the `exists (...)` clause (red: PLUS path counted); grant to anon (red). Restore with a reset.
- [ ] **Step 6: Commit** — `feat(db): search_learning_collections for the pronunciation search`.

> Codex cannot run Docker: it writes Steps 1 and 3; Claude runs Steps 2, 4, 5.

---

### Task 3: Data facade

**Files:**
- Modify: `lib/data/collections.ts` (`getCollectionViews` `ids` option; export it and `savedCollectionIds`)
- Modify: `lib/data/shadowing-hub.ts` (`getHubDiscovery` `withTotal`)
- Create: `lib/data/pronunciation-search.ts`
- Tests: `lib/data/pronunciation-search.test.ts`, additions to `lib/data/shadowing-hub.test.ts`, `lib/data/collections.test.ts`

**Interfaces:**
- Consumes: Task 1 `SearchType`; Task 2 RPC; `getHubDiscovery`, `HubLesson`, `toHubLesson`; `getShadowingCollections`, `ShadowingCollectionSummary`; `listPracticeSituations`, `PracticeSituation` (`{ slug, icon }`); `containsPattern`.
- Produces:
  - `getCollectionViews(kind: "path" | "goal", options?: { ids?: string[] }): Promise<CollectionView[]>` — with `ids`, only those collections, **in the order of `ids`**.
  - `savedCollectionIds(): Promise<Set<string>>` (the read `getLearningPaths` already does; `getLearningPaths` switches to it).
  - `HubDiscoveryProjection.total?: number` — set only when `withTotal: true`; a head count on `learner_videos` with the same query/filter/duration/hideCompleted (never sort).
  - In `lib/data/pronunciation-search.ts`:

```ts
export type LibraryItem =
  | { kind: "collection"; id: string; label: string; summary: ShadowingCollectionSummary }
  | { kind: "situation"; id: string; label: string; situation: PracticeSituation };

export interface SearchGroup<T> { items: T[]; total: number }
export interface SearchCounts { lessons: number; paths: number; goals: number; library: number }

export interface LessonSettings { filter?: string; sort?: PronunciationSort; duration?: PronunciationDuration; hideCompleted?: boolean }

export function searchLessons(q: string, settings: LessonSettings, limit: number): Promise<SearchGroup<HubLesson>>;
export function searchLearningCollections(kind: "path", q: string, limit: number): Promise<SearchGroup<PathSummary>>;
export function searchLearningCollections(kind: "goal", q: string, limit: number): Promise<SearchGroup<PracticeGoalSummary>>;
export function searchLibrary(q: string, situationLabels: Record<string, string>, locale: string, limit: number): Promise<SearchGroup<LibraryItem>>;
export function getSearchCounts(q: string, settings: LessonSettings, situationLabels: Record<string, string>, locale: string): Promise<SearchCounts>;

/** One page of the active tab; on All (type null) the ≤4 previews of every group. Counts always. */
export function getPronunciationSearch(input: {
  q: string; type: SearchType | null; settings: LessonSettings; limit: number;
  situationLabels: Record<string, string>; locale: string;
}): Promise<{
  counts: SearchCounts;
  lessons?: SearchGroup<HubLesson>; paths?: SearchGroup<PathSummary>;
  goals?: SearchGroup<PracticeGoalSummary>; library?: SearchGroup<LibraryItem>;
}>;
export const SEARCH_PREVIEW_LIMIT = 4;
```

  `hasMore` for every group is `items.length < total` (the page renders `items`).

- [ ] **Step 1: Failing tests** (`lib/data/pronunciation-search.test.ts`, mocking `@/lib/data/shadowing-hub`, `@/lib/data/collections`, `@/lib/data/lesson-taxonomy` and the Supabase client with `createMockSupabase` + `rpcs.search_learning_collections`):
  - `searchLearningCollections("path", "ra%", 4)` calls the RPC with `{ p_kind: "path", p_pattern: "%ra\\%%", p_limit: 4, p_offset: 0 }`, builds summaries for exactly the returned ids in RPC order (`getCollectionViews` called with `{ ids }`), marks `saved` from `savedCollectionIds`, `total` from the rows (0 with no rows).
  - `searchLibrary`: collections `Ramen Talk`, `Zebra`, situations `restaurant` (label `Nhà hàng`), `airport` (label `Sân bay`), q matching all → order by `Intl.Collator("vi")`; equal labels → collection before situation, then id; `limit` slices **after** the merge; `total` = matches of both.
  - situations match the label **or** the slug, case-insensitively (`toLocaleLowerCase(locale)`); a collection matches its title the same way.
  - `getSearchCounts` asks lessons with `withTotal` and the lesson filters, paths/goals with `p_limit: 1`, and sums library.
  - `getPronunciationSearch({ type: "paths" })` calls only the paths rows (plus counts); `type: null` calls every group with `SEARCH_PREVIEW_LIMIT`.
  - In `shadowing-hub.test.ts`: `withTotal` issues one head-count read on `learner_videos` carrying the same `ilike`/`eq`/duration/`is completed_at` filters as the rows read and **no** `order`; `total` is its count; absent when `withTotal` is not set.
  - In `collections.test.ts`: `getCollectionViews("path", { ids: ["b", "a"] })` filters `in("id", ...)` and returns b then a.

- [ ] **Step 2: Run red** — `npx vitest run lib/data/pronunciation-search.test.ts lib/data/shadowing-hub.test.ts lib/data/collections.test.ts`.

- [ ] **Step 3: Implement.** Sketch of the non-obvious parts:

```ts
// lib/data/pronunciation-search.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { containsPattern } from "@/lib/data/query-pagination";
import { getHubDiscovery, type HubLesson } from "@/lib/data/shadowing-hub";
import { getCollectionViews, getShadowingCollections, savedCollectionIds, type PathSummary, type PracticeGoalSummary, type ShadowingCollectionSummary } from "@/lib/data/collections";
import { listPracticeSituations, type PracticeSituation } from "@/lib/data/lesson-taxonomy";

export const SEARCH_PREVIEW_LIMIT = 4;

export async function searchLessons(q: string, settings: LessonSettings, limit: number): Promise<SearchGroup<HubLesson>> {
  const { discovery } = await getHubDiscovery({ query: q, ...settings, browse: true, limit, withTotal: true });
  return { items: discovery?.lessons ?? [], total: discovery?.total ?? 0 };
}

async function learningCollectionPage(kind: "path" | "goal", q: string, limit: number) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("search_learning_collections", { p_kind: kind, p_pattern: containsPattern(q), p_limit: limit, p_offset: 0 });
  if (error) throw error;
  const rows = (data as { collection_id: string; total: number }[] | null) ?? [];
  return { ids: rows.map((row) => row.collection_id), total: Number(rows[0]?.total ?? 0) };
}

// The five editorial shelves are a fixed constant (SHADOWING_COLLECTION_SLUGS) and the
// situations a curated taxonomy of eight: both bounded by construction (ruling 19).
export async function searchLibrary(q: string, situationLabels: Record<string, string>, locale: string, limit: number): Promise<SearchGroup<LibraryItem>> {
  const needle = q.toLocaleLowerCase(locale);
  const matches = (text: string) => text.toLocaleLowerCase(locale).includes(needle);
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
```

  `getHubDiscovery`: resolve the filter as today, then when `withTotal`, run in parallel with the rows read a `learner_videos` `select("id", { count: "exact", head: true })` with the same `ilike`/filter/duration/`is("completed_at", null)` calls — build both from **one** helper that applies those filters, so they cannot drift.

- [ ] **Step 4: Run green**, then the four gates.
- [ ] **Step 5: Mutations** — sort the library before the collator by insertion order (red); count lessons with the sort applied / without the duration filter (red); build path summaries in `getCollectionViews` default order instead of `ids` order (red).
- [ ] **Step 6: Commit** — `feat(data): the pronunciation search facade`.

---

### Task 4: Result grid and compact lesson card

**Files:**
- Modify: `app/globals.css` (component layer)
- Create: `components/shadowing/hub-lesson-result-card.tsx`, `components/shadowing/hub-lesson-result-card.test.tsx`
- Modify: `components/ui/token-scale.test.ts` (`components/shadowing` `sources` + 2)

**Interfaces:**
- Produces:
  - CSS classes: `.result-pane` (the container, `container: results / inline-size`), `.result-grid` (the grid), `.result-preview` (on a `.result-grid` whose items past one row are hidden).
  - `HubLessonResultCard({ lesson, noThumbnailLabel, durationLabel }: { lesson: HubLesson; noThumbnailLabel: string; durationLabel: string | null })` — an `<li>` whose whole body is one `Link` to `/shadowing/{id}`, accessible name = `lesson.title`.

> Correction 2026-10-01: the gap is NOT bounded by 1rem — `--space-md` scales with `--display-scale` up to 1.25 (`DISPLAY_SCALE_FACTOR`), so the breakpoints below wrap at Display size extra large. Superseded by `.superpowers/sdd/pronunciation-show-more/task-4-brief.md` (breakpoints from the largest factor, pinned by a test).

- [ ] **Step 1: CSS** (in `app/globals.css`, `@layer components`):

```css
/* The pronunciation result grid (search spec 2026-10-01): a column is at least
   12rem and extra width becomes another column as soon as one fits, so cards stay
   density-stable when the AppNav hides (measured at 1280: 3 × ≈225px shown,
   4 × ≈208px hidden). */
.result-pane { container: results / inline-size; }
.result-grid {
  display: grid;
  gap: var(--space-md);
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
}
/* One preview row: a container query cannot read a custom property, so the
   breakpoints are n × 12rem + (n − 1) × 1rem — the gap's upper bound. Where the
   real gap is smaller this hides one more item: a row may end short, never wrap. */
@container results (width < 25rem) { .result-preview > :nth-child(n + 2) { display: none; } }
@container results (25rem <= width < 38rem) { .result-preview > :nth-child(n + 3) { display: none; } }
@container results (38rem <= width < 51rem) { .result-preview > :nth-child(n + 4) { display: none; } }
@container results (width >= 51rem) { .result-preview > :nth-child(n + 5) { display: none; } }
```

- [ ] **Step 2: Failing card test**: renders a link named by the title to `/en/shadowing/l1`; shows the JLPT badge and the `durationLabel`; with `thumbnailUrl: null` shows `noThumbnailLabel`; contains no "Start" text.
- [ ] **Step 3: Implement the card** — `aspect-video` thumbnail (`next/image`, `sizes="(min-width: 1024px) 15rem, 50vw"`), `p-sm`, title `line-clamp-2 text-body font-semibold`, meta `text-caption text-muted-foreground`, same focus ring and hover as `HubLessonCard`. Do **not** modify `HubLessonCard`.
- [ ] **Step 4: Run green**, gates (the token test must pass with the bumped count).
- [ ] **Step 5: Commit** — `feat(ui): the result grid and the compact lesson card`.

(The container-query behaviour is proved in the browser in Task 6; jsdom has no layout.)

---

### Task 5: The page — three states, tabs, groups

**Files:**
- Create: `components/shadowing/pronunciation-search-results.tsx` (+ `.test.tsx`)
- Modify: `app/[locale]/(protected)/(app)/pronunciation/page.tsx` (+ `page.test.tsx`)
- Modify: `components/shadowing/hub-discovery-controls.tsx` (+ test) — remove `resultsHeading`, `resultsSummary`, `resultsEmpty`, `resultsMore` and the pager there (grep first: only the pronunciation page passes them)
- Modify: `messages/en/pronunciation.json`, `messages/vi/pronunciation.json`

**Interfaces:**
- Consumes: Tasks 1, 3, 4; `HubResultsPager` (`count`, `more: { href, label, pendingLabel } | null`, children); `pathCards`, `goalCards`, `pathCardLabels` (`./path-card-copy`); `HubPathCard`, `HubCollectionCard`, `HubSituationTile`.
- Produces: `PronunciationSearchResults` — a **server** component taking already-formatted props only:

```ts
type Tab = { key: "all" | SearchType; label: string; href: string; current: boolean };
type Group = { key: SearchType; title: string; seeAll: { href: string; label: string } | null; items: React.ReactNode[] };
export function PronunciationSearchResults(props: {
  heading: string;                 // Results for “q” / All lessons
  tabs: Tab[] | null;              // null in Browse
  groups: Group[];                 // All: every non-empty group, preview; a tab: one group
  preview: boolean;                // All → .result-preview on each grid
  more: { href: string; label: string; pendingLabel: string } | null;   // concrete tab / Browse
  empty: string;                   // shown when groups are all empty
}): JSX.Element
```

- [ ] **Step 1: Copy** (EN; VI in the same style):

```json
"search": {
  "heading": "Results for “{q}”",
  "tabs": { "all": "All", "lessons": "Lessons ({count})", "paths": "Learning paths ({count})", "goals": "Practice goals ({count})", "library": "Collections & situations ({count})" },
  "tabsLabel": "Result types",
  "seeAll": "See all",
  "seeAllLabel": "See all {group}",
  "empty": "No results for “{q}”.",
  "lessonControls": "Lesson filters & sort",
  "showMore": { "lessons": "Show more lessons", "paths": "Show more paths", "goals": "Show more goals", "library": "Show more" }
}
```

  VI: `"Kết quả cho “{q}”"`, `"Tất cả"`, `"Bài học ({count})"`, `"Lộ trình học ({count})"`, `"Mục tiêu luyện tập ({count})"`, `"Bộ sưu tập & tình huống ({count})"`, `"Loại kết quả"`, `"Xem tất cả"`, `"Xem tất cả {group}"`, `"Không có kết quả cho “{q}”."`, `"Lọc & sắp xếp bài học"`, `"Xem thêm bài học"`, `"Xem thêm lộ trình"`, `"Xem thêm mục tiêu"`, `"Xem thêm"`.

- [ ] **Step 2: Failing component tests** (`pronunciation-search-results.test.tsx`, mock `@/lib/i18n/navigation` `useRouter` as in `hub-discovery-controls.test.tsx`):
  - tabs render as links in a `nav` named "Result types"; the current one has `aria-current="page"`.
  - with `preview`, each group's `ul` has class `result-preview` and a "See all …" link; without it, neither.
  - no groups → only `empty`.
  - `more` renders the pager's link after the grid.

- [ ] **Step 3: Failing page tests** (`page.test.tsx`; mock `getPronunciationSearch`):
  - `?q=ramen` → `getPronunciationSearch({ q: "ramen", type: null, limit: 4, ... })`; heading "Results for “ramen”"; five tabs with counts; the hero/curated shelves absent.
  - `?q=ramen&type=paths&shown=48` → `limit: 48`; the display panel (`Sort & display`) **absent**; Show more href keeps `q`, `type`, lesson params, `shown=72`.
  - `?q=ramen` (All) → the display trigger's accessible name includes "Lesson filters & sort".
  - `?q=ramen&type=xyz&shown=48&sort=shortest` → `redirect` (mock `next/navigation`) to `/pronunciation?q=ramen&sort=shortest` (locale-prefixed as the page's other hrefs are).
  - `?sort=shortest` (no q) → Browse: no tabs, "All lessons", `getHubDiscovery` path unchanged (Show more as today).
  - no q, defaults → Default: curated shelves exactly as before (existing tests stay green).
  - a new search (the search form) carries no `type`/`shown` (hidden inputs), keeps lesson params.

- [ ] **Step 4: Implement.** In `page.tsx`:
  - `const q = normalizeSearchQuery(param("q"))`, `const { type, canonical } = parseSearchType(param("type"))`; when `q && !canonical` → `redirect(getPathname({ href: searchHref({ q, type: null, lesson }), locale }))` (import `redirect` from `next/navigation`).
  - `surface = pronunciationSurface({ q, filter: hubQuery.filter, display, type })`.
  - Default: unchanged. Browse: the existing lesson path, rendered through `PronunciationSearchResults` (tabs `null`, one lessons group, `more` from the current Show more logic) with `HubLessonResultCard`.
  - Search: `getPronunciationSearch({ q, type, settings, limit: type ? pronunciationResultLimit(param("shown")) : SEARCH_PREVIEW_LIMIT, situationLabels, locale })`; `situationLabels` from `tHub("situations.<slug>")` for `listPracticeSituations()` slugs; tabs via `searchHref` (no `shown`); groups mapped to cards (`HubLessonResultCard`, `pathCards` → `HubPathCard`, `goalCards` → `HubPathCard`, library items by `kind` → `HubCollectionCard` / `HubSituationTile`, formatted exactly as the default shelves do); `more` when `items.length < total && limit < RESULT_MAX_LIMIT`.
  - The display panel renders on Browse, All and `type=lessons`; on All its trigger label is `search.lessonControls`.
  - Pass `results={null}` to `HubDiscoveryControls`; the search form's `preservedParams` stay the lesson params only.
- [ ] **Step 5: Run green**, gates; `/shadowing` page tests unchanged and green.
- [ ] **Step 6: Mutations** — render the display panel on `type=paths` (red); keep `shown` in tab hrefs (red); skip the redirect (red); drop `aria-current` (red).
- [ ] **Step 7: Commit** — `feat(pronunciation): grouped search and the compact lesson browser`.

---

### Task 6: Browser acceptance (Claude — Codex never runs Playwright)

**Files:**
- Create: `tests/e2e/fixtures/search-data.ts`, `tests/e2e/pronunciation-search.spec.ts`

**Interfaces:**
- Produces: `seedSearchData(): Promise<{ prefix: string; cleanup(): Promise<void> }>` — loads `.env.local` with `loadEnvConfig(process.cwd())` from `@next/env`, creates a service client (`@supabase/supabase-js`, `SUPABASE_SERVICE_ROLE_KEY`) **in the test process only**, inserts under a unique prefix `e2e-search-<uuid8>`: 30 FREE videos titled `<prefix> Ramen NN` with durations, one `path` collection `<prefix> Ramen Path` holding one of them; `cleanup` deletes by prefix (collections first).

- [ ] **Step 1: Fixture + spec** — `test.beforeAll` seeds, `test.afterAll` cleans (runs on failure too). Scenarios at `viewport: { width: 1280, height: 529 }`, a registered learner:
  1. `?q=<prefix>` → tabs show `Lessons (30)` and `Learning paths (1)`; All's lesson preview shows exactly as many visible cards as the grid has columns, and the rest are not in the accessibility tree (`toBeHidden`).
  2. Geometry, nav shown then hidden (`Hide navigation`): column count from `getComputedStyle(grid).gridTemplateColumns.split(" ").length` = 3 then 4 **without reload**; every card width in 200–235 px; `scrollWidth <= clientWidth`.
  3. At 1024 and 1440: no card wider than 300 px, no horizontal overflow.
  4. `type=lessons`: Show more by keyboard → focus on card 25; switching to Paths hides the lesson controls; back to Lessons keeps `sort=shortest` in the URL and the controls' state.
  5. `?q=<prefix>&type=xyz` → lands on the URL without `type`.
- [ ] **Step 2: Run** against a built server (`npm run build` in the worktree, `npm run start`, then `npx playwright test tests/e2e/pronunciation-search.spec.ts tests/e2e/pronunciation.spec.ts --workers=1`); fix what fails.
- [ ] **Step 3:** delete the local probe rows: `delete from videos where youtube_video_id like 'showmore-probe-%'`; remove `tests/e2e/.probe/`.
- [ ] **Step 4: Commit** — `test(e2e): the pronunciation search surface in the browser`.

---

## Finish

Independent `code-reviewer` on the whole branch; fresh reset + all SQL gates + full vitest + the four pronunciation-area e2e specs; stop for the owner's look in Chrome (nav shown and hidden); then ask for the merge decision.
