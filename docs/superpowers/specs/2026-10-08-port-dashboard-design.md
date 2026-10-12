# Port Dashboard — design

- **Status:** design approved section by section by the owner on 2026-10-08 (rulings D1–D12, schema S1–S7,
  mission engine M1–M5, curriculum C1–C5, layout L1–L5, states/tests/gates E1–E4, each with the owner's
  amendments folded in). Written-spec review 2026-10-08: five corrections (M2 access hints + practice lesson rule,
  S7 `first_completed_at`, positive-only weekly cue, curriculum-query test, "up to three" levels) applied; **approved
  by the owner** for `writing-plans`.
- **Branch:** `port-dashboard`, worktree `.worktrees/port-dashboard`, base `master` at **`b89f49d`**.
- **Frame:** Dashboard `111:515` (named "Homepage" in Figma) — file `IwFHZDZdHW7qsSFiNbWrkd`
  (`figma.com/design/IwFHZDZdHW7qsSFiNbWrkd/Korume?node-id=111-515`). Route `/dashboard`.
- **Predecessor:** `port-profile` (merged `d57ad41`) built the two foundations this branch consumes and must not
  rebuild: study timezone (`lib/time/study-day.ts`, `lib/time/study-timezone.ts`) and study time
  (`study_time`, `study_tracked_since`, `lib/data/study-time.ts`), plus `learning_outcomes`, `study_streak` and
  `record_learning_outcome`.

Decision IDs (D, S, M, C, L, E) are stable. Plans, packets, reviews and commits cite them; nobody re-derives a
ruling from prose.

---

## 0. Authority, platform, and what was measured

### 0.1 Authority

Figma decides composition, hierarchy and visual intent; the repo decides source of truth and architecture
(`docs/product/screen-inventory.md` Part II Amendment C). A port is **complete**: every control has a real
effect, every number is measured, nothing is mocked. A capability whose semantics are undecided is decided first
or left off the screen — never rendered as an inert control or a fabricated number. Layer D (`AGENTS.md` §2) binds.

### 0.2 Platform (owner, 2026-10-08)

