# Shadowing Hub Plan C — run state (paused 2026-08-08, mid-execution)

**Read this before touching anything on branch `shadowing-hub-plan-c`.** Spec is locked, C1 plan is
written, Checkpoints A and B are merged into the branch, C and D remain.

## Where things stand

| Artifact | State |
|---|---|
| Spec `docs/superpowers/specs/2026-08-07-shadowing-hub-plan-c-design.md` | **LOCKED** at `22c9d18`, 17 decisions D1–D17, evidence appendix §7 |
| Plan `docs/superpowers/plans/2026-08-07-shadowing-hub-plan-c1-foundation.md` | 11 tasks / 68 steps |
| Branch `shadowing-hub-plan-c` | 13 commits off master `3ca9966`. **Never pushed.** |
| Ledger `.superpowers/sdd/2026-08-07-shadowing-hub-plan-c1-foundation/progress.md` | gitignored; per-task detail, every fix round, every deferred minor |

**Do not re-dispatch a task that has a `Task <N>: complete` line in the ledger.** After compaction,
trust the ledger and `git log`, not recollection.

## ▶ RESUME HERE — Checkpoint C (Task 7), then D (Tasks 8–11)

Execution method: `superpowers:subagent-driven-development`, **no worktree** (this repo never pushes,
so `EnterWorktree` branches from a stale `origin`; and a worktree has no `.env.local`, which makes
every auth-dependent Playwright spec fail in a way that looks exactly like a code regression).

The user grouped the 11 tasks into 4 human-review gates:

- **A — Tasks 1–2** ✅ approved by user
- **B — Tasks 3–6** ✅ complete and **approved by the user 2026-08-08**
- **C — Task 7** (NAV_GROUPS to 22 rows + scroll + href-resolves test) — alone, because it is the only
  change touching every authenticated screen
- **D — Tasks 8–11** (taxonomy, collections, ranking strategy, verification gate)

### One thing still owed by the user at resume

**Checkpoint B is approved (2026-08-08); the session was paused there by the user, to resume at
Checkpoint C.** One ruling remains open — do not treat the B approval as covering it, and do not let a
later task ship more Vietnamese copy before asking again:

1. **Vietnamese copy decision.** A reviewer judged 4 strings in
   `messages/vi/upcoming.json` to be literal gloss rather than native copy — `challenges.body`
   ("Những lượt ngắn có giờ, đẩy một kỹ năng mạnh hơn buổi học thường"), `roadmap.unlocks`
   ("…trước khi nói được điều gì đúng"), `settings.unlocks` ("…sẽ về cùng trang này"), `explore.body`.
   Not ungrammatical, meaning preserved, terminology consistent with `nav.json`. **The copy was
   authored by the controller in the plan**, not by the implementer. VI is the primary locale and this
   copy already renders on 9 routes. The user is a native speaker and should rule.

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
```

## Gate state at pause (controller-measured, not taken from subagent reports)

`tsc` 0 · `npm run lint` 0 errors / 77 warnings, mix unchanged `54 no-non-null-assertion +
23 no-unused-vars` · unit **2038/2038 across 225 files** · Playwright **12/12** · build lists all 12
expected routes and no `/[locale]/videos`.

Baseline before the branch was 2007 unit / 221 files / 8 e2e.

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

## Deferred minors parked in the ledger (none block merge)

Token-test tautology · `--layout-sidebar-collapsed` missing the `-width` suffix · brief's `Produces`
interface narrower than its own code · `railLabel` required even when `rail` is omitted (will bite
Explore per D14 — consider a discriminated union when C3 consumes the shell) · `{...props}` spread
last on the shell root · the two moved focus page bodies still carry comments referencing their
pre-move paths · the "no svg/canvas/progress/meter" test is stricter than its stated intent (bans a
decorative icon too) · `max-w-[60ch]` is a raw arbitrary value with no reading-measure token · when a
later plan replaces `/shadowing/explore`'s body, `explore.body`/`explore.unlocks` become dead keys.

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
