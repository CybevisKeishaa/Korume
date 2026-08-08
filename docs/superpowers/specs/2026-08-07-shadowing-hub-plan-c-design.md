# Shadowing Hub — Plan C design (Hub UI, Explore, and the foundation both need)

> **Status: LOCKED 2026-08-07** after two review rounds. C1 is planned next; C2 and C3 get their plans
> only after the plan before them has merged, so each is written against a real foundation rather than a
> predicted one.
> **Parent spec:** `docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` (LOCKED,
> `249c442`), which split delivery into A Docs / B Backend / **C Hub UI** / D Lesson UI. A and B are
> merged (`a6a7617`, `b36c455`). This spec is C.
> **Binding context:** `mem:project_status` § NEXT ACTION (the five rules every screen port obeys),
> `mem:plan_c_hub_ui_inputs`, `mem:screen_port_workflow_inputs` (the five-step per-screen method).
> **Design source:** the live Figma design file, key `IwFHZDZdHW7qsSFiNbWrkd` — **59 top-level frames**,
> read through the Figma MCP. Not the local bundle. See §7.

---

## 1. Why this spec is bigger than "Hub UI"

The parent spec scoped C as one screen. Three things measured during this brainstorm made that scope
untenable, and the user ruled on each:

1. **`/videos` → `/shadowing` is executed here, not decided here.** The parent spec §6.2 already fixed
   the whole route family. C carries it out.
2. **Explore Lessons is a separate screen**, not a section of the Hub. The tier-A design prompt is
   explicit: *"This page is opened by clicking Explore inside the Shadowing Hub. It is NOT the same page
   as Shadowing Hub. Shadowing Hub is personalized. Explore is for discovering new content."*
3. **The nav is missing 8 of its 22 rows**, not 3. `navigation-system.md` defines 22; `NAV_GROUPS` ships
   14.

Delivered as **one design, three sequential plans**. Each plan is a branch with its own review gate.