**The web app is desktop-only. Mobile is a separate native app.** This port has no mobile-browser layout, no
375×812 gate and no mobile reflow scope. Review viewports: **1280×529** (the owner's screen) and **1440×900**.
Viewport normalization applies: reflow, never shrink (Claude memory `port-viewport-normalization`).

### 0.3 Measured facts this design rests on

| Fact | Where |
|---|---|
| Current `/dashboard` is a 99-line placeholder (Level/Streak/SRS cards, badges, recommendations, 3 module links). | `app/[locale]/(protected)/(app)/dashboard/page.tsx` |
| `/review`, `/roadmap`, `/weekly-report`, `/challenges`, `/statistics`, `/achievements`, `/companion` are `UpcomingScreen` placeholders. | `upcoming-routes.test.tsx` |
| **A10** hides `/vocab`, `/vocab/[id]`, `/vocab/review` (`navGroup: null`, code kept, reversible). `/kanji` and `/mining` are exposed. | `lib/product/screen-registry.ts`, inventory §3 |
| SRS review exists per deck only: `/kanji/review`, `/mining/review` (and hidden `/vocab/review`). | routes |
| Curated content: N5 = 39 kanji / 55 vocab / 9 grammar; N4 = 6 / 5 / 1; N3+ = 0. Mock tests exist for N5 and N4 only. | `20260712000005_content_n5_n4.sql`, `20260713000012_jlpt_reading_content.sql` |
| The only canonical lesson ordering is `lesson_collections.position` inside `kind='path'` collections (used by Summary next-lesson). Collections are explicitly independent of `videos.jlpt_level_estimate`. No migration seeds memberships; no admin UI writes them. | `20260731000019_collections.sql`, `20260807000026_collections_seed.sql`, `lib/summary/navigation.ts` |
| Local DB holds 8 videos, all demo/e2e fixtures; no real lesson exists in any database; no deployed DB exists. | measured 2026-10-08 |
| `videos.youtube_video_id` is `unique`. | `20260712000001_schema.sql:197` |
| `videos_read` exposes PLUS metadata to everyone; PLUS **content** is gated by `transcripts_read` (active non-free subscription), inline SQL. | `20260731000023`, `20260731000021` |
| `user_grammar_progress.mastery_score` has **no writer**. | grep |
| Skill scores with writers: `dictation_attempts.accuracy_score`, `user_reading_attempts.score`, `shadowing_sessions.{pronunciation,pitch,rhythm}_score`. | `lib/data/dictation.ts`, `reading.ts`, `pronunciation-metrics.ts` |
| `mastered_at` exists only on `user_vocab_progress` (first transition, trigger-guarded); mining cards run the same SM-2 engine but have no `mastered_at`. `MASTERY_THRESHOLD = 2`. | `lib/data/srs.ts:64,77`, `lib/data/mining.ts:182–201` |
| `normalizeRef` = NFKC + `.trim()` is the declared identity of a saved word/expression (`source_ref`). | `lib/summary/refs.ts`, summary spec §6.1 |
| `profile_counts.words_learned` counts curated vocab with `srs_stage >= p_mastery` (current state). | `20261007000044_port_profile.sql:291` |
| Every `recordActivity` call runs **after** its learning write. | `srs.ts:87`, `mining.ts:215`, `shadowing.ts:90`, `dictation.ts:56`, … |
| `user_video_progress.completed_at` is overwritten on every completion (not first-transition). | `lib/data/videos.ts:126` |
| Conversation outcome fires in `endConversationSession` with no minimum learner turns, and only when AI is configured (else 503). | `lib/data/conversation.ts:290` |
| Summary route is not gated on lesson completion (401/404 only). | `shadowing/[id]/summary/page.tsx` |
| `listCollections()` reads collections **without a kind filter**; caller `lib/data/shadowing-explore.ts:74`. | `lib/data/collections.ts:55` |
| Companion doctrine: surfaces announce what happened, never what to say; no `entering_dashboard` context; "a rest point with nothing meaningful to say gets silence". | `lib/companion/presence/contexts.ts`, `companion-patterns.md` |
| `AppNav` already renders `NotificationBell`; no global search capability exists. | `components/layout/app-nav.tsx` |
| Chrome width = sidebar 224px + rail 24px. | `globals.css:220`, `app-nav.tsx` |

---

## 1. Owner rulings

| ID | Ruling |
|---|---|
| **D1** | **Today's Mission** is a real daily mission system. Keep the card and up to three missions. Reward is XP only; **Journey Point is dropped** from V1. Progress reads the canonical source of each mission type, normalised to `target / current / completed`. The set is frozen for the cycle. Selection order: due work → current lesson (the same lesson as Continue Learning) → relevant practice. No fabricated missions. A new/empty account gets an onboarding treatment. |
| **D2** | **Learning Journey** is curriculum progress, **not JLPT proficiency**. Percentage = completed / total core curriculum lessons of a level; 100% = Completed; a level with curriculum not yet reached = Locked; a level with no curriculum = Unavailable (never 0%, never merged with Locked). Next milestone = the lowest-position incomplete core lesson, named by its real title. Mock tests neither feed the percentage nor gate completion in V1. Never labelled "current JLPT level". |
| **D2b** | Curriculum source of truth = curated `collections.kind='curriculum'` (one per JLPT level), membership + `position` = authored content. No fallback to `jlpt_level_estimate`, no algorithmic ordering. V1 curation = version-controlled manifest → deterministic sync; no admin UI in this branch. |
| **D2c** | Ship the full capability. The production manifest may be **empty** at merge; the card then renders the real state "Lộ trình JLPT đang được biên soạn". Dev/e2e use a clearly marked fixture that can never reach the production manifest. N5/N4 curation is a separate content work item after real lessons are imported. |
| **D3** | **Weakness Snapshot** = up to 3 lowest performance scores among skill **families** with a real metric and enough evidence: Listening (dictation), Reading (reading attempts), Pronunciation family (one weakest metric). Grammar excluded until a real writer exists. Fewer than 3 or empty state; never 0%. `%` is a performance score (low = weak), never inverted. No "Open Weakness Explorer". |
| **D4** | **Weekly Evolution** = 10 non-overlapping rolling 7-day local windows; bars = active study time; metrics = vocabulary mastered, Listening delta, Pronunciation delta, hours studied. Deltas in points; missing evidence hides the metric; windows before tracking are unavailable, not zero. No Weekly Report CTA. |
| **D4b** | Mining cards gain first-transition `mastered_at`. Vocabulary metrics count **distinct lexical items**, never rows. Label "Vocabulary mastered / Từ & cụm từ đã học". Profile Quick Stats moves to the same lexical aggregate layer (in scope). |
| **D5** | **Continue Learning** = most recent incomplete lesson; playback-based progress; curriculum enriches title/order only; states Continue Learning → Start Next Lesson → Recommended for You → onboarding. |
| **D6** | **AI Sensei → Korume**, an optional contextual presence. Deterministic, fact-grounded cue from a shared resolver; silence when nothing is worth saying; no LLM per view or day; no streak warnings. |
| **D7** | **Learning Activity** = 56 consecutive study dates; presence and streak share `learning_outcomes`; fixed intensity thresholds; rest days distinct from missed days; explicit instrumentation boundary. |
| **D8** | **Recent Achievement** = up to 3: latest earned, then measurable in-progress badges; binary/unreachable badges never shown as progress; trophy → Profile Achievements. |
| **D9** | Dashboard-owned header (weekday + daypart, greeting, streak chip, avatar). Bell stays in AppNav only. No search box / ⌘K. AppNav untouched. |
| **D10** | **Review** is a smart entry point over due counts (no unified `/review`). The Review mission freezes its due set and counts distinct reviewed items. Roadmap tile dropped. |
| **D11** | Mission catalog and reward: **50 XP**, stable cycle identity, pinned day boundary, created before qualifying activity, content-scoped frozen targets, reward is never a learning outcome. Conversation dropped from V1 after audit. |
| **D12** | **A10 stands.** Vocabulary leaves Quick Access; the actionable review set is **Mining + Kanji** only, through one canonical review-surface registry. Curated vocab stays domain/history data. |

---

## 2. Data and schema (S1–S7)

New objects go in one new migration `supabase/migrations/20261008000045_port_dashboard.sql`. Changed objects are
edited in their defining migration (`AGENTS.md` §6; resetability gate §11.3). Every aggregate is SQL — never read
rows into TS and count (PostgREST `max_rows = 1000`). **Reads are `SECURITY INVOKER` and rely on RLS +
`auth.uid()`; `SECURITY DEFINER` only for atomic writes**, each with fixed `search_path`, ownership checks and
`revoke execute … from public, anon, authenticated` where the function is service-only.

### S1 — Curriculum collections

- `collections.kind` check gains `'curriculum'`. New column `curriculum_level jlpt_level`, with
  `check ((kind = 'curriculum') = (curriculum_level is not null))` and a unique index on `curriculum_level`.
- The migration inserts five rows `jlpt-n5` … `jlpt-n1` (kind `curriculum`, the matching level) with **no
  members** — reference data, same precedent as `20260807000026_collections_seed.sql`.
- The data API becomes explicit: `listCollections({ kind })` (or `listBrowsableCollections()` for the existing
  shelf/path/goal consumers). A test pins that **no existing caller** (today `shadowing-explore.ts:74`) can receive a
  `curriculum` row. Sync and Journey resolve a curriculum collection by `curriculum_level`, never by title or slug.

### S2 — Mining mastery timestamp

- `sentence_mining_cards.mastered_at timestamptz`, guarded by the existing generic trigger function
  `keep_first_mastered_at()` (once set, never changes, never reset when the stage drops). No backfill.
- Shared helper `masteryTransition({ wasMastered, isMastered, existingMasteredAt, now })` returns the
  `mastered_at` to write. Each model computes `wasMastered` / `isMastered` with its own canonical predicate (today both
  are `repetitions >= MASTERY_THRESHOLD`); the helper never reads a raw field. Curated vocab (`lib/data/srs.ts`) and
  mining (`lib/data/mining.ts`) both call it.
- Every SRS write path of both tables is enumerated in the plan and tested: no path may cross mastery without setting
  the timestamp.

### S3 — Lexical mastery aggregates

Two aggregates sharing one lexical key and one dedupe rule:

- `current_mastered_count()` — distinct lexical items **currently** mastered (Profile "Words Learned" semantics:
  current state). Replaces `profile_counts.words_learned`.
- `newly_mastered_count(p_from, p_to)` — distinct lexical items whose **first** mastery falls in `[p_from, p_to)`
  (Weekly). Order is mandatory: `union(curated, mining) → group by lexical_key → first_mastered_at = min(mastered_at)
  → then filter the window`. Filtering each table before `min()` is a bug (a word mastered last month in the curated
  deck and mined again this week would count as new).

Sources: curated vocab (`user_vocab_progress` ⨝ `vocab`) and mining cards with `source_kind in ('selection',
'vocabulary', 'expression')` (sentence cards never count).

**Lexical identity invariant:** the key is the repo's existing identity of a saved word, `normalizeRef` (NFKC +
trim of Unicode whitespace). It is a **surface identity**: homographs with different readings merge into one item.
This is accepted as the repo's current definition, stated here rather than hidden. `vocab.lexical_key` becomes a
generated column computing the same normalisation in SQL (`normalize(word, NFKC)` + a regex trim that includes
U+3000, because `btrim` does not); mining uses `source_ref`, already normalised on write. A **TS↔SQL parity test**
over a shared fixture (full-width spaces, compatibility forms, mixed scripts) is mandatory.

