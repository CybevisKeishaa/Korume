# Port Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port Figma `111:515` to `/dashboard` as a complete, measured learner home: a real daily mission system,
a curated JLPT curriculum journey, lexical vocabulary mastery, and eight fact-backed cards on the study-timezone
foundations `port-profile` built.

**Architecture:** SQL owns every aggregate and every atomic write (mission creation and reward under the per-user XP
advisory lock, curriculum sync in one transaction). Pure TS modules in `lib/dashboard/` turn rows into views (windows,
grids, journey states, cue choice). The RSC page streams one Suspense boundary per card; card loaders compose
request-`cache()`d fact primitives in `lib/data/dashboard/`, so a fact is read once per request.

**Tech Stack:** Next.js 14 App Router, React 18.3, TypeScript strict, Tailwind + container queries in
`app/globals.css`, next-intl, Supabase (Postgres, RLS), zod, Vitest + jsdom, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-08-port-dashboard-design.md` (approved `812c7c3`). Read it beside this plan:
the steps are a floor, never a ceiling (`docs/lessons.md` L-013). Every reviewer diffs a task against the spec IDs it
names (D, S, M, C, L, E), not only against these steps.

## Plan-time corrections (owner approval requested with this plan)

Measured while writing the plan; each task already implements the corrected version.

- **P1 — the mission reward would count as a learning session.** `buildBadgeSnapshot`
  (`lib/data/gamification.ts`) derives `totalOutcomes` and `outcomeCounts` from **`xp_events`**, so a
  `daily_mission_complete` row would raise `first_steps`/`sessions` progress. Task 7 excludes that source from the
  snapshot (XP badges still see the XP through `user_stats.xp`).
- **P2 — "due" differs per deck today, and the spec did not say which.** Kanji: a progress row with
  `next_review_at` null or ≤ now (never-seen curated kanji are new material, not due — `getReviewQueue`). Mining:
  any card with `next_review_at` null or ≤ now, reviewed or not (`getMiningQueue` presents both). Task 5 pins exactly
  these in one SQL function used by the Review tile, the destination and the mission snapshot.
- **P3 — "in progress" already has a definition.** `learner_videos.in_progress` = progress row, `completed_at` null,
  `last_watched_position > 0`. D5's candidate uses it (a lesson opened but never played is not "in progress"),
  ordered by `in_progress_last_watched_at`. The hub's own "continue" shelf (ordered by `created_at`) is not touched.
- **P4 — the existing weekly helper cannot serve D4.** `getWeeklyImprovement` uses rolling 24-hour windows and returns
  no evidence counts, so it cannot apply D4's study-date windows or the ≥ 3-attempt floor. Task 9 adds one SQL
  aggregate over the D4 windows for Listening and Pronunciation accuracy; the pronunciation page keeps its helper.
- **P5 — Quick Access labels.** `messages/destination-name-parity.test.ts` requires a destination to carry one name
  everywhere. The tiles therefore use the nav catalog: **Review · Collection · Speaking · Lessons** (Figma's "Mining /
  Conversation / Lesson Library" are the same destinations under older names).
- **P6 — one Korume, not two.** The page's `<CompanionAnchor surface="dashboard">` moves **into** the Korume card, so
  the creature and the cue share one container and disappear together when `companion_enabled = false`. The
  `anchor-boundary.test.ts` allowlist entry moves from the page to `components/dashboard/korume-card.tsx`.
- **P7 — the "current transcript" rule.** A video may have several `transcripts`; `getTranscript` reads the newest
  (`created_at desc`). The mission's frozen line set uses the same rule through SQL `current_transcript_id(video)`.
- **P8 — `first_completed_at` uses the server clock.** `user_video_progress` is client-writable through RLS, so the
  S7 trigger ignores any client-supplied value and stamps `now()` on the first completion.
- **P9 — Continue links to the workspace, not to a computed line.** The workspace already resumes from the saved
  position under the learner's `resume_behavior` (`lib/shadowing-workspace/resume.ts`, `workspace-context.tsx:291`).
  Computing Summary's `resumeHref` line id would read every transcript line on each Dashboard view, so Continue links
  to `/shadowing/[id]` and the workspace places the learner (spec §5.2 intent, without the extra read).

## Global Constraints

- Work only in `C:\Users\tplon\Documents\GitHub\JPWeb\japan-web\.worktrees\port-dashboard`, absolute paths. Never
  build, serve or run Playwright in the main checkout (memory `never-build-in-main-checkout`). Serena edit tools write
  to the main checkout — do not use them (memory `serena-writes-to-main-checkout`).
- `node_modules`: create a junction to `.worktrees/port-profile/node_modules` before Task 1
  (`New-Item -ItemType Junction -Path node_modules -Target ..\port-profile\node_modules`); never `npm install`. Copy
  `.env.local` from the main checkout. No new dependency.
- Migrations: an existing object is changed **in its defining migration, in place** (`AGENTS.md` §6); new objects go
  in the one new file `supabase/migrations/20261008000045_port_dashboard.sql`. After any migration edit:
  `npx supabase db reset`, then re-import the dictionary (`bash ../shadowing-workspace-1b/.tmp/import.sh`). Docker
  Desktop must be running. `db reset` needs the owner's approval in auto mode.
- New functions: `revoke execute … from public, anon`; service-only functions also `from authenticated` and
  `grant … to service_role`. `SECURITY DEFINER` only for atomic writes, always `set search_path = public`. Reads are
  `SECURITY INVOKER` scoped to `auth.uid()`.
- Aggregate in SQL; never count rows read through PostgREST (`max_rows = 1000`, L-041). RLS and grants are proven only
  by the live gate `npm run verify:db:dashboard`, never by the unit mock (L-005).
- Constants (one home each): `DAILY_MISSION_XP = 50` (`lib/gamification/xp.ts`); mission targets
  `MISSION_TARGETS = { review: 20, shadow_lines: 3, dictation_lines: 5 }` (`lib/dashboard/missions.ts`, passed to SQL);
  `MISSION_PRACTICE_WINDOW_DAYS = 14`; `WEAKNESS_WINDOW_STUDY_DATES = 30`; `MIN_SKILL_EVIDENCE = 3`;
  `WEEKLY_SIGNIFICANT_POINTS = 5`; `ACTIVITY_THRESHOLDS = [1, 5, 15, 30]`; `ACTIVITY_DAYS = 56`;
  `WEEKLY_WINDOWS = 10`; daypart starts `{ morning: 5, afternoon: 12, evening: 17, lateEvening: 21 }`;
  instrumentation boundary `2026-10-08T07:51:13Z`.
- Copy: next-intl ICU with named arguments (no `#`), vi and en in parity, tests read labels from the catalog. The
  string "Sensei" never appears (`messages/no-sensei.test.ts`). Copy states facts and never judges (D6).
- Props crossing the RSC boundary are plain data (strings, numbers, booleans, arrays/objects of them); every card's
  props get a `structuredClone` test (memory `rsc-client-props-strings-only`).
- Tests: `npx vitest run <paths> --minWorkers=1 --maxWorkers=2`; full suite
  `npm test -- --minWorkers=1 --maxWorkers=2 --reporter=dot`; never alongside Playwright or Codex (memory
  `machine-memory-pressure`). Lint `npm run lint`, types `npm run typecheck`.
- Every new guard and every invariant test is mutation-checked: copy the file to `<file>.mutbak` beside it, mutate,
  run, paste the red output into the task report, restore from `.mutbak`, delete it (memory `tmp-path-differs-by-tool`).
- Commits: message in a file, `git commit -F <file>` (memory `bash-heredoc-apostrophe`), ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Each task: independent `code-reviewer` before commit; the unit gate runs after the last edit (memory
  `gate-after-last-edit`).
- Before Task 1 the controller writes `docs/superpowers/run-state/port-dashboard.md` from the 9-heading template
  `verify:protocol` enforces (`# Branch Run State` … `## Next actions`, `- Owner: Claude`), and checkpoints it after
  every accepted task. `npm run verify:protocol` exits 0 before any owner change.

## Review Focus

1. **A learner reviews one kanji card on a fresh morning without opening the Dashboard first.** The mission exists
   before the write and that very card is in the frozen set; the Dashboard later shows `1/N`. Pinned in Task 7
   (`missions-prewrite.integration` "first due card is eligible").
2. **Two browser tabs submit the last two qualifying reviews at the same instant.** Exactly one `+50 XP`, both
   requests succeed. Pinned in Task 8 (`mission-race`) and Task 7 (claim idempotency unit).
3. **A learner travels and changes study timezone at 22:00.** Today's missions keep their window; no second set
   appears that day. Pinned in Task 6 (gate case "timezone change keeps the active cycle").
4. **A learner subscribes to Plus after finishing every free N5 lesson.** N5 stays Completed; only the "+N bài
   Plus" line changes. Pinned in Task 3 (gate case "subscription never changes core progression").
5. **A word mastered in the curated deck last month is mined again this week and mastered again.** Weekly shows
   `+0` for it, Profile counts it once. Pinned in Task 4 (gate case "min before filter").

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `supabase/migrations/20260731000021_lesson_rls_rewrite.sql` | `can_open_lesson()` + transcript policies call it | 1 |
| `supabase/migrations/20260712000001_schema.sql` | `user_video_progress.first_completed_at` + trigger; `vocab.lexical_key` | 1, 4 |
| `supabase/migrations/20261008000045_port_dashboard.sql` | every new table/function of this branch, in sections | 1–9 |
| `supabase/tests/port-dashboard.sql`, `scripts/verify-dashboard-gate.ps1`, `supabase/tests/mission-race/*` | live gate | 1, 3–9 |
| `supabase/migrations/20260731000019_collections.sql`, `…26_collections_seed.sql` | curriculum kind/level, five rows | 2 |
| `content/curriculum/jlpt.ts`, `lib/curriculum/manifest.ts`, `scripts/sync-curriculum.ts` | manifest, validation, sync | 2 |
| `supabase/seed.sql` | local/e2e curriculum fixture | 2 |
| `lib/data/collections.ts` | `listCollections({ kind })`, `listBrowsableCollections()` | 2 |
| `lib/dashboard/journey.ts`, `lib/data/dashboard/journey.ts` | journey states + window; loader | 3 |
| `lib/srs/mastery.ts`, `lib/data/srs.ts`, `lib/data/mining.ts`, `lib/data/profile.ts` | `masteryTransition`, writers, Profile count | 4 |
| `lib/dashboard/review-surfaces.ts`, `lib/data/dashboard/review.ts` | registry, due summary, destination | 5 |
| `lib/dashboard/missions.ts`, `lib/data/missions.ts` | ranking (pure), ensure/claim/read (I/O) | 6, 7 |
| `lib/data/xp-award.ts` | post-award level-up + badges helper shared by `recordActivity` and the claim | 7 |
| `lib/dashboard/{activity,weekly,weakness,daypart}.ts`, `lib/gamification/badge-progress.ts` | pure fact shaping | 9 |
| `lib/data/dashboard/{context,facts,achievements}.ts` | request-cached fact primitives | 9 |
| `lib/companion/dashboard-cues.ts` | cue resolver (pure) | 10 |
| `components/dashboard/*` | header, grid, card shell, eight cards, Quick Access | 11–13 |
| `app/[locale]/(protected)/(app)/dashboard/{page,loading}.tsx` | the route | 11 |
| `app/globals.css` | `.dashboard-*` container layout | 11 |
| `messages/{en,vi}/dashboard.json`, `messages/{en,vi}/companion.json` | copy | 10–13 |

---

### Task 1: Lesson access helper, first completion timestamp, live gate scaffold

**Spec:** §4 C4 ("One access predicate"), §2 S7, §11 step 3. **Corrections:** P8.

**Files:**
- Modify: `supabase/migrations/20260731000021_lesson_rls_rewrite.sql`, `supabase/migrations/20260712000001_schema.sql`
- Create: `supabase/migrations/20261008000045_port_dashboard.sql` (header only), `supabase/tests/port-dashboard.sql`,
  `scripts/verify-dashboard-gate.ps1`; `package.json` script `verify:db:dashboard`

**Interfaces:**
- Produces: SQL `can_open_lesson(p_video_id uuid, p_user uuid) returns boolean` (invoker, granted to
  `authenticated, service_role`); column `user_video_progress.first_completed_at`; `npm run verify:db:dashboard`.

- [ ] **Step 1: Write the failing gate cases.** Create `supabase/tests/port-dashboard.sql` with the two-user preamble
  copied from `supabase/tests/port-profile.sql` (emails `dashgate-a@example.invalid`, `dashgate-b@example.invalid`)
  and these blocks:

```sql
-- C4 one access predicate: FREE yes, PLUS only with an active subscription, PRIVATE only in the learner's library.
do $$
declare a uuid := (select id from users where email = 'dashgate-a@example.invalid');
  free_v uuid; plus_v uuid; priv_v uuid;
begin
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-free', 'g free', 'FREE') returning id into free_v;
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-plus', 'g plus', 'PLUS') returning id into plus_v;
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-priv', 'g priv', 'PRIVATE') returning id into priv_v;
  if not can_open_lesson(free_v, a) or can_open_lesson(plus_v, a) or can_open_lesson(priv_v, a) then
    raise exception 'FAIL dashboard can_open_lesson without subscription';
  end if;
  insert into subscriptions (user_id, plan, status) values (a, 'plus_monthly', 'active');
  insert into user_lesson_library (user_id, lesson_id) values (a, priv_v);
  if not can_open_lesson(plus_v, a) or not can_open_lesson(priv_v, a) then
    raise exception 'FAIL dashboard can_open_lesson with subscription and library';
  end if;
  delete from subscriptions where user_id = a;
  delete from videos where youtube_video_id like 'dashgate-%';
  raise notice 'PASS dashboard can_open_lesson';
end $$;

-- S7 first completion: stamped once by the server, never moved, client values ignored.
do $$
declare a uuid := (select id from users where email = 'dashgate-a@example.invalid'); v uuid; first_at timestamptz;
begin
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-s7', 'g s7', 'FREE') returning id into v;
  insert into user_video_progress (user_id, video_id, last_watched_position, first_completed_at)
    values (a, v, 10, '2000-01-01');
  if (select first_completed_at from user_video_progress where user_id = a and video_id = v) is not null then
    raise exception 'FAIL dashboard S7 accepted a client first_completed_at';
  end if;
  update user_video_progress set completed_at = now() where user_id = a and video_id = v;
  select first_completed_at into first_at from user_video_progress where user_id = a and video_id = v;
  if first_at is null then raise exception 'FAIL dashboard S7 not stamped'; end if;
  update user_video_progress set completed_at = now() + interval '1 day', first_completed_at = null
    where user_id = a and video_id = v;
  if (select first_completed_at from user_video_progress where user_id = a and video_id = v) <> first_at then
    raise exception 'FAIL dashboard S7 moved on re-completion';
  end if;
  delete from videos where id = v;
  raise notice 'PASS dashboard first_completed_at';
end $$;
```

  Check the real `subscriptions` columns (`20260712000001_schema.sql:571`) and the plan values allowed by its check
  before running; use a valid non-`free` plan literal.