| Plan | Contents | Why this order |
|---|---|---|
| **C1 Foundation** | Route rename + move · layout tokens · `TwoColumnShell` · nav to 22 rows + scroll + 8 empty-state routes · data layer (collections, situations, sources) | Pure infrastructure, zero pixels. After C1, C2/C3 are layout work. |
| **C2 Shadowing Hub** | 8 sections + 4-card Companion rail | First real screen. Produces the card components C3 consumes. |
| **C3 Explore Lessons** | Hero search · shelves · situation chips · 5 level shelves · Quick Preview drawer | Largest (5833px vs the Hub's 2745px) and **consumes** C2's components. Reversing the order means building them twice. |

**C4 (not in this spec):** the asynchronous lesson-creation job subsystem. See §4.2.3 and §9.

---

## 2. Decisions register

Every ruling made during the 2026-08-07 brainstorm, with the evidence behind it. A later session that
wants to revisit one should read the evidence first, not re-derive the question.

| # | Decision | Rationale |
|---|---|---|
| D1 | Scope = Hub + Explore + complete nav. Roadmap/Weekly Report etc. get real routes with honest empty states, not populated screens. | A nav row that 404s is worse than one that says "not enough data yet". |
| D2 | C1 moves the whole route family at once; the two focus screens are **moved, not restyled**. | One rename event. Plan D changes content, never URLs again. |
| D3 | **Figma wins all four Hub divergences** against parent spec §5 (see §4.1). Losing side gets amended — §8. | User ruling. The screens were designed after understanding the business model better than the docs did. |
| D4 | Editorial collections are seeded by migration; `lib/data/collections.ts` provides the read path. | Content is versioned reference data → migrations, per repo convention. Tables already exist (`20260731000019`), unused by any code. |
| D5 | Shell geometry becomes **`--layout-*` tokens, a group separate from `--space-*`**. | `space-*` describes distance between elements; sidebar/content/rail describe shell structure. Different purpose, different namespace. (User correction.) |
| D6 | Add exactly one spacing step, **20px**, named `md-lg`. **No other step is renamed.** | Measured (§7.3): 20px is 12.0% of all spacing on live, and absent from the scale. Renaming `lg/xl/2xl/3xl` is a repo-wide migration whose only payoff is naming aesthetics — if ever wanted it is its own spec, "Spacing System v2". (User correction.) |
| D7 | 28px and 36px are **rounded to 24 and 32**. No `space-28`/`space-36`. | Measured at 2.5% and 0.7%. Adding them days after locking Rule #0 would break the rule that was just written. |
| D8 | Companion rail width = **340px**. | Measured 339.35 in frame `149:2`. |
| D9 | Nav gets `overflow-y-auto`. | 22 rows do not fit 682px. This restores design intent; the clipping in every frame is a Make-export artifact, not a design choice (§7.2). |
| D10 | "Building lesson" shows the **current step label only — no fabricated percentage or ETA**. | `createLesson()` is synchronous and returns no step state (§4.2.3). A client-side 72% would be the UI lying. |
| D11 | **Two axes, not one.** `situation_id` **and** `source_id` both exist from day one. FK columns are the minimal implementation for the UI that exists; **the two-axis separation is the architectural commitment, the cardinality is not.** | The Figma chip row mixes two taxonomies (`Restaurant`/`Office` vs `Anime`/`Podcast`/`News`). The tier-A prompt had them as two separate sections; the build collapsed them. One column would freeze that error into the schema. (User correction.) |
| D12 | **"Popular" is a ranking strategy behind an interface, not a formula in the page.** `PopularStrategyV1` ranks by library count. | Ranking is a business decision that will change (completion rate, retention, recency, AI). Swapping it must not require touching the Hub. (User correction.) |
| D13 | Grammar count is **omitted** from lesson cards. | No lesson↔`grammar_points` link exists, and creating one is content tagging, not porting. Rule: no data, no UI. |
| D14 | Explore has **no Companion rail**, contradicting its own tier-A prompt. | The built frame `200:7705` is one full-width column. Frame beats prompt. |
| D15 | Quick Preview drawer ships **in C3**, not deferred. | It is an Explore interaction, not a backend feature. Deferring it means editing the lesson card twice. (User ruling.) |
| D16 | `JLPT → Certification Practice` and the removal of `Reading` are **recorded, not acted on**. | Observed only in the newest JLPT frames. Whichever plan ports those screens rules on it. Changing a nav label before knowing the destination is backwards. |
| D17 | The `sensei` nav row routes to **`/sensei`**, not `/companion`. | Companion is a cross-cutting concept — it appears in the Hub rail, AI Suggestion, Growth Areas, Weekly Report, and Roadmap. A `/companion` route would attract "everything AI" and sprawl. INSIGHTS lists Sensei, Roadmap and Weekly Report as three peers, so the route matches the nav label and stays one thing. `/companion` is left free to become a landing page *over* them later (`/companion` → sensei · roadmap · growth) rather than a bucket. |

---

## 3. Plan C1 — Foundation

### 3.1 Route rename and move

The parent spec §6.2 already fixed the family. C1 executes it.

| From | To | Chrome group |
|---|---|---|
| `app/[locale]/(protected)/(app)/videos/page.tsx` | `…/(app)/shadowing/page.tsx` | `(app)` |
| `…/(focus)/videos/[id]/shadowing/page.tsx` | `…/(focus)/shadowing/[id]/page.tsx` | `(focus)` |
| `…/(focus)/videos/[id]/dictation/page.tsx` | `…/(focus)/shadowing/[id]/dictation/page.tsx` | `(focus)` |
| — (new, empty shell in C1; filled in C3) | `…/(app)/shadowing/explore/page.tsx` | `(app)` |

**Not renamed:** `/api/videos/**`, the `videos` table, `videos.youtube_video_id`, and every
`lib/data/videos.ts` import path. Parent spec §7 states the physical table name stays internal technical
vocabulary. Only user-visible routes change.

The two focus screens are **moved with their UI untouched**. Plan D restyles them.

**Cleanup owed here:** `components/companion/anchor-boundary.test.ts` still pre-declares
`(app)/shadowing/[id]/…` paths that belong under `(focus)`. This move makes those paths real, so the
test must be corrected in the same commit rather than accidentally starting to pass for the wrong reason.

#### 3.1.1 Redirect policy for the old routes

Three explicit rules in `next.config.js`. A single wildcard is wrong here, because one of the three
mappings **collapses a segment** rather than renaming a prefix:

| From | To |
|---|---|
| `/:locale/videos` | `/:locale/shadowing` |
| `/:locale/videos/:id/shadowing` | `/:locale/shadowing/:id` — segment dropped |
| `/:locale/videos/:id/dictation` | `/:locale/shadowing/:id/dictation` |

**Temporary (307), not permanent (308).** The reasoning matters more than the number: these routes are
still moving — Plan D restructures the lesson workspace into four Learning Modes — and a 308 is cached
aggressively by browsers, which turns a later change into a debugging trap that presents as a routing bug
in the app. There is no SEO argument on the other side: every one of these routes is auth-gated, so
search engines never see them, and the app has never been published, so no external inbound link exists
to preserve. Revisit at launch, once the shape has settled.

All three rules get e2e assertions (§6), precisely because the middle one is the easy one to get wrong,
and getting it wrong sends a learner silently into the wrong lesson mode instead of to an error.

### 3.2 Layout tokens

A new group in `app/globals.css`, deliberately **not** part of `--space-*`:

```css
--layout-sidebar-width: 224px;
--layout-sidebar-collapsed: 68px;
--layout-content-max: 1240px;
--layout-companion-width: 340px;
--layout-gutter: var(--space-xl);      /* 32 — measured 36/40, rounded per D7 */
--layout-column-gap: var(--space-lg);  /* 24 — measured 28,    rounded per D7 */
```

The last two exist so the `layout` namespace is complete: once shell structure has its own namespace,
leaving gutter and column gap in `space-*` splits one concept across two vocabularies. They **reference**
spacing steps rather than carrying raw numbers, so the namespace is whole and D7 still holds — no new
value enters the system.

Plus one spacing step, inserted without renaming anything:

```css
--space-md-lg: 20px;   /* between --space-md 16 and --space-lg 24 */
```

`tailwind.config.ts` gains `"md-lg": "var(--space-md-lg)"` in `theme.extend.spacing`, giving
`p-md-lg` / `gap-md-lg`. Verify `lib/utils.ts`'s `extendTailwindMerge` still resolves the spacing group
correctly — `lib/utils.test.ts` is the guard, and the repo has been bitten before by a new scale that
`twMerge` silently misread.

### 3.3 `TwoColumnShell`

`components/layout/two-column-shell.tsx` — flexible main column plus a `--layout-companion-width` rail
that is `position: sticky`. The rail is hidden below `xl` and its content must not be the only place any
information appears. Explore uses a single-column variant (D14).

### 3.4 Navigation

`NAV_GROUPS` goes to the full 22 rows across 5 groups, matching `docs/design/screens/navigation-system.md`
exactly. The new `insights` group sits between `study` and `progress`.

| Group | Rows |
|---|---|
| LEARN | dashboard · lessons (`/shadowing`) · kanji · vocab · grammar · reading · speaking · jlpt |
| STUDY | review · mining · playlists · challenges · community · leaderboard |
| INSIGHTS | sensei · roadmap · weeklyReport |
| PROGRESS | journey · statistics · achievements |
| ACCOUNT | profile · settings |

STUDY keeps `community` and `leaderboard`, which the Figma sidebar does not draw — `navigation-system.md`
already reconciled that to six rows, and both destinations are built and shipped.

The nav list region becomes `overflow-y-auto` (D9). The reduce-motion control and its `compact` prop
introduced at `7277ac1` must keep working in both expanded and collapsed states; that fix exists because
a previous branch broke exactly this.

**Eight new routes in `(app)`,** each a real page with an honest empty state, i18n strings, and
`generateMetadata`: `/review` · `/challenges` · `/sensei` · `/roadmap` · `/weekly-report` ·
`/statistics` · `/achievements` · `/settings`.

An empty state states what is missing and what would fill it. It never claims a feature is "coming soon"
with a date, and it never renders a fake chart.

### 3.5 Data layer

**Collections** — `lib/data/collections.ts` provides the read path over the existing `collections` /
`lesson_collections` tables (migration `20260731000019`, RLS read-only for `authenticated`, writes
service-role). A seed migration creates the five level collections Explore is built from:

| slug | title | display_order |
|---|---|---|
| `beginner-foundation` | Beginner Foundation (N5–N4) | 1 |
| `daily-conversation` | Daily Conversation (N4–N3) | 2 |
| `natural-japanese` | Natural Japanese (N3–N2) | 3 |
| `advanced-expression` | Advanced Expression (N2–N1) | 4 |
| `native-fluency` | Native Fluency (N1) | 5 |

`featured` already has a defined meaning per the migration's own comment (Featured is a collections row
with `slug = 'featured'`, not a boolean column) and is seeded alongside them.