Labels: Weekly "+N vocabulary items" / Profile "Vocabulary mastered — Từ & cụm từ đã học". Existing users see counts
"since tracking began" (no backfill).

### S4 — Daily missions

```text
daily_missions
  id uuid pk
  user_id uuid fk users on delete cascade
  study_date date                -- display metadata, NOT identity
  timezone_at_creation text
  window_start timestamptz
  window_end timestamptz
  created_at timestamptz
  completed_at timestamptz       -- first transition to all-complete
  rewarded_at timestamptz        -- set only when the XP award committed
  check (window_start < window_end)
  unique (user_id, window_start, window_end)

daily_mission_items
  id uuid pk
  mission_id uuid fk daily_missions on delete cascade
  slot smallint check (slot between 1 and 3)
  type text check (type in ('review', 'finish_lesson', 'shadow_lines', 'dictation_lines'))
  video_id uuid null fk videos   -- required for lesson types, null for review (check)
  target int check (target > 0)
  unique (mission_id, slot), unique (mission_id, type)

daily_mission_eligible
  mission_item_id uuid fk daily_mission_items on delete cascade
  item_key text                  -- exactly the learning_outcomes.item_key format of the source
  primary key (mission_item_id, item_key)
```

`daily_mission_eligible` freezes the eligible identities of **every** count-based type: review (`kanji:<id>`,
mining card id) and practice (`line_id`). It is bounded and indexable; it never lives in an array or JSON column.
RLS: a learner selects only rows of their own missions; writes are service-only.

### S5 — XP source

`xp_events.source_type` gains `'daily_mission_complete'` (edited in `20260713000013_gamification.sql`).
`learning_outcomes.source_type` does **not** change. The mission reward never calls `record_learning_outcome`.
`DAILY_MISSION_XP = 50` lives beside `XP_TABLE` in `lib/gamification/xp.ts`.

### S6 — Instrumentation boundary

`learning_outcomes_instrumented_since() returns timestamptz` — `immutable`, returns the pinned UTC instant
**`2026-10-08T07:51:13Z`** (the `port-profile` merge, `d57ad41`, 14:51:13 +07:00). Its comment states it is the
instrumentation boundary of `learning_outcomes`, not anyone's first activity. Activity history uses
`greatest(users.created_at, learning_outcomes_instrumented_since())`.

### S7 — First lesson completion

