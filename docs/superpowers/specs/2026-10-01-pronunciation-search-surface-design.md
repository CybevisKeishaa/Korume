# Pronunciation search surface — design

Date: 2026-10-01 · Branch: `pronunciation-show-more` · **Owner-approved to implement** (brainstorming parts 1–2, then two required corrections: bounded concrete tabs, the `library` merge rule).

## Why

On `/pronunciation`, the All-lessons result surface (ruling 18) renders 24 lesson cards in two
columns — twelve rows — and the cards stretch with the container, so they grow further when the
AppNav collapses. The owner wants compact, density-stable cards and a search that groups what it
finds by kind, the way a social-network search does, with filters on the result page itself.

The default (curated) Pronunciation screen is **unchanged** and stays faithful to Figma.

## Three states

| State | Condition | Renders |
|---|---|---|
| **Default** | no `q`, every discovery setting at its default | the curated shelves, exactly as today |
| **Browse lessons** | no `q`, any lesson setting (sort, duration, hide completed, filter chip) not default | compact lesson grid + lesson controls + Show more; **no** kind tabs |
| **Search** | `q` present | heading "Results for “q”", kind tabs, grouped results |

Filters such as duration, JLPT level or "shortest" have no meaning for paths, goals, collections or
situations, so a browse without a query shows lessons only.

## URL contract

- `q` is trimmed; an empty string is **no query**.
- `type` ∈ `lessons | paths | goals | library`. Absent means **All**; `type=all` is never written
  (one state, one URL). Any other value is treated as All and the page **redirects to the same URL
  without `type`**, so an invalid value never survives as a second URL for All; it never fails the page.
- `library` is the combined **Collections & situations** tab. Code must not assume it holds
  collections only.
- A **new search** (submitting the search form) drops `type` and `shown`.
- `shown` (pages of 24, `pronunciationResultLimit`) is meaningful in Browse lessons and in Search
  with **any concrete tab** (`type=lessons|paths|goals|library`); All ignores it. **No search tab ever
  fetches unbounded**: every concrete tab reads a fixed page size and offers Show more while its
  count exceeds what is rendered.
- **Lesson settings are lesson-only state.** `sort`, `duration`, `hideCompleted` and `filter` stay in
  the URL on every tab — *preserved but ignored outside lessons* — so switching to Paths and back to
  Lessons, or Back/Forward, never loses the learner's configuration.
- Tab links keep `q` and the lesson settings, and drop `shown` (switching tab starts at one page).

## Search mode

**Tabs:** `All · Lessons (N) · Learning paths (N) · Practice goals (N) · Collections & situations (N)`,
each with its result count. The active tab is marked (`aria-current="page"`); tabs are links.

**All:**
- Each non-empty group shows **one row** of previews and a "See all" link to its tab. An empty group
  is not rendered. When all four are empty, one shared empty state ("No results for “q”").
- The Lessons preview and `Lessons (N)` apply the **lesson filters** (duration, hide completed, filter
  chip); **sort** orders the preview but does not change N. "See all" therefore opens exactly the set
  that was previewed.
- Paths, goals and library apply `q` only.
- The lesson controls stay available on All but are **scoped visibly and by accessible name** to
  lessons ("Lesson filters & sort"), so they never read as filtering all four kinds.

**One row means one row:** each group fetches at most 4 previews; items that would wrap to a second
row at the current column count are `display: none` (native CSS `@container` rules on the result
pane, next to the grid definition), so hidden links are out of the keyboard order and the
accessibility tree — not merely clipped. A container query cannot read a custom property, so its
breakpoints are literal: `n × 12rem + (n − 1) × 1.25rem` (the gap's upper bound: `--space-md` grows with the Display size setting up to ×1.25; corrected 2026-10-01, pinned by `lib/design-tokens.test.ts`). Where the real
gap is smaller the query errs toward hiding one more item — a row may end one card short, never
wrap.

**Lessons tab:** the full lesson grid with the normal lesson controls and Show more (as today).

**Paths / Goals / Library tabs:** that kind's matches a page at a time (`shown` + Show more, same
pager and focus behaviour as Lessons), no lesson controls.

**Library = Collections & situations — the merge rule:**
- `searchLibrary` returns one typed list of `{ kind: "collection" } | { kind: "situation" }` items.
  A collection's label is its DB title; a situation's is its **localized display label**.
- The two sources are merged into one list, sorted **stably by the current display label**
  (`Intl.Collator` for the request locale; ties by kind, then id), and only then sliced to the page
  limit / `shown`. So collections never take every slot merely because they were queried first.
- The tab's count is collection count + situation count.
- The renderer picks `HubCollectionCard` or `HubSituationTile` by the `kind` discriminator.
- All's library preview is the first ≤4 items of **that same merged ordering**, so the preview and
  "See all" agree.
- ponytail: collections are read in SQL `order by title` (up to the page limit) and re-sorted in code
  with the collator; for plain titles the two orders agree. If titles ever need a locale collation
  SQL disagrees with, read the collections with an ICU collation matching the request locale.

## Grid and cards

