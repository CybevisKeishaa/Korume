# Lessons Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give this project's operational lessons one canonical home — `docs/lessons.md`, one entry per lesson under a stable `L-NNN` id — and cut every duplicate restatement down to a pointer.

**Architecture:** A hand-classified markdown registry, a Vitest integrity guard that resolves every `L-NNN` reference in `git ls-files` against a defined entry, and two `CLAUDE.md` contracts — §10 for reading, §9 Definition of Done for writing. No product code, no message catalog, no route is touched.

**Tech Stack:** Markdown · TypeScript · Vitest (`vitest.config.ts` already globs `**/*.test.{ts,tsx}`) · `git ls-files` via `node:child_process`.

**Spec:** `docs/superpowers/specs/2026-08-08-lessons-registry-design.md` (approved 2026-08-08, amended at `75ddbd0`). Decisions are cited as **G1**–**G10** throughout.

## Global Constraints

- **Process lessons only (G1).** Technical gotchas about this codebase (GRANTs, Azure audio format, `cn()` + twMerge, dark-only tokens) stay in `mem:project_status` § Key gotchas. Do not migrate them.
- **Cut, never copy (G2).** After migration no source may hold a lesson body that also lives in `docs/lessons.md`. A source keeps a pointer only.
- **Evidence must be an openable artifact (G4):** a commit sha, a spec/plan path, or a dated incident. Never "this has happened several times".
- **Merge, don't append (G5).** A variant of an existing lesson becomes another `Evidence` entry, never a new `L-NNN`.
- **Never record a derived count.** No "3rd consecutive plan", no commit counts, no test tallies inside the lessons file. Evidence-list length carries that information and cannot go stale.
- **Ids are never reused or renumbered.** A retired lesson keeps its id and gains a `Status:` line.
- **Lesson count is never a target (G8).** This plan defines **28** entries — measured after full classification, above the spec's pre-reading estimate of 22–26. Do not trim to hit a number and do not split to inflate one.
- **Do not promote anything to `CLAUDE.md` law in this work** (spec §7). `L-011` will qualify for a promotion *review* under **G6** on day one; record it as a candidate and stop there.
- **Do not edit already-committed specs or plans to insert pointers** (spec §7). The one exception is Task 1 Step 6, which repairs this work's own spec so its forward-reference matches final numbering.
- Verification commands: `npx tsc --noEmit` · `npm run lint` (**never** `npx eslint` — see `L-018`) · `npx vitest run`.
- Lint baseline to compare against: **0 errors, 77 warnings**, mix `54 no-non-null-assertion + 23 no-unused-vars`. "Clean" means 0 new; compare the **mix**, not the total.

---

## File Structure

| File | Created / Modified | Responsibility |
|---|---|---|
| `docs/lessons.md` | Create | The registry. Four lesson-entry rules, seven navigation groups, 28 entries. Sole owner of lesson text. |
| `docs/lessons.test.ts` | Create | Integrity guard I1 + I2. Sole owner of the `L-NNN` invariant. Placed beside the artifact it guards, matching `components/ui/token-scale.test.ts`. |
| `CLAUDE.md` | Modify | New §10 (read contract); one new line in §9 (write contract). |
| `.serena/memories/project_status.md` | Modify | Two "Lessons worth carrying" blocks → pointer lines. §Key gotchas untouched. |
| `.serena/memories/shadowing_hub_plan_c_run_state.md` | Modify | "Standing lessons from this run" → pointer line. |
| `.serena/memories/l9a_localization_run_state.md` | Modify | STANDING CONVENTIONS #1/#2/#3 → pointers; #6 split; #4/#5 kept whole. |
| `.serena/memories/project_status_archive.md` | Modify | Two inline sentences → pointers. Surrounding review record left intact. |
| `<auto-memory>/feedback-*.md` (6 files, **outside the repo**) | Modify | Reduced to 2-line pointer stubs. No test covers these (spec §4.2). |

