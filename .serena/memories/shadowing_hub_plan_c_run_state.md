# Shadowing Hub Plan C — run state (paused 2026-08-08, mid-execution)

**Read this before touching anything on branch `shadowing-hub-plan-c`.** Spec is locked, C1 plan is
written, Checkpoints A, B and C are approved, and D is 3 tasks of 4 done. **Only Task 11 remains, and it
is deliberately blocked — see "Task 11 is blocked on purpose" below before you touch anything.**

## Where things stand

| Artifact | State |
|---|---|
| Spec `docs/superpowers/specs/2026-08-07-shadowing-hub-plan-c-design.md` | **LOCKED** at `22c9d18`, 17 decisions D1–D17, evidence appendix §7 |
| Plan `docs/superpowers/plans/2026-08-07-shadowing-hub-plan-c1-foundation.md` | 11 tasks / 68 steps |
| Branch `shadowing-hub-plan-c` | 23 commits off master `3ca9966`, head `1df1edc`. **Never pushed.** |
| Ledger `.superpowers/sdd/2026-08-07-shadowing-hub-plan-c1-foundation/progress.md` | gitignored; per-task detail, every fix round, every deferred minor |

**Do not re-dispatch a task that has a `Task <N>: complete` line in the ledger.** After compaction,
trust the ledger and `git log`, not recollection.

## ▶ RESUME HERE — Task 11 only, and NOT until the copy work is settled

Execution method: `superpowers:subagent-driven-development`, **no worktree** (this repo never pushes,
so `EnterWorktree` branches from a stale `origin`; and a worktree has no `.env.local`, which makes
every auth-dependent Playwright spec fail in a way that looks exactly like a code regression).

The user grouped the 11 tasks into 4 human-review gates:

- **A — Tasks 1–2** ✅ approved
- **B — Tasks 3–6** ✅ approved 2026-08-08
- **C — Task 7** ✅ approved 2026-08-08
- **D — Tasks 8–11** — **8, 9, 10 complete and reviewed. 11 blocked (below).** No human gate review of D
  has happened yet; when Task 11 finishes, D goes to the user as one gate, then the final whole-branch
  review, then `superpowers:finishing-a-development-branch`.

### ⛔ Task 11 is blocked on purpose — do not "just run it"

Task 11 is the full verification gate and its **entire deliverable is the recorded output of a CLEAN
run**. The suite is knowingly red: **9 characterization pins in `messages/en/companion.pin.test.ts`**
hold Vietnamese strings the user has legitimately rewritten. Running the gate against a tree that is red
for a known non-code reason produces a meaningless artifact and normalises "the gate is red but it's
fine" — which is how a real regression gets waved through later.

**Correct sequence, do not invert it:** user declares the catalogs settled → update the 9 pins to the new
copy (mechanical) → run Task 11.

### The copy situation, as of the pause

The user is **rewriting `messages/vi/**` live, file by file, across sessions.** At the pause, dirty in the
working tree: `admin, auth, common, community, companion, conversation, nav, shadowing` (and they had
just opened `marketing.json`). **Never commit, revert, reformat, `git add -A`, or `git checkout` these.**
Tell every implementer to leave `messages/**` completely alone.

Settled rulings:

- **VI `upcoming` copy** — the user rewrote all 10 keys themselves (`d7ac610`) rather than patching the 4
  flagged strings. All 9 `title` values were left unchanged, which independently validated 8 of the 9 nav
  labels Task 7 shipped.
