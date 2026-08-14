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
**Evidence:** Plan C1 — branch count written 23, then 26, then 35 and 36 in two memory files in the *same commit*, while HEAD was 37; the 26 was arithmetic on a commit list that deliberately omitted spec and docs commits. · Screen Registry Phase 2a — a ruling in `decision-register.md` was written "exactly four edits", corrected to five, and was *still* one short; the third correction (`5c7a6cd`) dropped the total instead of raising it, delegating enumeration to the suite, which is the only authority that cannot drift. · Same branch, the counter-trap: **the recorded command can match its own documentation.** `grep -c 'navGroup: "'` over `lib/product/screen-registry.ts` returns **15** where the answer is 14 — the fifteenth hit is the header comment that documents the command. The anchored form the header actually prescribes (`grep -c '^    navGroup: "'`) excludes itself. Writing the command instead of the number is necessary, not sufficient: run it and sanity-check the result against a second measurement.
**Applies to:** commit counts, test tallies, file counts, migration counts — any figure in a doc, memory, or commit message.

### L-003 — Re-derive load-bearing claims yourself, whoever made them

**Rule:** Recompute any number a decision rests on. When a report says "out of scope", "pre-existing" or "environmental", isolate the variable and prove it.
**Why:** Reports are written in good faith from a narrower view, and a plausible classification is exactly where a real defect hides. A number costs seconds to recompute and ships if wrong.
**Evidence:** Token foundation `86328bc` — "3 `text-white` sites, out of scope" was 4 sites at 3.28:1 failing AA, and the pre-branch value had passed at 6.03:1; a reported contrast figure was arithmetically impossible; "1 flaky test" was reported unnamed. · Screen-port workflow `7277ac1` — a reviewer reported "7 lint errors, pre-existing" when the real count was 0 (`L-018`), and a second reviewer called a correction note dishonest for crediting a user ruling that had in fact happened. · Screen Registry Phase 2a — the fix wave's own report claimed *"no line number now points into `screen-inventory.md` from anywhere"* (14 did) and that two surviving pins *"already imply"* an invariant it had removed (nothing pins `SCREEN_REGISTRY.length`, so they do not). Both were sincere summaries of work genuinely done; the overclaim was in the scope word — "anywhere", "already imply" — which is exactly where a self-report is weakest and cheapest to check.
**Applies to:** every subagent report and every review finding, in both directions. The claims most worth re-deriving are the universal ones ("nowhere", "every", "all"), because one counter-example falsifies them and one grep finds it.

---

## Testing discipline

### L-004 — An assertion nobody has seen fail is not yet a test

**Status:** Promoted to `CLAUDE.md` §7 (2026-08-13) — retained here as historical evidence.
**Evidence:** Plan C1 `bd7f574`, three separate rounds — a test titled "sticks the rail" asserted `sticky` and a width class but not the inset class, so it passed against a rail that did not stick; an over-breadth test's `else` arm re-asserted the negation of its own guard, so that path always passed; a four-required-prop component asserted two, leaving the paragraph it existed for untested across nine routes. · Screen registry Phase 1a `0059385` — the glob `app/[locale]/**/page.tsx` matched **zero** files, because a glob reads `[locale]` as a character class, not a literal directory name; escaped, the same walk matched 44. The assertion it fed (T1, "every `page.tsx` has a registry entry") would have compared an empty set against the registry and passed while asserting nothing — the vacuous-pass case, caught only because the count was measured rather than assumed.
**Evidence (cont.):** Screen registry Phase 1b `276d0ac` — the same disease *outside* the test suite. The client-bundle check greped the built chunks for six registry markers and returned six clean zeros. The positive control, `"Pronunciation"`, returned zero **too**: catalog strings travel in the RSC payload and never reach a static chunk, so the grep could not have found anything and all six zeros were meaningless. Re-run with `data-nav-scroll` — a literal that genuinely is in `app-nav.tsx`'s chunk — the control fired, and only then did the zeros mean what they appeared to mean.
**Note (kept here — too narrow to be law):** `toContain` on a class name is especially prone to this — it constrains a substring, not behaviour. A **grep of a build artifact is a collection gathered by a pattern**, so `CLAUDE.md` §7's clause applies to it verbatim: never report a clean sweep of build output without a control that fires.

