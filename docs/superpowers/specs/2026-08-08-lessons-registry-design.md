# Lessons Registry (`docs/lessons.md`) — design

> **Status:** design approved 2026-08-08.
> **Depends on:** nothing. Touches no product code and no message catalog. Can run alongside or before
> Screen Registry Phase 1.

**One-sentence definition, and the load-bearing constraint of this whole document:**

> **`docs/lessons.md` is the single canonical home for this project's operational lessons — how to
> verify, dispatch, audit, and not fool ourselves. Every lesson exists there exactly once under a
> stable `L-NNN` id; every other artifact references the id and restates nothing.**

---

## 1. Why now

Operational lessons are currently written down in four places, none of which owns them:

| Where | In git? | What it holds |
|---|---|---|
| `CLAUDE.md` §2/§6/§7/§9 | ✅ | Law — non-negotiables, conventions, Definition of Done |
| `.serena/memories/*.md` | ✅ | "Lessons worth carrying" ×2, "Standing lessons", "STANDING CONVENTIONS", "Key gotchas learned" |
| `C:\Users\<user>\.claude\projects\…\memory\feedback-*.md` | ❌ **outside the repo** | 6 distilled process lessons |
| `docs/superpowers/specs\|plans/**` | ✅ | Lessons embedded in execution addenda |

Measured total: roughly **45 lesson-shaped items**.

### 1.1 The defect is duplication, not absence

The lessons are written down. They are written down **repeatedly**, in different words each time.

Measuring this needs a distinction that a raw grep does not make. `grep -ril "mutation"` hits 9 tracked
files, but they are not 9 duplications:

- **Restated as a standing rule** — 4 `.serena/memories` files, 1 auto-memory file, and
  `2026-08-08-screen-registry-design.md` §4.1, which spells the rule out inline. **These are the
  duplication**, and they are what migration removes.
- **Applied as a task step** — `2026-07-17`, `2026-07-18` and `2026-07-24` plans, which instruct a
  specific task to run mutations. Two of them already cite the source (`mem:l9a_localization_run_state`,
  "standing convention #1"). **This is correct usage and stays**; a spec applying a lesson is not a copy
  of it.

So the corpus is already doing the right thing in the plans, and the wrong thing in the memories. The
same split holds for `verify subagent claims` and `one grep is never an audit`.

The sharpest instance is inside a single file. `.serena/memories/project_status.md` contains, 43 lines
apart:

- line 156: *"The final whole-branch review earned its keep for the **5th** consecutive plan"*
- line 199: *"The final whole-branch review earned its keep for the **4th** consecutive plan"*

One lesson, written twice, each carrying a **derived count** — the exact practice this project already
banned (`mem:feedback-never-record-derived-counts`). The lesson corpus is violating its own lessons.

This is also the failure mode this project has recorded as its most expensive: two silently-disagreeing
sources of truth. Plan A spent an entire plan cleaning one up; Screen Registry §7 risk 1 names it again.

### 1.2 Why a status file is the wrong home

Lessons currently live inside `project_status.md`, which is a **status** document. When a new NEXT ACTION
arrives, the old block is folded into `<details>` and eventually moved to `project_status_archive.md`.
The screen-port workflow's "Lessons worth carrying" block is already inside a `(superseded)` section.

The text survives; the standing changes. But a lesson does not expire when the plan that produced it
finishes — that is the entire point of calling it a lesson. Coupling a permanent artifact to a
transient one guarantees the permanent one decays.