- [ ] **Step 2: Gate script and npm script.** `scripts/verify-dashboard-gate.ps1` = a copy of
  `scripts/verify-profile-gate.ps1` with `$sqlPath` → `supabase/tests/port-dashboard.sql`, the race directory
  → `supabase/tests/mission-race` (Task 8 creates it; until then the script skips the race step when the directory is
  absent and says so), and messages naming "Dashboard". `package.json`: `"verify:db:dashboard": "powershell -NoProfile
  -ExecutionPolicy Bypass -File scripts/verify-dashboard-gate.ps1"`. Run it: FAIL (`can_open_lesson` does not exist).

- [ ] **Step 3: The access helper.** In `20260731000021_lesson_rls_rewrite.sql`, before `drop policy transcripts_read`,
  add the function and replace both transcript policies' `using` clauses:

```sql
-- One home for "may this learner open this lesson's content" (port-dashboard spec §4 C4). The transcript policies,
-- the Dashboard Journey and the mission engine all call it. Invoker: under RLS it sees only the caller's own
-- subscription and library rows; the service-role mission engine passes the learner explicitly.
create function can_open_lesson(p_video_id uuid, p_user uuid) returns boolean
  language sql stable security invoker set search_path = public
as $$
  select exists (
    select 1 from videos v
    where v.id = p_video_id
      and (
        v.library_access = 'FREE'
        or (v.library_access = 'PLUS' and exists (
             select 1 from subscriptions s
             where s.user_id = p_user and s.plan <> 'free' and s.status = 'active'))
        or (v.library_access = 'PRIVATE' and exists (
             select 1 from user_lesson_library l where l.user_id = p_user and l.lesson_id = v.id))
        or v.added_by_user_id = p_user
      )
  );
$$;
revoke execute on function can_open_lesson(uuid, uuid) from public, anon;
grant execute on function can_open_lesson(uuid, uuid) to authenticated, service_role;

drop policy transcripts_read on transcripts;
create policy transcripts_read on transcripts for select to authenticated
  using (can_open_lesson(transcripts.video_id, auth.uid()));

drop policy transcript_lines_read on transcript_lines;
create policy transcript_lines_read on transcript_lines for select to authenticated
  using (exists (
    select 1 from transcripts t
    where t.id = transcript_lines.transcript_id and can_open_lesson(t.video_id, auth.uid())
  ));
```

  `videos_read` keeps its own wider predicate (PLUS metadata is visible to everyone by design — `20260731000023`).

- [ ] **Step 4: S7.** In `20260712000001_schema.sql`, add `first_completed_at timestamptz,` after `completed_at` in
  `user_video_progress`, and after the table's existing trigger(s):

```sql
-- port-dashboard S7: the FIRST completion, stamped by the server clock. completed_at is overwritten on every
-- completion and is client-writable through RLS, so this column ignores any client value (plan P8).
create function keep_first_completed_at() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.first_completed_at is not null then
    new.first_completed_at := old.first_completed_at;
  elsif new.completed_at is not null then
    new.first_completed_at := now();
  else
    new.first_completed_at := null;
  end if;
  return new;
end $$;
create trigger user_video_progress_first_completed before insert or update on user_video_progress
  for each row execute function keep_first_completed_at();
```

  Create `20261008000045_port_dashboard.sql` with the header comment
  `-- port-dashboard (spec 2026-10-08). New objects only; changed objects are edited in their defining migrations.`
  Add `first_completed_at` to `lib/data/user-export.ts` only if that file lists columns per table (it lists primary
  keys only — verify, no change expected).

- [ ] **Step 5: Reset and run.** `npx supabase db reset`, re-import the dictionary, `npm run verify:db:dashboard`
  → both PASS lines; `npm run verify:db:shadowing` and `npm run verify:db:pronunciation` still PASS (they read
  transcripts through RLS). Mutation: change `s.status = 'active'` to `s.status <> 'active'` → the gate goes red.

- [ ] **Step 6: Commit** `feat(db): one lesson-access predicate and first completion timestamp (C4, S7)`.

---

### Task 2: Curriculum collections, manifest and authoritative sync

**Spec:** §2 S1, §4 C1–C3, D2b, D2c.

**Files:**
- Modify: `supabase/migrations/20260731000019_collections.sql`, `supabase/migrations/20260807000026_collections_seed.sql`,
  `supabase/seed.sql`, `lib/data/collections.ts` (+ test), `lib/data/shadowing-explore.ts`, `package.json`
- Create: `content/curriculum/jlpt.ts`, `lib/curriculum/manifest.ts`, `lib/curriculum/manifest.test.ts`,
  `scripts/sync-curriculum.ts`; section "C3" of `20261008000045_port_dashboard.sql`; gate cases

**Interfaces:**
- Produces: `JLPT_CURRICULUM: Readonly<Record<JlptLevel, readonly string[]>>`;
  `validateCurriculumManifest(m: Record<string, readonly string[]>): string[]` (error messages, empty = valid);
  `listCollections(options: { kind: "shelf" | "path" | "goal" | "curriculum" }): Promise<Collection[]>`,
  `listBrowsableCollections(): Promise<Collection[]>` (kinds shelf, path, goal); SQL
  `sync_curriculum_manifest(p_manifest jsonb) returns table (level jlpt_level, members int)` (service-only);
  `npm run content:sync-curriculum`.