**Task order is fixed by spec §5.5** and must not be rearranged: registry → guard → cut sources → contracts → verify. Cutting a source before the guard exists means one mistyped id silently destroys a lesson whose original was just deleted.

---

## Task 1: Create the registry

**Files:**
- Create: `docs/lessons.md`
- Modify: `docs/superpowers/specs/2026-08-08-lessons-registry-design.md` (two `L-014` references → `L-004`)

**Interfaces:**
- Consumes: nothing.
- Produces: 28 heading ids `L-001`…`L-028`, each matching `^### (L-\d{3}) — ` exactly. Task 2's `HEADING_PATTERN` parses this literal shape — em dash `—` with a single space either side. Task 3, 4 and 6 reference these ids.

- [ ] **Step 1: Create `docs/lessons.md` with the header and the four lesson-entry rules**

```markdown
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
```

- [ ] **Step 2: Append groups 1–3 (`L-001`–`L-014`)**

```markdown
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
```

- [ ] **Step 3: Append groups 4–5 (`L-015`–`L-021`)**

```markdown
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
```

- [ ] **Step 4: Append groups 6–7 (`L-022`–`L-028`)**

```markdown
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
```

- [ ] **Step 5: Verify the file parses as the guard will parse it**

Run:

```bash
grep -cE "^### L-[0-9]{3} — " docs/lessons.md
grep -ohE "^### (L-[0-9]{3})" docs/lessons.md | sort | uniq -d
```

Expected: first command prints `28`; second prints nothing (no duplicate ids).

- [ ] **Step 6: Repair this work's own spec so its forward-reference matches final numbering**

The spec was written before ids were assigned and uses `L-014` as its example of the mutation-check lesson, which is now `L-004`. Leaving it would make the guard pass while the pointer lies.

In `docs/superpowers/specs/2026-08-08-lessons-registry-design.md` replace both occurrences:
- §3.2, the example entry heading `### L-014 — An assertion nobody has seen fail is not yet a test` → `### L-004 — …`
- §4.1, `would be the system's own first violation (L-014)` → `(L-004)`

Then confirm no other stale reference exists:

```bash
grep -rn "L-014" docs/superpowers/specs/2026-08-08-lessons-registry-design.md
```

Expected: no output.

> This is the single permitted exception to the "do not edit committed specs" constraint, and only because it is this work's own spec and the reference would otherwise be wrong. Do **not** touch any other spec.

- [ ] **Step 7: Commit**

```bash
git add docs/lessons.md docs/superpowers/specs/2026-08-08-lessons-registry-design.md
git commit -m "docs(lessons): create the registry with 28 classified entries

Sources still intact — nothing is cut until the integrity guard exists.
Merges the whole-branch-review lesson from three files into one entry with
four evidence entries, dropping all three derived counts.

Renumbers the spec's own forward reference from L-014 to L-004 so the
example points at the lesson it describes."
```

---

## Task 2: The integrity guard

**Files:**
- Create: `docs/lessons.test.ts`

**Interfaces:**
- Consumes: the `^### (L-\d{3}) — ` heading shape produced by Task 1.
- Produces: nothing importable. This is a guard, not a module.

- [ ] **Step 1: Write the test**

