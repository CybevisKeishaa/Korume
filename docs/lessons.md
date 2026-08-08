# Lessons

Operational lessons this project has already paid for — how to verify, dispatch, audit, and avoid
fooling ourselves. **This file is the only place a lesson is written out.** Everywhere else — specs,
plans, memories, status docs — references the `L-NNN` id and restates nothing.

Scope is **process**. Technical facts about this codebase (schema, tokens, provider quirks) belong in
`mem:project_status` § Key gotchas, not here. Reusable craft principles with no incident behind them
belong in `docs/reference/GRAND_PLAYBOOK.md`.

Design: `docs/superpowers/specs/2026-08-08-lessons-registry-design.md`.
Contracts: `CLAUDE.md` §10 (when to read) and §9 (when to write).

## Lesson-entry rules

1. **Evidence is required, and must be openable.** A commit sha, a spec/plan path, or a dated
   incident. "This has happened a few times" is not evidence — it is an opinion wearing a citation.
2. **Merge, don't append.** If a new lesson is a variant of one already here, add an `Evidence` entry
   to that lesson. Do not create a second id. This file grows by evidence, not by entry count.
3. **Three evidence entries trigger a promotion *review*, not a promotion.** Promote to `CLAUDE.md`
   only when the lesson can be restated as a checkable invariant. On promotion the rule moves and this
   entry keeps only `**Status:** Promoted to CLAUDE.md §X — retained here as historical evidence.`
4. **Entry count is never a target.** Sixty genuinely distinct lessons is correct. Thirty entries that
   are five variants of five lessons is a defect.

Ids are never reused or renumbered. A retired lesson keeps its id and gains a `Status:` line.
Never write a derived count into an entry — the evidence list already carries "how often", and unlike a
count it cannot go stale.

---

## Verification & evidence

### L-001 — A tool reporting success is not evidence it worked

**Rule:** After any state-changing tool call, read the state back before relying on it.
**Why:** A success return describes the call, not the world. The two can disagree silently.
**Evidence:** Plan C1 `bd7f574` — `resize_window` returned success twice while `innerWidth` never left 1280.
**Applies to:** browser automation, file writes, migrations, anything whose effect is observable.

### L-002 — Count, don't add up — and record the command, not its output

**Rule:** Measure a figure with a command. In durable documents write the *command*, never the number.
**Why:** A derived count is falsified by the next action, including the commit that carries it. A confidently wrong figure is worse than an obviously old one: a reader who spot-checks it discounts the whole document.
**Evidence:** Plan C1 — branch count written 23, then 26, then 35 and 36 in two memory files in the *same commit*, while HEAD was 37; the 26 was arithmetic on a commit list that deliberately omitted spec and docs commits.
**Applies to:** commit counts, test tallies, file counts, migration counts — any figure in a doc, memory, or commit message.

### L-003 — Re-derive load-bearing claims yourself, whoever made them

**Rule:** Recompute any number a decision rests on. When a report says "out of scope", "pre-existing" or "environmental", isolate the variable and prove it.
**Why:** Reports are written in good faith from a narrower view, and a plausible classification is exactly where a real defect hides. A number costs seconds to recompute and ships if wrong.
**Evidence:** Token foundation `86328bc` — "3 `text-white` sites, out of scope" was 4 sites at 3.28:1 failing AA, and the pre-branch value had passed at 6.03:1; a reported contrast figure was arithmetically impossible; "1 flaky test" was reported unnamed. · Screen-port workflow `7277ac1` — a reviewer reported "7 lint errors, pre-existing"; the real count was 0 (`L-018`).
**Applies to:** every subagent report and every review finding, in both directions.

---

## Testing discipline

### L-004 — An assertion nobody has seen fail is not yet a test