- [ ] **Step 1: Failing manifest tests** (`lib/curriculum/manifest.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { JLPT_CURRICULUM } from "@/content/curriculum/jlpt";
import { validateCurriculumManifest } from "./manifest";

const empty = { N5: [], N4: [], N3: [], N2: [], N1: [] };

describe("validateCurriculumManifest", () => {
  it("accepts the empty production manifest", () => {
    expect(validateCurriculumManifest(empty)).toEqual([]);
    expect(validateCurriculumManifest(JLPT_CURRICULUM)).toEqual([]);
  });
  it("rejects a duplicate inside one level", () => {
    expect(validateCurriculumManifest({ ...empty, N5: ["abcdefghijk", "abcdefghijk"] })).toEqual([
      "N5 lists abcdefghijk twice",
    ]);
  });
  it("rejects a lesson in two levels", () => {
    expect(validateCurriculumManifest({ ...empty, N5: ["abcdefghijk"], N4: ["abcdefghijk"] })).toEqual([
      "abcdefghijk is in N5 and N4",
    ]);
  });
  it("rejects fixture-shaped ids so the e2e fixture never reaches production", () => {
    expect(validateCurriculumManifest({ ...empty, N5: ["e2e_curriculum_n5_02", "demo3"] })).toEqual([
      "N5: e2e_curriculum_n5_02 is a fixture id",
      "N5: demo3 is a fixture id",
    ]);
  });
  it("rejects an unknown level key", () => {
    expect(validateCurriculumManifest({ ...empty, N6: [] })).toEqual(["unknown level N6"]);
  });
});
```

- [ ] **Step 2: Implement.** `content/curriculum/jlpt.ts`:

```ts
import type { JlptLevel } from "@/lib/conversation-types";

/**
 * Authored JLPT curriculum (port-dashboard D2b). Each entry is a `youtube_video_id`; array order IS the lesson
 * order (position = index + 1). Changing this file is a content change: it is reviewed as such and applied with
 * `npm run content:sync-curriculum`, never by a migration. Empty is valid — the Dashboard then shows the real
 * "being prepared" state (D2c).
 */
export const JLPT_CURRICULUM: Readonly<Record<JlptLevel, readonly string[]>> = {
  N5: [],
  N4: [],
  N3: [],
  N2: [],
  N1: [],
};
```

  `lib/curriculum/manifest.ts` exports `CURRICULUM_LEVELS = ["N5","N4","N3","N2","N1"] as const`,
  `FIXTURE_ID = /^(e2e_|demo\d+$)/`, and `validateCurriculumManifest` producing exactly the messages above, levels
  checked in `CURRICULUM_LEVELS` order then unknown keys. Run the test: PASS.

- [ ] **Step 3: Schema.** In `20260731000019_collections.sql` change the kind check to
  `check (kind in ('shelf', 'path', 'goal', 'curriculum'))`, add `curriculum_level jlpt_level,` and:

```sql
  -- port-dashboard S1: a curriculum collection belongs to exactly one JLPT level, and only it has one.
  constraint collections_curriculum_level_check check ((kind = 'curriculum') = (curriculum_level is not null))
);
create unique index collections_curriculum_level_uq on collections (curriculum_level) where curriculum_level is not null;
```

  In `20260807000026_collections_seed.sql` append:

```sql
-- port-dashboard D2b: one curriculum per JLPT level. These rows are reference data; their MEMBERSHIP is authored
-- content applied by `npm run content:sync-curriculum` from content/curriculum/jlpt.ts — never by a migration,
-- because lessons do not exist when migrations run.
insert into collections (slug, title, description, display_order, kind, curriculum_level) values
  ('jlpt-n5', 'JLPT N5', null, 100, 'curriculum', 'N5'),
  ('jlpt-n4', 'JLPT N4', null, 101, 'curriculum', 'N4'),
  ('jlpt-n3', 'JLPT N3', null, 102, 'curriculum', 'N3'),
  ('jlpt-n2', 'JLPT N2', null, 103, 'curriculum', 'N2'),
  ('jlpt-n1', 'JLPT N1', null, 104, 'curriculum', 'N1');
```

- [ ] **Step 4: The sync RPC** (new migration, section `-- C3 curriculum sync`):

```sql
-- C3: replaces the membership and order of ALL five curriculum collections in one transaction. Authoritative:
-- an id absent from p_manifest leaves its collection. Ids are videos.id, already resolved by the script.
create function sync_curriculum_manifest(p_manifest jsonb) returns table (level jlpt_level, members int)
  language plpgsql security definer set search_path = public
as $$
declare v_level jlpt_level; v_collection uuid; v_ids uuid[]; v_bad text;
begin
  if exists (select 1 from jsonb_object_keys(p_manifest) k where k not in ('N5', 'N4', 'N3', 'N2', 'N1')) then
    raise exception 'sync_curriculum_manifest: unknown level key';
  end if;
  for v_level in select unnest(enum_range(null::jlpt_level)) loop
    select c.id into v_collection from collections c where c.kind = 'curriculum' and c.curriculum_level = v_level;
    if v_collection is null then raise exception 'sync_curriculum_manifest: no curriculum collection for %', v_level; end if;
    v_ids := array(
      select e.value::uuid from jsonb_array_elements_text(coalesce(p_manifest -> v_level::text, '[]'::jsonb))
        with ordinality as e(value, ord) order by e.ord);
    if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then
      raise exception 'sync_curriculum_manifest: duplicate lesson in %', v_level;
    end if;
    if (select count(*) from videos where id = any (v_ids)) <> cardinality(v_ids) then
      raise exception 'sync_curriculum_manifest: unknown video in %', v_level;
    end if;
    select v.youtube_video_id into v_bad from videos v where v.id = any (v_ids) and v.library_access = 'PRIVATE' limit 1;
    if v_bad is not null then raise exception 'sync_curriculum_manifest: PRIVATE video % cannot be curriculum', v_bad; end if;
    delete from lesson_collections lc where lc.collection_id = v_collection and not (lc.lesson_id = any (v_ids));
    insert into lesson_collections (lesson_id, collection_id, position)
      select e.id, v_collection, e.ord::int from unnest(v_ids) with ordinality as e(id, ord)
      on conflict (lesson_id, collection_id) do update set position = excluded.position;
    level := v_level; members := cardinality(v_ids); return next;
  end loop;
  if exists (
    select lc.lesson_id from lesson_collections lc join collections c on c.id = lc.collection_id
    where c.kind = 'curriculum' group by lc.lesson_id having count(*) > 1
  ) then raise exception 'sync_curriculum_manifest: a lesson is in two curricula'; end if;
end $$;
revoke execute on function sync_curriculum_manifest(jsonb) from public, anon, authenticated;
grant execute on function sync_curriculum_manifest(jsonb) to service_role;
```

- [ ] **Step 5: Gate cases** (append to `port-dashboard.sql`, each block in `begin; … rollback;` so the C2 fixture
  survives — spec E2 amendment 4):

```sql
begin;
do $$
declare free1 uuid; free2 uuid; priv uuid; n int;
begin
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-c1', 'c1', 'FREE') returning id into free1;
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-c2', 'c2', 'FREE') returning id into free2;
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-cp', 'cp', 'PRIVATE') returning id into priv;
  perform sync_curriculum_manifest(jsonb_build_object('N5', jsonb_build_array(free2, free1)));
  if (select position from lesson_collections lc join collections c on c.id = lc.collection_id
      where c.curriculum_level = 'N5' and lc.lesson_id = free2) <> 1 then raise exception 'FAIL dashboard sync order'; end if;
  perform sync_curriculum_manifest(jsonb_build_object('N5', jsonb_build_array(free2, free1)));  -- idempotent
  perform sync_curriculum_manifest(jsonb_build_object('N5', jsonb_build_array(free1)));         -- authoritative
  select count(*) into n from lesson_collections lc join collections c on c.id = lc.collection_id where c.kind = 'curriculum';
  if n <> 1 then raise exception 'FAIL dashboard sync not authoritative (% rows)', n; end if;
  begin
    perform sync_curriculum_manifest(jsonb_build_object('N5', jsonb_build_array(free1), 'N4', jsonb_build_array(priv)));
    raise exception 'FAIL dashboard sync accepted PRIVATE';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  if (select count(*) from lesson_collections lc join collections c on c.id = lc.collection_id
      where c.kind = 'curriculum') <> 1 then raise exception 'FAIL dashboard sync not atomic'; end if;
  perform sync_curriculum_manifest('{}'::jsonb);
  if exists (select 1 from lesson_collections lc join collections c on c.id = lc.collection_id where c.kind = 'curriculum')
    then raise exception 'FAIL dashboard empty manifest kept members'; end if;
  raise notice 'PASS dashboard curriculum sync (order, idempotent, authoritative, PRIVATE, atomic, empty)';
end $$;
rollback;
```

  The gate's privilege block (Task 8, Step 4) asserts `authenticated` cannot execute it.

- [ ] **Step 6: Script.** `scripts/sync-curriculum.ts` on the `scripts/seed-real-lesson.ts` pattern (env via
  `loadEnvConfig`, service client): validate with `validateCurriculumManifest` (print all errors, exit 1); collect
  every id, `select id, youtube_video_id from videos where youtube_video_id in (…)`; if any is missing print
  `missing youtube_video_id: <a>, <b>, …` (all of them) and exit 1 **before** calling the RPC; otherwise call
  `sync_curriculum_manifest` with all five levels (an empty level is `[]`), print `N5 <n> · N4 <n> · …`. Header
  comment warns: running it against a fixture database wipes the `seed.sql` curriculum fixture. `package.json`:
  `"content:sync-curriculum": "vite-node --config vitest.config.ts scripts/sync-curriculum.ts"`.

- [ ] **Step 7: Fixture.** In `supabase/seed.sql`, after the Explore fixture, add four fixture videos and the
  memberships, commented as a local/e2e fixture that `content:sync-curriculum` would replace:

```sql
-- port-dashboard C2: LOCAL/E2E curriculum fixture so Journey, "Lesson {position}" and Start Next Lesson are testable.
-- Never in content/curriculum/jlpt.ts (its validator rejects e2e_ ids). `npm run content:sync-curriculum` is
-- authoritative and REPLACES these rows — never run it on the database e2e uses.
insert into videos (id, youtube_video_id, title, duration_seconds, jlpt_level_estimate, library_access) values
  ('e2e00000-0000-0000-0000-0000000000c2', 'e2e_curriculum_n5_02', 'E2E Curriculum N5 lesson two', 120, 'N5', 'FREE'),
  ('e2e00000-0000-0000-0000-0000000000c3', 'e2e_curriculum_n5_03', 'E2E Curriculum N5 lesson three', 120, 'N5', 'FREE'),
  ('e2e00000-0000-0000-0000-0000000000c4', 'e2e_curriculum_n4_01', 'E2E Curriculum N4 lesson one', 120, 'N4', 'FREE'),
  ('e2e00000-0000-0000-0000-0000000000c5', 'e2e_curriculum_n4_plus', 'E2E Curriculum N4 Plus lesson', 120, 'N4', 'PLUS')
on conflict (id) do nothing;
insert into lesson_collections (lesson_id, collection_id, position)
select m.lesson_id, c.id, m.position
from (values
  ('e2e00000-0000-0000-0000-000000000002'::uuid, 'N5'::jlpt_level, 1),
  ('e2e00000-0000-0000-0000-0000000000c2'::uuid, 'N5', 2),
  ('e2e00000-0000-0000-0000-0000000000c3'::uuid, 'N5', 3),
  ('e2e00000-0000-0000-0000-0000000000c4'::uuid, 'N4', 1),
  ('e2e00000-0000-0000-0000-0000000000c5'::uuid, 'N4', 2)
) as m(lesson_id, level, position)
join collections c on c.kind = 'curriculum' and c.curriculum_level = m.level
on conflict (lesson_id, collection_id) do nothing;
```

  Confirm the hex ids are unused in `seed.sql` first.

- [ ] **Step 8: Data API.** Failing test in `lib/data/collections.test.ts`: `listBrowsableCollections()` issues
  `.in("kind", ["shelf","path","goal"])`; `listCollections({ kind: "curriculum" })` issues `.eq("kind","curriculum")`
  (assert the recorded query calls — the mock ignores filters, L-005/lesson 4 of pronunciation). Replace the
  unfiltered `listCollections()` with these two; `shadowing-explore.ts:74` calls `listBrowsableCollections()`. Add a
  repo scan test asserting no production file calls `listCollections()` without an argument.

- [ ] **Step 9: Gates and commit.** Reset, `verify:db:dashboard` PASS, vitest for the touched files PASS, run the
  script against a scratch reset with a one-id manifest pointing at a missing id → exit 1 with the id listed (paste
  output), then reset again. Mutation: drop the `delete from lesson_collections` line → "not authoritative" red.
  Commit `feat(curriculum): curated JLPT curriculum collections, manifest and authoritative sync (S1, C1-C3)`.

---

### Task 3: Curriculum journey read model

**Spec:** §4 C4–C5, D2, §5.2 title rule.

**Files:**
- Create: `lib/dashboard/journey.ts` (+ test), `lib/data/dashboard/journey.ts` (+ test); section "C4" of the new
  migration; gate cases

**Interfaces:**
- Consumes: `can_open_lesson` (Task 1), curriculum collections (Task 2).
- Produces: SQL `curriculum_journey() returns table (level jlpt_level, collection_title text, core_total int,
  core_completed int, next_video_id uuid, next_title text, next_position int, plus_total int, plus_accessible int)`;
  SQL `curriculum_membership(p_video_id uuid) returns table (collection_title text, position int)`;
  TS:

```ts
export type JourneyNodeState = "completed" | "current" | "locked" | "unavailable";
export interface JourneyLevelRow { level: JlptLevel; coreTotal: number; coreCompleted: number; plusTotal: number;
  plusAccessible: number; next: { videoId: string; title: string; position: number } | null }
export interface JourneyNode { level: JlptLevel; state: JourneyNodeState; percent: number | null }
export type JourneyView =
  | { kind: "authoring" }
  | { kind: "active"; nodes: JourneyNode[]; current: JlptLevel; next: { videoId: string; title: string } | null;
      remaining: number; plus: { total: number; accessible: number } }
  | { kind: "complete"; nodes: JourneyNode[] };
export function buildJourney(rows: readonly JourneyLevelRow[]): JourneyView;
export async function getCurriculumJourney(): Promise<JourneyView>; // React cache()
export async function getCurriculumPlacement(videoId: string): Promise<{ title: string; position: number } | null>;
```

- [ ] **Step 1: Failing pure tests** (`lib/dashboard/journey.test.ts`), one per rule:
  - all five `coreTotal = 0` → `{ kind: "authoring" }`;
  - N5 3/3, N4 1/2 → current N4, nodes `N5 completed 100 · N4 current 50 · N3 unavailable null`, `remaining 1`;
  - window table from spec C5 for every Current (N5 → N5 N4 N3, N4 → N5 N4 N3, N3 → N4 N3 N2, N2 → N3 N2 N1,
    N1 → N3 N2 N1) — drive it with `it.each` and assert the table length is 5 first;
  - N4 completed but N5 not → N4 node `completed`, current N5 (completion is a fact, order-independent);
  - N5 current, N4 has curriculum not completed → N4 `locked`; N3 none → `unavailable`;
  - every level with curriculum completed, only N5 and N4 have curriculum → `{ kind: "complete", nodes: [N5, N4] }`
    ("up to three");
  - PLUS counts never change `percent` or `state` (two rows identical except `plusAccessible` → equal nodes).

- [ ] **Step 2: Implement `buildJourney`.** Order rows by `CURRICULUM_LEVELS`; `available = coreTotal > 0`;
  `state = !available ? "unavailable" : coreCompleted === coreTotal ? "completed" : level === current ? "current" :
  "locked"` where `current` = first available level not completed. `percent = available ? Math.round(100 *
  coreCompleted / coreTotal) : null`. Window: index of current `i` in the five levels, start `clamp(i - 1, 0, 2)`,
  take three. Complete view: the last ≤ 3 available levels in order. Run: PASS.

- [ ] **Step 3: SQL** (new migration, section `-- C4 journey`):

```sql
-- C4: FREE members are core progression; PLUS members are supplemental and never change progression, so a
-- subscription change cannot move the journey. Invoker: completion rows are the caller's own through RLS.
create function curriculum_journey() returns table (
  level jlpt_level, collection_title text, core_total int, core_completed int,
  next_video_id uuid, next_title text, next_position int, plus_total int, plus_accessible int)
  language sql stable security invoker set search_path = public
as $$
  with members as (
    select c.curriculum_level as lvl, c.title as ctitle, lc.position as pos, v.id as vid, v.title as vtitle,
      v.library_access as access, (p.completed_at is not null) as done
    from collections c
    left join lesson_collections lc on lc.collection_id = c.id and lc.position > 0
    left join videos v on v.id = lc.lesson_id
    left join user_video_progress p on p.video_id = v.id and p.user_id = auth.uid()
    where c.kind = 'curriculum'
  )
  select lvl, min(ctitle),
    (count(*) filter (where access = 'FREE'))::int,
    (count(*) filter (where access = 'FREE' and done))::int,
    (array_agg(vid order by pos) filter (where access = 'FREE' and not done))[1],
    (array_agg(vtitle order by pos) filter (where access = 'FREE' and not done))[1],
    (array_agg(pos order by pos) filter (where access = 'FREE' and not done))[1],
    (count(*) filter (where access = 'PLUS'))::int,
    (count(*) filter (where access = 'PLUS' and can_open_lesson(vid, auth.uid())))::int
  from members group by lvl order by lvl;
$$;
revoke execute on function curriculum_journey() from public, anon;
grant execute on function curriculum_journey() to authenticated;

-- D5: "collection + Lesson {position}" comes ONLY from a curriculum collection.
create function curriculum_membership(p_video_id uuid) returns table (collection_title text, position int)
  language sql stable security invoker set search_path = public
as $$
  select c.title, lc.position from lesson_collections lc join collections c on c.id = lc.collection_id
  where lc.lesson_id = p_video_id and c.kind = 'curriculum' and lc.position > 0 limit 1;
$$;
revoke execute on function curriculum_membership(uuid) from public, anon;
grant execute on function curriculum_membership(uuid) to authenticated;
```

- [ ] **Step 4: Gate case** "subscription never changes core progression" (in `begin; … rollback;`): insert two FREE
  and one PLUS member into N5 via `sync_curriculum_manifest`, mark one FREE completed for user A, set
  `request.jwt.claims` to user A (copy the `set local role authenticated; select set_config('request.jwt.claims', …)`
  pattern from `port-profile.sql`), read `curriculum_journey()` → N5 `core_total 2, core_completed 1, plus_total 1,
  plus_accessible 0`; insert an active subscription → same core numbers, `plus_accessible 1`.

- [ ] **Step 5: Loader.** `lib/data/dashboard/journey.ts`: `getCurriculumJourney = cache(async () => …)` calls the
  RPC with the user client and maps rows to `JourneyLevelRow` (camelCase, `next` null when `next_video_id` is null),
  then `buildJourney`. `getCurriculumPlacement(videoId)` calls `curriculum_membership`. Unit test with the supabase
  mock asserting the RPC names and the mapping.

- [ ] **Step 6: Gates and commit.** Reset, gate PASS, vitest PASS. Mutation: drop `access = 'FREE' and` from
  `core_total` → the subscription case goes red. Commit `feat(dashboard): curriculum journey read model (C4, C5)`.

---

### Task 4: Mining mastery timestamp and lexical mastery aggregates

**Spec:** §2 S2, S3, D4b; Profile "Words Learned" switch.

**Files:**
- Modify: `supabase/migrations/20260712000008_sentence_mining_cards.sql`, `supabase/migrations/20260712000001_schema.sql`
  (vocab `lexical_key`), `supabase/migrations/20261007000044_port_profile.sql` (`profile_counts`), `lib/data/srs.ts`
  (+ test), `lib/data/mining.ts` (+ test), `lib/data/profile.ts` (+ test), `messages/{en,vi}/profile.json`
- Create: `lib/srs/mastery.ts` (+ test), `lib/summary/lexical-key-fixture.ts`, `lib/summary/refs.parity.test.ts`;
  section "S3" of the new migration; gate cases

**Interfaces:**
- Produces: `masteryTransition(input: { wasMastered: boolean; isMastered: boolean; existingMasteredAt: string | null;
  now: Date }): string | null`; column `sentence_mining_cards.mastered_at`; generated column `vocab.lexical_key`; SQL
  `mastered_lexemes(p_mastery int)`, `current_mastered_count(p_mastery int) returns int`,
  `newly_mastered_count(p_mastery int, p_from timestamptz, p_to timestamptz) returns int` (all invoker);
  `profile_counts(p_mastery int) returns table (video_lessons_completed int)`.

- [ ] **Step 1: Failing unit tests** (`lib/srs/mastery.test.ts`): first crossing → `now.toISOString()`; already
  mastered with a timestamp → the existing value even when `isMastered` is false (never reset); already mastered with
  no timestamp (pre-instrumentation) → `null` (no invented date); not mastered → `null`.

- [ ] **Step 2: Implement** `lib/srs/mastery.ts`:

```ts
/** First-transition mastery timestamp shared by every SRS model (port-dashboard S2). Each model decides
 * `wasMastered`/`isMastered` with its own predicate; this only decides what `mastered_at` to write. */
export function masteryTransition(input: {
  wasMastered: boolean; isMastered: boolean; existingMasteredAt: string | null; now: Date;
}): string | null {
  if (input.existingMasteredAt !== null) return input.existingMasteredAt;
  return !input.wasMastered && input.isMastered ? input.now.toISOString() : null;
}
```

  `lib/data/srs.ts`: replace the `crossed` expression with
  `masteryTransition({ wasMastered: (existing?.srs_stage ?? 0) >= MASTERY_THRESHOLD, isMastered: next.repetitions >=
  MASTERY_THRESHOLD, existingMasteredAt, now })`. `lib/data/mining.ts` `reviewMiningCard`: select `mastered_at` too
  and write `mastered_at: masteryTransition({ wasMastered: existing.srs_stage >= MASTERY_THRESHOLD, isMastered:
  next.repetitions >= MASTERY_THRESHOLD, existingMasteredAt: existing.mastered_at, now })`. Add a test to
  `lib/data/mining.test.ts`: crossing from stage 1 to 2 writes `mastered_at`; a later lapse keeps it. Add a repo scan
  test (`lib/srs/mastery-writers.test.ts`) listing every production file that writes `srs_stage` to
  `user_vocab_progress` or `sentence_mining_cards` (today exactly `lib/data/srs.ts`, `lib/data/mining.ts`) and asserting
  each imports `masteryTransition` — assert the list length first.

- [ ] **Step 3: Schema.** In `20260712000008_sentence_mining_cards.sql` add `mastered_at timestamptz,` and after the
  table `create trigger sentence_mining_cards_keep_mastered_at before update on sentence_mining_cards for each row
  execute function keep_first_mastered_at();` (the function is generic, defined in `20260712000001_schema.sql`). In
  `20260712000001_schema.sql` `vocab`, add:

```sql
  -- port-dashboard S3: the repo's saved-word identity (lib/summary/refs.ts normalizeRef = NFKC + trim of Unicode
  -- whitespace) computed in SQL. btrim() alone misses U+3000, so the trim is explicit. Parity is tested.
  lexical_key text generated always as (
    regexp_replace(normalize(word, NFKC), '^[\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$', '', 'g')
  ) stored,
```

- [ ] **Step 4: Parity fixture.** `lib/summary/lexical-key-fixture.ts` exports
  `LEXICAL_KEY_CASES: readonly { input: string; key: string }[]` with at least: `"　食べる　"` → `"食べる"`,
  `"ﾀﾍﾞﾙ"` → `"タベル"`, `"Ｔｏｋｙｏ"` → `"Tokyo"`, `"\u00a0日本\u3000"` → `"日本"`, `"お茶"` → `"お茶"`.
  `lib/summary/refs.parity.test.ts`: `normalizeRef(c.input) === c.key` for each case, and the gate SQL file contains
  one `('<input>', '<key>')` row per case (read `supabase/tests/port-dashboard.sql` as text and assert each pair
  appears) — assert the case count first. The gate block:

```sql
do $$
declare bad text;
begin
  create temporary table lexical_cases (input text, key text) on commit drop;
  insert into lexical_cases values ('　食べる　', '食べる'), ('ﾀﾍﾞﾙ', 'タベル'), ('Ｔｏｋｙｏ', 'Tokyo'),
    (E'\u00a0日本\u3000', '日本'), ('お茶', 'お茶');
  insert into vocab (word, jlpt_level) select input, 'N5' from lexical_cases;
  select v.word into bad from vocab v join lexical_cases c on c.input = v.word where v.lexical_key <> c.key limit 1;
  delete from vocab where word in (select input from lexical_cases);
  if bad is not null then raise exception 'FAIL dashboard lexical_key parity for %', bad; end if;
  raise notice 'PASS dashboard lexical_key parity';
end $$;
```

  (Check `vocab`'s not-null columns before running; add the required literals.)

- [ ] **Step 5: Aggregates** (new migration, section `-- S3 lexical mastery`):

```sql
-- S3: one lexical key, one dedupe; two time predicates. Group FIRST, then filter the window, so a word mastered
-- last month in one source and again this week in another is not "new" twice.
create function mastered_lexemes(p_mastery int)
  returns table (lexical_key text, first_mastered_at timestamptz, currently_mastered boolean)
  language sql stable security invoker set search_path = public
as $$
  with items as (
    select v.lexical_key as k, p.mastered_at as at, p.srs_stage >= p_mastery as cur
    from user_vocab_progress p join vocab v on v.id = p.vocab_id
    where p.user_id = auth.uid()
    union all
    select c.source_ref, c.mastered_at, c.srs_stage >= p_mastery
    from sentence_mining_cards c
    where c.user_id = auth.uid() and c.source_kind in ('selection', 'vocabulary', 'expression') and c.source_ref is not null
  )
  select k, min(at), bool_or(cur) from items where k <> '' group by k;
$$;
create function current_mastered_count(p_mastery int) returns int
  language sql stable security invoker set search_path = public
as $$ select count(*)::int from mastered_lexemes(p_mastery) where currently_mastered $$;
create function newly_mastered_count(p_mastery int, p_from timestamptz, p_to timestamptz) returns int
  language sql stable security invoker set search_path = public
as $$ select count(*)::int from mastered_lexemes(p_mastery) where first_mastered_at >= p_from and first_mastered_at < p_to $$;
revoke execute on function mastered_lexemes(int) from public, anon;
revoke execute on function current_mastered_count(int) from public, anon;
revoke execute on function newly_mastered_count(int, timestamptz, timestamptz) from public, anon;
grant execute on function mastered_lexemes(int) to authenticated;
grant execute on function current_mastered_count(int) to authenticated;
grant execute on function newly_mastered_count(int, timestamptz, timestamptz) to authenticated;
```

  Gate case "min before filter" (rollback block, user A's claims): curated `食べる` mastered 30 days ago, a mining
  card `source_ref '食べる'` mastered today, a mining `selection` card `飲む` mastered today, a `sentence` card
  mastered today → `newly_mastered_count(2, today_start, tomorrow_start) = 1` (飲む only),
  `current_mastered_count(2) = 2`.

- [ ] **Step 6: Profile.** Edit `profile_counts` in `20261007000044_port_profile.sql` in place to return only
  `video_lessons_completed`; `lib/data/profile.ts` adds `supabase.rpc("current_mastered_count", { p_mastery:
  MASTERY_THRESHOLD })` to its `Promise.all` and maps it to `wordsLearned`. Update `lib/data/profile.test.ts`. Profile's
  stat label becomes en "Vocabulary mastered" / vi "Từ & cụm từ đã học" (key unchanged; update the pin).

- [ ] **Step 7: Gates and commit.** Reset, gate PASS, vitest (mastery, srs, mining, profile, parity) PASS. Mutation:
  move the window filter into `items` (filter before `min`) → "min before filter" red. Commit
  `feat(vocab): first-transition mastery for mining and lexical mastery aggregates (S2, S3)`.

---

### Task 5: Review surfaces, due summary and the Review destination

**Spec:** §5.10, D10, D12. **Corrections:** P2.

**Files:**
- Create: `lib/dashboard/review-surfaces.ts` (+ test), `lib/data/dashboard/review.ts` (+ test); section "D12" of the
  new migration; gate cases

**Interfaces:**
- Produces:

```ts
export type ReviewDeck = "mining" | "kanji" | "vocab";
export interface ReviewSurface { deck: ReviewDeck; reviewHref: "/mining/review" | "/kanji/review" | "/vocab/review" }
export function exposedReviewSurfaces(registry?: readonly ScreenEntry[]): ReviewSurface[]; // registry order mining, kanji, vocab
export interface DeckSummary { deck: ReviewDeck; due: number; lastReviewedAt: string | null }
export function reviewDestination(summaries: readonly DeckSummary[], surfaces: readonly ReviewSurface[]):
  { href: string; due: number }; // due = total over exposed decks
export async function getReviewSummary(): Promise<{ href: string; due: number }>; // React cache()
```

  SQL `review_due_keys(p_user uuid, p_decks text[], p_at timestamptz) returns table (deck text, item_key text)`;
  `review_deck_summary(p_decks text[]) returns table (deck text, due int, last_reviewed_at timestamptz)`.

- [ ] **Step 1: Failing pure tests** (`lib/dashboard/review-surfaces.test.ts`):
  - with today's registry, `exposedReviewSurfaces()` → `[{mining,/mining/review},{kanji,/kanji/review}]` (vocab
    hidden by A10, read from `SCREEN_REGISTRY`: a deck is exposed when its parent screen — `mining`, `kanji`,
    `vocab` — has `navGroup !== null`);
  - a registry copy with `vocab` given a navGroup → vocab appears (proves it is derived, not hardcoded);
  - destination: most due wins; tie → most recent `lastReviewedAt`; still tied → mining before kanji; all zero → the
    deck with the most recent `lastReviewedAt`; all zero and never reviewed → `/kanji/review`; `due` is the sum over
    exposed decks only (a vocab summary row is ignored when vocab is hidden).

- [ ] **Step 2: Implement** both functions. Run: PASS.

- [ ] **Step 3: SQL** (new migration, section `-- D12 review surfaces`):

```sql
-- D10/D12 (plan P2): one definition of "due" per deck, matching the review queues. Kanji: a progress row whose
-- next_review_at is null or past (never-seen curated kanji are new material, not due). Mining: any card whose
-- next_review_at is null or past, reviewed or not. Keys use the learning_outcomes.item_key format of each source.
create function review_due_keys(p_user uuid, p_decks text[], p_at timestamptz)
  returns table (deck text, item_key text)
  language sql stable security invoker set search_path = public
as $$
  select 'kanji', 'kanji:' || k.kanji_id from user_kanji_progress k
  where k.user_id = p_user and 'kanji' = any (p_decks) and (k.next_review_at is null or k.next_review_at <= p_at)
  union all
  select 'vocab', 'vocab:' || v.vocab_id from user_vocab_progress v
  where v.user_id = p_user and 'vocab' = any (p_decks) and (v.next_review_at is null or v.next_review_at <= p_at)
  union all
  select 'mining', m.id::text from sentence_mining_cards m
  where m.user_id = p_user and 'mining' = any (p_decks) and (m.next_review_at is null or m.next_review_at <= p_at);
$$;
revoke execute on function review_due_keys(uuid, text[], timestamptz) from public, anon;
grant execute on function review_due_keys(uuid, text[], timestamptz) to authenticated, service_role;

create function review_deck_summary(p_decks text[]) returns table (deck text, due int, last_reviewed_at timestamptz)
  language sql stable security invoker set search_path = public
as $$
  select d.deck,
    (select count(*)::int from review_due_keys(auth.uid(), array[d.deck], now())),
    case d.deck
      when 'kanji' then (select max(last_reviewed_at) from user_kanji_progress where user_id = auth.uid())
      when 'vocab' then (select max(last_reviewed_at) from user_vocab_progress where user_id = auth.uid())
      else (select max(last_reviewed_at) from sentence_mining_cards where user_id = auth.uid())
    end
  from unnest(p_decks) as d(deck);
$$;
revoke execute on function review_deck_summary(text[]) from public, anon;
grant execute on function review_deck_summary(text[]) to authenticated;
```

  Under `authenticated`, RLS confines `review_due_keys` to the caller's rows whatever `p_user` says; the gate proves it
  (user B's claims with `p_user = A` → zero rows).

- [ ] **Step 4: Loader.** `getReviewSummary` = `cache()`: `exposedReviewSurfaces()` → one `review_deck_summary` RPC
  with those decks → `reviewDestination`. Unit test asserts one RPC call with `p_decks: ["mining","kanji"]`.

- [ ] **Step 5: Gates and commit.** Gate cases: due definitions (kanji row with future `next_review_at` excluded;
  never-reviewed mining card with null `next_review_at` included); RLS case above. Mutation: change
  `next_review_at <= p_at` to `<` for mining → the boundary case (card due exactly at `p_at`) red — add that case.
  Commit `feat(dashboard): exposed review surfaces and due summary (D10, D12)`.

---

### Task 6: Daily mission schema, ranking and creation

**Spec:** §2 S4, §3 M2, D1, D11, D12. **Corrections:** P3, P7.

**Files:**
- Create: `lib/dashboard/missions.ts` (+ test), `lib/data/missions.ts` (+ test); sections "S4" and "M2" of the new
  migration; gate cases
- Modify: `lib/user-export/tables.ts` (+ test counts), `lib/data/user-export.ts` (`PRIMARY_KEY_COLUMNS`),
  `supabase/tests/account-erasure.sql` (allowlist)

**Interfaces:**
- Consumes: `can_open_lesson` (T1), `review_due_keys`, `exposedReviewSurfaces` (T5).
- Produces:

```ts
// lib/dashboard/missions.ts (pure)
export const MISSION_TARGETS = { review: 20, shadow_lines: 3, dictation_lines: 5 } as const;
export const MISSION_PRACTICE_WINDOW_DAYS = 14;
export type MissionType = "review" | "finish_lesson" | "shadow_lines" | "dictation_lines";
export interface PracticeActivity { type: "shadow_lines" | "dictation_lines"; count: number; lastAt: string | null; lastVideoId: string | null }
export interface MissionHint { type: Exclude<MissionType, "review">; videoId: string }
export function rankMissionHints(input: {
  continueLesson: { videoId: string; hasLines: boolean } | null; practice: readonly PracticeActivity[];
}): MissionHint[];
// lib/data/missions.ts (I/O)
export async function ensureDailyMission(userId: string): Promise<string | null>; // never throws
```

  SQL `ensure_daily_mission(p_user uuid, p_review_decks text[], p_targets jsonb, p_hints jsonb) returns uuid`
  (service-only), `current_transcript_id(p_video_id uuid) returns uuid`, `practice_activity(p_since timestamptz)`.

- [ ] **Step 1: Failing ranking tests** (`lib/dashboard/missions.test.ts`):
  - continue lesson with lines + no practice → `[finish_lesson(v1), shadow_lines(v1), dictation_lines(v1)]`;
  - dictation count 9, shadowing count 2 → dictation before shadowing (share descending);
  - equal counts → later `lastAt` first; equal `lastAt` → `shadow_lines` before `dictation_lines`;
  - continue lesson **without** lines → practice uses each modality's `lastVideoId`; a modality with
    `lastVideoId: null` produces no hint;
  - no continue lesson and no practice → `[]` (no invented lesson).

- [ ] **Step 2: Implement `rankMissionHints`** exactly to those rules. Run: PASS.

- [ ] **Step 3: Schema** (new migration, section `-- S4 daily missions`):

```sql
create table daily_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  study_date date not null,              -- display metadata, never identity
  timezone_at_creation text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,              -- first transition to all-complete
  rewarded_at timestamptz,               -- written only when the XP award committed
  check (window_start < window_end),
  unique (user_id, window_start, window_end)
);
create index idx_daily_missions_user_window on daily_missions (user_id, window_end desc);

create table daily_mission_items (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references daily_missions (id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  type text not null check (type in ('review', 'finish_lesson', 'shadow_lines', 'dictation_lines')),
  video_id uuid references videos (id) on delete cascade,
  target int not null check (target > 0),
  check ((type = 'review') = (video_id is null)),
  unique (mission_id, slot),
  unique (mission_id, type)
);

-- The frozen identities a count-based item may count: review item_keys and practice line ids (spec S4).
create table daily_mission_eligible (
  mission_item_id uuid not null references daily_mission_items (id) on delete cascade,
  item_key text not null check (length(item_key) between 1 and 128),
  primary key (mission_item_id, item_key)
);

alter table daily_missions enable row level security;
alter table daily_mission_items enable row level security;
alter table daily_mission_eligible enable row level security;
create policy daily_missions_select_own on daily_missions for select to authenticated using (user_id = auth.uid());
create policy daily_mission_items_select_own on daily_mission_items for select to authenticated
  using (exists (select 1 from daily_missions m where m.id = mission_id and m.user_id = auth.uid()));
create policy daily_mission_eligible_select_own on daily_mission_eligible for select to authenticated
  using (exists (select 1 from daily_mission_items i join daily_missions m on m.id = i.mission_id
                 where i.id = mission_item_id and m.user_id = auth.uid()));
revoke all on daily_missions, daily_mission_items, daily_mission_eligible from anon, authenticated;
grant select on daily_missions, daily_mission_items, daily_mission_eligible to authenticated;
grant all on daily_missions, daily_mission_items, daily_mission_eligible to service_role;
```

  Export/erasure: add `daily_missions` (`userColumn: "user_id"`) and `daily_mission_items` (`via: { parent:
  "daily_missions", column: "mission_id", parentKey: "id" }`) to `USER_EXPORT_TABLES`; `PRIMARY_KEY_COLUMNS`
  `daily_missions: ["id"]`, `daily_mission_items: ["id"]`; `daily_mission_eligible` is a grandchild the guard does not
  collect and holds only frozen keys — note that in a comment beside the two entries. Update the counted expectations
  in `lib/user-export/tables.test.ts` (direct `38 → 39`, via `3 → 4`, tables `37 → 39`; re-derive by running the test
  and reading its actual numbers, then explain each delta in the comment) and add
  `('public.daily_missions','user_id','c')` to `supabase/tests/account-erasure.sql`.

- [ ] **Step 4: Creation SQL** (section `-- M2 creation`):

```sql
-- P7: the transcript a lesson shows is its newest (getTranscript orders created_at desc).
create function current_transcript_id(p_video_id uuid) returns uuid
  language sql stable security invoker set search_path = public
as $$ select t.id from transcripts t where t.video_id = p_video_id order by t.created_at desc, t.id desc limit 1 $$;
revoke execute on function current_transcript_id(uuid) from public, anon;
grant execute on function current_transcript_id(uuid) to authenticated, service_role;

-- M2: hints are ranked by TS; this function is the authority. It resolves the zone itself, finds the active cycle
-- by instant, revalidates every hint, recomputes every target from real rows and freezes eligible keys — all under
-- the per-user XP lock. Inserts nothing when no slot qualifies (onboarding).
create function ensure_daily_mission(p_user uuid, p_review_decks text[], p_targets jsonb, p_hints jsonb)
  returns uuid
  language plpgsql security definer set search_path = public
as $$
declare
  v_now timestamptz := now(); v_tz text; v_local date; v_start timestamptz; v_end timestamptz;
  v_id uuid; v_item uuid; v_slot int := 0; v_count int; v_hint jsonb; v_type text; v_video uuid;
  v_target int; v_transcript uuid; v_types text[] := '{}';
begin
  perform pg_advisory_xact_lock(hashtext('xp:' || p_user::text));
  select id into v_id from daily_missions where user_id = p_user and window_start <= v_now and v_now < window_end;
  if v_id is not null then return v_id; end if;

  select coalesce(u.study_timezone, 'Asia/Ho_Chi_Minh') into v_tz from users u where u.id = p_user;
  if v_tz is null then raise exception 'ensure_daily_mission: unknown user'; end if;
  if not exists (select 1 from pg_timezone_names where name = v_tz) then v_tz := 'Asia/Ho_Chi_Minh'; end if;
  v_local := (v_now at time zone v_tz)::date;
  v_end := (v_local + 1)::timestamp at time zone v_tz;
  v_start := greatest(v_local::timestamp at time zone v_tz,
                      coalesce((select max(window_end) from daily_missions where user_id = p_user), '-infinity'));
  if v_start >= v_end then return null; end if;

  insert into daily_missions (user_id, study_date, timezone_at_creation, window_start, window_end)
    values (p_user, v_local, v_tz, v_start, v_end) returning id into v_id;

  select count(*) into v_count from review_due_keys(p_user, p_review_decks, v_now);
  if v_count > 0 then
    v_slot := 1;
    insert into daily_mission_items (mission_id, slot, type, target)
      values (v_id, v_slot, 'review', least((p_targets ->> 'review')::int, v_count)) returning id into v_item;
    insert into daily_mission_eligible (mission_item_id, item_key)
      select v_item, k.item_key from review_due_keys(p_user, p_review_decks, v_now) k;
    v_types := array['review'];
  end if;

  for v_hint in select value from jsonb_array_elements(coalesce(p_hints, '[]'::jsonb)) loop
    exit when v_slot >= 3;
    v_type := v_hint ->> 'type';
    v_video := nullif(v_hint ->> 'videoId', '')::uuid;
    continue when v_type is null or v_type = any (v_types)
      or v_type not in ('finish_lesson', 'shadow_lines', 'dictation_lines');
    continue when v_video is null or not can_open_lesson(v_video, p_user);
    v_transcript := current_transcript_id(v_video);
    continue when v_transcript is null;
    if v_type = 'finish_lesson' then
      continue when not exists (
        select 1 from user_video_progress p where p.user_id = p_user and p.video_id = v_video
          and p.completed_at is null and p.last_watched_position > 0);
      v_target := 1;
    else
      select count(*) into v_count from transcript_lines tl where tl.transcript_id = v_transcript;
      v_target := least((p_targets ->> v_type)::int, v_count);
      continue when v_target <= 0;
    end if;
    v_slot := v_slot + 1;
    insert into daily_mission_items (mission_id, slot, type, video_id, target)
      values (v_id, v_slot, v_type, v_video, v_target) returning id into v_item;
    if v_type <> 'finish_lesson' then
      insert into daily_mission_eligible (mission_item_id, item_key)
        select v_item, tl.id::text from transcript_lines tl where tl.transcript_id = v_transcript;
    end if;
    v_types := v_types || v_type;
  end loop;

  if v_slot = 0 then
    delete from daily_missions where id = v_id;
    return null;
  end if;
  return v_id;
end $$;
revoke execute on function ensure_daily_mission(uuid, text[], jsonb, jsonb) from public, anon, authenticated;
grant execute on function ensure_daily_mission(uuid, text[], jsonb, jsonb) to service_role;

-- Mission hints: modality activity in the practice window, with the video practised last.
create function practice_activity(p_since timestamptz)
  returns table (type text, outcomes int, last_at timestamptz, last_video_id uuid)
  language sql stable security invoker set search_path = public
as $$
  select 'shadow_lines', count(*)::int, max(created_at), (array_agg(video_id order by created_at desc))[1]
  from shadowing_sessions where user_id = auth.uid() and created_at >= p_since
  union all
  select 'dictation_lines', count(*)::int, max(created_at),
    (array_agg(video_id order by created_at desc) filter (where video_id is not null))[1]
  from dictation_attempts where user_id = auth.uid() and created_at >= p_since;
$$;
revoke execute on function practice_activity(timestamptz) from public, anon;
grant execute on function practice_activity(timestamptz) to authenticated;
```

- [ ] **Step 5: Gate cases** (rollback blocks; call `ensure_daily_mission` as the superuser, which is how the service
  role reaches it):
  - two calls → the same id (idempotent within the window);
  - a user with 25 due kanji rows → review target 20, 25 eligible rows; with 0 due → no review item;
  - a PLUS hint for a user without subscription is skipped; a hint whose video has no transcript is skipped;
  - **timezone change keeps the active cycle**: create a cycle, `update users set study_timezone = 'Pacific/Kiritimati'`,
    call again → same id;
  - window continuity: set the cycle's `window_end` to `now() - interval '1 second'`, call → a new cycle whose
    `window_start = greatest(local day start, previous window_end)`;
  - no due, no valid hints → returns null and leaves no row.

- [ ] **Step 6: `ensureDailyMission` (I/O).** In `lib/data/missions.ts`:

```ts
/** Pre-write mission ensure (spec M1/M2). Never throws: failure is degraded tracking, logged, and the learning
 * write proceeds. A cheap RLS read short-circuits when a cycle is active; SQL stays the authority either way. */
export async function ensureDailyMission(userId: string): Promise<string | null> {
  try {
    const supabase = createClient();
    const now = new Date();
    const active = await supabase.from("daily_missions").select("id")
      .lte("window_start", now.toISOString()).gt("window_end", now.toISOString()).maybeSingle();
    if (active.error) throw active.error;
    if (active.data) return (active.data as { id: string }).id;
    const hints = await buildMissionHints(supabase, now);
    const { data, error } = await createServiceClient().rpc("ensure_daily_mission", {
      p_user: userId,
      p_review_decks: exposedReviewSurfaces().map((surface) => surface.deck),
      p_targets: MISSION_TARGETS,
      p_hints: hints,
    });
    if (error) throw error;
    return (data as string | null) ?? null;
  } catch (error) {
    console.error(JSON.stringify({ event: "mission_ensure_failed", userId, error: String(error) }));
    return null;
  }
}
```

  `buildMissionHints` reads, in parallel: the D5 candidate (`learner_videos` `in_progress = true` ordered by
  `in_progress_last_watched_at desc nulls last, id`, limit 1 — P3) plus whether `current_transcript_id` has lines
  (`transcript_lines` head count on that transcript), and `practice_activity(now − 14 days)`; then
  `rankMissionHints`. Unit tests (supabase mock): active cycle → no RPC; RPC error → returns null and logs
  `mission_ensure_failed`; the RPC receives `p_review_decks: ["mining","kanji"]` and `MISSION_TARGETS`.

- [ ] **Step 7: Gates and commit.** Reset, `verify:db:dashboard`, `verify:db:erasure`, vitest PASS. Mutations: remove
  `can_open_lesson` from the hint loop → the PLUS case red; remove the active-cycle lookup → the idempotency case red.
  Commit `feat(missions): daily mission cycles, frozen eligibility and locked creation (S4, M2)`.

---

### Task 7: Pre-write wiring, progress, claim and the shared award helper

**Spec:** §3 M1, M3, M4, §2 S5, D11. **Corrections:** P1.

**Files:**
- Modify: `supabase/migrations/20260713000013_gamification.sql` (`xp_events` source check + once-only index),
  `lib/gamification/xp.ts`, `lib/data/gamification.ts` (+ test) — `LearningOutcomeSource` is **not** modified (the
  reward is never a learning outcome), `lib/data/srs.ts`, `lib/data/mining.ts`,
  `lib/data/shadowing.ts`, `lib/data/dictation.ts`, `lib/data/videos.ts` (+ their tests), `lib/data/missions.ts`
- Create: `lib/data/xp-award.ts` (+ test), `lib/data/missions-prewrite.integration.test.ts`; section "M3/M4" of the
  new migration; gate cases

**Interfaces:**
- Produces: `DAILY_MISSION_XP = 50`; SQL `daily_mission_item_progress(p_mission_id uuid) returns table (item_id uuid,
  slot int, type text, video_id uuid, target int, current int)` (invoker);
  `claim_daily_mission(p_user uuid, p_mission_id uuid, p_xp int) returns table (completed boolean, xp_awarded int,
  prev_xp int, next_xp int)` (service-only); TS `claimActiveMission(userId: string): Promise<void>` (never throws);
  `afterXpAward(supabase, input: { userId: string; prevXp: number; nextXp: number; now: Date }): Promise<{ newBadges:
  string[]; leveledUp: boolean }>`.

- [ ] **Step 1: XP source.** In `20260713000013_gamification.sql` add `'daily_mission_complete'` to the
  `xp_events.source_type` check and extend the once-only index predicate to
  `where source_type in ('conversation', 'daily_mission_complete')`. `lib/gamification/xp.ts`: `export const
  DAILY_MISSION_XP = 50;` with a comment citing D11 (below the XP of the activities themselves).
  `learning_outcomes.source_type` is **not** changed.

- [ ] **Step 2: Progress and claim SQL** (section `-- M3/M4`):

```sql
-- M3: only outcomes inside [mission.created_at, window_end) count; count-based items count DISTINCT frozen keys.
create function daily_mission_item_progress(p_mission_id uuid)
  returns table (item_id uuid, slot int, type text, video_id uuid, target int, current int)
  language sql stable security invoker set search_path = public
as $$
  select i.id, i.slot::int, i.type, i.video_id, i.target,
    case when i.type = 'finish_lesson' then
      (exists (select 1 from user_video_progress p where p.user_id = m.user_id and p.video_id = i.video_id
         and p.first_completed_at >= m.created_at and p.first_completed_at < m.window_end))::int
    else least(i.target, (
      select count(distinct o.item_key)::int from learning_outcomes o
      join daily_mission_eligible e on e.mission_item_id = i.id and e.item_key = o.item_key
      where o.user_id = m.user_id and o.created_at >= m.created_at and o.created_at < m.window_end
        and o.source_type = any (case i.type when 'review' then array['srs_review', 'mining_review']
                                             when 'shadow_lines' then array['shadowing']
                                             else array['dictation'] end)))
    end
  from daily_missions m join daily_mission_items i on i.mission_id = m.id
  where m.id = p_mission_id order by i.slot;
$$;
revoke execute on function daily_mission_item_progress(uuid) from public, anon;
grant execute on function daily_mission_item_progress(uuid) to authenticated, service_role;

-- M4: one transaction under the XP lock. Never a learning outcome (D11): it cannot light the heatmap or streak.
create function claim_daily_mission(p_user uuid, p_mission_id uuid, p_xp int)
  returns table (completed boolean, xp_awarded int, prev_xp int, next_xp int)
  language plpgsql security definer set search_path = public
as $$
declare v_rewarded timestamptz; v_done boolean; v_prev int;
begin
  if p_xp <= 0 then raise exception 'claim_daily_mission: xp must be positive'; end if;
  perform pg_advisory_xact_lock(hashtext('xp:' || p_user::text));
  select rewarded_at into v_rewarded from daily_missions where id = p_mission_id and user_id = p_user;
  if not found then raise exception 'claim_daily_mission: no such mission for this user'; end if;
  if v_rewarded is not null then return query select true, 0, null::int, null::int; return; end if;
  select bool_and(p.current >= p.target) into v_done from daily_mission_item_progress(p_mission_id) p;
  if not coalesce(v_done, false) then return query select false, 0, null::int, null::int; return; end if;
  update daily_missions set completed_at = coalesce(completed_at, now()) where id = p_mission_id;
  insert into user_stats (user_id) values (p_user) on conflict (user_id) do nothing;
  select xp into v_prev from user_stats where user_id = p_user;
  insert into xp_events (user_id, source_type, source_id, xp)
    values (p_user, 'daily_mission_complete', 'mission:' || p_mission_id::text, p_xp);
  update user_stats set xp = xp + p_xp where user_id = p_user;
  update daily_missions set rewarded_at = now() where id = p_mission_id;
  return query select true, p_xp, v_prev, v_prev + p_xp;
end $$;
revoke execute on function claim_daily_mission(uuid, uuid, int) from public, anon, authenticated;
grant execute on function claim_daily_mission(uuid, uuid, int) to service_role;
```

- [ ] **Step 3: Gate cases** (rollback blocks): an incomplete mission → `completed false`, no `xp_events` row; complete
  it (insert `learning_outcomes` rows for frozen keys, stamp `first_completed_at` via a completion update) → `xp 50`,
  `completed_at` and `rewarded_at` set, **no** `learning_outcomes` row with a mission key, a second claim → `xp 0`; a
  repeated outcome for one key counts once; an outcome for a non-eligible key counts zero; an outcome at exactly
  `window_end` counts zero.

- [ ] **Step 4: Extract the award helper.** Move the level-up notification and the
  `!isNewXp && had_outcome_today` early return's **after** part (streak read, `buildBadgeSnapshot`, `awardNewBadges`)
  from `recordActivityInner` into `lib/data/xp-award.ts` `afterXpAward(...)`; `recordActivityInner` keeps its early
  return and then calls `afterXpAward`. In `buildBadgeSnapshot` add `.neq("source_type", "daily_mission_complete")`
  to the `xp_events` read (P1) and a test in `lib/data/gamification.test.ts` asserting that filter is recorded.
  Existing `gamification.test.ts` cases must pass unchanged.

- [ ] **Step 5: Claim wrapper.** `lib/data/missions.ts`:

```ts
/** After a qualifying write committed: claim the active cycle if it is now complete. Never throws (M4). */
export async function claimActiveMission(userId: string, now: Date = new Date()): Promise<void> {
  try {
    const service = createServiceClient();
    // Unrewarded cycles that closed at most a day ago are still claimable (a late claim, spec M4) — at most two.
    const open = await service.from("daily_missions").select("id").eq("user_id", userId).is("rewarded_at", null)
      .gt("window_end", new Date(now.getTime() - 86_400_000).toISOString())
      .order("window_end", { ascending: true }).limit(2);
    if (open.error) throw open.error;
    for (const { id } of (open.data as { id: string }[] | null) ?? []) {
      const { data, error } = await service.rpc("claim_daily_mission", {
        p_user: userId, p_mission_id: id, p_xp: DAILY_MISSION_XP,
      });
      if (error) throw error;
      const row = (data as { xp_awarded: number; prev_xp: number | null; next_xp: number | null }[] | null)?.[0];
      if (row && row.xp_awarded > 0 && row.prev_xp !== null && row.next_xp !== null) {
        await afterXpAward(service, { userId, prevXp: row.prev_xp, nextXp: row.next_xp, now });
      }
    }
  } catch (error) {
    console.error(JSON.stringify({ event: "mission_claim_failed", userId, error: String(error) }));
  }
}
```

  Unit tests: no open cycle → no RPC; two open cycles → two claims in window order; an RPC error is logged as
  `mission_claim_failed` and never thrown.

- [ ] **Step 6: Failing pre-write integration tests** (`lib/data/missions-prewrite.integration.test.ts`, supabase mock
  recording call order per client): for `submitReview` (kanji), `reviewMiningCard`, `createSession`, `submitAttempt`
  and `updateProgress({ completed: true })`, assert `ensureDailyMission` is called **after** the auth check and input
  validation and **before** the first write call (`upsert`/`update`/`insert`/`storage.upload`), and
  `claimActiveMission` after `recordActivity` (or after the progress upsert for video completion). An invalid request
  (unknown card, bad audio, missing line, unauthenticated) never calls `ensureDailyMission`. `updateProgress` without
  `completed` never calls either. A thrown `ensureDailyMission` mock still lets the write happen and returns `ok`.

- [ ] **Step 7: Wire the five sites** to make Step 6 pass: `await ensureDailyMission(user.id)` placed exactly as the
  tests require (`srs.ts` after `readPreferences`, before the progress upsert; `mining.ts` after the `existing` card
  check; `shadowing.ts` after `validateAudioFile`, before `storage.upload`; `dictation.ts` after the line lookup, before
  the insert; `videos.ts` only when `input.completed`, before the upsert), and `await claimActiveMission(user.id)` after
  `recordActivity` / after the completion upsert.

- [ ] **Step 8: Live pre-write proof** (gate): as the superuser, create user A with one due kanji row; call
  `ensure_daily_mission`; then perform the review the way `submitReview` does (move `next_review_at` to the future and
  insert the `learning_outcomes` row `kanji:<id>`); `daily_mission_item_progress` → review `current 1`. Then the
  reverse order (write first, ensure after) → no review item, proving why the order matters.

- [ ] **Step 9: Gates and commit.** Reset, gate PASS, vitest (gamification, xp-award, missions, the five writers,
  integration) PASS. Mutations: move `ensureDailyMission` after the upsert in `srs.ts` → the integration test red;
  drop the `.neq` filter → the P1 test red. Commit `feat(missions): pre-write ensure, progress, atomic claim (M1, M3,
  M4, S5)`.

---

### Task 8: Mission concurrency harness and privilege sweep

**Spec:** §3 M5, §9 live gate bullets 1, 11.

**Files:**
- Create: `supabase/tests/mission-race/{setup,controller,worker,assert}.sql`, `supabase/tests/mission-race/run.sh`
- Modify: `scripts/verify-dashboard-gate.ps1` (run the race), `supabase/tests/port-dashboard.sql` (privilege block)

- [ ] **Step 1: Harness.** Copy `supabase/tests/xp-race/run.sh` with barrier objid `7302`. `setup.sql`: one user
  `missionrace@example.invalid` with one due kanji progress row. `controller.sql`: `select pg_advisory_lock(7302);
  select pg_sleep(1); select pg_advisory_unlock(7302);`. `worker.sql`: `select pg_advisory_lock_shared(7302);` then
  `select ensure_daily_mission(<user>, array['mining','kanji'], '{"review":20,"shadow_lines":3,"dictation_lines":5}',
  '[]')`, insert the `learning_outcomes` row for the due key, `select claim_daily_mission(<user>, <that id>, 50)`.
  `assert.sql`: exactly one `daily_missions` row, exactly one `xp_events` row with `source_type =
  'daily_mission_complete'`, `user_stats.xp = 50`, twenty `learning_outcomes` rows, zero `learning_outcomes` rows whose
  `item_key` starts with `mission:`; clean up the user.

- [ ] **Step 2: Privilege sweep** (in `port-dashboard.sql`):

```sql
do $$
declare f text; r text;
begin
  foreach f in array array[
    'ensure_daily_mission(uuid,text[],jsonb,jsonb)', 'claim_daily_mission(uuid,uuid,integer)',
    'sync_curriculum_manifest(jsonb)'] loop
    foreach r in array array['anon', 'authenticated'] loop
      if has_function_privilege(r, f, 'execute') then raise exception 'FAIL dashboard % can execute %', r, f; end if;
    end loop;
  end loop;
  foreach f in array array[
    'curriculum_journey()', 'curriculum_membership(uuid)', 'mastered_lexemes(integer)', 'current_mastered_count(integer)',
    'newly_mastered_count(integer,timestamp with time zone,timestamp with time zone)', 'review_deck_summary(text[])',
    'review_due_keys(uuid,text[],timestamp with time zone)', 'practice_activity(timestamp with time zone)',
    'daily_mission_item_progress(uuid)', 'can_open_lesson(uuid,uuid)', 'current_transcript_id(uuid)'] loop
    if has_function_privilege('anon', f, 'execute') then raise exception 'FAIL dashboard anon can execute %', f; end if;
  end loop;
  raise notice 'PASS dashboard function privileges';
end $$;
```

  Task 9 appends its own functions to the second list.

- [ ] **Step 3: Run** `npm run verify:db:dashboard` → single-session PASS lines, race PASS. Mutation: remove the
  advisory lock from `ensure_daily_mission` → the race asserts more than one cycle (paste it), restore. Commit
  `test(missions): twenty-connection mission race and privilege sweep (M5)`.

---

### Task 9: Dashboard fact layer

**Spec:** §5.1, §5.6–§5.9, §6, §2 S6, D3, D4, D7, D8. **Corrections:** P4.

**Files:**
- Create: `lib/dashboard/daypart.ts`, `lib/dashboard/activity.ts`, `lib/dashboard/weekly.ts`,
  `lib/dashboard/weakness.ts`, `lib/gamification/badge-progress.ts` (each + test); `lib/data/dashboard/context.ts`,
  `lib/data/dashboard/facts.ts`, `lib/data/dashboard/achievements.ts` (+ tests); section "S6/facts" of the new
  migration; gate cases
- Modify: `lib/data/gamification.ts` (export `buildBadgeSnapshot` from `lib/data/badge-snapshot.ts`, taking a
  `SupabaseClient` so the Dashboard can call it with the user client)

**Interfaces:**
- Produces:

```ts
// lib/dashboard/daypart.ts
export type Daypart = "morning" | "afternoon" | "evening" | "lateEvening";
export function daypartAt(instant: Date, timeZone: string): Daypart; // 05,12,17,21 starts
// lib/dashboard/activity.ts
export const ACTIVITY_DAYS = 56; export const ACTIVITY_THRESHOLDS = [1, 5, 15, 30] as const;
export type ActivityCell = { date: string; state: "unavailable" | "rest" | "empty" | "active"; level: 0 | 1 | 2 | 3 | 4; count: number };
export function buildActivityGrid(input: { today: string; counts: ReadonlyMap<string, number>;
  scheduleDays: readonly IsoWeekday[]; firstTrackedDate: string }): ActivityCell[]; // length 56, oldest first
// lib/dashboard/weekly.ts
export const WEEKLY_WINDOWS = 10; export const WEEKLY_SIGNIFICANT_POINTS = 5; export const MIN_SKILL_EVIDENCE = 3;
export interface WeekWindow { index: number; from: string; to: string } // inclusive local dates, index 0 = current
export function weeklyWindows(today: string): WeekWindow[];
export type WeeklyBar = { index: number; seconds: number } | { index: number; unavailable: true };
export function weeklyBars(windows: readonly WeekWindow[], days: readonly { day: string; seconds: number }[],
  trackedSinceDate: string | null): WeeklyBar[];
export interface SkillWindowStat { skill: "listening" | "pronunciation"; window: 0 | 1; attempts: number; mean: number | null }
export function weeklyDelta(stats: readonly SkillWindowStat[], skill: SkillWindowStat["skill"]): number | null; // rounded points
// lib/dashboard/weakness.ts
export type WeaknessFamily = "listening" | "reading" | "pronunciation";
export interface WeaknessScoreRow { family: WeaknessFamily; metric: string; attempts: number; score: number }
export interface WeaknessRow { family: WeaknessFamily; metric: "accuracy" | "score" | PronunciationMetric; score: number }
export function weaknessRows(rows: readonly WeaknessScoreRow[]): WeaknessRow[]; // ≤ 3, ascending score
// lib/data/dashboard/facts.ts (shapes the cards consume)
export type ContinueView =
  | { kind: "continue"; videoId: string; title: string; placement: { title: string; position: number } | null;
      percent: number | null; remainingMinutes: number | null; tags: string[] } // href /shadowing/[id] (P9)
  | { kind: "startNext"; videoId: string; title: string; placement: { title: string; position: number } | null }
  | { kind: "recommended"; videoId: string; title: string }
  | { kind: "onboarding" };
export interface WeaknessFact extends WeaknessRow { practiceHref: string | null }
// Listening → `/shadowing/<lesson>/dictation`; pronunciation metrics → `/shadowing/<lesson>/pronunciation`, where
// <lesson> = the D5 lesson, else that modality's `practice_activity.last_video_id`; Reading → null (A10 hides it).
// lib/gamification/badge-progress.ts
export function badgeProgress(criteria: unknown, snapshot: BadgeSnapshot, limits: { kanji: number }):
  { current: number; target: number; kind: "count" | "streak" } | null;
```

  SQL `learning_outcomes_instrumented_since() returns timestamptz` (immutable), `activity_days(p_tz text, p_from date,
  p_to date) returns table (day date, outcomes int)`, `weekly_skill_windows(p_tz text, p_w1_from date, p_w0_from date,
  p_to date) returns table (skill text, win int, attempts int, mean numeric)`, `weakness_scores(p_tz text, p_dates int)
  returns table (family text, metric text, attempts int, score numeric)` — all invoker except the immutable constant.

- [ ] **Step 1: Failing pure tests**, one file per module:
  - `daypart`: 04:59 → lateEvening, 05:00 → morning, 11:59 → morning, 12:00 → afternoon, 17:00 → evening, 21:00 →
    lateEvening, computed in `Asia/Tokyo` and `America/New_York` from the same instant (local hour decides);
  - `activity`: 56 cells oldest → today; `firstTrackedDate` after the oldest date → earlier cells `unavailable`;
    a scheduled day with 0 → `empty`; an unscheduled day with 0 → `rest`; an unscheduled day with 7 → `active` level
    2; levels at counts 1, 4, 5, 14, 15, 29, 30 → 1, 1, 2, 2, 3, 3, 4; a DST week in `Europe/Berlin` still yields 56
    distinct consecutive dates;
  - `weekly`: `weeklyWindows("2026-10-08")[0]` = `{from "2026-10-02", to "2026-10-08"}`, `[1]` = `{"2026-09-25",
    "2026-10-01"}`, ten windows, no overlap, no gap; a window whose `to` is before `trackedSinceDate` → unavailable;
    a window containing `trackedSinceDate` with no study → `seconds 0`; `weeklyDelta` returns null when either
    window has fewer than 3 attempts, else `Math.round(mean0 - mean1)`;
  - `weakness`: pronunciation contributes one row, the lowest metric among those with ≥ 3 attempts (ties via
    `weakestPronunciationMetric` order); a family with 2 attempts is absent; rows sorted ascending; at most 3; empty
    input → `[]`;
  - `badgeProgress`: `sessions` 3/5 → `{3,5,count}`; `streak` → `kind "streak"`; `jlpt_mock` → null;
    `kanji_learned` 100 with `limits.kanji = 45` → null (unreachable rule); malformed criteria → null; already
    satisfied (current ≥ target) → null.

- [ ] **Step 2: Implement** the five modules. `badgeProgress` parses with the same zod schema `evaluateBadges` uses —
  export `badgeCriteriaSchema` from `lib/gamification/badges.ts` rather than copying it. Run: PASS.

- [ ] **Step 3: SQL** (section `-- S6/facts`):

```sql
-- S6: the instant learning_outcomes started recording (the port-profile merge, d57ad41, 2026-10-08 14:51:13 +07).
-- An instrumentation boundary, not anyone's first activity.
create function learning_outcomes_instrumented_since() returns timestamptz
  language sql immutable set search_path = public
as $$ select timestamptz '2026-10-08T07:51:13Z' $$;
grant execute on function learning_outcomes_instrumented_since() to authenticated;
revoke execute on function learning_outcomes_instrumented_since() from public, anon;

create function activity_days(p_tz text, p_from date, p_to date) returns table (day date, outcomes int)
  language sql stable security invoker set search_path = public
as $$
  select (created_at at time zone p_tz)::date, count(*)::int from learning_outcomes
  where user_id = auth.uid()
    and created_at >= (p_from::timestamp at time zone p_tz) and created_at < ((p_to + 1)::timestamp at time zone p_tz)
  group by 1 order by 1;
$$;

-- D4 (plan P4): Listening and Pronunciation accuracy per study-date window, with evidence counts.
create function weekly_skill_windows(p_tz text, p_w1_from date, p_w0_from date, p_to date)
  returns table (skill text, win int, attempts int, mean numeric)
  language sql stable security invoker set search_path = public
as $$
  with ev as (
    select 'listening' as skill, (created_at at time zone p_tz)::date as d, accuracy_score::numeric as s
    from dictation_attempts where user_id = auth.uid() and accuracy_score is not null
    union all
    select 'pronunciation', (created_at at time zone p_tz)::date, pronunciation_score
    from shadowing_sessions where user_id = auth.uid() and pronunciation_score is not null
  )
  select skill, case when d >= p_w0_from then 0 else 1 end, count(*)::int, round(avg(s), 2)
  from ev where d >= p_w1_from and d <= p_to group by 1, 2;
$$;

-- D3: each family/metric over its last p_dates study dates WITH evidence.
create function weakness_scores(p_tz text, p_dates int) returns table (family text, metric text, attempts int, score numeric)
  language sql stable security invoker set search_path = public
as $$
  with ev as (
    select 'listening' as fam, 'accuracy' as met, created_at as at, accuracy_score::numeric as s
      from dictation_attempts where user_id = auth.uid() and accuracy_score is not null
    union all select 'reading', 'score', completed_at, score from user_reading_attempts where user_id = auth.uid()
    union all select 'pronunciation', 'accuracy', created_at, pronunciation_score from shadowing_sessions
      where user_id = auth.uid() and pronunciation_score is not null
    union all select 'pronunciation', 'pitch', created_at, pitch_score from shadowing_sessions
      where user_id = auth.uid() and pitch_score is not null
    union all select 'pronunciation', 'rhythm', created_at, rhythm_score from shadowing_sessions
      where user_id = auth.uid() and rhythm_score is not null
  ),
  ranked as (
    select fam, met, s, dense_rank() over (partition by fam, met order by (at at time zone p_tz)::date desc) as r from ev
  )
  select fam, met, count(*)::int, round(avg(s), 2) from ranked where r <= p_dates group by fam, met;
$$;
```

  Revoke each from `public, anon`, grant to `authenticated`; append them to the Task 8 privilege list. Gate cases:
  `activity_days` splits at the local midnight of `p_tz`; `weakness_scores` with 31 study dates of dictation ignores the
  oldest date; `weekly_skill_windows` puts a `p_w0_from` attempt in window 0.

- [ ] **Step 4: Fact primitives** (`lib/data/dashboard/`), each `cache()`d, each reading once per request:
  - `context.ts` `getDashboardContext()` → `{ userId, name, avatarUrl, timeZone, now, today, createdAt, scheduleDays,
    companionEnabled }` (reuse `getStudyTimezone`, `readPreferences`, `resolveAvatarUrl`);
  - `facts.ts`: `getStreakFact()` (`getStreak` once — header chip and heatmap share it), `getActivityFact()`
    (`activity_days` for the 56 days + `firstTrackedDate = studyDate(max(createdAt, boundary))` →
    `buildActivityGrid`), `getStudyTimeFact()` (one `getStudyTime` over the 70 days of `weeklyWindows`, plus
    `getTrackedSince`), `getWeeklyFacts()` (`getStudyTimeFact` + `weekly_skill_windows` + `newly_mastered_count` for W0
    → `{ bars, vocabularyMastered, listeningDelta, pronunciationDelta, hoursW0 }`), `getWeaknessFacts()`
    (`weakness_scores(tz, 30)` → `weaknessRows`), `getContinueLearning()` (P3 query + `getCurriculumPlacement` +
    situation/source slugs; fallback chain `getCurriculumJourney().next` → `getRecommendations({ limit: 1 })` →
    onboarding);
  - `achievements.ts` `getAchievementSnapshot()` → earned badges (latest first) + in-progress from `badgeProgress`
    with `limits.kanji` = count of `kanji` rows, sorted by ratio, total ≤ 3.
  Unit tests assert each primitive issues its RPC once when called twice in one request (wrap in a `cache` scope
  helper the profile tests already use, or call through a shared promise) and the mappings.

- [ ] **Step 5: Gates and commit.** Reset, gate PASS, vitest PASS. Mutations: change `r <= p_dates` to `r < p_dates`
  → the 31-date case red; change the level-2 threshold 5 → 6 → the activity levels case red. Commit
  `feat(dashboard): request-cached fact layer (D3, D4, D7, D8, S6)`.

---

### Task 10: Korume cue resolver

**Spec:** §5.4, D6.

**Files:**
- Create: `lib/companion/dashboard-cues.ts` (+ test)
- Modify: `messages/{en,vi}/companion.json`, `messages/en/companion.pin.test.ts`

**Interfaces:**
- Produces:

```ts
export type DashboardCueKey = "cue.missionCompleted" | "cue.weeklyImproved" | "cue.weakSkill";
export interface DashboardFacts {
  missionCompletedToday: boolean;
  weeklyDeltas: { listening: number | null; pronunciation: number | null };
  weakest: readonly { family: WeaknessFamily; metric: string; score: number; practiceHref: string | null }[];
}
export interface DashboardCue {
  key: DashboardCueKey;
  values: { skill?: string; points?: number; score?: number }; // skill = a catalog key under dashboard.skills
  practiceHref: string | null;
  viewWeakness: boolean;
}
export function resolveDashboardCue(facts: DashboardFacts): DashboardCue | null;
```

- [ ] **Step 1: Failing tests:** mission completed → `cue.missionCompleted`, no practice, no viewWeakness (even when
  a weakness exists); listening `+8`, pronunciation `+6` → `cue.weeklyImproved` with `skill "listening"`, `points 8`
  (largest wins; tie → listening); `+4` → not significant; **`-8` → never `weeklyImproved`** (positive only); no
  significant improvement and weakest rows `[reading 40 (no href), listening 55 (href)]` → `cue.weakSkill` for
  listening (first **actionable**), `viewWeakness true`, `practiceHref` = listening's href; nothing → `null`; the same
  facts twice → deep-equal cues.

- [ ] **Step 2: Implement** with `WEEKLY_SIGNIFICANT_POINTS` from `lib/dashboard/weekly.ts`.

- [ ] **Step 3: Copy** (`companion.json`, under a new `cue` object; vi in parity):

| Key | en | vi |
|---|---|---|
| `cue.missionCompleted` | You kept all of today's promises. | Bạn đã giữ trọn những lời hẹn hôm nay. |
| `cue.weeklyImproved` | Your {skill} rose {points} points compared with the previous 7 days. | {skill} của bạn tăng {points} điểm so với 7 ngày trước. |
| `cue.weakSkill` | {skill} is at {score}% right now. A few minutes of practice would help. | {skill} đang ở mức {score}%. Luyện vài phút sẽ giúp ích. |

  Pin the en values in `companion.pin.test.ts`; `no-sensei.test.ts` stays green.

- [ ] **Step 4: Commit** `feat(companion): deterministic dashboard cue resolver (D6)` after vitest PASS and a mutation
  (`>=` → `>` on the significance check makes the `+5` boundary case red — add that case).

---

### Task 11: Page shell, layout, header, Quick Access, card shell

**Spec:** §5.1, §5.10, §6, §7 L1–L5, D9. **Corrections:** P5, P6.

**Files:**
- Modify: `app/[locale]/(protected)/(app)/dashboard/page.tsx` (rewrite), `app/globals.css`,
  `messages/{en,vi}/dashboard.json`, `messages/en/dashboard.pin.test.ts`, `components/companion/anchor-boundary.test.ts`,
  `components/profile/achievements-card.tsx` (+ test)
- Create: `app/[locale]/(protected)/(app)/dashboard/loading.tsx`, `components/dashboard/dashboard-header.tsx`,
  `components/dashboard/quick-access.tsx`, `components/dashboard/dashboard-card.tsx`,
  `components/dashboard/card-boundary.tsx` (each + test)

**Interfaces:**
- Produces:

```ts
export type CardState<T> = { kind: "ok"; data: T } | { kind: "unavailable" } | { kind: "error" };
export async function loadCard<T>(name: string, load: () => Promise<T>): Promise<CardState<T>>; // logs, rethrows auth
export function DashboardCard(props: { id: string; area: DashboardArea; eyebrow: string; children: React.ReactNode;
  labelledBy?: string; focusable?: boolean }): JSX.Element;
export type DashboardArea = "continue" | "mission" | "korume" | "journey" | "weakness" | "weekly" | "activity"
  | "achievements" | "quick";
```

- [ ] **Step 1: Failing component tests:** header renders `{weekday} · {daypart}` from the catalog, `Welcome back,
  {name}` and the no-name fallback, hides the streak chip at 0, the chip is a link to `#learning-activity`; Quick
  Access renders exactly four links with labels read from `nav.json` (`review`, `mining`, `speaking`, `lessons` —
  P5) and hrefs `<review destination>`, `/mining`, `/conversation`, `/shadowing`; the review tile shows `{count} due`
  or the caught-up text; `loadCard` returns `{kind:"error"}` and logs `dashboard_card_failed` on a thrown error, but
  rethrows an error marked as auth (`status 401`); every component's props survive `structuredClone`.

- [ ] **Step 2: Layout CSS** in `app/globals.css` (same conventions as `.profile-*`: DOM order is reading order,
  explicit grid lines always in pairs, no hard heights):

```css
/* /dashboard (port-dashboard spec §7): reflow by the content container, never shrink. */
.dashboard-layout { container: dashboard / inline-size; max-width: 75rem; margin-inline: auto; }
.dashboard-grid { display: grid; gap: var(--space-md); grid-template-columns: minmax(0, 1fr); }
.dashboard-row { display: grid; gap: var(--space-md); grid-template-columns: minmax(0, 1fr); align-items: stretch; }
.dashboard-quick { display: grid; gap: var(--space-sm); grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); }
@container dashboard (width >= 40rem) {
  .dashboard-row--three, .dashboard-row--pair, .dashboard-row--lead { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container dashboard (width >= 56.25rem) {
  .dashboard-row--lead { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }
  .dashboard-row--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .dashboard-row--three:not(:has(> [data-area="korume"])) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dashboard-row--trend { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); }
  .dashboard-quick { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@container dashboard (width >= 68.75rem) {
  .dashboard-row--lead { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
  .dashboard-row--trend { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); }
}
```

  `56.25rem` = 900px and `68.75rem` = 1100px at the root size; verify the root font size the density tokens set and
  convert from the pixel boundaries in spec §7 if it is not 16px. Reserved block sizes: `[data-area="continue"],
  [data-area="mission"] { min-block-size: 15rem }`, and one rule per remaining area chosen from the populated capture in
  Task 14 (start with `12rem` for the row-2 cards, `14rem` for row 3, `8rem` achievements) — applied identically to the
  skeleton, empty and error renders.

- [ ] **Step 3: Page.** Rewrite `page.tsx`: `generateMetadata` unchanged; `export const dynamic = "force-dynamic"`.
  This task renders the header, the five row containers (`lead · three · trend · achievements · quick`) and Quick
  Access; Tasks 12 and 13 each add their cards into the rows, every card inside
  `<Suspense fallback={<CardSkeleton area=…/>}>`. No placeholder card is rendered meanwhile — an empty row container
  renders nothing visible. `loading.tsx` renders the header skeleton and one `CardSkeleton` per area. Delete the old `CompanionAnchor` import (P6) and
  update the `anchor-boundary.test.ts` allowlist: remove the page path, add `components/dashboard/korume-card.tsx`.

- [ ] **Step 4: Profile anchor.** `components/profile/achievements-card.tsx`: add `id="achievements"` and
  `tabIndex={-1}` to the section (the trophy target, D8); test it.

- [ ] **Step 5: Copy.** Replace `dashboard.json` (en/vi) with the keys this plan uses (header, states, cards; table
  below), delete the keys of the removed cards, and rewrite `dashboard.pin.test.ts` to pin the new en values.

| Key | en | vi |
|---|---|---|
| `header.eyebrow` | {weekday} · {daypart} | {weekday} · {daypart} |
| `header.daypart.morning/afternoon/evening/lateEvening` | Morning / Afternoon / Evening / Late evening | Buổi sáng / Buổi chiều / Buổi tối / Khuya |
| `header.title` | Welcome back, {name} | Chào mừng trở lại, {name} |
| `header.titleNoName` | Welcome back | Chào mừng trở lại |
| `header.subtitle` | Let's continue your Japanese journey. | Cùng tiếp tục hành trình tiếng Nhật của bạn. |
| `header.streak` | {count}-day streak | Chuỗi {count} ngày |
| `quick.eyebrow` | Quick access | Truy cập nhanh |
| `quick.due` | {count} due | {count} thẻ đến hạn |
| `quick.caughtUp` | All caught up | Không có thẻ đến hạn |
| `card.error` | This part couldn't load right now. | Phần này tạm thời chưa tải được. |

- [ ] **Step 6: Commit** after vitest, lint, typecheck PASS: `feat(dashboard): page shell, container layout, header and
  quick access (D9, L1-L5)`.

---

### Task 12: Continue Learning, Today's Mission, Learning Journey cards

**Spec:** §5.2, §5.3, §5.5, §8 rows 2–3 and 5.

**Files:**
- Create: `components/dashboard/continue-card.tsx`, `components/dashboard/mission-card.tsx`,
  `components/dashboard/journey-card.tsx` (each + test), `lib/data/dashboard/mission.ts` (+ test)
- Modify: `app/[locale]/(protected)/(app)/dashboard/page.tsx`, `messages/{en,vi}/dashboard.json` (+ pin)

**Interfaces:**
- Consumes: `ensureDailyMission`, `claimActiveMission` (T6, T7), `getContinueLearning` (T9), `getCurriculumJourney` (T3).
- Produces: `getDailyMission(): Promise<CardState<MissionView>>` where

```ts
export interface MissionView {
  items: { type: MissionType; current: number; target: number; title: string | null; href: string; playbackPercent: number | null }[];
  rewarded: boolean; // rewarded_at is the authority
}
```

  (calls `ensureDailyMission`, then `claimActiveMission` as the sweeper, then `daily_mission_item_progress`, then video
  titles for lesson items; `null` cycle → `{kind:"unavailable"}` = onboarding). The page starts
  `const missionPromise = getDailyMission()` once and passes the promise to the Mission card and, in Task 13, to the
  Korume cue — the only two awaiters (spec §6).

- [ ] **Step 1: Failing tests:**
  - Continue: the four states render their eyebrow/title/CTA from the catalog; `duration_seconds` null hides `%` and
    remaining; percent clamps at 100; the curriculum title renders `JLPT N5 · Lesson 2` only when placement exists;
    Review Lesson links to `/shadowing/<id>/summary`; Continue links to `/shadowing/<id>` (P9).
  - Mission: three items → heading "Three small promises"; two → "Today's missions"; rewarded → "+50 XP earned" (and
    not when only `completed` would be true); onboarding copy; error copy; each row shows `{current}/{target}`, and
    `finish_lesson` shows the playback bar.
  - Journey: authoring → the whole-card sentence and no `0%`; active → three nodes with state labels, Next milestone
    title + remaining count, `+N bài Plus` when `plus.total > 0`; complete → the done sentence; no "View Roadmap".

- [ ] **Step 2: Implement** the cards and `getDailyMission`; wire them into the page with `loadCard`.

- [ ] **Step 3: Copy** (en / vi, pinned):

| Key | en | vi |
|---|---|---|
| `continue.eyebrow.continue/startNext/recommended/onboarding` | Continue learning / Start next lesson / Recommended for you / Start learning | Tiếp tục học / Bắt đầu bài tiếp theo / Gợi ý cho bạn / Bắt đầu học |
| `continue.lessonOrdinal` | Lesson {position} | Bài {position} |
| `continue.percent` | {percent}% completed | Đã xong {percent}% |
| `continue.remaining` | {minutes} min of video left | Còn {minutes} phút video |
| `continue.cta.continue/start/review/explore` | Continue learning / Start lesson / Review lesson / Explore lessons | Học tiếp / Bắt đầu học / Xem lại bài / Khám phá bài học |
| `continue.onboarding` | Pick a first lesson and Korume will keep your place. | Chọn bài đầu tiên, Korume sẽ giữ chỗ cho bạn. |
| `mission.eyebrow` | Today's mission | Nhiệm vụ hôm nay |
| `mission.titleThree` / `mission.titleSome` | Three small promises / Today's missions | Ba lời hẹn nhỏ / Nhiệm vụ hôm nay |
| `mission.item.review/finish/shadow/dictation` | Review {target} cards / Finish {title} / Shadow {target} sentences / Dictate {target} lines | Ôn {target} thẻ / Hoàn thành {title} / Shadow {target} câu / Chép chính tả {target} câu |
| `mission.reward` / `mission.rewardXp` / `mission.rewardEarned` | Reward / +{xp} XP / +{xp} XP earned | Phần thưởng / +{xp} XP / Đã nhận +{xp} XP |
| `mission.onboarding` | Your first missions appear once you start learning. | Nhiệm vụ đầu tiên sẽ xuất hiện khi bạn bắt đầu học. |
| `mission.error` | Today's missions couldn't load. | Chưa tải được nhiệm vụ hôm nay. |
| `journey.eyebrow` | Learning journey | Lộ trình học |
| `journey.state.completed/locked/unavailable` | Completed / Locked / Being prepared | Đã hoàn thành / Chưa mở / Đang biên soạn |
| `journey.next` / `journey.remaining` | Next milestone / {count, plural, one {{count} lesson remaining} other {{count} lessons remaining}} | Cột mốc tiếp theo / Còn {count} bài |
| `journey.plus` | +{count} Plus lessons | +{count} bài Plus |
| `journey.authoring` / `journey.complete` | The JLPT journey is being prepared. / You've completed the current journey. | Lộ trình JLPT đang được biên soạn. / Đã hoàn thành lộ trình hiện có. |

- [ ] **Step 4: Commit** after vitest, lint, typecheck: `feat(dashboard): continue, mission and journey cards (D1, D2, D5)`.

---

### Task 13: Korume, Weakness, Weekly, Activity, Achievement cards

**Spec:** §5.4, §5.6–§5.9, §8.

**Files:**
- Create: `components/dashboard/{korume-card,weakness-card,weekly-card,activity-card,achievement-card}.tsx` (each + test)
- Modify: page, `messages/{en,vi}/dashboard.json` (+ pin)

- [ ] **Step 1: Failing tests:**
  - Korume: not rendered when `companionEnabled` is false (no container in the DOM); silent → sprite anchor, no
    bubble, no buttons; cue → bubble text from `companion.cue.*` with the skill label from `dashboard.skills.*`;
    **Practice now** only with `practiceHref`; **View weakness** only with `viewWeakness`, and it moves focus to
    `#weakness-snapshot`; a loader error renders the silent state (and `loadCard` logged it).
  - Weakness: 1–3 rows with `{score}%` and the label per family/metric; the Reading row has no link; empty copy.
  - Weekly: ten bars, unavailable bars muted with the "Not yet tracked" label; metrics hidden when null; deltas render
    `+8 điểm` / `−3 điểm` (U+2212 for the minus) never `%`; tracking-from sentence when every bar is unavailable; no
    Weekly Report link.
  - Activity: `role="grid"` is **not** used; one focusable region (`tabIndex={0}`, `id="learning-activity"`) with an
    `aria-describedby` summary containing the streak text and active-day count; cells carry `aria-label` date + status
    and are not tab stops; 4 × 14 order; streak 0 → "Chưa có chuỗi học hiện tại"; arrow keys move a roving
    highlight that announces the focused cell.
  - Achievements: earned first with "Earned yesterday" / "Earned {date}", then `{current}/{target}` (streak uses the
    current-streak label); empty copy; trophy link `/profile#achievements`.

- [ ] **Step 2: Implement**, Korume card renders `<CompanionAnchor surface="dashboard" pose="sitting" />` inside the
  card (P6) and the cue text beside it.

- [ ] **Step 3: Copy** (pinned):

| Key | en | vi |
|---|---|---|
| `korume.practice` / `korume.viewWeakness` | Practice now / View weakness | Luyện ngay / Xem điểm yếu |
| `skills.listening/reading/accuracy/pitch/rhythm` | Listening / Reading / Pronunciation / Pitch accent / Rhythm | Nghe / Đọc / Phát âm / Ngữ điệu / Nhịp điệu |
| `weakness.eyebrow` / `weakness.empty` | Weakness snapshot / Keep learning so Korume can notice what to practise. | Điểm cần luyện / Hãy học thêm để Korume nhận ra điểm cần luyện. |
| `weekly.eyebrow` / `weekly.title` | Weekly evolution / A quieter kind of progress | Tiến triển hằng tuần / Một kiểu tiến bộ lặng lẽ |
| `weekly.vocabulary` | +{count} vocabulary items | +{count} từ & cụm từ |
| `weekly.points` | {value} points | {value} điểm |
| `weekly.hours` | {hours} hours studied | {hours} giờ học |
| `weekly.notTracked` / `weekly.trackedFrom` | Not yet tracked / Study time recorded from {date} | Chưa ghi nhận / Thời gian học được ghi từ {date} |
| `activity.eyebrow` / `activity.caption` | Learning activity / Consistency builds fluency. | Hoạt động học / Đều đặn tạo nên sự trôi chảy. |
| `activity.streak` / `activity.noStreak` / `activity.today` | {count}-day streak / No active streak / Today | Chuỗi {count} ngày / Chưa có chuỗi học hiện tại / Hôm nay |
| `activity.summary` | {streak}. {active} active days in the last 56. Rest days follow your schedule; faded days were before tracking began. | {streak}. {active} ngày có học trong 56 ngày qua. Ngày nghỉ theo lịch của bạn; ô mờ là trước khi bắt đầu ghi nhận. |
| `activity.cell.active/empty/rest/unavailable` | {date}: {count} activities / {date}: no activity / {date}: rest day / {date}: not yet tracked | {date}: {count} hoạt động / {date}: không có hoạt động / {date}: ngày nghỉ / {date}: chưa ghi nhận |
| `achievements.eyebrow` / `achievements.empty` / `achievements.viewAll` | Recent achievement / Your first achievement will appear here. / View achievements | Thành tựu gần đây / Thành tựu đầu tiên của bạn sẽ hiện ở đây. / Xem thành tựu |
| `achievements.earnedToday` / `earnedYesterday` / `earnedOn` | Earned today / Earned yesterday / Earned {date} | Đạt hôm nay / Đạt hôm qua / Đạt {date} |
| `achievements.streakProgress` | Current streak {current}/{target} | Chuỗi hiện tại {current}/{target} |

- [ ] **Step 4: Commit** after vitest, lint, typecheck: `feat(dashboard): korume, weakness, weekly, activity and
  achievement cards (D3, D4, D6, D7, D8)`.

---

### Task 14: Remove the old Dashboard pieces, registries, docs

**Files:**
- Delete: `components/learning/level-card.tsx`, `streak-card.tsx`, `srs-due-card.tsx`, `badges-grid.tsx` and their
  tests **only if** nothing else imports them (grep first; `recommendation-section.tsx` stays if
  `recommendation-rail.tsx` or another page imports it)
- Modify: `lib/product/screen-registry.ts` (`dashboard` `figmaCheckedAt: "2026-10-08"`, `specRef` to the spec),
  `docs/product/screen-inventory.md` §19.1 (one paragraph: ported, rulings D1–D12, what was dropped and why),
  `docs/lessons.md` (only lessons this branch earned, at the end)

- [ ] **Step 1:** grep every deleted symbol; delete; vitest + typecheck + lint PASS.
- [ ] **Step 2:** registry and inventory edits; `npm run verify:protocol` PASS.
- [ ] **Step 3: Commit** `chore(dashboard): retire the placeholder dashboard cards, registry and inventory`.

---

### Task 15: End-to-end, geometry, fan-out

**Spec:** §9 e2e, §11 steps 3–4, §7 fold gate.

**Files:**
- Create: `tests/e2e/dashboard.spec.ts`, `tests/e2e/fixtures/dashboard-data.ts`

- [ ] **Step 1: Fixture.** `seedDashboardData(admin, userId)` on the `summary-data.ts` pattern: uses
  `seedWorkspaceData()` for a lesson with 30 lines; inserts for the user one due kanji progress row, a mining card with
  null `next_review_at`, an in-progress `user_video_progress` row on the lesson, 3 dictation attempts and 3 shadowing
  sessions with scores today, 3 more 8 days ago; returns `cleanup()`.

- [ ] **Step 2: Specs** (each test registers a fresh account; labels from the catalogs):
  1. new account at 1280×529: every card shows its onboarding/empty state; Journey shows the C2 fixture (N5 current,
     `0%` is allowed here because the fixture HAS core lessons — assert the node label, not absence of `%`); no
     horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`); the row-1 container's
     `getBoundingClientRect().bottom <= 529 + 4`;
  2. populated account at 1440×900: mission shows three rows; open `/kanji/review`, review the due card, return →
     review row `1/1`; Continue shows the lesson with `%`;
  3. streak chip, Korume **View weakness**, and the trophy each move focus to their target
     (`document.activeElement` id);
  4. `companion_enabled = false` (set through `/settings` or the admin client) → no Korume card and row 2 has two
     columns (compare the two cards' `left` values with the container's);
  5. run 1 and 2 at both viewports (parameterise).

- [ ] **Step 3: Fan-out gate.** Add a temporary server log (in a scratch branch-local patch, not committed) or use
  the Supabase API gateway logs (`docker logs supabase_kong_nihongo-cinema`) while loading `/dashboard` once with the
  populated account; list every PostgREST/RPC request. Pass = no N+1, each fact primitive once, every request
  explained. Record the list and the count in the run state and the final review.

- [ ] **Step 4:** `npm run test:e2e -- tests/e2e/dashboard.spec.ts` against a server built in this worktree on a free
  port (restart it if landing images hang — memory `next-image-optimizer-wedge`); then the full `npm run test:e2e`.
  Commit `test(dashboard): end-to-end states, focus targets, fold and overflow geometry`.

---

### Task 16: Gates, whole-branch review, owner review

- [ ] **Step 1:** Fresh `npx supabase db reset` → dictionary re-import → every `verify:db:*` (including `dashboard`,
  `profile`, `erasure`) → `db reset` again if any sync test was not rolled back → full vitest
  (`--minWorkers=1 --maxWorkers=2`) → `npm run lint` → `npm run typecheck` → full e2e. Paste every summary line.
- [ ] **Step 2:** Whole-branch `code-reviewer` (opus) on `git diff master...port-dashboard` against the spec IDs;
  its fix wave gets its own review.
- [ ] **Step 3:** Resetability: confirm again with the owner that no deployed database exists.
- [ ] **Step 4:** Chrome captures at 1280×529 and 1440×900, new and populated accounts (Chrome extension if connected,
  else the Playwright capture script pattern from `port-profile`), judged against `111:515` on hierarchy, rhythm, fold
  and overflow. Then STOP for the owner's Chrome review; merge `--no-ff` only after approval; `npm run verify:protocol`
  exits 0 before the owner change and before merge.

---

## Spec coverage

| Spec | Task |
|---|---|
| D1, D11, S4, M1–M5 | 6, 7, 8, 12 |
| D2, D2b, D2c, S1, C1–C5 | 2, 3, 12 |
| D3 | 9, 13 |
| D4, D4b, S2, S3 | 4, 9, 13 |
| D5 | 9, 12 |
| D6 | 10, 13 |
| D7, S6 | 9, 13 |
| D8 | 9, 11 (anchor), 13 |
| D9 | 11 |
| D10, D12 | 5, 11 |
| S5 | 7 |
| S7 | 1, 7 |
| §6 architecture | 9, 11, 12, 13 |
| §7 layout | 11, 15 |
| §8 states | 11–13 |
| §9 tests, §11 gates | every task, 8, 15, 16 |
| §12 deferred | not built |