```ts
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "..");
const LESSONS_PATH = path.join(REPO_ROOT, "docs", "lessons.md");

/** Every reference to a lesson, anywhere. */
const REFERENCE_PATTERN = /\bL-\d{3}\b/g;
/** A lesson *definition*. Only headings define ids. */
const HEADING_PATTERN = /^### (L-\d{3}) — /gm;

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".pdf", ".blend", ".blend1", ".mp3", ".wav", ".webm", ".mp4",
]);

/**
 * Scan source is `git ls-files`, not a directory glob (spec G10). Git already
 * answers "which files belong to this repo", so no exclusion list is needed
 * and gitignored paths — node_modules, .next, .worktrees, .superpowers — are
 * excluded for free.
 */
function trackedTextFiles(): string[] {
  const stdout = execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout
    .split("\0")
    .filter(Boolean)
    .filter((file) => !BINARY_EXTENSIONS.has(path.extname(file).toLowerCase()));
}

function definedIds(): string[] {
  const source = readFileSync(LESSONS_PATH, "utf8");
  return [...source.matchAll(HEADING_PATTERN)].map((match) => match[1]);
}

describe("lessons registry integrity", () => {
  it("I1: every L-NNN reference in a tracked file resolves to a defined lesson", () => {
    const defined = new Set(definedIds());
    const dangling: string[] = [];

    for (const file of trackedTextFiles()) {
      let contents: string;
      try {
        contents = readFileSync(path.join(REPO_ROOT, file), "utf8");
      } catch {
        continue; // unreadable or deleted-but-staged; not this guard's concern
      }
      for (const [id] of contents.matchAll(REFERENCE_PATTERN)) {
        if (!defined.has(id)) dangling.push(`${file}: ${id}`);
      }
    }

    expect(dangling).toEqual([]);
  });

  it("I2: every lesson id is defined exactly once", () => {
    const ids = definedIds();
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

    expect(duplicates).toEqual([]);
    expect(ids.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it — expect PASS**

Run: `npx vitest run docs/lessons.test.ts`
Expected: 2 passed. The registry is valid, so a green result here is the baseline — **not** yet evidence the test works (`L-004`).

- [ ] **Step 3: Mutation-check I1 — prove it can go red**

Add a dangling reference to a tracked file. **The id is assembled by `printf` on purpose** — writing the
literal into this plan would put an unresolvable id into a tracked file and make I1 fail forever, since
this plan is itself inside the scan:

```bash
printf '\n<!-- mutation check: L-%s -->\n' 999 >> docs/lessons.md
npx vitest run docs/lessons.test.ts
```

Expected: **I1 FAILS**, naming `docs/lessons.md` and the injected id. Then restore:

```bash
git checkout -- docs/lessons.md
npx vitest run docs/lessons.test.ts
```

Expected: 2 passed.

- [ ] **Step 4: Mutation-check I2 — prove it can go red**

Duplicate a heading:

```bash
printf '\n### L-001 — duplicate for mutation check\n' >> docs/lessons.md
npx vitest run docs/lessons.test.ts
```

Expected: **I2 FAILS**, reporting duplicate `L-001`. (I1 still passes — `L-001` resolves.) Then restore:

```bash
git checkout -- docs/lessons.md
npx vitest run docs/lessons.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Record both mutation outcomes in the task report**

Paste the real failure output for I1 and I2, and the restored green run. A mutation check that is claimed but not shown is exactly what `L-004` exists to prevent.

- [ ] **Step 6: Commit**

```bash
git add docs/lessons.test.ts
git commit -m "test(lessons): guard L-NNN reference integrity, mutation-checked

I1 resolves every L-NNN in git ls-files against a defined entry; I2 pins
id uniqueness. Scan source is git ls-files so no exclusion list exists to
drift. Both assertions were driven red before being trusted."
```

---

## Task 3: Cut the serena memory sources to pointers

**Files:**
- Modify: `.serena/memories/project_status.md`
- Modify: `.serena/memories/shadowing_hub_plan_c_run_state.md`
- Modify: `.serena/memories/l9a_localization_run_state.md`
- Modify: `.serena/memories/project_status_archive.md`

**Interfaces:**
- Consumes: ids `L-001`–`L-028` from Task 1; the guard from Task 2 now protects every pointer written here.
- Produces: nothing importable.

- [ ] **Step 1: `project_status.md` — replace the two "Lessons worth carrying" blocks**

Delete the block bodies (the one under `### Lessons worth carrying` for the screen-port workflow, and the one under `### Lessons worth carrying (the SDD ledger is deleted; …)` for the token foundation). Replace each heading and body with a single line.