### L-005 — The Supabase mock models no RLS, so RLS mistakes are invisible to the suite

**Rule:** On any query that aggregates across users, ask *which client factory, and what does that table's SELECT policy say* — never *is the test green*.
**Why:** RLS is enforced by Postgres and no unit test reaches Postgres. `test/supabase-mock.ts` returns whatever a resolver returns.
**Evidence:** Plan C1 Task 10 — `PopularStrategyV1` read `user_lesson_library` through the cookie-bound `createClient()` while that table's only SELECT policy is `using (user_id = auth.uid())`; in production every learner set tops out at size 1. All 7 tests and all 4 mutation checks were green; a reviewer caught it by reading the migration. Fixed `84a7c71`.
**Applies to:** cross-user aggregates. Pattern to copy: `lib/data/leaderboard.ts:68` — `createServiceClient()` for the aggregate, `createClient()` kept for caller-scoped reads. Swap **only** the aggregating read. Comment every deliberate service-role read with why it is safe (aggregate only, no per-user field crosses the function boundary). To test it, mock both `@/lib/supabase/service` and `@/lib/supabase/server` and register no resolver for the table on the wrong one, so the mock's throw-on-unregistered-table fires.

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

**Status:** Promoted to `CLAUDE.md` §9 (2026-08-13) — retained here as historical evidence.
**Evidence:** Lesson Workspace Plan A — 1 Critical + 4 Important, incl. an e2e spec still clicking a renamed nav label. · Token foundation `86328bc` — 5 Important, incl. `color-scheme: dark` never declared. · Screen-port workflow `7277ac1` — caught that the `(focus)` contract had removed the reduce-motion control, breaking `CLAUDE.md` §2 rule 4. · Plan C1 `bd7f574` — round 1 returned CHANGES REQUIRED and was right five for five, incl. a redirect swallowing `/api/videos`.

### L-012 — A fix wave needs its own review

**Rule:** Review the fixes for review findings as a change in their own right.
**Why:** A fix is written under pressure, against a narrow description of a symptom, and can break the very contract the branch existed to establish.
**Evidence:** Screen-port workflow `7277ac1` — the fix restoring the reduce-motion control mounted it outside the nav, turning a 24px strip into a ~130px labelled rail on every authenticated screen. Resolved with a `compact` prop that `sr-only`s the caption. · Screen Registry Phase 1b — the re-review of `4db8e7b..HEAD` found no code defect but four documents outranking the truth, including the branch's own resume memory. · Screen Registry Phase 2a `01eb284`+`5c7a6cd` — a wave closing eleven findings introduced a fresh false statement of its own (a spec sentence enumerating which questions stay open was wrong in **both** directions — it listed one the file's own list had answered and omitted one still open) and left the single live line-citation it existed to fix pointing ~29 lines off target, because its own `+21` lines moved it. Closed at `bf344a4`. **Twice now the fix wave's defect has been the same shape: a claim written *about* a file the same commit was editing.** Check the wave's own output against the wave's own edits before closing it.
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

### L-029 — A plan-wide gate must be scheduled in a task, not only named in Global Constraints

**Rule:** Every verification command a plan declares binding must be named in the steps of a specific task — the first task that can break it, not only the last one. A gate listed in Global Constraints and scheduled nowhere is a gate nobody runs.
**Why:** Per-task reviews verify what the task's own steps name. A constraint stated once at the top of a plan is read as context, not as an action, so a regression it would catch survives every review by construction.
**Evidence:** Lessons Registry — Task 2 shipped `docs/lessons.test.ts` with `npx tsc --noEmit` failing (`TS2322` under `noUncheckedIndexedAccess`); Tasks 3, 4 and 5 each passed review on `vitest` alone; the failure surfaced only at Task 6 and was fixed at `736d3bc`. The plan listed `tsc` in Global Constraints and invoked it in one task of six.
**Applies to:** plan authoring — Global Constraints sections; and the first task that introduces a file of a new type.

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
**Evidence:** Lesson Workspace Plan A — Task 20 of 22 committed to `master`; caught by the controller's review-package showing `BASE==HEAD`, not by the self-report, which carried a real sha on the wrong branch. · Plan B — recurred at Task 9 *with* the full prompt pattern in place, on a haiku-tier implementer; the remaining tasks escalated the model floor to sonnet, bundled with controller verification as a paired mitigation not proven causally responsible on its own. · Token foundation `86328bc` — controller verification after all 9 tasks and 4 fix rounds, zero incidents.
**Applies to:** every worktree-based subagent run. Recovery: `git cherry-pick` onto the correct branch, then on the polluted branch prefer soft-reset + single-file checkout over `git reset --hard` if any unrelated uncommitted change exists — and surface it to the user before any reset on a shared branch.
**Status:** Promotion review completed 2026-08-13 — **declined**, and not on evidence count. Two reasons, either sufficient: it binds only worktree-based subagent runs while `CLAUDE.md` binds every session, and compliance is observable only in the controller's own transcript — never in a diff, a command output, or an artifact a reviewer can open, so it cannot be restated as the checkable invariant G6 requires. Stays a lesson, cited by id from dispatch procedure. Do not re-open on a further evidence entry alone.

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