- One result grid for every group and state: `grid-template-columns: repeat(auto-fill,
  minmax(12rem, 1fr))`, gap `--space-md`. Extra width becomes another column as soon as one fits,
  so a card never stretches past ≈ 12rem + (12rem + gap) / columns (≈ 295 px worst case, at two
  columns). The grid reacts to its own container width, not the viewport and not the AppNav state.
- **Measured 2026-10-01 at the owner's viewport 1280×529:** result pane 704 px with the AppNav shown,
  876 px hidden; rail 275 / 302 px; gap 14.2 px. The owner's first target (3/4 columns *and* 240–290 px
  cards) is geometrically impossible beside the rail (3 × 240 + gaps > 704); the owner chose
  **columns over width**.
- **Acceptance:** at 1280×529, **3 columns (≈ 225 px cards) with the AppNav shown, 4 (≈ 208 px) with it
  hidden**; cards 200–235 px there; no card wider than 300 px at any tested width (1024, 1280, 1440);
  no horizontal overflow.
- The right rail keeps its width; the space freed by collapsing the nav goes to the result pane.
- **`HubLessonResultCard`** (new; the `/shadowing` card is untouched): 16:9 thumbnail scaled to the
  card width, title clamped to 2 lines, the whole card is the link (accessible name = lesson title),
  no separate "Start" button. As built: the JLPT level is a badge on the thumbnail and the meta line is the
  duration; both are the link's accessible description.
- Paths and goals reuse `HubPathCard`; collections `HubCollectionCard`; situations `HubSituationTile` —
  inside the same grid, so the search shares the default screen's design language.

## Data

> **As built (correction 2026-10-01):** paths and goals are one `searchLearningCollections(kind)` over the
> SQL function `search_learning_collections` (rows + `count(*) over ()`, security invoker, so a collection
> counts only with a lesson the caller can see; PLUS lessons are visible to everyone). The library is
> `searchLibrary`, counted in code. A group whose rows are read reports its own total as its count; only
> the other groups are counted. The tree below is the original design.

`getPronunciationSearch(...)` is a thin **facade** over typed, independent functions; adding a sixth
kind adds a function, not a branch:

```text
getPronunciationSearch({ q, type, lessonSettings, shown })
  ├─ searchLessons(q, lessonSettings, limit)   reuses getHubDiscovery's query/order logic
  ├─ searchPaths(q, limit)                     collections kind=path, title ilike
  ├─ searchGoals(q, limit)                     collections kind=goal, title ilike
  ├─ searchLibrary(q, locale labels, limit)    typed merge of:
  │    ├─ searchCollections(q, limit)          shadowing collections, title ilike, order by title
  │    └─ searchSituations(q, locale labels)   in code: match translated label or slug
  └─ getSearchCounts(q, lessonSettings)        head counts, no rows (library = sum of both)
```

- The active tab fetches only its own rows, one page (`shown`) at a time; `type` absent (All) fetches
  the ≤4-item previews of every group. Counts always run and are light: `count: "exact", head: true` in SQL (the lesson count on
  `learner_videos` when a learner filter applies), situations counted in code.
- Every text match goes through `containsPattern` (escaped `ilike`).
- Situation names live in the message files, not the DB: matching the **current locale's label**
  (and the slug) in application code is bounded by construction (8 curated rows) — ruling 19 holds.
- **Known limitation:** path, goal and collection titles exist only in English in the DB, so a
  Vietnamese query ("hội thoại") does not match "Daily Conversation". No machine or fuzzy
  translation is faked; localized titles are a separate content task.

## Accessibility

- Tabs are a `nav` with links; the active one has `aria-current="page"`.
- Changing tab or pressing Show more keeps focus meaningful (Show more: first new card, as today).
- Counts are part of each tab's accessible name.
- The lesson controls' accessible name says they apply to lessons.

## Testing and acceptance

- **Unit:** `q`/`type` normalisation (empty, unknown → redirect without `type`, never `type=all`); a
  new search drops `type` and `shown`; every concrete tab is bounded and pages with `shown`; the
  library merge (interleaved by label, count = sum, All preview = first items of the same order); lesson settings preserved but ignored outside lessons; each search function and the
  counts (lesson count follows filters, not sort); empty groups hidden; the shared empty state; tab
  hrefs. Mutation-check each rule (AGENTS.md §7).
- **Playwright at 1280×529, AppNav shown and hidden:** measured column count (3 / 4), card widths
  200–235 px, ≤ 300 px at 1024 and 1440, no horizontal overflow; an All preview shows exactly one row with the extra
  items out of the accessibility tree; tab switching keeps the lesson settings; keyboard focus on
  Show more.
- **E2E data:** the seed holds two lessons, so a fixture creates search data with the service role
  (`SUPABASE_SERVICE_ROLE_KEY`) **only in test setup** (never in a browser bundle), under a dedicated
  prefix, and cleans it up in teardown even when a test fails. New pattern for this repo. The spec
  process loads `.env.local` with `loadEnvConfig` from `@next/env` (ships with Next; no new
  dependency).
- `/shadowing` and `/shadowing/explore` render and test exactly as before.

## Out of scope

- The default curated screen (Figma).
- Localized DB titles for paths, goals and collections.
- Searching lesson transcripts, vocabulary or grammar (title only, as today).