For the screen-port workflow block:

```markdown
### Lessons worth carrying
Migrated to `docs/lessons.md`: L-003, L-010, L-011, L-012, L-013, L-018.
```

For the token foundation block:

```markdown
### Lessons worth carrying (the SDD ledger is deleted; these are the parts that generalise)
Migrated to `docs/lessons.md`: L-003, L-011, L-020, L-021, L-022.
```

**Do not touch `## Key gotchas learned`** (G1) — technical gotchas stay. The two font findings that lived in the token block ("width comparison cannot detect CJK fallback", "the 5-font payload fear did not materialise") are **not** lessons: the first is already recorded in the § Stack section, and the second is a spent finding. Leave both where they are; migrate neither.

- [ ] **Step 2: `shadowing_hub_plan_c_run_state.md` — replace "Standing lessons from this run"**

Replace the eight numbered items under `## Standing lessons from this run` with:

```markdown
## Standing lessons from this run
Migrated to `docs/lessons.md`: L-001, L-004, L-005, L-006, L-009, L-017, L-019, L-023.
```

- [ ] **Step 2b: same file — the `## ⚠️ Corrections` block also carries lesson bodies**

This file states lessons in **two** places, and cutting only the "Standing lessons" block would leave the
duplicate that this work exists to remove (**G2**). The `Corrections` block near the top spells out two
lessons in full:

- **Correction 1** carries `L-002` — *"A commit count is structurally self-invalidating… record
  `git rev-list --count <base>..HEAD` instead of its output."*
- **Correction 3** carries `L-027` — *"Copy must be committed BEFORE the pins that characterize it."*

Apply the §5.1 classification **within each correction**: the factual record of what this file got wrong
is run state and **stays**; the generalized rule points. So keep each correction's opening statement of
the error and replace only its trailing rule sentence:

- Correction 1: keep *"It said '23 commits off master'. Never measured…"* through the description of what
  actually happened; replace the generalizing rule sentences with `Rule: docs/lessons.md L-002.`
- Correction 3: keep *"It said 'never commit anything under `messages/`'. That rule's premise expired…"*
  and the `60abdef` fact; replace the closing rule sentence with `Rule: docs/lessons.md L-027.`

Correction 2 ("Task 11 is blocked") is pure run state — leave it untouched.

- [ ] **Step 3: `l9a_localization_run_state.md` — split the STANDING CONVENTIONS block**

Under `## ⭐⭐ STANDING CONVENTIONS`:
- Replace items **#1**, **#2**, **#3** with pointers — they are now `L-007`, `L-023`, `L-008` respectively.
- Leave **#4** and **#5** whole. #4's rule is about product code (server diagnostics reaching the DOM), not process, so it is out of scope by **G1**; #5 is a Task-19 gate criterion, i.e. run state.
- **Split #6**: its general triage rule is now `L-014`; keep only its run-scoped application.

Resulting shape:

```markdown
1. Report mutation testing in TWO LAYERS, never one number → `docs/lessons.md` L-007.
2. Audit scope from the DEPENDENCY GRAPH, not the plan → `docs/lessons.md` L-023.
3. Swap-proof render assertions for TYPE-INTERCHANGEABLE values → `docs/lessons.md` L-008.
```

…with #4 and #5 left exactly as they are, and #6 reduced to:

```markdown
6. **Proportionality/triage — the general rule is `docs/lessons.md` L-014.** Run-scoped application:
   Task 12's two trivial `mining` `<h1>`/link key swaps are carried to the Task 19 audit, not fixed
   in-task.
```

- [ ] **Step 4: `project_status_archive.md` — replace two inline sentences**

This file has **no lessons block**. Two sentences move:

- Line ~31, `Third plan running where this is true; treat the final review as mandatory.` → replace with `See docs/lessons.md L-011.` Leave the surrounding "1 Critical + 4 Important" review record intact — that is history, not a lesson.
- Line ~35, `**Lesson: any nav/label rename must sweep tests/e2e/ by hand.** T1 remembered to; T3 did not.` → replace with `See docs/lessons.md L-025. T1 remembered to; T3 did not.`

- [ ] **Step 5: Verify no lesson body survives in two places**

```bash
grep -rn "assertion nobody has seen fail\|models no RLS\|npx rg is NOT ripgrep\|earned its keep" .serena/memories/
grep -rn "structurally self-invalidating\|BEFORE the pins that characterize" .serena/memories/
```

Expected: no output from either. Any hit is a body that was pointed at but not cut (**G2**). The second
command exists because this failure mode already happened once while writing this plan: Task 3's first
draft cut the `Standing lessons` block of `shadowing_hub_plan_c_run_state.md` and left the same two
lessons written out in full in its `Corrections` block a hundred lines above. **One block per file is an
assumption, not a fact** — the same reasoning as `L-023`.

- [ ] **Step 6: Run the guard — every pointer just written must resolve**

Run: `npx vitest run docs/lessons.test.ts`
Expected: 2 passed. A typo in any id written in steps 1–4 fails I1 here, which is the whole reason this task runs after Task 2.

- [ ] **Step 7: Commit**

```bash
git add .serena/memories/
git commit -m "docs(memory): cut migrated lesson bodies down to L-NNN pointers

project_status keeps § Key gotchas untouched (process lessons only).
l9a standing conventions #4 and #5 stay whole as run state; #6 splits into
its general rule (L-014) and its Task-19 application. project_status_archive
had no lessons block — two inline sentences moved, review record intact."
```

---

## Task 4: Reduce the auto-memory files to stubs