---

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| **G1** | `docs/lessons.md` holds **process lessons only** — how we work. Technical gotchas about this codebase (GRANTs, Azure audio format, `cn()` + twMerge, dark-only tokens) stay in `project_status` § Key gotchas. | The two have different lifetimes. A process lesson survives any code change; a technical gotcha is falsified by the commit that fixes it. One file cannot carry one staleness policy for both. |
| **G2** | Migration **cuts the original**, replacing it with an id pointer. No source keeps a second copy. | Anything less produces a fifth source. The goal is not "one more place to look" — it is *one* place to look. |
| **G3** | Grouping is **navigation, not taxonomy**. A lesson sitting between two groups picks one; no new group is created to classify it prettily. | Category proliferation is how an index becomes a bureaucracy. Groups exist so a human can find an entry, nothing more. |
| **G4** | `Evidence` is a **required field** and must point at an artifact someone can open: a commit sha, a plan/spec path, or a dated incident. "This has happened several times" is not evidence. | Unfalsifiable evidence is opinion wearing a citation. A linkable artifact also lets a future reader judge whether the lesson still applies. |
| **G5** | **Merge, don't append.** When a new lesson turns out to be a variant of an existing entry, it becomes another `Evidence` line on that entry — never a new entry. | This is the anti-bloat mechanism. The file then grows by **evidence**, not by **entry count**, and an entry with five evidence lines self-identifies as the most expensive lesson without anyone maintaining a ranking. |
| **G6** | **≥3 evidence lines triggers a promotion *review*, never an automatic promotion.** Promotion to `CLAUDE.md` is granted only when the lesson can be restated as a checkable invariant. | Without this, a lesson that coincidentally recurs three times is pushed into law before it is general enough to be law. The threshold measures *frequency*; promotion requires *generality*. |
| **G7** | After promotion the entry keeps **no copy of the rule** — only `**Status:** Promoted to CLAUDE.md §X — retained here as historical evidence.` | History is worth keeping; a second copy of the rule is not. This is G2 applied to `CLAUDE.md` itself. |
| **G8** | **Lesson count is never a target.** Sixty genuinely distinct lessons is correct. Thirty entries that are five variants of five lessons is a defect. | A count target incentivises the wrong edit in both directions — suppressing real lessons to stay under it, or splitting one lesson to look thorough. The invariant is *one lesson, one place, one wording*; the count is whatever that yields. |
| **G9** | `CLAUDE.md` §10 is the **read contract**; `CLAUDE.md` §9 (Definition of Done) is the **write contract**. They stay independent, and **no "I read the lessons" checkbox is added to the DoD**. | A read cannot be evidenced by a checkbox, so such a checkbox is ceremony — it costs attention and proves nothing. A write can be evidenced: the diff either touches `docs/lessons.md` or it does not. |
| **G10** | The integrity test scans **`git ls-files`**, not a directory glob, and defines **no exclusion list**. | Git already answers "which files belong to this repo", and it is already maintained. A hand-written list of `node_modules`, `.next`, `.worktrees`, `.superpowers` would be a second source of truth about repo membership — the precise thing this spec exists to eliminate. |

---

## 3. The file

### 3.1 Location

`docs/lessons.md`. Plural, and under `docs/` alongside the other governance documents
(`docs/design/README.md` establishes that placement). The repo root already carries six markdown files;
this one is not more load-bearing than `CLAUDE.md`, which is the only governance file that must be at
the root because the harness injects it.

### 3.2 Entry shape

Fixed, and capped at roughly six lines. Longer than that means two lessons wearing one id.

```markdown
### L-014 — An assertion nobody has seen fail is not yet a test

**Rule:** Delete the thing the assertion protects, watch the test go red, restore it.
**Why:** Three separate rounds of Plan C1 shipped assertions that could not go red while the suite stayed green.
**Evidence:** Plan C1 `bd7f574` (2026-08-08) · L9a Plan 3 Task 11c — blended mutation score 0 while the RTL-only pass was 5.
**Applies to:** every new test; the enforcement section of any registry or guard spec.
```

Field meanings, fixed:

- `L-NNN` — stable id. Never renumbered. A retired lesson keeps its id and gains a `Status` line.
- `Rule` — the thing to do, imperative.
- `Why` — the mechanism that makes the rule necessary. Not a restatement of the rule.
- `Evidence` — a `·`-separated list of openable artifacts (G4). **This is the list that grows** (G5).
- `Applies to` — when this fires. What makes the rule reachable instead of merely true.
- `Status` — present only on promoted or retired entries (G7).

### 3.3 Groups

Seven, derived from the ~45 measured items. Navigation only (G3):

1. **Verification & evidence** — measuring, and what does not count as measurement.
2. **Testing discipline** — what makes a test a test.
3. **Plans & specs** — defects that originate upstream of any implementer.
4. **Subagent dispatch** — briefing, and reading results back.
5. **Environment & tooling** — the local traps that impersonate code regressions.
6. **Auditing & search** — how a sweep misses things.
7. **Sources of truth** — duplication, derived facts, and ordering of record-keeping.

### 3.4 The four rules, stated in the file itself

`docs/lessons.md` opens with a short `## Rules` section carrying G4, G5, G6+G7, and G8 in the imperative.
They govern edits to the file, so they belong in it — the spec is not consulted at edit time.

---

## 4. Enforcement