**Rule:** Delete the thing the assertion guards, run it, watch it go red, restore. Report both outcomes with real output.
**Why:** An assertion can be structurally incapable of failing while looking correct on inspection, and a green suite says nothing about it.
**Evidence:** Plan C1 `bd7f574`, three separate rounds — a test titled "sticks the rail" asserted `sticky` and a width class but not the inset class, so it passed against a rail that did not stick; an over-breadth test's `else` arm re-asserted the negation of its own guard, so that path always passed; a four-required-prop component asserted two, leaving the paragraph it existed for untested across nine routes.
**Applies to:** every new assertion, including ones written to close a review finding. `toContain` on a class name is especially prone — it constrains a substring, not behaviour.

### L-005 — The Supabase mock models no RLS, so RLS mistakes are invisible to the suite

**Rule:** On any query that aggregates across users, ask *which client factory, and what does that table's SELECT policy say* — never *is the test green*.
**Why:** RLS is enforced by Postgres and no unit test reaches Postgres. `test/supabase-mock.ts` returns whatever a resolver returns.
**Evidence:** Plan C1 Task 10 — `PopularStrategyV1` read `user_lesson_library` through the cookie-bound `createClient()` while that table's only SELECT policy is `using (user_id = auth.uid())`; in production every learner set tops out at size 1. All 7 tests and all 4 mutation checks were green; a reviewer caught it by reading the migration. Fixed `84a7c71`.
**Applies to:** cross-user aggregates. Pattern to copy: `lib/data/leaderboard.ts:68` — `createServiceClient()` for the aggregate, `createClient()` kept for caller-scoped reads. Swap **only** the aggregating read.

### L-006 — A guard driven by the list it protects cannot detect an omission from that list

**Rule:** Drive such guards from the filesystem, not from the array under test.
**Why:** Iterating `PROTECTED_PREFIXES` to check `PROTECTED_PREFIXES` is a tautology — a route that was never added is invisible to every assertion in the file.
**Evidence:** Plan C1 — eight `(protected)/(app)` routes never reached `PROTECTED_PREFIXES`, dropping `redirectTo`; invisible to eleven per-task reviews and a green gate. Fixed `65ebb4c` with a filesystem walk.
**Applies to:** route protection, nav registries, token scales, any list-shaped invariant.

### L-007 — Report a blended metric in its separate layers, never as one number

**Rule:** When one figure blends two properties, report both, and say which tests each ran against.
**Why:** A blend can read 0 while one layer is badly broken, and no single number can show that.
**Evidence:** L9a Plan 3 — blended mutation score "0 survivors" against a wiring-only pass of 5 at Task 11c, 9 at 11d, 1 at 11e; the pin tests were masking the gap. Catalog mutations prove copy stability, wiring mutations prove the UI renders the correct key.
**Applies to:** mutation reporting, coverage figures, any composite score.

### L-008 — Add a swap-proof assertion wherever two values are type-interchangeable

**Rule:** When two rendered values have the same shape, assert the composed node so the test fails if they are swapped — not merely that each exists.
**Why:** Swapping two keys teaches the wrong thing while every literal pin still passes.
**Evidence:** L9a Plan 3 — お手本/あなた (11d), 発音/リズム (11e), Again/Hard/Good/Easy ↔ shortcuts 1/2/3/4 (Task 12). Assert `getByText("発音 82")` or `toHaveTextContent("Again1")`, or scope each label+value to one element.
**Applies to:** legends, badges, score labels, grade buttons, any paired label↔value UI.

### L-009 — Diagnose a flake; never wave it through

**Rule:** Before dismissing a failure, exclude a self-inflicted regression by evidence — standalone run, full-suite re-run, and where the failure actually occurs.
**Why:** "Flaky" is the most convenient available explanation and therefore the least trustworthy one, especially right after a change touching that area.
**Evidence:** Plan C1 — `review.spec.ts` failed once just after `/review` was added to the protected prefixes. Excluded three ways: standalone pass in 3.9s, full suite 13/13, and the failure occurred at `/register` before `/review` was reached. Real cause: a PGRST303 clock-skew flake under parallel load.
**Applies to:** every intermittent failure.

### L-010 — A test can prove architecture with zero production instrumentation