**Files:**
- Modify (6, **outside the repo**, at `C:\Users\tplon\.claude\projects\C--Users-tplon-Documents-GitHub-JPWeb-japan-web\memory\`):
  `feedback-mutation-check-assertions.md` · `feedback-never-record-derived-counts.md` · `feedback-repo-wide-consistency-audits.md` · `feedback-rls-invisible-to-mocked-tests.md` · `feedback-verify-subagent-claims.md` · `feedback-worktree-subagent-dispatch.md`
- Modify: `MEMORY.md` in the same directory (index lines)

**Interfaces:**
- Consumes: ids from Task 1.
- Produces: nothing. **No test covers this task** (spec §4.2) — these files are outside `git ls-files`. Verification here is by reading, not by running.

- [ ] **Step 1: Rewrite each file body as a pointer, keeping its frontmatter**

Keep the YAML frontmatter exactly as-is — `description` is what auto-recall matches on, and deleting the file would remove the recall trigger entirely (spec §5.4). Replace only the body.

The stub must be a **pointer, not a summary**. A restated rule is a second wording that drifts, at the one place no test can see it.

| File | New body |
|---|---|
| `feedback-mutation-check-assertions.md` | `Canonical: docs/lessons.md L-004 — "An assertion nobody has seen fail is not yet a test".` |
| `feedback-never-record-derived-counts.md` | `Canonical: docs/lessons.md L-002 (record the command, not the number) and L-015 (never seed a subagent with an unmeasured figure).` |
| `feedback-repo-wide-consistency-audits.md` | `Canonical: docs/lessons.md L-024 — "Reconcile the whole dependent system, not just the flagged files".` |
| `feedback-rls-invisible-to-mocked-tests.md` | `Canonical: docs/lessons.md L-005 — "The Supabase mock models no RLS".` |
| `feedback-verify-subagent-claims.md` | `Canonical: docs/lessons.md L-003 — "Re-derive load-bearing claims yourself, whoever made them".` |
| `feedback-worktree-subagent-dispatch.md` | `Canonical: docs/lessons.md L-016 (controller verification is the safety net), L-020 (a worktree has no .env.local), L-021 (EnterWorktree branches from origin).` |

Each body is one line plus the existing `Related:` wiki-links, which stay — they are navigation between memories, not lesson text.

- [ ] **Step 2: Update the six `MEMORY.md` index lines**

Each line's hook becomes a pointer rather than a restatement. Example:

```markdown
- [Mutation-check every assertion](feedback-mutation-check-assertions.md) — canonical text is docs/lessons.md L-004.
```

- [ ] **Step 3: Verify by reading, and state the limit plainly**

Re-read all six files and confirm no rule text survives beside the pointer. There is no automated check here and the plan does not pretend otherwise (spec §4.2) — say so in the task report rather than implying coverage.

- [ ] **Step 4: No commit**

These files are outside the repository. Nothing to stage. Note in the report that this task produced no commit **by design**, so a reviewer does not read the absence as a skipped task.

---

## Task 5: The two `CLAUDE.md` contracts

**Files:**
- Modify: `CLAUDE.md` (append §10; add one line to §9)

**Interfaces:**
- Consumes: `docs/lessons.md` existing at its path.
- Produces: the read and write contracts every future session and branch obeys.

- [ ] **Step 1: Append §10 after §9**

```markdown
---

## 10. Operational lessons

`docs/lessons.md` is the single source of truth for lessons this project has already paid for.
Every lesson lives there once, under a stable `L-NNN` id. Everywhere else references the id;
nothing restates the rule.

**Read it before:** writing a spec or a plan · dispatching a subagent · running a completion
gate or claiming work done · reading back a subagent's or a reviewer's report.

**Write to it at the end of every branch** — in place of a "lessons" block anywhere else.

CLAUDE.md holds **law**: breaking a rule here is a defect. `docs/lessons.md` holds **experience**:
ignoring it costs time. A lesson promoted to law moves here and leaves a pointer behind.
```

- [ ] **Step 2: Add the write contract to §9 Definition of Done**

Append as the final checkbox of the §9 list:

```markdown
- [ ] Lessons from this work recorded in `docs/lessons.md` per its four lesson-entry rules — merged
      into an existing entry where one applies, not appended as a new one
```

- [ ] **Step 3: Confirm no lesson text was copied into `CLAUDE.md`**

```bash
grep -nE "assertion nobody|models no RLS|kill .3000|npx rg" CLAUDE.md
```

Expected: no output. §10 points; it must not summarise (**G7**, spec §6.3). `CLAUDE.md` must never become a cache of `docs/lessons.md`.

- [ ] **Step 4: Run the guard**

Run: `npx vitest run docs/lessons.test.ts`
Expected: 2 passed. `CLAUDE.md` is tracked, so any id typed into it is now covered by I1.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): add the lessons read contract (§10) and write contract (§9)

§10 names four concrete moments to read, because 'consult when relevant'
is dead text. §9 redirects the end-of-branch write-up away from status
prose, which is the habit that produced the duplication in the first place.
No lesson text is restated here — §10 points only."
```

---

## Task 6: Full verification and status update

**Files:**
- Modify: `.serena/memories/project_status.md` (NEXT ACTION block)

**Interfaces:**
- Consumes: everything above.
- Produces: the recorded state the next session reads first.

- [ ] **Step 1: Run the full gate**

```bash
npx tsc --noEmit
npm run lint
npx vitest run --reporter=json --outputFile=../lessons-run.json
```

Expected: `tsc` 0 errors · lint 0 errors and 77 warnings with mix `54 no-non-null-assertion + 23 no-unused-vars` · unit suite green with **file count up by exactly 1** versus the pre-branch baseline.

Read the JSON, do not grep stdout — grepping stdout once lost a failing test's name for good.

- [ ] **Step 2: Confirm the migration actually reduced duplication**

This is acceptance criterion 3, and it is the pass/fail test of the design itself (spec §5.2).

```bash
grep -rn "earned its keep\|Third plan running" .serena/memories/ CLAUDE.md
grep -c "^### L-" docs/lessons.md
```

Expected: first command returns nothing outside `docs/lessons.md`; second prints `28`. If duplication did not fall, the design failed and that must be reported, not smoothed over.

- [ ] **Step 3: Update the NEXT ACTION block in `project_status.md`**

Record: the registry exists at `docs/lessons.md` with the guard at `docs/lessons.test.ts`; `CLAUDE.md` §10 and §9 now carry the read and write contracts; `L-011` is the first promotion candidate under lesson-entry rule 3, deliberately not promoted. Restore the previous NEXT ACTION (Screen Registry Phase 1) as the next action.

**Write the verify command, not its output** (`L-002`). Do not record an entry count as a durable fact — `grep -c "^### L-" docs/lessons.md` is the fact.

- [ ] **Step 4: Commit**

```bash
git add .serena/memories/project_status.md
git commit -m "docs(memory): record the lessons registry, and restore the next action

L-011 qualifies for a promotion review on day one (four evidence entries)
and is deliberately not promoted — promotion is out of scope for this work."
```

---

## Self-Review

**Spec coverage.** G1 → Task 3 Step 1 and Task 1 scope. G2 → Task 3 Step 5, Task 5 Step 3. G3 → the seven group headings in Task 1. G4 → every entry carries `Evidence`. G5 → `L-011`'s four evidence entries and `L-003`/`L-023`'s merges. G6 → `L-011`'s `Status:` line plus the Global Constraint deferring promotion. G7 → Task 5 Step 3. G8 → the Global Constraint recording 28 without treating it as a target. G9 → Task 5 Steps 1–2, kept independent, with no "I read it" checkbox. G10 → Task 2 Step 1's `trackedTextFiles()`. Spec §4.2 → Task 4 Step 3 and Step 4. Spec §5.5 order → the File Structure note and task order.

**Placeholder scan.** No "TBD", no "similar to Task N", no "add appropriate handling". Every entry body, the full test source, every replacement line, and every command is written out. Task 4's six stub bodies are given as literal strings.

**Type consistency.** `HEADING_PATTERN` in Task 2 matches the heading shape Task 1 produces, em dash included — this is the one coupling that would silently pass I2 while defining zero ids, which is why I2 also asserts `ids.length > 0`. Ids referenced in Tasks 3–6 are all defined in Task 1: `L-001`–`L-028`, no gaps.

**Two defects this self-review caught, recorded because both are instances of lessons in the registry itself.**

1. **The plan broke its own guard.** Task 2's mutation check originally wrote a literal unresolvable id into this plan. This plan is a tracked file, so I1 scans it — the guard would have failed permanently the moment it was written, on the plan that defines it. Fixed by assembling the id with `printf` so no literal appears. Instance of `L-013`: the defect originated in the plan, not in any implementer.
2. **Task 3 cut one block per file and missed a second.** `shadowing_hub_plan_c_run_state.md` states `L-002` and `L-027` in full inside its `Corrections` block, a hundred lines above the `Standing lessons` block the task was cutting. Pointing at one while leaving the other would have shipped exactly the duplication this work removes. Fixed by Step 2b, and Step 5 now greps for both bodies. Instance of `L-023`: audit the artifact, not the list you were handed.

**Verification of this plan's own id integrity.** `grep -ohE "^### L-[0-9]{3}"` yields 28 unique definitions; every distinct `L-NNN` mentioned anywhere in the plan is one of those 28; the set difference is empty. Measured 2026-08-08.

**One known gap, stated rather than hidden.** Task 1 Step 6 edits an already-committed spec, which the Global Constraints otherwise forbid. It is scoped to this work's own spec and to a reference that would otherwise be wrong. No other spec is touched.

**One residual risk with no mitigation.** Task 4's six stubs sit outside the repository and no test reaches them (spec §4.2). If a future edit restores a rule body there, nothing will notice. Accepted at design time; recorded here so a reviewer does not mistake silence for coverage.