| Pair | Mechanism | Automated? |
|---|---|---|
| id reference ↔ entry (tracked files) | test | ✅ yes |
| entry ↔ its evidence artifact | human, at write time | ❌ no |
| lesson ↔ actual behaviour on a branch | `CLAUDE.md` §9 DoD | ❌ no |
| **auto-memory stub ↔ entry** | **nothing** | ❌ **no — outside the repo (§4.2)** |

### 4.1 The integrity test

`docs/lessons.test.ts`:

| # | Assertion |
|---|---|
| **I1** | Every `L-\d{3}` occurring in any file returned by `git ls-files` resolves to an entry defined in `docs/lessons.md`. A dangling reference **fails**. |
| **I2** | Every `L-NNN` heading in `docs/lessons.md` is unique. |

Scope, fixed by G10: the scan source is `git ls-files`, so every gitignored path is excluded without a
list. Binary extensions (`.png`, `.jpg`, `.woff2`, `.blend`) are skipped by extension. `.serena/memories/**`
and `project_status_archive.md` **are scanned** — an archive pointing at a renumbered id is an archive
telling a lie, and repairing a pointer is not rewriting history.

The test's own fixtures are **constructed in memory**, never written to a scanned file. This removes the
one exclusion that would otherwise be needed, by design rather than by list.

**Two implementation facts, measured 2026-08-08 so they are not rediscovered:**

- **`git ls-files` departs from repo precedent, deliberately.** All three existing filesystem-scanning
  guards — `components/companion/anchor-boundary.test.ts`, `components/ui/token-scale-adoption.test.ts`,
  `lib/supabase/route-protection.test.ts` — walk with `readdirSync`. None shells out to git. They can,
  because each walks a **narrow subtree** (`components/ui`, `app/[locale]`) where nothing needs excluding.
  This scan is **repo-wide**, which is exactly the case where a `readdirSync` walk would require the
  hand-maintained exclusion list G10 rejects. The departure buys the absence of that list; the cost is a
  `child_process` + git dependency in a unit test, which is acceptable in a repo whose test commands
  already assume a git checkout. It also disposes of the known `.worktrees/**` scanning gotcha for free:
  a worktree is gitignored, so `git ls-files` never lists it.
- **`vitest.config.ts` already picks the file up.** `include` is `["**/*.test.{ts,tsx}"]` with `exclude`
  `["node_modules", ".next", "tests/e2e"]`, so `docs/lessons.test.ts` runs with no config change. Placing
  the test beside the artifact it guards also matches how the three guards above are placed.

**Both assertions must be mutation-checked** — delete an entry and watch I1 go red; duplicate a heading
and watch I2 go red; restore. An integrity test for the lesson system that has never been seen to fail
would be the system's own first violation (L-014).

Baseline measured 2026-08-08: `git grep -nE "\bL-[0-9]{3}\b"` returns **0 hits**. Every reference that
ever exists is created by this work or after it, so I1 starts from a clean floor. The sibling convention
`F-\d{3}` (16 feature docs, ~150 references) already exists, so `L-NNN` follows an established shape
rather than inventing one.

### 4.2 Assurance deliberately NOT claimed

The 6 `feedback-*.md` stubs live in Claude's auto-memory directory, **outside the repository**.
`git ls-files` cannot reach them, so **no test covers them** and this spec claims no coverage of them.
Recorded explicitly, in the same spirit as Screen Registry R7: state the assurance that exists, never
imply more.

### 4.3 Assertions deliberately NOT written

- ❌ **"Every entry must be referenced somewhere."** A lesson nobody has needed to cite yet is still a
  lesson. This would pressure contributors to sprinkle ids to satisfy a test.
- ❌ **"Evidence links must resolve."** Commit shas do resolve, but plan paths get archived and incident
  dates are not links. A test here would fail for correct reasons and be disabled within a month.
- ❌ **Any assertion about entry count** (G8).

---

## 5. Migration

### 5.1 Migration is a classification pass, not a move

The existing lesson blocks mix **three kinds of content**, and only one kind travels:

| Kind | Real example | Destination |
|---|---|---|
| **Process lesson** | "A plan's file list is a claim, not a fact." | → `docs/lessons.md` |
| **Run-scoped instruction** | STANDING CONVENTION #5, "Task 19 exit criterion for `common.player.*`"; #4, "defect class CLOSED — Tasks 13–19 should NOT hunt for it" | **stays** in its run-state memory — this is project state, and it expires with the run |
| **Technical finding** | "The 5-font payload fear did not materialise"; "Width comparison cannot detect CJK font fallback" | stays in `project_status` § Key gotchas, or is dropped if spent |