**This seed is editorial content, not taxonomy.** A collection is a curated set that *contains* lessons;
it is not an attribute *of* a lesson. The five rows above are named after level bands only because the
curator chose to shelve by level — `lesson.level` and `collection` remain independent, and a later
collection may cut across levels entirely. Do not derive one from the other.

**Situations and sources** (D11) — two reference tables plus two FK columns:

```sql
create table lesson_situations (id uuid pk, slug text unique, display_order int);
create table lesson_sources    (id uuid pk, slug text unique, display_order int);
alter table videos add column situation_id uuid references lesson_situations (id);
alter table videos add column source_id    uuid references lesson_sources (id);
```

**Cardinality is provisional, and deliberately so (D11).** FK columns are the minimum that serves the UI
that exists: a single-select chip row. They are **not** a claim that a lesson has only one situation or
one source. Real content already argues against it — NHK News is plausibly News *and* Business; an anime
scene is School *and* Daily Life; a podcast is Daily Life *and* Conversation.

What C1 commits to permanently is **the separation of the two axes**. What it does not commit to is
one-to-one. Two consequences follow, and both are requirements, not observations:

- Consumers read situation and source through `lib/data/` functions that return arrays, never by
  selecting `videos.situation_id` directly in a component or page. Going many-to-many then changes one
  query body and one migration, not every call site.