`user_video_progress.first_completed_at timestamptz` — set on the first transition to completed, never overwritten
(trigger guard on the `keep_first_mastered_at()` pattern), never reset, no backfill. `completed_at` keeps its current
overwrite behaviour for compatibility. `finish_lesson` progress reads `first_completed_at` (M3), so a later
re-completion can never move an old cycle's evidence out of its window.

---

## 3. Mission engine (M1–M5)

### M1 — Ensure before the write

`ensureDailyMission()` runs **after auth and request validation, before the first mutation** that can change a
mission candidate or its progress, at exactly five sites:

| Site | Why before |
|---|---|
| `lib/data/srs.ts` (kanji and vocab reviews share this path; vocab items are never eligible, D12) | after the write the card is no longer due |
| `lib/data/mining.ts` review | same |
| `lib/data/shadowing.ts` | the line set must be frozen before the first outcome |
| `lib/data/dictation.ts` | same |
| `lib/data/videos.ts` `updateProgress` when `completed` | after the write the lesson is no longer incomplete |

JLPT, reading and conversation do not advance a mission and do not call it. The Dashboard read also calls it.
An invalid request never creates a mission.

**Failure is degraded tracking, never a failed learning action.** If ensure throws, the learning write proceeds,
a structured log/metric records `mission_ensure_failed`, and a later ensure may create a cycle from the new state.
The UI never claims a mission was missed; nothing reconstructs a past due snapshot.

### M2 — Creation

Two layers:

- **TS `buildMissionCandidates(userClient)`** returns ranked **hints only — never an authority on access.**
  `videos_read` exposes PLUS metadata to everyone (§0.3), so reading through RLS does not prove a lesson can be
  opened; SQL revalidates every hint with `can_open_lesson()` (step 5). Hints: the D5 lesson as `finish_lesson`, and
  practice types (`shadow_lines`, `dictation_lines`) ranked by **14-day activity share descending → recency → fixed
  `shadow_lines`, `dictation_lines`**. Ranking is a pure function with unit tests.
- **Practice lesson choice (deterministic).** For each practice type: the D5 current incomplete lesson if it has
  transcript lines; otherwise the most recently practised lesson **of that same modality** within the 14-day window
  that is still openable; otherwise **no candidate** for that type. Never a random or recommended lesson to fill a
  slot — one or two real missions beat three invented ones (D1).
- **SQL `ensure_daily_mission(p_user uuid, p_candidates jsonb)`** — `SECURITY DEFINER`, executable by
  `service_role` only (denied to `anon` and `authenticated`, so a learner cannot inject easy missions). Under
  `pg_advisory_xact_lock(hashtext('xp:' || p_user))` — the **same** lock as XP awards — it:
  1. resolves the study timezone itself from `users.study_timezone` with the repo fallback (never trusts a parameter);
  2. returns the cycle with `window_start <= now() < window_end` if one exists;
  3. otherwise computes `window_start = greatest(local day start, previous.window_end)` and `window_end` = next local
     day start, so a timezone change cannot create overlapping or extra cycles;
  4. computes the **review eligible set in SQL, now**, from the D12 review surfaces (Mining + Kanji due items);
  5. **revalidates every hint**: the lesson is still openable (canonical access helper, §4 C4), still incomplete for
     `finish_lesson`, has a transcript, and the type is valid; it recomputes targets from real rows
     (`min(3, valid lines)`, `min(5, valid lines)`, `min(20, eligible due items)`) and freezes the line ids;
  6. fills slots: `review` (if its target > 0) → hints in order; skips any target 0; at most 3, one per type;
  7. inserts the cycle, its items and its eligible keys in the same transaction — or inserts **nothing** when no slot
     qualifies (onboarding), so a later ensure that day can still create one.

### M3 — Progress

`daily_mission_progress(p_mission_id)` — invoker, RLS. Only outcomes with `created_at` in
`[mission.created_at, window_end)` count:

- `review`, `shadow_lines`, `dictation_lines`: distinct `learning_outcomes.item_key` present in
  `daily_mission_eligible` for that item (a card reviewed twice counts once; a card outside the frozen set never
  counts).
- `finish_lesson`: the frozen `video_id` has `first_completed_at` (S7) in the range. The display bar shows playback % (D5);
  completion is the boolean.

### M4 — Claim

`claim_daily_mission(p_user uuid, p_mission_id uuid)` — `SECURITY DEFINER`, service-only, one transaction under the
same advisory lock:

1. if `rewarded_at` is set, return the current state (duplicate and concurrent claims are no-ops);
2. recompute progress from canonical data;
3. if all items are complete: set `completed_at` (first transition), insert
   `xp_events(source_type = 'daily_mission_complete', source_id = 'mission:' || id, xp = 50)`, increment
   `user_stats.xp`, set `rewarded_at`. `rewarded_at` is written only when the XP insert and increment succeed.

Called after `recordActivity` returns for the four mission sources, after a lesson completion, and on the Dashboard
read (a sweeper for a failed best-effort claim). A late claim after `window_end` is valid when the evidence lies
inside the window. After an award, XP-badge evaluation and the level-up notification run through the **same helper**
`recordActivity` uses (extracted, not duplicated).

### M5 — Concurrency