- **"Korume", not "Companion", in learner-facing copy** (user's words: *"Đổi thành Korume nhé, không
  dùng Companion"*). English mirror shipped at `4005d6f`.
- **`groups.insights`** — the user overrode the plan's `"Thấu hiểu"` with **`"Insight"`**, and also changed
  `nav.dashboard` to `"Tổng quan"`. Verified no test pins either VI string.
- **`companion.json` keeps the mascot as a common noun.** The user's own `a11y.sprite` is *"Người bạn đồng
  hành của bạn — mở nhật ký"* — they did NOT substitute "Korume". The controller's decision to leave
  `companion.json` out of the Korume rename was therefore correct. The `companion` **code identifiers**
  (`lib/companion/**`, `/api/companion/**`, the i18n namespace, `CompanionAnchor`) were deliberately not
  renamed — same reasoning as the Task 2 spacing ruling.
- **`journal.empty` D9 violation — FIXED by the user.** Their first rewrite opened with "Chưa có gì ở đây
  cả", which tripped the L9b D9 guard `not.toMatch(/chưa có|không có|trống/i)` — the binding rule that a
  Companion line looks FORWARD and never apologizes for an empty present. That was the one failure that
  was a real rule break rather than a stale pin. It now reads "Từ hôm nay, mình cùng bắt đầu viết nh…"
  and the guard passes. **All 9 remaining failures are ordinary drift.**

### Index naming — user ruling, and it generalises

`videos_situation_id_idx` → **`idx_videos_situation_id`**, `videos_source_id_idx` → **`idx_videos_source_id`**,
renamed **in place** in `20260807000025_lesson_taxonomy.sql` (not via a rename migration — it has never
been pushed), plan doc synced at `1df1edc`. The user's reasoning, worth reusing: the plan was dictating an
implementation-level detail, the survey showed the repo's real convention is the `idx_` prefix (~28 of ~30
indexes, and every other index on `videos`), and an unpushed migration is the cheapest moment to correct it.

## Commits, oldest first

```
2b1d094 docs(plan): make UpcomingScreen synchronous so it is testable
e9840d8 feat(tokens): add the --layout-* namespace and the 20px spacing step
db61cb9 feat(layout): add TwoColumnShell with an optional sticky companion rail
3bb260d test(layout): assert xl:top-md-lg so the sticky-rail test actually catches a missing offset
da99f84 docs(plan): use grep, not npx rg, for the route-surface sweep
75abe1f refactor(routes): move the lesson route family from /videos to /shadowing
b289bda feat(routes): add temporary redirects from the old /videos paths
d5b2bbc docs(plan): assert the redirects at the HTTP level, and add an over-breadth case
dd727e7 test(routes): assert redirects at the HTTP level, not through auth
5338c2c test(routes): assert the over-breadth guard unconditionally
99d93eb feat(i18n): add the upcoming namespace and the UpcomingScreen empty state
26b68c0 test(upcoming): assert body and unlocksLabel render, not just title/unlocks
c34526c feat(routes): add nine honest empty-state routes for unbuilt destinations
d7ac610 copy(i18n): replace the Vietnamese upcoming copy with the native-speaker rewrite
4005d6f copy(i18n): name Korume, not "your Companion", in the English upcoming copy
7206103 feat(nav): complete NAV_GROUPS to its 22 canonical rows and let the list scroll
899df28 feat(data): add the situation/source taxonomy behind an array-returning read path
923a10f feat(data): add the collections read path and seed the six editorial collections
503ffe5 feat(data): rank lessons behind LessonRankingStrategy with PopularStrategyV1
f8221b0 test(data): assert PopularStrategyV1's tie-break order deterministically
84a7c71 fix(data): read the popularity ledger through the service-role client
21abfc3 fix(db): rename Task 8's two videos indexes to idx_<table>_<column>
1df1edc docs(plan): follow the repo's idx_<table>_<column> convention in Task 8's SQL
```

## Gate state at the pause (controller-measured, not taken from subagent reports)

`tsc` **0** · `npm run lint` **0 errors / 77 warnings**, mix unchanged `54 no-non-null-assertion +
23 no-unused-vars` · unit **2050 passed / 9 failed across 229 files** — and **every one of the 9 is in
`messages/en/companion.pin.test.ts`**, i.e. the copy drift above, not code.

Checkpoint C measured clean before the copy work started: 2044/2044 across 226 files, Playwright 12/12 in
51.5s on the first run, build listing all 12 expected routes and no `/[locale]/videos`.