**Rule:** Where an architectural claim has an observable side effect, count the side effect instead of instrumenting the code.
**Why:** It keeps a structural guarantee under test without shipping test-only hooks into production.
**Evidence:** Screen-port workflow `7277ac1` — `phaseRequestedRef` makes the Companion phase read fire once per provider lifetime, so counting `/api/user/stats` across a route-group boundary distinguishes a surviving provider from a rebuilt one.
**Applies to:** provider lifetime, caching, memoization, dedupe — anything whose correctness is "how many times did X happen".

---

## Plans & specs

### L-011 — The final whole-branch review catches what no per-task review can

**Rule:** Run a whole-branch review before merging, even when every task was individually reviewed and the gate is green.
**Why:** The defects it finds are contradictions *between* correct changes. No per-task diff contains them.
**Evidence:** Lesson Workspace Plan A — 1 Critical + 4 Important, incl. an e2e spec still clicking a renamed nav label. · Token foundation `86328bc` — 5 Important, incl. `color-scheme: dark` never declared. · Screen-port workflow `7277ac1` — caught that the `(focus)` contract had removed the reduce-motion control, breaking `CLAUDE.md` §2 rule 4. · Plan C1 `bd7f574` — round 1 returned CHANGES REQUIRED and was right five for five, incl. a redirect swallowing `/api/videos`.
**Applies to:** every branch before merge.
**Status:** Promotion candidate under lesson-entry rule 3 (four evidence entries). Not promoted — review deferred, see `docs/superpowers/specs/2026-08-08-lessons-registry-design.md` §7.

### L-012 — A fix wave needs its own review

**Rule:** Review the fixes for review findings as a change in their own right.
**Why:** A fix is written under pressure, against a narrow description of a symptom, and can break the very contract the branch existed to establish.
**Evidence:** Screen-port workflow `7277ac1` — the fix restoring the reduce-motion control mounted it outside the nav, turning a 24px strip into a ~130px labelled rail on every authenticated screen. Resolved with a `compact` prop that `sr-only`s the caption.
**Applies to:** every round of review fixes.

### L-013 — The worst defects originate in the spec or the plan, not in the implementer

**Rule:** When a defect appears, check whether the plan instructed it before attributing it to execution.
**Why:** An implementer following a wrong instruction produces a correct-looking task that no per-task review will reject.
**Evidence:** Screen-port workflow `7277ac1`, all three of its worst defects — the plan told the gate to assert `getByRole("navigation", {name: /main/i})`, which one i18n rename would have greened forever; it assumed rather than asserted that `/journal` mounts a CompanionAnchor, without which the whole proxy is vacuous; and it described `(immersive)` as having "no toggle" after the user had ruled otherwise.
**Applies to:** spec and plan authoring, and defect triage.

### L-014 — Route low-value findings to the final audit; expand a task only for correctness-sensitive defects

**Rule:** If a gap has no user-visible behavioural consequence, record it as a carried Minor for the closing audit task instead of widening the task in flight.
**Why:** Review effort spent on assertion count is effort not spent on new defect classes, and scope creep in flight is how a task loses its reviewable boundary.
**Evidence:** L9a Plan 3 standing convention #6 — Task 12 carried two trivial `mining` `<h1>`/link key swaps to the Task 19 audit rather than fixing in-task, while 11e's mislabeled pronunciation score and 12's owned error path were fixed immediately.
**Applies to:** review triage during plan execution.

---

## Subagent dispatch

### L-015 — Never seed a subagent with a number you have not measured

**Rule:** Treat every figure in your own dispatch prompt as a claim you are asserting. Measure it first, or instruct the agent to measure it and to report disagreement as a finding.
**Why:** The agent repeats it, and an unverified figure comes back looking independently confirmed — worse than stating no number at all.
**Evidence:** Plan C1 — an unmeasured "26" went into a code-reviewer's prompt and was echoed in its report. The round-2 dispatch instead told the reviewer to measure, and it promptly caught the next stale count.
**Applies to:** every dispatch prompt. See `L-002` for the same disease in documents.