| Scenario | Why it is safe |
|---|---|
| Two first events of the day concurrently | one advisory lock; the second sees the active cycle; `unique(user_id, window_start, window_end)` is the backstop |
| Ensure vs claim | same lock; a claim never reads a half-inserted cycle |
| The last two outcomes concurrently | each claims after its own commit; the lock serialises; the second sees `rewarded_at` |
| An outcome committing after a claim checked | that outcome's own claim runs after its commit and sees everything |
| Timezone change mid-cycle | the active cycle is found by instant and lives to its pinned `window_end` |
| Event exactly at `window_end` | belongs to the next cycle (`[start, end)`) |


---

## 4. Curriculum (C1–C5)

### C1 — Manifest

`content/curriculum/jlpt.ts`:

```ts
export const JLPT_CURRICULUM = { N5: [], N4: [], N3: [], N2: [], N1: [] } as const satisfies Record<JlptLevel, readonly string[]>;
```

Entries are `youtube_video_id`; array index + 1 = `position`. A pure test rejects duplicates within a level, a video
in two levels, and fixture-shaped ids (`e2e_`, `demo`). An empty manifest passes.

### C2 — Fixture

Local/e2e only, in `supabase/seed.sql`, clearly commented like the existing path fixture: curriculum memberships for
e2e videos so the populated Journey, `Lesson {position}` titles and Start Next Lesson are testable. It never enters
the manifest (C1 test).

### C3 — Sync

`npm run content:sync-curriculum` (script on the `scripts/seed-real-lesson.ts` pattern, service role):

1. validate the manifest with the C1 rules;
2. resolve every `youtube_video_id`; if any is missing, print **all** missing ids and exit 1 without writing;
3. call **one** service-only RPC `sync_curriculum_manifest(p_manifest jsonb)` that, in **one transaction**, rejects
   `PRIVATE` videos, then replaces the membership and positions of all five curriculum collections. Re-running changes
   nothing; an empty manifest removes every managed membership.

Never run inside a migration — lessons do not exist when migrations run. **Running sync on a fixture database wipes
the C2 fixture** (it is authoritative); e2e and screenshots run on a database that has not been synced since its
last reset (§11).

### C4 — Journey computation

- **Core vs supplemental.** FREE members are **core progression**. PLUS members are **supplemental**: shown as
  "+N bài Plus" (available enrichment when subscribed, locked Plus otherwise) and never part of the percentage,
  Completed, remaining count or Next milestone. **A subscription change never changes the Journey.** PRIVATE videos
  are rejected by sync.
- **One access predicate.** The inline content-access condition of `transcripts_read` / `transcript_lines_read` is
  factored into one tested SQL helper (e.g. `can_open_lesson(video_id)`), used by those RLS policies **and** by the
  Journey and mission revalidation. No second copy of authorization logic.
- `curriculum_journey()` — invoker, `auth.uid()`, all in SQL, per level: `core_total`, `core_completed`,
  `next_core_lesson` (lowest position, incomplete), `plus_total`, `plus_accessible`.
- States: `core_total = 0` → **Unavailable**; `core_completed = core_total` → **Completed** (a fact, independent of
  order); **Current** = the lowest level with core curriculum not completed; a level with core curriculum above
  Current and not completed → **Locked** (display only — it never blocks opening a lesson from the library).
  Every level with curriculum completed → "Đã hoàn thành lộ trình hiện có".

### C5 — Display

Three nodes, a window over real levels only:

| Current | Nodes |
|---|---|
| N5 | N5 N4 N3 |
| N4 | N5 N4 N3 |
| N3 | N4 N3 N2 |
| N2 | N3 N2 N1 |
| N1 | N3 N2 N1 |
| all completed | up to three of the highest levels that have curriculum; no invented "next" |

Unavailable nodes read "Đang biên soạn". Next milestone block = the real lesson title + "còn N bài" (core,
incomplete, Current level). No "View Roadmap" link. Every level Unavailable → the whole card reads "Lộ trình JLPT
đang được biên soạn" (no 0%). D5 reads the same result: `Lesson {position}` uses the synced, contiguous positions.

---

## 5. Card semantics

### 5.1 Header (D9)

- Eyebrow: localized weekday + daypart in the study timezone. Daypart taxonomy (pinned): **05:00–11:59 morning,
  12:00–16:59 afternoon, 17:00–20:59 evening, 21:00–04:59 late evening**.
- Title `Welcome back, {name}`; without a name, `Welcome back`. One fixed subtitle from the catalog; no random copy.
- Streak chip = `study_streak` current (the same value Profile and the heatmap use); hidden at 0; activating it
  scrolls to and focuses Learning Activity.
- Avatar through Profile's shared avatar resolver, linking `/profile`.
- No search box, no ⌘K, no second bell. At 1280×529 the freed space stays whitespace; the greeting is not stretched.

### 5.2 Continue Learning (D5)

- Candidate: the most recent `last_watched_at` with `completed_at is null` (`completed_at` wins; a lesson watched to
  ~100% without a completion event is still incomplete).
- Progress `last_watched_position / duration_seconds`, clamped 0–100; duration missing or 0 hides % and remaining.
  Remaining is labelled as video time left.
- Title: `collection title + "Lesson {position}" · lesson title` only when the lesson is a member of a **curriculum**
  collection (D2b), never from a path or shelf; otherwise the lesson title alone.