Baseline before the branch was 2007 unit / 221 files / 8 e2e; Checkpoint B was 2038 / 225.

Always run the unit suite with `--reporter=json --outputFile` and read the JSON — grepping stdout once
lost a failing test's name for good. Verify `:3000` is empty with
`Get-NetTCPConnection -LocalPort 3000 -State Listen` BEFORE Playwright, not after a failure.

## What already shipped in the branch

- `--layout-{sidebar-width 224, sidebar-collapsed 68, content-max 1240, companion-width 340,
  gutter var(--space-xl), column-gap var(--space-lg)}` plus `--space-md-lg: 20px`. Tailwind keys
  `w-sidebar`, `w-companion`, `max-w-content`, `p-md-lg`; all registered in `lib/utils.ts`'s
  `extendTailwindMerge` (a scale missing there is silently stripped by `cn()`).
- `components/layout/two-column-shell.tsx` — the **only** consumer of `--layout-content-max`.
  `components/ui/container.tsx` deliberately keeps `max-w-6xl`; see D5 note below.
- Routes moved: `/shadowing`, `/shadowing/[id]`, `/shadowing/[id]/dictation`. Three 307 redirects in
  `next.config.mjs`. `/api/videos/**`, the `videos` table and the `videos` i18n namespace unchanged.
- `upcoming` namespace (EN+VI+NAMESPACES+messages.d.ts+pin test) and `UpcomingScreen`.
- Nine routes: `/review /challenges /sensei /roadmap /weekly-report /statistics /achievements
  /settings` and `/shadowing/explore`.
- **The Checkpoint D data layer**, all three modules sharing one shape (`"server-only"`, a row→domain
  mapper, `createClient()` from `@/lib/supabase/server`, `if (error) throw error` on every call, slugs
  never labels): `lib/data/lesson-taxonomy.ts` (`LessonTag` + four `Promise<LessonTag[]>` functions;
  `lesson_situations`/`lesson_sources` tables + `videos.situation_id`/`source_id` FKs, RLS select-only for
  `authenticated`, no write policy), `lib/data/collections.ts` (+ the six-collection seed; adds NO RLS of
  its own because `20260731000019_collections.sql:24-25` already has it), and `lib/data/lesson-ranking.ts`
  (`LessonRankingStrategy` + `PopularStrategyV1`, ranking by distinct learners, tie-break = lesson id
  ascending via `localeCompare`).
- `NAV_GROUPS` at its full **5 groups / 22 rows** (INSIGHTS added between STUDY and PROGRESS), the nav
  list scrollable via `data-nav-scroll` + `overflow-y-auto`, and an **href-resolves guard** in
  `app-nav.test.tsx` that fails if any nav href has no `page.tsx` — so a future route rename breaks
  loudly instead of shipping a dead row. `messages/en/nav.pin.test.ts` **created** (it never existed;
  the plan wrongly said "Modify"), scoped to the 9 new literals per this repo's split-authority
  convention documented at `videos.pin.test.ts:11-20`.

## Decisions made DURING execution that amend the plan

- **Task 2 was deleted from the plan mid-flight (user ruling).** The original made
  `components/ui/container.tsx` adopt `--layout-content-max`, widening every page 1152→1240. The user
  rejected it: `--layout-content-max` is the Shadowing shell's measure, not a claim that every page in
  the app is 1240px — Pricing/Settings/Auth will each want their own. `TwoColumnShell` owns the
  measure instead. **The browser-pass step now asserts page widths are UNCHANGED outside a
  TwoColumnShell**; a width change anywhere else is a defect.
- **Spacing scale: add the 20px step, rename nothing** (user ruling). Renaming `lg/xl/2xl/3xl` is a
  repo-wide migration whose only payoff is naming aesthetics — if ever wanted it is its own spec,
  "Spacing System v2".
- **Redirect e2e asserts at the HTTP level** (`maxRedirects: 0`, status 307 + `location` full path),
  not by navigating — see the plan-defect list below.

## Lessons this run produced — carry them forward