- The migration that would introduce `lesson_situations_assignments` is a foreseen evolution, not a
  design failure. Whoever writes it should not treat this section as a mistake to apologise for.

**Name collision, flagged:** `source_id` here means content origin (NHK, Podcast, Anime, Drama, Vlog,
News, Creator). It is unrelated to the existing `transcript_source` column, which records how a
transcript was obtained (`user_submitted` etc.). Neither should be renamed to the other.

**Labels are not stored in the database.** Both tables hold `slug` only; display labels come from the
i18n catalog (`shadowing.situations.restaurant`, `shadowing.sources.podcast`). This is the lesson L9a
Plan 3 Task 13 paid for: `lib/jlpt-ui.ts`'s `SECTION_LABELS` / `PILLAR_LABELS` were English maps in code
that had to be deleted and rewired through `t()` across five call sites.

RLS on both new tables: `select` for `authenticated`, writes service-role only — the same convention as
`collections`, `radicals`, `kanji`, `badges`.

---

## 4. Plan C2 — Shadowing Hub

Design source: frame **`149:2` "Shadowing hub after changes"**, 1536×2745. This is the newest hub
iteration; the older `90:1985` "Shadowing Hub" (1278×2299) is superseded and must not be built against.

### 4.1 The four adjudicated divergences (D3)

| # | Parent spec §5 said | Figma builds | Ruling |
|---|---|---|---|
| 1 | Grid entirely collection-driven, ordered by `display_order`; virtual collections prepended Continue Learning → My Lessons → Recently Added | A fixed editorial layout of 8 named sections | **Figma.** The Hub is an authored page, not a rendered list. |
| 2 | "Create Lesson" is a header button opening a modal that shows quota first | An inline import block in the page body: visible URL field, quota box, upgrade link | **Figma.** |
| 3 | §2.2: user-facing progress is 3 lines, explicitly *not* the 6-step backend | 6 named steps, 72%, "est. 1m 20s" | **Figma defines the interaction model; D10 constrains the initial implementation until C4 provides authoritative job progress.** Building is a first-class state and the multi-step pipeline is what the learner sees — the old 3-line UI is retired. What C2 may not do is invent numbers the backend cannot produce. |
| 4 | Not mentioned | "Recommended For You", driven by weaknesses | **Figma.** The engine already exists. |

### 4.2 Sections, and what real data backs each

`listVideos()` is `select * order by created_at desc` — no search, no filtering, no pagination, no
progress join, no collection join. Most sections therefore need new query functions. This table is the
honest inventory.

| Section | Data source | State |
|---|---|---|
| FeaturedHero | `collections` slug `featured` + the viewer's progress | new query (tables exist) |
| ImportSection + quota | `createLesson` · `countMonthlyCreations` · `FREE_MONTHLY_LESSON_QUOTA` · `isUnderQuota` | exists |
| MyLessons — Ready | `user_lesson_library` + `hasTranscript` | exists |
| MyLessons — Failed | `transcriptStatus === "missing"` | exists — see §4.2.2 |
| MyLessons — Building | in-flight request, current step label | see §4.2.3 |
| SearchAndFilter | `ILIKE` on title + `situation_id` | new query + C1 schema |
| PopularLessons | ranking function | see §4.2.1 |
| ContinueLearning | `video_progress` | new query |
| RecentlyAdded | `created_at desc` | exists |
| RecommendedForYou | `getRecommendations()` | exists, shipped |