Every item is classified **by hand**. No heading- or keyword-driven bulk move. This is where G4's
admission rule is applied for the first time, and it is the only step that decides whether the file is
clean on day one. Cost: one human decision per item, ~45 decisions.

### 5.2 The merge rule fires immediately, on real data

The two `project_status.md` lines quoted in §1.1 collapse into **one entry with two evidence lines**, and
both derived counts ("4th", "5th") disappear because the length of the evidence list already carries that
information. The same collapse applies to `verify subagent claims` (2 sources), `one grep is never an
audit` (2), and `mutation-check` (5).

**Measured expectation: ~45 raw items → roughly 22–26 real entries.** This is an observation about
today's corpus, **not a target** (G8), and not an invariant to preserve later.

This also gives the migration a pass/fail test of the design itself:

> **If migration does not reduce duplication, the design has failed.**

### 5.3 What is cut, and what replaces it

| Source | Action |
|---|---|
| `project_status.md` — "Lessons worth carrying" ×2 | Body deleted, replaced by one line: `Lessons from this branch: L-003, L-007, L-011 — docs/lessons.md` |
| `shadowing_hub_plan_c_run_state.md` — "Standing lessons from this run" (8) | Same |
| `l9a_localization_run_state.md` — "STANDING CONVENTIONS" (6) | **Split**: #1, #2, #3 migrate; #4, #5, #6 stay (run-scoped, §5.1) |
| `project_status_archive.md` — 1 block | Same |
| `project_status.md` — § Key gotchas (~14) | **Untouched** — out of scope by G1 |
| 6 × `feedback-*.md` (auto-memory) | Reduced to a **2-line stub**: the `Rule` sentence plus a pointer to `L-NNN` |

### 5.4 Why the auto-memory files become stubs rather than being deleted

Auto-memory is surfaced by **automatic recall keyed on each file's `description`**. Deleting a file
removes the recall trigger entirely, and a future session would have no signal that a relevant lesson
exists. A stub keeps the trigger and drops the duplicated body.

The stub must be a **pointer, not a summary** — enough description for recall to fire, then the id.
A stub that restates the full rule is a second wording that drifts, which is G2 violated at the one
place no test can see it (§4.2).

### 5.5 Order of execution — and why this order

1. Write `docs/lessons.md` with merged entries. **Sources still intact.**
2. Add `docs/lessons.test.ts` (I1, I2). Mutation-check both.
3. **Only now** cut the sources down to pointers.
4. Add `CLAUDE.md` §10 (read contract) and the §9 DoD line (write contract).
5. Verify: `npx tsc --noEmit` · `npm run lint` · `npx vitest run`.

Cutting before the test exists means a single mistyped id **silently deletes a lesson** whose original
was just removed. The safe order is the one this project already learned the hard way, and inverting it
here would contradict the very lessons being filed.

---

## 6. The `CLAUDE.md` changes

### 6.1 New §10 — the read contract

```markdown
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

"Single source of truth" stays in `CLAUDE.md` verbatim. It is an **ownership rule**, not a description
of a document, and ownership rules belong in the file that carries law.

The four read triggers are deliberately concrete; "consult when relevant" is dead text. Each maps to a
measured cluster in the corpus: writing a plan ↔ *a plan's file list is a claim*; dispatch ↔ *never seed
a reviewer with an unmeasured number*; gate ↔ *kill `:3000` first*, *count, do not add up*; report
readback ↔ *a tool reporting success is not evidence it worked*.

### 6.2 New §9 line — the write contract

```markdown
- [ ] Lessons from this work recorded in `docs/lessons.md` per its four rules — merged into an
      existing entry where one applies, not appended as a new one