### L-016 — In a worktree run, the controller's own git check is the safety net — not the prompt pattern

**Rule:** After **every** dispatch, run `git worktree list` + `git log --oneline -3` in the worktree and `git log --oneline -1` + `git status --short` in the main checkout. Unconditionally, not when a report looks off.
**Why:** Requiring `cd` + absolute paths + a pre-commit branch self-check measurably reduces stray commits but does not prevent them: a tool call can resolve against a different cwd than the Bash calls that were correctly `cd`ed, so the agent's self-check runs in the wrong place too and its report is internally consistent and wrong.
**Evidence:** Lesson Workspace Plan A — Task 20 of 22 committed to `master`; caught by the controller's review-package showing `BASE==HEAD`, not by the self-report, which carried a real sha on the wrong branch. · Plan B — recurred at Task 9 *with* the full prompt pattern in place. · Token foundation `86328bc` — controller verification after all 9 tasks and 4 fix rounds, zero incidents.
**Applies to:** every worktree-based subagent run. Recovery: `git cherry-pick` onto the correct branch, then on the polluted branch prefer soft-reset + single-file checkout over `git reset --hard` if any unrelated uncommitted change exists — and surface it to the user before any reset on a shared branch.

---

## Environment & tooling

### L-017 — Kill `:3000` before Playwright

**Rule:** Confirm the port is free (`Get-NetTCPConnection -LocalPort 3000 -State Listen`) before the run, not after a failure.
**Why:** `reuseExistingServer` adopts a stale process and silently tests an old build, which presents as a code regression.
**Evidence:** Plan C1 — a stale `node.exe` served a pre-rename build and looked exactly like an auth regression.
**Applies to:** every Playwright run.

### L-018 — Use `npm run lint`, never `npx eslint`

**Rule:** Lint through the npm script.
**Why:** `next lint` applies exclusions that a direct `npx eslint` over paths does not, so the direct call invents errors that do not exist.
**Evidence:** Screen-port workflow `7277ac1` — a reviewer reported "7 lint errors, pre-existing"; the measured count through `npm run lint` was 0.
**Applies to:** every lint check, including inside review dispatches.

### L-019 — `npx rg` is not ripgrep

**Rule:** Use `grep`, or the Grep tool.
**Why:** `npx rg` installs an unrelated stub package and returns misleading output.
**Evidence:** Plan C1.
**Applies to:** any search from a shell.

### L-020 — A worktree has no `.env.local`

**Rule:** Copy the full env from the main checkout before trusting any auth-dependent result in a worktree, and remove the secrets afterwards.
**Why:** `.env.local` is gitignored, so `git worktree add` does not copy it. A hand-built stub fails every auth-dependent Playwright spec in a way indistinguishable from a code regression.
**Evidence:** Token foundation `86328bc` — the environment was suspected, then the branch, before the missing env was isolated.
**Applies to:** every worktree that runs e2e or auth-dependent tests. Related: `npm test` from the repo root also scans `.worktrees/`, which `vitest.config.ts` does not exclude.

### L-021 — `EnterWorktree` branches from `origin`, which is wrong for a repo that never pushes

**Rule:** Use `git worktree add` into `.worktrees/`, or set `worktree.baseRef: head`.
**Why:** The default `worktree.baseRef: fresh` branches from `origin/<default>`. Local `master` here routinely runs many commits ahead of origin, so the worktree would be missing the spec and plan just committed. `baseRef` is a setting, not a per-call parameter.
**Evidence:** Token foundation `86328bc` — measured before use; `git worktree add` used instead.
**Applies to:** every isolated execution workspace in this repo.

---

## Auditing & search

### L-022 — One grep is never an audit