#### 4.2.1 Popular (D12)

Ranking is behind an interface, so that changing how "popular" is computed never touches the Hub (D12):

```ts
// lib/data/lesson-ranking.ts
export interface LessonRankingStrategy {
  readonly id: string;
  rank(input: { userId: string; limit: number }): Promise<VideoRow[]>;
}

export const PopularStrategyV1: LessonRankingStrategy;
```

The Hub depends on `LessonRankingStrategy` only. It never sees the formula, never names it, and never
renders the underlying number.

**`PopularStrategyV1` ranks by the count of distinct learner libraries containing the lesson**
(`count(*) from user_lesson_library group by lesson_id`). That is the only real signal the system has
today — there is no view count, no completion rate, no rating.

**This is a product decision recorded as v1, not an implementation placeholder.** Later strategies
(`TrendingStrategy` over a time window, `RetentionStrategy`, `AIRecommendedStrategy`) drop in behind the
same interface. The one thing the UI must never do is call the section "Trending" while a
library-count strategy is installed — the label belongs to the strategy, not to the layout.

#### 4.2.2 Failed imports

The design's failure copy is *"Reason: Transcript unavailable"*, which maps exactly onto
`transcriptStatus === "missing"`. Retry re-attempts the caption fetch; Delete removes the row from the
learner's library. Both are real operations against existing data.

#### 4.2.3 Building (D10)

`lib/data/lesson-creation.ts`'s `createLesson()` runs the whole pipeline **synchronously inside one
request** and returns `{ ok, data, transcriptStatus }`. There is no job table, no per-step status, no
percentage, no ETA, no worker, and no retry path.

C2 therefore renders Building as: an in-progress state with the current step label and nothing else. No
percentage. No estimated time. No 6-step checklist with ticks the backend cannot justify.

The real job subsystem — a jobs table, per-step transitions, progress, ETA, resumable retry — is **C4**,
a backend plan outside this spec. When it lands, the same component starts showing real numbers without
being redesigned.

### 4.3 Companion rail

Four cards: `AI COMPANION` (lesson preparation state) · `TODAY'S GOAL` (progress ring, minutes
remaining) · `WEEKLY PROGRESS` (7 bars; shadowing minutes, lessons, accuracy, streak) ·
`AI SUGGESTION` (reason, lesson, CTA).

**Contract, binding — not a note.** Companion cards may explain, recommend, or summarize learner state
that the system has actually recorded. They may not fabricate learner state, invent progress, or assert
future outcomes beyond what the Companion Learning Loop Boundary
(`docs/design/screens/design-reconciliation.md` §4/§6, narrowed in Plan A) permits. A card with no data
renders its empty state; it does not fill itself with plausible text.

---

## 5. Plan C3 — Explore Lessons

Design source: frame **`200:7705` "Explore Lessons"**, 1536×5833. `200:10726` is the same screen with the
preview drawer open.

**Layout:** sidebar 224 + container 1312, single full-width content column (D14). No Companion rail.

**Section order** (measured from the frame, not from the prompt):

1. Hero — eyebrow `SHADOWING LIBRARY` · H1 `Explore Lessons` · subtitle · large search input · hint text
2. `MY IMPORTED LESSONS` — *"The material you chose to bring with you."* + "Import a lesson"
3. Shelf — `RECENTLY ADDED`, *"New official Korume scenes, released this week."*
4. Shelf — `RECOMMENDED FOR YOU`, *"A few directions your Companion thinks may feel good…"*
5. `BROWSE BY SITUATION` — chips
6. "A quiet suggestion" — a Companion nudge
7. Five level shelves, `Shelf 1 of 5` … `Shelf 5 of 5`, 8 lessons each

**The chip row is page-scoped context, not a local filter.** The frame states it directly: *"This
selection becomes the context for every bookshelf below."* Every shelf below re-queries under the
selection. This is the single easiest thing to port incorrectly on this screen.

**`MY IMPORTED LESSONS` is the same component as the Hub's MyLessons**, including all three states. C2
builds it; C3 consumes it. This dependency is why C3 follows C2.

**Lesson card fields:** JLPT range · series label · title · one-line note · duration · line count ·
word count · Start. Word count derives from `getVideoDifficulty`'s tokenization. **Grammar count is
omitted** (D13).