```

This is the survival mechanism, not documentation polish. The behaviour that produced today's
duplication is on the **write** side: at the end of each branch a new "Lessons worth carrying" block is
written into `project_status`. Unless that habit is redirected at the moment it fires, the next branch
recreates the problem and `docs/lessons.md` is bypassed under load.

The clause *"merged into an existing entry where one applies"* is what makes G5 operational. Merging
requires remembering the context well enough to recognise a variant, which is true only at the end of the
branch that produced it — never later. Deferring the merge is exactly how the "4th consecutive" and "5th
consecutive" lines came to coexist.

### 6.3 What `CLAUDE.md` must not do

It must not restate any lesson. §10 points; it does not summarise. The single exception is a **promoted**
lesson, which becomes law in `CLAUDE.md` while `docs/lessons.md` retains only the `Status` pointer (G7).

> `lessons.md → promoted → CLAUDE.md`, never `lessons.md + CLAUDE.md` holding the same rule.

`CLAUDE.md` must never become a cache of `docs/lessons.md`.

---

## 7. Scope and acceptance

**In scope:** the file, its four rules, ~22–26 merged entries, the integrity test, the source cuts, and
the two `CLAUDE.md` edits.

**Out of scope:**

- `project_status` § Key gotchas and every other technical gotcha (G1).
- Any change to `docs/reference/GRAND_PLAYBOOK.md`, which owns general craft principles. Lessons here are
  incidents this project paid for; the playbook is borrowed craft. Different admission rules, different
  files.
- Promoting anything to `CLAUDE.md` law during this work. Promotion is a per-lesson review under G6, not
  a migration step.
- **Editing already-committed specs and plans.** `2026-08-08-screen-registry-design.md` §4.1 restates the
  mutation-check rule inline, and it stays. A committed design doc records what was decided *at that
  time*; rewriting it later to insert a pointer falsifies the record — the same reasoning that keeps
  `project_status_archive.md` intact except for pointer repair. **Specs written from here on cite the id
  instead of restating**, which is the behaviour §6.1's read contract produces.
- Any product code, message catalog, component, or route.

**Acceptance criteria:**

1. I1 and I2 pass, each mutation-checked.
2. No source retains a lesson body that also exists in `docs/lessons.md` — every one is a pointer (G2).
3. Duplication measurably falls: of the 6 standing-rule restatements of the mutation-check lesson (§1.1),
   the **5 in memories and auto-memory** become 1 entry plus pointers. The 3 plans that *apply* it and the
   1 committed spec that restates it are left untouched (§7). No derived count survives anywhere in the
   migrated text.
4. `tsc` 0 errors; `npm run lint` error count 0 and warning count unchanged from the pre-branch baseline
   (77, mix `54 no-non-null-assertion + 23 no-unused-vars`).
5. `npx vitest run` green, with the file count up by exactly 1.

---

## 8. Risks

1. **The file becomes a second playbook.** *Mitigation:* G4 — no linkable incident, no entry. General
   craft belongs in `GRAND_PLAYBOOK.md`, which already carries that role and says so in its own header.
2. **The write contract is skipped under deadline pressure, and lessons re-accumulate in status prose.**
   The most likely failure, because it is the cheapest thing to skip. *Mitigation:* §9 DoD (G9) — a
   review can check whether the diff touches `docs/lessons.md`. Not automated; deliberately so, since a
   test cannot tell a real lesson from a filler entry written to satisfy it.
3. **Migration copies blocks wholesale and imports dead run-scoped instructions.** *Mitigation:* §5.1's
   hand classification, and acceptance criterion 3.
4. **Ids get renumbered, breaking pointers.** *Mitigation:* I1, plus the rule in §3.2 that ids are never
   reused or renumbered — a retired lesson keeps its id.
5. **The auto-memory stubs drift**, since nothing can check them (§4.2). *Mitigation:* keep the stub a
   pointer, never a summary (§5.4). Residual risk accepted and recorded.
6. **Entries grow past six lines** and quietly become two lessons under one id. *Mitigation:* §3.2's cap,
   enforced by review rather than by test — line count is a poor proxy and a test on it would be gamed.

---

## 9. Evidence

Everything measured on 2026-08-08 at master `781e4c8`, working tree clean.

| Claim | Command | Result |
|---|---|---|
| No `L-NNN` collision today | `git grep -nE "\bL-[0-9]{3}\b"` | 0 hits |
| `F-NNN` is an established sibling convention | `git grep -ohE "\b[A-Z]-[0-9]{3}\b" \| sort \| uniq -c` | 16 ids, ~150 references |
| Lessons are duplicated across sources | `grep -ril "mutation" .serena/memories docs/superpowers CLAUDE.md` | 4 memories + 4 specs/plans (+1 auto-memory file) |
| Lesson blocks and their locations | `grep -nE "STANDING CONVENTIONS\|Lessons worth carrying\|Standing lessons\|Key gotchas" .serena/memories/*.md` | 5 blocks across 4 files |
| The same lesson written twice with different derived counts | `.serena/memories/project_status.md` | lines 156 and 199 |
| Auto-memory holds 6 process lessons | directory listing | 6 × `feedback-*.md` |
| `.serena/memories` is version-controlled | `git ls-files .serena` | 12 memory files tracked |

The last row corrected a wrong assumption made while drafting: the serena memories were believed to be
machine-local. They are tracked. The migration plan depends on that, which is why it was measured rather
than assumed.