**Rule:** Sweep variants (`data-[…]`, `focus`, `focus-visible`, `group-hover`, `aria-*`, `peer-*`) and alternate spellings, not one shape.
**Why:** A pattern matches the shape you imagined, and the instance that matters is usually the one shaped differently.
**Evidence:** Token foundation `86328bc` — a `bg-<c>/<alpha>` sweep missed `notification-bell` (no alpha suffix); a `hover:bg-muted` sweep missed `select.tsx`'s `data-[highlighted]:bg-muted`, which is the keyboard-navigation indicator and therefore engaged `CLAUDE.md` §2 rule 5.
**Applies to:** every codebase-wide sweep.

### L-023 — Audit the dependency graph, not the list you were handed

**Rule:** Before freezing a task's scope, audit the assigned directory, grep the import graph of every exported symbol involved, and verify each consumer. Treat a plan's file list as a starting hypothesis.
**Why:** A plan's file list is a claim, not a fact — and a wrong one ships silently because the missing file is never opened.
**Evidence:** L9a Plan 3 — the file list was wrong five separate times; 11d's `useRecorder` had a consumer under `components/conversation/` on no list, breaking 13 tests; Task 12's `mining-review-session.tsx`, the file holding the owned defect, was absent from its own task's list. · Plan C1 — "check existence before trusting *Modify X*".
**Applies to:** every task scoping step, and every "modify these N files" instruction.

### L-024 — Reconcile the whole dependent system, not just the flagged files

**Rule:** When reconciling against a governance document, audit every file that depends on the same facts — including files a previous pass marked done.
**Why:** Fixing only the named files leaves latent contradictions that resurface later, which is the confusing state the reconciliation existed to remove.
**Evidence:** `docs/design/` reconciliation (2026-07-29, merged `20d6eed`) — a repo-wide audit found real contradictions in files a prior "Wave 1" had already signed off, turning a 9-file task into a 22-task plan.
**Applies to:** doc/config reconciliation against any source of truth.

### L-025 — A nav or label rename must sweep `tests/e2e/` by hand

**Rule:** After renaming any user-visible label, grep `tests/e2e/` for the old string.
**Why:** `vitest.config.ts:13` excludes `tests/e2e`, so `npm test` **structurally cannot** run Playwright specs — no unit run can ever catch the break.
**Evidence:** Lesson Workspace Plan A `ef564c7` — `tests/e2e/journal.spec.ts` still clicked a link named "Journal" after the nav label became "Journey".
**Applies to:** every label, route, or role-name rename.

---

## Sources of truth

### L-026 — Two silently-disagreeing sources is this project's most expensive failure mode

**Rule:** When a fact appears in two places, make one derive from the other or delete one. A ruling of "the other one is right, amend this" is valid; leaving both is not.
**Why:** Divergence is discovered late, one instance at a time, always as rework.
**Evidence:** Lesson Workspace Plan A spent an entire plan cleaning up one instance. · `docs/superpowers/specs/2026-08-08-screen-registry-design.md` §7 names it risk 1 and builds R1+R12 to guard it. · This registry exists because the lesson corpus itself had four owners.
**Applies to:** docs, catalogs, registries, memories, constants.

### L-027 — Commit the content before the test that pins it

**Rule:** When a test asserts literal content, the content must be committed first.
**Why:** Pins updated against an uncommitted file are green locally and red on every clean checkout.
**Evidence:** Plan C1 — the 9 pins assert Vietnamese strings; the catalogs were committed at `60abdef` before the pins that characterize them.
**Applies to:** message-catalog pins, snapshot tests, fixture-backed assertions.

### L-028 — A lesson recorded inside a status document decays with the status

**Rule:** Write lessons to `docs/lessons.md`. Never into a status or run-state document.
**Why:** A status doc is rewritten as work moves on — folded into `<details>`, then archived. The text survives but stops being read, and the next branch rediscovers the lesson and writes it again in different words.
**Evidence:** The whole-branch-review lesson was written three times in three files, each with a different derived count ("Third", "4th", "5th") — see `L-011`, whose evidence list replaces all three. · The screen-port workflow's lessons sat inside a `(superseded)` block within a week.
**Applies to:** every end-of-branch write-up. Enforced by `CLAUDE.md` §9.