**Quick Preview drawer** (D15) — 420px, right side, opened from a card. Contains thumbnail, title,
description, JLPT, duration, word count, a three-sentence transcript preview, and the actions Start
Lesson / Bookmark / Add to My Lessons. Per the screen-port workflow's overlay rule, this is a drawer
component, **not a route** — its state is neither shareable nor recoverable, so no URL is justified.

---

## 6. Testing

**C1**
- `lib/design-tokens.test.ts` extended: the four `--layout-*` tokens and `--space-md-lg` are pinned, and
  `--layout-*` is asserted to be a distinct group from `--space-*`.
- `NAV_GROUPS` renders 22 rows in 5 groups, in order.
- **Every `href` in `NAV_GROUPS` resolves to a route that exists.** This is the regression test that
  makes a future rename fail loudly instead of shipping a dead nav row.
- The nav list region is scrollable, and the reduce-motion control remains reachable by keyboard in both
  expanded and collapsed states.
- `lib/data/collections.ts`, situations, and sources tested with `test/supabase-mock.ts`.
- All three redirects from §3.1.1 assert their destination, especially the segment-collapsing one.
- `PopularStrategyV1` has a deterministic unit test over a fixed `user_lesson_library` fixture, and the
  Hub is tested against a stub `LessonRankingStrategy` so the page never depends on the ranking formula.

**C2 / C3**
- RTL per section; the **three MyLessons states** get explicit assertions, including that Building
  renders no percentage and no ETA.
- The Companion rail is absent below `xl` and no information is rail-only.
- Explore: selecting a situation chip changes every shelf below it, not just one.

**Playwright, by hand — mandatory.** `vitest.config.ts` excludes `tests/e2e/`, so `npm test` cannot see a
selector broken by the route rename. This exact gap produced the rebrand branch's only Critical finding.
Every spec touching `/videos` is swept manually in C1.
`tests/e2e/route-group-provider-identity.spec.ts` references `/videos` three times and needs the seeded
free-tier video, so `npx supabase db reset` runs before the e2e suite.

---

## 7. Evidence appendix

Everything below was measured on 2026-08-07 against the **live** Figma file `IwFHZDZdHW7qsSFiNbWrkd`
through the Figma MCP, except §7.3's second column. Values are evidence, not contracts — Rule #0 stands.

### 7.1 Hub geometry (frame `149:2`)

```
canvas 1536 ─┬─ Sidebar        224
             └─ Main Content  1312 ─ gutter 36 ─ Container 1240
                                     ├─ Header        86
                                     └─ Content ─┬─ main col   872.6375  (70.4%)
                                                 ├─ gap             28
                                                 └─ CompanionSidebar 339.35  (27.4%)  [sticky]
```

Explore (`200:7705`) uses the same 224 + 1312, header 72, gutter 40, content 1232. The sub-pixel widths
and the Hub/Explore disagreement (1240 vs 1232, gutter 36 vs 40) are HTML-import artifacts and are
themselves the argument for tokenizing one value.

### 7.2 Navigation

62 frames named `Sidebar*` across the file. Expanded left-nav widths: **224** in 15 frames · 223 in 3
(rounding) · 220 in 4 (the JLPT family) · 240 in 2 (`Unuse` and the superseded `Shadowing Detail`) ·
190/200 in 2 outliers. Collapsed: **68**, frame `71:9`, the only frame carrying
`Button - Expand navigation`; seven other frames carry `Button - Collapse navigation`.

**The nav is not missing content — it is clipped.** All five newest screens (`Shadowing hub after
changes`, `Explore Lessons`, `Companion home after change`, `Roadmap detail`, `Growth Areas`) contain the
identical, complete 22-row list. The sidebar frames are 585–682px tall inside screens 2299–5833px tall,
so Figma clips the overflow. This is why D9 treats scrolling as restoring design intent rather than
adding a feature.

**Genuine divergence, not clipping:** the newest JLPT frames (`234:625`, `243:14906`) show LEARN as
Dashboard · Lessons · Kanji · Vocabulary · Grammar · Speaking · **Certification Practice** — `Reading` is
absent from the middle of the list, and `JLPT` is renamed. Recorded under D16.

### 7.3 Spacing

Two independent sources, two different methods, converging:

| Value | Live Figma (1644 `*:margin` wrappers, 1655 values) | Bundle Tailwind utilities (1677) |
|---|---|---|
| 12px | 372 | 297 |
| 4px | 300 | 206 |
| 16px | 200 | 256 |
| **20px** | **198 (12.0%)** | **197 (11.7%)** |
| 24px | 166 | 86 |
| 8px | 117 | 328 |
| **28px** | **41 (2.5%)** | **61 (3.6%)** |
| 32px | 19 | 69 |
| **36px** | **11 (0.7%)** | **19 (1.1%)** |

Off-grid values are omitted from the table above: on live, 2px occurs 159 times and 6px 14 times; on the
bundle, 6px occurs 43 times and 10px 34. These are hairlines and icon insets, not spacing steps, and no
scale should absorb them.

The repo scale (4 · 8 · 12 · 16 · 24 · 32 · 48 · 64) matches design usage closely; six of the seven most
used values are already steps. It has exactly one hole, at 20px — hence D6 adds one step and D7 rounds
the rest.

**Method note, recorded because the first attempt was wrong:** measuring gaps between sibling nodes in
this file produces garbage (a meaningless 47px spike, inflated 10px). The file is an HTML import where
spacing lives inside `*:margin` wrapper frames, so sibling gaps are frequently 0 while the real value
sits in a wrapper's height. Measure the wrappers.

### 7.4 The design file is current

59 top-level frames, including screens absent from the last recorded survey: `Explore Lessons`,
`Explore Lessons (with preview)`, `Search lesson`, `Loading state`, `Error state`,
`Empty state (Companion home)`, `Global setting`, `Footer`, `Checkout`, the JLPT practice family, and
`Review mistake`. `mem:figma_make_design_source` recorded 29 frames and advised against the MCP route —
that guidance is stale for **measurement and screenshots**, which the MCP serves well. It remains correct
that `get_design_context` returns untokenized values unfit to paste.

Dead frames, never build against: `Unuse` (`5:1718`), `Pricing-remove` (`71:2`), and the superseded
`Shadowing Hub` (`90:1985`).

---

## 8. Docs to amend

D3 obliges the losing side to be corrected, so only one source of truth survives.

- `docs/design/screens/screen-shadowing-hub.md` — replace the collection-driven grid description with the
  eight-section editorial layout; document the inline import block.
- `docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` — §5 gains an addendum
  recording D3 with its date; §2.2 gains a note that the 3-line rule is superseded by real per-step
  progress once C4 exists, and that C2 ships step labels only.
- `docs/design/screens/navigation-system.md` — mark rows 15–17 as implemented and record the routes
  chosen for `sensei`, `roadmap`, `weeklyReport`.
- `docs/product/domain-model.md` — add Situation and Source as domain concepts, with D11's
  single-valued constraint stated.

---

## 9. Out of scope

- **C4** — the asynchronous job subsystem behind Building state (§4.2.3).
- Real content for `/review`, `/challenges`, `/sensei`, `/roadmap`, `/weekly-report`, `/statistics`,
  `/achievements`, `/settings` — empty states only.
- `JLPT → Certification Practice`, and the removal of `Reading` from LEARN (D16).
- Restyling the two focus screens (Plan D).
- Multi-valued situations and sources — **foreseen and planned for, not ruled out** (§3.5, D11).
- Renaming the spacing scale — "Spacing System v2", if ever (D6).
- Widening the Rule #0 token scan beyond `components/ui/**`.

## 10. Risks

1. **The rename's e2e blast radius is invisible to `npm test`.** Mitigated by the manual sweep in §6, but
   it stays the highest-likelihood defect in C1.
2. **C2's section count invites a plan with too many tasks.** Eight sections plus a four-card rail should
   be sequenced so that the final whole-branch review still sees a diff it can reason about — that review
   has caught findings no per-task review could see, on five consecutive plans.
3. **`--layout-*` and `--space-*` can drift.** The token test must assert the separation, not just the
   values, or a later contributor will add a layout dimension to the spacing scale.
4. **The live Figma keeps moving.** It gained 30 frames between the last survey and this one.
   **Re-measure only the frames a plan actually builds against, and only if they changed since
   2026-08-07** — check `get_metadata` on that frame's node id and compare its child dimensions against
   §7 before re-deriving anything. Re-surveying all 59 frames at the start of every plan costs hours and
   changes almost nothing. §7 is a dated record, not a permanent one; treat a mismatch as the signal to
   re-measure that frame, not the whole file.