1. **An assertion nobody has seen fail is not yet a test.** Three separate rounds shipped assertions
   that could not fail: the sticky-rail test omitted `xl:top-md-lg` (and `position:sticky` without an
   inset is not sticky); the over-breadth test's `else` arm re-asserted its own guard condition;
   `body`/`unlocksLabel` were never asserted at all. **Mutation check is now the standing bar** —
   delete the thing, watch the test go red, restore.
2. **The controller's own grep missed 9 route occurrences** because the pattern required a leading
   quote or backtick, so comments and test files were invisible. The implementer found them. "One
   grep is never an audit" applies to the controller too.
3. **`npx rg` is NOT ripgrep** — it installs an unrelated stub package. Use `grep`.
4. **Kill the node on :3000 BEFORE every Playwright run, not after a failure.** Five registration
   specs failed in a way that looked exactly like an auth regression; auth was fine (direct
   `POST /auth/v1/signup` returned 200 in 0.39s) and a stale `node.exe` holding :3000 was serving a
   build from before the routes existed. The plan warned about this and the controller hit it anyway.
5. **A reviewer that mutates real files can leave residue.** One left `next.config.mjs.mutated`
   behind. Check `git status --porcelain` after any review that ran an experiment.
6. **`●` in Next's build table does not mean prerendered.** The 9 new routes show as SSG while
   `(protected)/layout.tsx` declares `force-dynamic` and does the auth redirect — which looked like an
   auth bypass. Verified it is not: their build dirs hold only `page.js` + manifests, and
   `find .next/server/app/en -name "*.html" | wc -l` = 0, while the genuinely static `_not-found` has
   `.html`/`.meta`/`.rsc`. The marker is an artifact of `generateStaticParams` in the root layout.
7. **`lib/supabase/route-protection.ts` is security-load-bearing on any route rename.** It holds the
   protected-path list; a renamed route missing from it becomes publicly reachable.
8. **⭐ The Supabase mock does not model RLS, so every RLS mistake is invisible to the suite.** Task 10's
   `PopularStrategyV1` read `user_lesson_library` through `createClient()` — the cookie-bound, RLS-governed
   client — while that table's only SELECT policy is `using (user_id = auth.uid())`. In production the
   unfiltered select returns **only the caller's own rows**, every learner Set tops out at size 1, and
   "rank by how many learners saved this" silently degrades to "my own library." Deterministically wrong on
   every call for every real user — and all 7 tests plus all 4 mutation checks were green. **On any query
   that aggregates across users, the check is "which client factory, and what does that table's policy
   say" — never "is the test green."** The fix pattern already existed at `lib/data/leaderboard.ts:68`
   (`createServiceClient()` for the cross-user aggregate, `createClient()` kept at `:63`/`:112` for
   caller-scoped reads). Swap ONLY the aggregating read: `lesson-ranking.ts` keeps `videos` on
   `createClient()`, which is what preserves "a lesson RLS hid is dropped from the result."
   To make such a bug testable at all, assert at the factory level — mock both `@/lib/supabase/service` and
   `@/lib/supabase/server` and register no resolver for the table on the wrong one, so
   `test/supabase-mock.ts`'s throw-on-unregistered-table fires.
9. **A plan's file list is a claim, not a fact — check existence.** Task 7's brief said "Modify
   `messages/en/nav.pin.test.ts`"; the file had never existed. Related: after renaming anything a plan
   quotes verbatim, grep the plan itself — the Task 10 implementer caught that the plan doc still showed
   the old index names.
10. **A `DONE_WITH_CONCERNS` about an untested branch is worth one extra round, not a deferred minor.**
   Task 10 shipped a tie-break with no fixture that produced a tie, because the plan's verbatim test list
   had none. CLAUDE.md §7 (deterministic tests for this logic family) outranks the plan's omission. The
   fix bar that made it real: the fixture must list its rows in the WRONG order, so a stable sort without
   the comparator gives the wrong answer — otherwise the test passes by luck.

## Plan defects the controller authored and had to fix mid-run

Recorded so the next planning pass does not repeat them:

- `UpcomingScreen` was specified async so it could read one shared string — untestable, because React
  18 + RTL cannot render an async component and no test in this repo does. Fixed by passing
  `unlocksLabel` as a prop (`2b1d094`).
- The redirect e2e bodies claimed they "pass whether or not the target requires auth". False —
  `/shadowing` is in `PROTECTED_PREFIXES`. The same plan said "every one of these routes is
  auth-gated" in the `next.config` comment three paragraphs earlier.
- Task 1's namespace test contained a tautological half (`--layout-space*` filter).
- Task 2's prose said "4 tests" while its own test body had 5 blocks.
- The route-survey step told the implementer to run `npx rg`.

## Plan defects found in Checkpoint D

- Task 7's brief said "Modify `messages/en/nav.pin.test.ts`" — the file did not exist.
- Task 8's brief specified index names against the repo's own convention (see the ruling above).
- Task 10's verbatim test list contained no tie fixture, leaving the tie-break unexercised.
- Task 8's brief quoted a stale migration count ("17"); the repo now applies 26. The count is never the
  check — "applied with zero errors" is.

## Deferred minors parked in the ledger (none block merge)

Token-test tautology · `--layout-sidebar-collapsed` missing the `-width` suffix · brief's `Produces`
interface narrower than its own code · `railLabel` required even when `rail` is omitted (will bite
Explore per D14 — consider a discriminated union when C3 consumes the shell) · `{...props}` spread
last on the shell root · the two moved focus page bodies still carry comments referencing their
pre-move paths · the "no svg/canvas/progress/meter" test is stricter than its stated intent (bans a
decorative icon too) · `max-w-[60ch]` is a raw arbitrary value with no reading-measure token · when a
later plan replaces `/shadowing/explore`'s body, `explore.body`/`explore.unlocks` become dead keys.

Checkpoint D adds: `collections.test.ts`'s "unknown slug" case never asserts that `.maybeSingle()` was the
call made, and `test/supabase-mock.ts:181-188` treats `single()`/`maybeSingle()` as inert no-ops — so an
accidental swap to `.single()`, which THROWS on zero rows in real Supabase, would pass the suite;
`hasCall(calls, "maybeSingle")` closes it · `listSources`/`getLessonSources` have no dedicated test (both
pairs share the same helpers, so risk is low until they diverge) · `lesson-ranking.ts`'s `.slice(0, limit)`
with `limit === 0` produces `.in("id", [])`, untested · the nav's `overflow-y-auto` is probably inert on
mobile because `<nav>` has no height bound below `md:` (`app-nav.tsx:97`) so `flex-1` has nothing to grow
against — desktop is correct and nothing false shipped into the source, but confirm it visually.

**Owed to a later task, not a defect now:** nothing yet consumes `listCollections` /
`getCollectionBySlug` / `listCollectionLessons`, so no untrusted input reaches them. Whichever task first
wires an API route to `getCollectionBySlug(slug)` MUST validate the slug shape before the call
(CLAUDE.md §6).

**Honest gap:** one unit run showed `1 failed | 2037 passed` and the controller's grep captured only
the summary line, so **the failing test's name was lost**. Three subsequent full runs are green.
Documented unit flakes are `pitch-contour.test.tsx` and `waveform.test.tsx`, but this was NOT
identified. If it recurs, capture with `--reporter=json --outputFile`, never by grepping stdout.

**Infra, not code:** `PGRST303 "JWT issued at future"` has flaked across 3 different
registration-heavy e2e specs under 8-way parallel load. Local Supabase clock skew. Worth fixing at the
environment level before someone reads it as a regression.

## Related

`mem:plan_c_hub_ui_inputs` (what Plan C sits inside) · `mem:project_status` (§ NEXT ACTION) ·
`mem:figma_make_design_source` (⚠️ its "29 frames / avoid the MCP" claim is stale — the live design
file `IwFHZDZdHW7qsSFiNbWrkd` now has **59 frames** and the MCP is good for measurement and
screenshots).