### L-019 — A shell search here can return a confidently empty result for environmental reasons

**Rule:** Prefer the Grep tool. When searching from a shell, never accept an empty result until a **positive control** — a pattern you know is present — has fired through the same invocation.
**Why:** Two unrelated mechanisms in this environment make a search lie silently, and both present as "no matches" — which reads as a clean sweep rather than as a broken command.
**Evidence:** Plan C1 — **`npx rg` is not ripgrep**: it installs an unrelated stub package and returns misleading output. · Screen Registry Phase 2b `dc51d36` — in this repo's Git Bash, **a `git grep` pattern beginning with `/` is mangled by MSYS path conversion** and matches nothing regardless of the truth. Measured three ways: `git grep -c "/jlpt" -- 'lib/supabase/*.ts'` → empty, exit 1; `MSYS_NO_PATHCONV=1 git grep -c "/jlpt" …` → correctly two files; `git grep -c "[/]jlpt" …` → the same two. This made two plan steps vacuous **by construction** — Task 3 Step 5 (`git grep "/api/jlpt"`, "expected: no output") and Task 7's G4 sweep. G4 was the artifact standing in for a guard the user had explicitly deferred *on condition that the sweep be run in its place*, so the one check bought with that ruling could not have failed. It was saved only because the implementer ran a control first and noticed the silence.
**Applies to:** any search from a shell. A leading `/` needs `MSYS_NO_PATHCONV=1` or a `[/]` character class. Composes with `CLAUDE.md` §7: a sweep is a collection gathered by a pattern, so it needs a control that fires before an empty result means anything.

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
**Evidence:** L9a Plan 3 — the file list was wrong five separate times; 11d's `useRecorder` had a consumer under `components/conversation/` on no list, breaking 13 tests; Task 12's `mining-review-session.tsx`, the file holding the owned defect, was absent from its own task's list. · Plan C1 — "check existence before trusting *Modify X*". · Lessons Registry Task 3 — memory sources were cut against a pre-written list of replacement lines; a sentence the classification pass had never assigned a home ("one reviewer called a correction note dishonest for crediting a user ruling that had in fact happened") was deleted outright, invisible to the integrity guard because no id was malformed. Restored `1728eb4`. · Lessons Registry Task 4 — the same plan handed a pre-written stub table for six memory files, assuming full coverage; a classification pass run *before* any cutting found three of them held content with no home anywhere in the registry, and placed it on `L-005`, `L-016`, `L-024` at `f4991ee` before anything was lost. · Screen Registry Phase 2b `a21dd02` (2026-08-14) — the same defect wearing a **scope predicate** instead of a file list, which is harder to catch because a predicate reads as exhaustive. The spec's §5 scoped the whole of `components/jlpt/**` to one row, "every `fetch` to `/api/jlpt/**`", and the plan's File Structure named exactly one file there, "`jlpt-test-runner.tsx` … (the one API caller)". But the directory also held **four in-app `Link` sites** pointing at the route being renamed — `jlpt-attempt-list.tsx:34`, `jlpt-results-panel.tsx:201`, `jlpt-test-card.tsx:44` and `:50` — plus a `LevelTabs basePath="/jlpt"` on the page itself. None is a `fetch`; none appeared in either document; three of the four are template literals (`` href={`/jlpt/${id}`} ``) so a `href="/jlpt"` literal grep finds only one of them (`L-022`). **They were caught by auditing the directory against the plan's list before dispatch, rather than by following that list** — measured, then added to the task as ruling R-4, so `a21dd02` moved all five in the same commit as the route move. Task 7's later G4 sweep only *confirmed* none survived; it did not find them. **A rename plan must enumerate every *kind* of reference — link sites, not just fetch sites — because naming one kind under-scopes exactly like naming the wrong set of files** (`L-013`: the defect was in the spec and the plan, not in the implementer).
**Applies to:** every task scoping step, and every "modify these N files" instruction — and every scope *predicate*, which is a file list with the enumeration hidden. Before cutting any source against a pre-written list, classify every claim in it to a destination first — anything with no destination is an orphan to be placed, never deleted.
**Status:** Promotion review completed 2026-08-13 — **declined** under G6, despite being the highest-frequency entry here. "Audit the dependency graph" has no binary outcome and no bounded depth: nothing in a diff distinguishes an audit that was done from one that was skipped, so as law it would be unenforceable ceremony. Stays a lesson and a standing convention in implementer dispatch briefs, where it is actually actionable. Do not re-open on a further evidence entry alone.

### L-024 — Reconcile the whole dependent system, not just the flagged files

**Rule:** When reconciling against a governance document, audit every file that depends on the same facts — including files a previous pass marked done. **Run the sweep to exhaustion: a sweep that stops at its first hit is a spot fix wearing a sweep's name.**
**Why:** Fixing only the named files leaves latent contradictions that resurface later, which is the confusing state the reconciliation existed to remove.
**Evidence:** `docs/design/` reconciliation (2026-07-29, merged `20d6eed`) — a repo-wide audit found real contradictions in files a prior "Wave 1" had already signed off, turning a 9-file task into a 22-task plan. · Screen Registry Phase 1b `7ba870a` — its own commit message says an L-024 sweep of `navigation-system.md` "found one more" falsehood (`/settings` "does not exist"). It stopped there. The L-012 review of that same wave found **four** surviving claims that `/journal` is a nav row — in the file the sweep was already editing, contradicting the branch's own headline change and a green test in the same range — plus a deleted count re-asserted twelve lines later as "the same 13-of-14 scope, described just above", pointing at text the same commit had removed. · Screen Registry Phase 2a `bf344a4` — the re-review flagged a stale clause ("hide in Phase 2", when A10 had shipped in Phase 1b); **the same sentence** ended "But see the conflict in §4 before acting on the vocab half", also stale, the conflict having been resolved and recorded in that file's own §5. A sweep that stops at the first hit inside a single sentence is the smallest possible instance of this failure — and it was found by re-reading the sentence, not by re-running the grep.
**Applies to:** doc/config reconciliation against any source of truth. Use parallel research/audit agents to keep a widened audit affordable. When a finding names a clause, read the whole sentence and the whole paragraph before calling it fixed.

### L-031 — Assert the relation the spec states, never a stronger one today's data happens to satisfy

**Rule:** When an invariant test is written, check it against the *specification's* wording. If the spec says subset, assert subset. An assertion stronger than the rule it guards is a defect even while it is green.
**Why:** An over-strong invariant is indistinguishable from a correct one until the first legitimate change — and then it fails, blaming honest work. Worse, it sets the incentive: the cheapest way back to green is to falsify the *data* rather than fix the test, and the falsified datum is precisely the one the system exists to keep honest.
**Evidence:** Screen Registry Phase 2a `5c7a6cd` — the G2 guard asserted `expect(unstamped).toEqual(outOfScopeIds)` (set **equality**) where both specs define the survey backlog as `figmaCheckedAt === null` **minus** the out-of-scope cases. Equality declares that backlog permanently empty by decree: the first genuinely un-surveyed route — which Phase 3 registers **by design** — turns the suite red, and the cheapest green is writing a `2026-08-12` stamp for a Figma pass that never happened, the exact dishonesty the "a citation licenses the stamp" rule exists to prevent. Replaced with the permanent subset invariant (every out-of-scope entry is unstamped, the set *derived* from `repoOnlyReason` rather than hardcoded) plus two pins under an explicit "TODAY'S STATE. Not invariants." banner. Mutation-checked both directions: stamping an out-of-scope entry fails at the invariant line; nulling a real entry's stamp moves only the labelled pin, which is the point.
**Applies to:** every invariant test. Ask what legitimate future change the assertion forbids — if the answer is "one the roadmap already plans", it is too strong. Separate permanent invariants from state pins *in the test itself*, and label which is which, so a later reader updates the pin instead of the data.

### L-033 — A sweep must classify each hit as a live reference or a dated record before rewriting it

**Rule:** Before a rename sweep edits a comment, decide which kind of claim it is. A **live reference** ("this calls X", "see file Y") must track the rename. A **dated record** — provenance, decision history, what was true when the text was written — must not: rewriting it into present-tense truth destroys the history it exists to carry.
**Why:** A sweep is driven by a pattern, and a pattern cannot see tense — every hit looks like a reference. The bad edit is invisible to review because it looks exactly like the dozens of correct ones beside it, and the sentence it produces is plausible.
**Evidence:** Screen Registry Phase 2b `dc51d36` — Task 7's route sweep rewrote `messages/en/jlpt.pin.test.ts`'s provenance comment ("copied verbatim from the pre-extraction source of `app/[locale]/(app)/jlpt/page.tsx` … on `layer-9a-string-extraction` before Task 13") to say `app/[locale]/(app)/certification/page.tsx`. That path has **never existed at any commit** — `git log --all --oneline -- 'app/[locale]/(app)/certification/page.tsx'` returns nothing — so it names neither the historical source nor today's path (`app/[locale]/(protected)/(app)/certification/page.tsx`): a dated statement that was true became one false in both directions. · The counter-case, handled correctly on the same branch: the spec's §4 ⛔ block kept `20260731000019_collections.sql:28`'s comment naming `jlpt_tests` as written, "because it describes a naming convention that was true when written". The principle was encoded **for migrations only**, and did not generalise to a characterization test's provenance comment.
**Applies to:** every rename, label, or route sweep. Where a present-day reader would be helped, **append a parenthetical** ("now `<new path>`") rather than overwriting the record — and say in the comment that the list is a dated record, so the next sweep does not re-break it. Note the direction: `L-022`/`L-024` are about a sweep doing too little; this one is about a sweep doing too much.

### L-025 — A nav or label rename must sweep `tests/e2e/` by hand

**Rule:** After renaming any user-visible label, grep `tests/e2e/` for the old string — **and then prove the replacement works**, by running it or by an isolated repro. The sweep is only half the job.
**Why:** `vitest.config.ts:13` excludes `tests/e2e`, so `npm test` **structurally cannot** run Playwright specs. No unit run can catch the break, and none can catch a broken *fix* either — which is the half that gets forgotten, because the replacement looks right on the page.
**Evidence:** Lesson Workspace Plan A `ef564c7` — `tests/e2e/journal.spec.ts` still clicked a link named "Journal" after the nav label became "Journey". · Screen registry Phase 1b `276d0ac` — the sweep found **two** specs, not one, both clicking a nav row the LOCKED IA had just moved. The replacement pointed them at the companion sprite, which is genuinely the right door — but that button carries `companion-breathe`, an infinite `scale(1 → 1.03)`, and Playwright's click actionability waits for a *stable* bounding box. Measured in an isolated repro: 3/3 timeouts at ~8s by default, 63ms with `page.emulateMedia({ reducedMotion: "reduce" })`. Reading the diff could not have found it; the whole-branch review reproduced it.
**Applies to:** every label, route, or role-name rename. Also: any Playwright interaction with an element that animates — an infinite animation is never "stable", so the click never becomes actionable.

---

## Sources of truth

### L-026 — Two silently-disagreeing sources is this project's most expensive failure mode

**Status:** Promoted to `CLAUDE.md` §6 (2026-08-13) — retained here as historical evidence.
**Evidence:** Lesson Workspace Plan A spent an entire plan cleaning up one instance. · `docs/superpowers/specs/2026-08-08-screen-registry-design.md` §7 names it risk 1 and builds R1+R12 to guard it. · This registry exists because the lesson corpus itself had four owners. · Screen Registry Phase 1b — the **resume memory itself** went stale: at branch HEAD `mem:screen_registry_run_state` still listed two rulings as OPEN that the last commit had implemented, and still repeated a scope claim that the same commit had measured false and retracted in `decision-register.md`. `MEMORY.md` names that memory the thing to read first on resume, so merging it would have instructed the next session to re-ask the user for rulings already given. **A handoff document is code for the next session: stale-check it in the same pass that changes what it describes, not in a later one.** · Screen Registry Phase 2a `01eb284`, `bf344a4` — the same memory again, handled a different way: the stale body was left intact as a historical record and a dated correction banner was placed *above* it, naming each superseded section by heading. That form survives review, but only because the banner precedes every false sentence. Its two soft spots are worth copying carefully: the **title** was left stale while `MEMORY.md` indexes the file *by* its title (a label is not a historical record — retitle it), and a retraction that corrects "three routes" to "all four" without naming the fourth leaves the reader to reconcile the mismatch.

### L-032 — A cross-file `path:NN` citation is falsified by the next commit that touches that file

**Rule:** Across files, cite a **symbol** — "`AppNav`'s `t(item.key)` call in `components/layout/app-nav.tsx`" — never `path:line`. Keep line numbers for citations *inside the same file as the text*, where anything that moves the target shows up in the same diff. When a drifted citation is found, re-anchor it to a symbol; bumping the number only restarts the same clock.
**Why:** A cross-file line number is a fact copied out of a file that has no idea it was copied — `CLAUDE.md` §6 in miniature, and the file always wins. Task N writes it correctly; task N+k adds a line above it and falsifies it. **Neither per-task review can see this**: N's review checked a citation that was true at the time, and N+k's review is reading an unrelated edit in a different file. The branch manufactures the defect on its own, with no author to attribute it to.
**Evidence:** Screen Registry Phase 2b — Task 5 (`981ee03`) wrote, in `messages/nav-certification.pin.test.ts`, "`AppNav` renders each item as `t(item.key)` (components/layout/app-nav.tsx:91)", which was correct at that commit. Task 7 (`dc51d36`) added one line to that file's header comment, and at `dc51d36` line 91 is `tests. */}` while the call has moved to line 92. Both per-task reviews passed. Caught only by the whole-branch review (`L-011`) and fixed by citing the symbol. · The same disease *inside a fix wave* is already recorded on `L-012`: Phase 2a's wave left the single live line-citation it existed to fix pointing ~29 lines off target, moved by its own `+21` lines.
**Applies to:** comments, specs, plans, memories, review findings, commit messages — anywhere a citation must outlive the commit that wrote it.

### L-030 — An observation and a decision are different axes; a field name must not blur them

**Rule:** A data field records what was *observed*. Whether something is *decided* — and whether it is work — is a separate axis with a separate owner. Never let a field, an enum member, or a null double as work-list membership.
**Why:** Once a field name implies a backlog, every reader infers a decision the data never made, and the inference is invisible because the field is accurate on its own axis. The error compounds: a survey gap gets read as an open question, someone "closes" it by inventing a ruling, and now a fabricated decision is cited as precedent.
**Evidence:** Screen Registry Phase 2a — `repoOnlyReason: 'legacy-unreviewed'` was read across specs, plans and memories as "named and countable Phase 2 debt", when all it ever recorded was *no frame at the last Figma pass*. Renamed to `no-frame-at-last-pass` at `b67796d`. Of the 23 entries so labelled, **21 were never debt** — 14 already governed by a ruling, 7 sub-routes inheriting a ruled parent. · The same leak then recurred *inside the wave written to close it* (`01eb284`): the headline count licensed `/register` as already-ruled by citing "Figma has `Login` but no register frame" — frame evidence, not a ruling. Nothing in `decision-register.md` rules on `/register`; **recording that no ruling exists was the honest outcome**, and inventing one would have been the defect. · User ruling 2026-08-13 locked the split: the registry generates a **survey** backlog only (`figmaCheckedAt === null`, minus the permanently-out-of-scope cases); the **decision** backlog is not derivable from the registry and is owned by `decision-register.md`.
**Applies to:** enum members, nullable columns, and any field whose name contains a judgement word. Name the observation, not the conclusion you expect to draw from it.

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