- Actions: Continue → `/shadowing/[id]` at the resume line (Summary's `resumeHref` logic); Review Lesson →
  `/shadowing/[id]/summary`.
- Tags: real metadata only (`jlpt_level_estimate`, lesson taxonomy situation/topic). No skill tags.
- States: **Continue Learning** → **Start Next Lesson** (curriculum Next milestone) → **Recommended for You**
  (first i+1 recommendation, labelled as a recommendation) → **onboarding** ("Explore lessons" → `/shadowing`).

### 5.3 Today's Mission (D1, D10, D11, D12)

| Type | Target (frozen) | Progress | Destination |
|---|---|---|---|
| `review` | `min(20, eligible due items)` over Mining + Kanji | distinct eligible items reviewed | Review smart entry (§5.10) |
| `finish_lesson` | the D5 lesson | completed in the window; bar shows playback % | `/shadowing/[id]` |
| `shadow_lines` | `min(3, valid lines)` of the lesson chosen by the M2 practice rule | distinct frozen line ids shadowed | the lesson workspace |
| `dictation_lines` | `min(5, valid lines)` of the lesson chosen by the M2 practice rule | distinct frozen line ids dictated | the lesson's dictation |

Heading **"Three small promises"** only when the cycle has exactly three items; one or two items use **"Today's
missions"**. Reward row: `+50 XP`; once `rewarded_at` is set it reads "+50 XP earned" — `rewarded_at`, not
`completed_at`, is the authority for that line. No cycle (no qualifying candidate) → onboarding. Conversation is not a
mission in V1 (D11 audit); owner note: the conversation outcome should require a minimum number of learner turns.

### 5.4 Korume (D6)

- Rendered only when `companion_enabled`; otherwise the container does not exist.
- The Dashboard passes **measured facts** (mission state, weekly facts, weakness facts) to a **shared companion cue
  resolver** in `lib/companion/`; the copy catalog lives with the resolver, not in the card. No `entering_dashboard`
  context is added.
- V1 priority: `mission_completed_today` → `weekly_improvement` (both windows have evidence and
  a **positive** `delta >= +5` points) → `weakest_actionable_skill`. A decline is never a `weekly_improvement` cue;
  reacting to declines would be a separate cue type with its own copy, not in V1. No `streak_at_risk`.
- The same facts always yield the same cue; the cue changes only on a meaningful state transition (e.g. the mission
  completes).
- Nothing worth saying → Korume present, silent: no bubble, no CTA.
- **Practice Now** only with a real destination (e.g. weakness Listening → dictation of a real lesson; a mission-
  complete cue has none). **View Weakness** only for a weakness cue; it scrolls to and focuses the Weakness card.
- Copy states facts and never judges ("Listening của bạn tăng 8 điểm so với 7 ngày trước"; never "bạn đang tụt lại").

### 5.5 Learning Journey — see §4 C4–C5.

### 5.6 Weakness Snapshot (D3)

| Family | Score | Row action |
|---|---|---|
| Listening | mean `dictation_attempts.accuracy_score` | dictation of the D5 or most recent lesson |
| Reading | mean `user_reading_attempts.score` | none — `/reading` is hidden by A10; informational row, no fake affordance |
| Pronunciation | one metric chosen by `weakestPronunciationMetric` over `shadowing_sessions` | the shipped pronunciation/shadowing surface |

Window per family: its **last 30 study dates with evidence** (study timezone). Minimum evidence: **3 scored attempts
per family** in that window. Rank valid families by score ascending; show up to 3. Empty: "Hãy học thêm để Korume
nhận ra điểm cần luyện". No Weakness Explorer link.

### 5.7 Weekly Evolution (D4, D4b)

- Windows: `W0 = [today−6, today]`, `W1 = [today−13, today−7]`, … `W9`, local study dates.
- Bars = active study minutes per window (`study_time`). A window after the tracking boundary with no study = a real
  0 bar; a window wholly before `study_tracked_since()` = **unavailable** (muted gap, not zero). All unavailable →
  "Thời gian học được ghi từ {date}".
- Metrics for W0 vs W1: **Vocabulary mastered** = `newly_mastered_count(W0)` ("+N vocabulary items");
  **Listening** = dictation mean delta; **Pronunciation** = accuracy delta (existing helper); **Hours studied** =
  `study_time(W0)`. Deltas render `+8 điểm`, never `%`; a delta is hidden unless **both** windows hold at least 3 scored attempts. No
  Weekly Report link.

### 5.8 Learning Activity (D7)

- 56 consecutive study dates ending today, ordered oldest → today; desktop grid 4 rows × 14.
- Presence = ≥ 1 `learning_outcomes` row that study date (the evidence `study_streak` uses). Intensity by outcome
  count, fixed thresholds: **1–4, 5–14, 15–29, ≥ 30**.
- A date not in `schedule_days` with no activity = rest state (never "missed"); activity on a rest day renders by
  intensity. Dates before `greatest(users.created_at, learning_outcomes_instrumented_since())` = unavailable.
- Label: current `study_streak`; 0 → "Chưa có chuỗi học hiện tại" (neutral, no CTA).
- Accessibility: no 56 tab stops. One focusable region with a text summary (current streak, active days in range,
  what rest/unavailable mean); each cell carries semantic date/status for screen readers; details via roving focus.

### 5.9 Recent Achievement (D8)

- Up to 3: latest earned (`earned_at` desc) first, then in-progress badges by highest `current / target`.
- In-progress only for well-defined counters (`sessions`, `xp`, `outcome_count`, `kanji_learned`; `streak` labelled
  as the current streak). `jlpt_mock` never ranks as progress (earned ones show normally).
- Rule: a badge whose target exceeds the hard maximum of the current content model is never shown in progress (today
  `hundred_kanji`: 100 > 45 curated kanji).
- Labels: "Đạt hôm qua" / "Earned {date}" / "{current}/{target}"; names from the existing badge copy catalog.
- Progress comes from a projection helper beside `evaluateBadges` over the same `BadgeSnapshot` — never a second
  implementation.
- Trophy → the real Achievements anchor on `/profile` (scroll + focus). New account: "Your first achievement will
  appear here".

### 5.10 Quick Access and the review surfaces (D10, D12)

- One canonical **review-surface registry** (derived from `screen-registry` exposure + an existing review route)
  feeds Quick Access, due aggregation and mission candidates. Today it yields **Mining** (`/mining/review`) and
  **Kanji** (`/kanji/review`).
- Tiles (4): **Review · Mining · Conversation · Lesson Library** (`/shadowing`).
- Review tile: total due over the registry; destination = most due → most recently reviewed → `mining → kanji`; no
  due → "Không có thẻ đến hạn" and the most recently reviewed deck; brand-new learner → `/kanji/review`. The
  destination routes already have real empty states; nothing fakes a session.
- A failed due-count read renders the tile without a count; the link still works.

---

## 6. Architecture

```text
RSC page /dashboard
  → per-card async components, each in Suspense with its own skeleton and typed state
  → card loaders (compose only)
  → request-cached shared facts (React cache()):
       getDashboardContext()      user, study tz, study date, windows
       getActivityBuckets()       heatmap + streak
       getStudyTimeBuckets()      weekly bars + hours
       getWeaknessFacts()
       getWeeklyFacts()
       getContinueLearning()
       getCurriculumJourney()
       getAchievementSnapshot()
       getDailyMission()
  → canonical domain/data functions and SQL aggregates
```

- Cards never own a source-of-truth query; the header streak chip and the heatmap read the same cached result;
  Weekly bars and Hours share one study-time aggregation; Korume consumes the facts objects and never queries.
- `ensureDailyMission()` is started **once** per request as a promise; only the Mission card and the Korume cue
  await it. Every other card streams independently.
- Each loader returns a typed `ok | unavailable | error` state and logs errors server-side; auth/session failures and
  genuine data corruption still bubble to the route error boundary. Nothing swallows every exception into "Try again".
- No page-wide consistent snapshot: atomicity lives in the mutation layer (mission creation/reward, XP, completion).
- Client components receive serialisable strings/numbers only (RSC props rule; `structuredClone` guard).

---

## 7. Layout (L1–L5)

Mode chosen by **content container width** (container queries), never viewport width.

| Mode | Width | Rows |
|---|---|---|
| **Wide** | ≥ 1100px (1440×900), `max-width` ≈ 1200px | Header · Continue `2fr` + Mission `1fr` · Korume / Journey / Weakness (3 equal) · Weekly `1.25fr` + Activity `1fr` · Recent Achievement (3 slots) · Quick Access (4 equal) |
| **Compact** | 900–1099px (1280×529) | Header ≈ 88px (streak + avatar on the title row) · Continue `3fr` + Mission `2fr` · the same 3-equal row (~315px each) · Weekly `1.15fr` + Activity `1fr` (cells ≈ 22px, type never shrunk) · Recent Achievement · Quick Access (4 equal) |
| **Narrow window** | < 900px | pinned breakpoints: 2 columns while every card keeps its pinned min-width, then 1 column; no horizontal scroll; no scaling. Desktop narrow-window behaviour, not a mobile design. |

- `companion_enabled = false` → row 2 is Journey + Weakness `1fr / 1fr`.
- No hard heights. Rows stretch with min/max; content is designed to land near ~300px for row 1 in compact mode; a
  localized Mission may grow rather than clip.
- **Fold gate (1280×529):** the header and the **row-1 container** sit fully inside the viewport (few-px tolerance).
  Row 2 is not required above the fold, and nothing is compressed to force it.
- Quick Access: reduce gaps before ever reducing font; wrap only past the tiles' min-width.
- Skeleton, empty and error states share a reserved block-size per card and mode (anti-CLS, not over-tall). No
  animation (UX/motion is deferred by the owner); reduced motion respected.

---

## 8. States (E1)

Copy follows the Figma error language (`218:15740`: never blaming, never alarming) and the loading patterns
(`210:14338`).

| Card | States | On error |
|---|---|---|
| Header | always; streak chip hidden at 0 or on error | greeting still renders |
| Continue | Continue · Start Next Lesson · Recommended for You · onboarding | local card error |
| Mission | 3 ("Three small promises") · 1–2 ("Today's missions") · completed ("+50 XP earned" per `rewarded_at`) · onboarding | "Chưa tải được nhiệm vụ hôm nay" — never "missed" |
| Korume | hidden · silent · cue | silent presence + server log |
| Journey | all being authored · normal · all completed | local card error |
| Weakness | 1–3 rows · empty | local card error |
| Weekly | unavailable windows · hidden metrics · tracking-from-date | local card error |
| Activity | unavailable · rest · intensity · streak label | local card error |
| Achievement | earned · in progress · empty | local card error |
| Quick Access | links + due count | count omitted, links work |

---

## 9. Tests (E2)

Every invariant gets at least one **mutation** proving the test can fail.

**Unit (vitest):** candidate ranking; window computation (DST, timezone change); `masteryTransition`; badge progress
projection and the unreachable-target rule; cue resolver priority, determinism and significance threshold; daypart
table; 56-date heatmap and 10 weekly windows with their boundaries; Journey window clamp table; manifest validation;
browsable/existing collection callers (`listBrowsableCollections()`, `shadowing-explore`) exclude curriculum while
an explicit `kind: 'curriculum'` query does return it; per-card state rendering; RSC props are structured-cloneable;
**mission-engine failure never fails** an SRS, mining, shadowing, dictation or video write.

**Data-layer integration (pre-write snapshot):** the first due card reviewed is in the frozen set although its
`next_review_at` moved to the future; an incomplete lesson is chosen as `finish_lesson` before its `completed_at`
changes; shadowing/dictation line sets are frozen before the first outcome.

**Live SQL gate `npm run verify:db:dashboard`** (`scripts/verify-dashboard-gate.ps1` + `supabase/tests/
port-dashboard.sql`, reusing the `xp-race` harness):

- 20 concurrent first events → exactly one cycle; concurrent claims → one XP award;
- the reward inserts no `learning_outcomes` row;
- timezone change mid-cycle; an event exactly at `window_end` lands in the next cycle;
- frozen eligibility: a repeat counts once, an item outside the set never counts; target 0 is never selected;
- toggling a subscription never changes the Journey; transcript RLS behaves exactly as before the helper refactor;
- sync is atomic (a mid-way failure writes nothing), idempotent and authoritative; PRIVATE is rejected; an empty
  manifest removes every managed membership — run in isolation, rolled back or followed by a reset (§11);
- re-completing a lesson never changes `first_completed_at`, and an old cycle's `finish_lesson` stays complete;
- `newly_mastered_count` takes `min` before filtering; `current_mastered_count` dedupes across sources;
- **`anon` and `authenticated` both lack EXECUTE** on every service-only RPC (`ensure_daily_mission`,
  `claim_daily_mission`, `sync_curriculum_manifest`); invoker reads never return another learner's rows.

**e2e (Playwright), at 1280×529 and 1440×900:** populated and new accounts; review a card, return, mission progress
advanced; streak chip, View Weakness and trophy move focus to the right place; row-1 container bottom within the
viewport at 1280×529 (geometry, few-px tolerance); no horizontal overflow; `companion_enabled = false` → two-column
row 2.

---

## 10. Pinned values

Real usage data does not exist yet (§0.3: no real lessons, no deployed DB), so these are pinned with their reasons and
revisited by the content work item once real data exists — never silently tuned.

| Value | Pinned | Reason |
|---|---|---|
| Review mission cap | 20 | Figma's example; ~100 XP of reviews, bounded |
| Shadow / dictation targets | 3 / 5 lines | Figma's "3 sentences"; dictation lines are shorter work |
| Mission reward | 50 XP | below the XP of the activities themselves (owner) |
| Weakness minimum evidence | 3 scored attempts per family | one or two attempts are noise |
| Weekly delta evidence | ≥ 3 scored attempts in each of W0 and W1 | same floor as Weakness |
| Weekly significance (Korume cue) | `delta >= +5` points (improvement only), evidence floor met | +1 is not worth coaching |
| Heatmap thresholds | 1–4 · 5–14 · 15–29 · ≥ 30 outcomes | fixed so colours compare across time |
| Daypart bounds | 05 / 12 / 17 / 21 | §5.1 |

---

## 11. Gates (E3)

1. Unit gate **after the last edit**, including edits provoked by live or e2e checks.
2. Whole-branch review even though every task was reviewed; its fix wave gets its own review.
3. Fresh `npx supabase db reset` → dictionary re-import → every `verify:db:*` including `verify:db:dashboard` →
   **`db reset` again if the dashboard gate's sync tests were not rolled back** → full `npm run test:e2e`. The C2
   fixture must be intact for e2e and screenshots.
4. **Query fan-out gate:** trace one real Dashboard request. Pass = no N+1; each shared fact runs at most once per
   request; every round trip is explained. Over-large fan-out is fixed in the primitives before merge. The final
   baseline is recorded in the review.
5. Resetability: confirm no non-resettable database exists (migrations are edited in place, `AGENTS.md` §6). If one
   exists, stop — forward migrations become required.
6. Chrome captures at 1280×529 and 1440×900, populated and new account, judged on hierarchy, rhythm, fold and absence
   of overflow against `111:515` — not pixel match.
7. Owner Chrome review; merge `--no-ff` only after approval. `npm run verify:protocol` exits 0 before every owner
   change and before merge.

---

## 12. Deferred, with destinations (E4)

| Item | Destination |
|---|---|
| Global search (indexing, query, permissions, ⌘K) | capability `global-search` |
| Shared chrome / sidebar matching Figma | capability `app-chrome-refresh`, after the remaining frames are compared |
| Unified review queue `/review` | its own learning-surface capability |
| Roadmap, Weekly Report, Weakness Explorer pages | their own screens |
| Conversation mission | after the conversation outcome requires a minimum of learner turns (owner note) |
| Grammar in Weakness Snapshot | after a real grammar-mastery writer exists |
| `hundred_kanji` unreachable | badge/content review |
| N5/N4 curriculum curation | content work item: import real lessons → export candidates → owner orders → manifest diff review → sync |
| Mock-test placement / skip | its own designed capability |
| App motion vocabulary | after the screen ports (owner, 2026-10-08) |
| `/vocab` visibility | A10 stays; reversing it re-opens D12 |
