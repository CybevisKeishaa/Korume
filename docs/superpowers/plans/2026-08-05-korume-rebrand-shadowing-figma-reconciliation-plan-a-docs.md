# Korume Rebrand & Shadowing Hub/Practice Reconciliation — Plan A (Docs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every *living* doc in the repo into agreement with the 2026-08-05 reconciliation
spec — rename the product and Companion from "Nihongo Cinema" to "Korume" everywhere it currently
appears outside historical records, restructure the nav docs to 5 groups, narrow the Companion
Learning Loop Boundary inside the Lesson Workspace, and fix the Shadowing Hub's collection ordering
and the Shadowing Practice header. Zero code, zero runtime/i18n, zero test changes.

**Architecture:** Documentation-only change, four phases. Phase 1 (rebrand) has no ordering
dependency on Phases 2–4 and could run in parallel, but is sequenced first because it's the most
mechanical and lowest-risk, giving the executor an easy warm-up before the content-specific rewrites
in Phases 2–4. Within Phase 1, the 3 tasks (by file category) have no dependency on each other.

**Tech Stack:** Markdown files only.

## Global Constraints

- **Source-of-truth spec, locked for execution:**
  `docs/superpowers/specs/2026-08-05-korume-rebrand-shadowing-figma-reconciliation-design.md`. Do not
  re-open any decision it records — this plan only executes it.
- **No tests apply.** Verification is `grep` counts + a read-back confirming the edited section
  matches the spec's resolution, same pattern as
  `docs/superpowers/plans/2026-07-31-shadowing-hub-lesson-workspace-plan-a-docs.md`.
- **No code changes.** Nothing in `app/`, `components/`, `lib/`, `messages/**`, `tests/**`,
  `test/**`, `tailwind.config.ts`, or `supabase/**` is touched. That work — i18n catalog +
  pin-test rename, `tests/e2e/home.spec.ts`, `app/[locale]/layout.tsx` metadata,
  `components/layout/app-nav.tsx` 5-group restructure, `components/companion/anchor-boundary.test.ts`
  narrowing to `/shadowing/[id]` exactly — is **Plan B (Code)**, not yet written (spec §7). Do not
  attempt any part of it in this plan.
- **Do not touch historical/immutable files** (spec §1.2 category 5): anything under
  `docs/superpowers/specs/**` or `docs/superpowers/plans/**` (including this plan's own source spec —
  read it, never edit it), `docs/product/nhat_ky_y_tuong_san_pham.md`,
  `supabase/migrations/**`, `.serena/memories/**`. If a task below is tempted to "fix" one of these
  because it still says "Nihongo Cinema," stop — that is correct, expected behavior for a historical
  record, not a bug.
- **`docs/design/nihongo_page_playbook.md`'s filename is NOT renamed in this plan** — the spec (§7)
  leaves that decision open. Only its body text is edited (Task 2).
- **`docs/reference/GRAND_PLAYBOOK.md` is NOT touched in this plan** — the spec (§7) leaves its
  historical-vs-living classification undecided. Do not edit it and do not assume either
  classification.
- **Rebrand substitution rule (Phase 1 tasks):** every occurrence of the exact string `Nihongo Cinema`
  in an in-scope file becomes `Korume`. This is a straight proper-noun substitution — every occurrence
  audited while writing this plan is a simple noun-phrase usage ("Nihongo Cinema — a web app...",
  "...journey của Nihongo Cinema", "Nihongo Cinema does not sell...") with no grammatical
  restructuring needed around the swap. `README.md`'s title is the one exception with extra text
  attached (`# Nihongo Cinema (JapanWeb)` → `# Korume`, dropping the `(JapanWeb)` alias entirely — the
  spec's rebrand decision (§1.1) supersedes that alias, not just the primary name). After editing a
  file, verify with `grep -c "Nihongo Cinema" <file>` — expect `0`.
- **One commit per task.** Prefix `docs(rebrand):` for Phase 1 tasks, `docs(design):` for Phase 2–4
  tasks.
- **Every edited file keeps its existing content except the exact text being changed** — do not
  reformat or reflow unrelated sections.

---

## File Structure

| File(s) | Task | Change |
|---|---|---|
| `CLAUDE.md`, `README.md`, `japanese-learning-app-spec.md`, `docs/product/business-model.md`, `MASCOT.md` | 1 | Rebrand: 5 files, 7 occurrences total. |
| 20 files under `docs/design/**` + `docs/features/README.md` | 2 | Rebrand: 20 files, ~35 occurrences total. |
| 11 files under `.claude/**` | 3 | Rebrand: 11 files, 11 occurrences total. |
| `docs/design/screens/navigation-system.md` | 4 | § Navigation Inventory rewrite: 5-group structure, 3 renames, visibility toggle note. |
| `docs/design/screens/screen-shadowing-practice.md` | 5 | § Companion rewrite: boundary narrowed to Shadowing-mode-only. |
| `docs/design/design-reconciliation.md` | 6 | §6 Anchor Availability table split row, version bump 1.2 → 1.3. |
| `docs/design/screens/screen-shadowing-hub.md` | 7 | § Collections: ordering rule relaxed, filter-pill shortcut note added. |
| `docs/design/screens/screen-shadowing-practice.md` | 8 | § Header: drop "72% complete" precedent note (already covers "Sentence 3/18"). |

No new files. No files deleted. No files renamed.

---

## Phase 1 — Product & Companion rebrand

### Task 1: Core identity docs

**Files:**
- Modify: `CLAUDE.md` (2 occurrences)
- Modify: `README.md` (1 occurrence, title line)
- Modify: `japanese-learning-app-spec.md` (1 occurrence, title line)
- Modify: `docs/product/business-model.md` (1 occurrence)
- Modify: `MASCOT.md` (2 occurrences)

**Interfaces:**
- Consumes: spec §1.1, §1.2 category 1.
- Produces: the product's canonical name in every doc a human reads first when opening the repo.

- [ ] **Step 1: `CLAUDE.md`**

Find:
```markdown
# CLAUDE.md — Nihongo Cinema
```
Replace:
```markdown
# CLAUDE.md — Korume
```

Find:
```markdown
**Nihongo Cinema** — a web app for learning Japanese through video (shadowing / dictation),
```
Replace:
```markdown
**Korume** — a web app for learning Japanese through video (shadowing / dictation),
```

- [ ] **Step 2: `README.md`**

Find:
```markdown
# Nihongo Cinema (JapanWeb)
```
Replace:
```markdown
# Korume
```

- [ ] **Step 3: `japanese-learning-app-spec.md`**

Find:
```markdown
# Nihongo Cinema — Product & Technical Specification
```
Replace:
```markdown
# Korume — Product & Technical Specification
```

- [ ] **Step 4: `docs/product/business-model.md`**

Find:
```markdown
> **Nihongo Cinema does not sell lesson quality. It sells library breadth and the ability to
```
Replace:
```markdown
> **Korume does not sell lesson quality. It sells library breadth and the ability to
```

- [ ] **Step 5: `MASCOT.md`**

Find:
```markdown
# Nihongo Cinema Companion Character Bible (Draft)
```
Replace:
```markdown
# Korume Companion Character Bible (Draft)
```

Find:
```markdown
Nó xuất hiện xuyên suốt hành trình học tập của Nihongo Cinema: từ lần gặp đầu tiên, tutorial, những bài học hằng ngày, các thành tựu cho tới Journal.
```
Replace:
```markdown
Nó xuất hiện xuyên suốt hành trình học tập của Korume: từ lần gặp đầu tiên, tutorial, những bài học hằng ngày, các thành tựu cho tới Journal.
```

- [ ] **Step 6: Verify**

```bash
for f in CLAUDE.md README.md japanese-learning-app-spec.md docs/product/business-model.md MASCOT.md; do echo "$f: $(grep -c 'Nihongo Cinema' "$f")"; done
```
Expected: every line ends `: 0`.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md README.md japanese-learning-app-spec.md docs/product/business-model.md MASCOT.md
git commit -m "docs(rebrand): rename product to Korume in core identity docs"
```

---

### Task 2: Design governance and pattern docs

**Files (20, ~35 occurrences total — counts below from the pre-plan audit):**
- `docs/design/README.md` (2)
- `docs/design/PLAYBOOK.md` (2)
- `docs/design/screens/screen-architecture.md` (5)
- `docs/design/screens/adaptive-layouts.md` (3)
- `docs/design/screens/workspace-patterns.md` (2)
- `docs/design/screens/learning-surfaces.md` (3)
- `docs/design/screens/screen-states.md` (2)
- `docs/design/screens/screen-search.md` (1)
- `docs/design/screens/screen-review.md` (1)
- `docs/design/screens/screen-dashboard.md` (1)
- `docs/design/screens/screen-shadowing-practice.md` (1 — the "Related" header cross-reference; not
  the § Companion or § Header content Tasks 5/8 handle separately)
- `docs/design/patterns/transcript-patterns.md` (1)
- `docs/design/patterns/companion-patterns.md` (1)
- `docs/design/patterns/overlays-and-drawers.md` (1)
- `docs/design/patterns/video-patterns.md` (2)
- `docs/design/patterns/reading-patterns.md` (1)
- `docs/design/patterns/feedback-patterns.md` (1)
- `docs/design/microcopy-guidelines.md` (1)
- `docs/design/nihongo_page_playbook.md` (1 — body text only, filename unchanged per Global
  Constraints)
- `docs/features/README.md` (1)

**Interfaces:**
- Consumes: spec §1.1, §1.2 category 2; the Rebrand substitution rule in Global Constraints.
- Produces: no other task depends on this one's output.

- [ ] **Step 1: For each file above, find and replace every occurrence**

```bash
grep -n "Nihongo Cinema" docs/design/README.md docs/design/PLAYBOOK.md \
  docs/design/screens/screen-architecture.md docs/design/screens/adaptive-layouts.md \
  docs/design/screens/workspace-patterns.md docs/design/screens/learning-surfaces.md \
  docs/design/screens/screen-states.md docs/design/screens/screen-search.md \
  docs/design/screens/screen-review.md docs/design/screens/screen-dashboard.md \
  docs/design/screens/screen-shadowing-practice.md docs/design/patterns/transcript-patterns.md \
  docs/design/patterns/companion-patterns.md docs/design/patterns/overlays-and-drawers.md \
  docs/design/patterns/video-patterns.md docs/design/patterns/reading-patterns.md \
  docs/design/patterns/feedback-patterns.md docs/design/microcopy-guidelines.md \
  docs/design/nihongo_page_playbook.md docs/features/README.md
```

Read each matched line in context (open the file around the reported line number) and replace the
exact string `Nihongo Cinema` with `Korume` — per the Rebrand substitution rule, this is a
straight proper-noun swap with no surrounding grammar change in every occurrence in this file set
(confirmed during the pre-plan audit). Do not change anything else on the matched lines.

- [ ] **Step 2: Verify**

```bash
grep -rc "Nihongo Cinema" docs/design/README.md docs/design/PLAYBOOK.md \
  docs/design/screens/screen-architecture.md docs/design/screens/adaptive-layouts.md \
  docs/design/screens/workspace-patterns.md docs/design/screens/learning-surfaces.md \
  docs/design/screens/screen-states.md docs/design/screens/screen-search.md \
  docs/design/screens/screen-review.md docs/design/screens/screen-dashboard.md \
  docs/design/screens/screen-shadowing-practice.md docs/design/patterns/transcript-patterns.md \
  docs/design/patterns/companion-patterns.md docs/design/patterns/overlays-and-drawers.md \
  docs/design/patterns/video-patterns.md docs/design/patterns/reading-patterns.md \
  docs/design/patterns/feedback-patterns.md docs/design/microcopy-guidelines.md \
  docs/design/nihongo_page_playbook.md docs/features/README.md
```
Expected: every file's count is `0`.

- [ ] **Step 3: Commit**

```bash
git add docs/design docs/features/README.md
git commit -m "docs(rebrand): rename product to Korume across design governance and pattern docs"
```

---

### Task 3: Operational and agent-definition docs

**Files (11, 1 occurrence each):**
`.claude/docs/workflow.md`, `.claude/commands/build-layer.md`, `.claude/commands/new-module.md`,
`.claude/agents/backend-engineer.md`, `.claude/agents/tech-lead.md`,
`.claude/agents/frontend-engineer.md`, `.claude/agents/code-reviewer.md`,
`.claude/agents/ai-engineer.md`, `.claude/agents/test-engineer.md`,
`.claude/agents/database-engineer.md`, `.claude/agents/motion-engineer.md`

**Interfaces:**
- Consumes: spec §1.1, §1.2 category 3 ("these are current instructions, not history").
- Produces: no other task depends on this one's output.

- [ ] **Step 1: Find and replace in each file**

```bash
grep -n "Nihongo Cinema" .claude/docs/workflow.md .claude/commands/build-layer.md \
  .claude/commands/new-module.md .claude/agents/backend-engineer.md .claude/agents/tech-lead.md \
  .claude/agents/frontend-engineer.md .claude/agents/code-reviewer.md .claude/agents/ai-engineer.md \
  .claude/agents/test-engineer.md .claude/agents/database-engineer.md .claude/agents/motion-engineer.md
```

Replace the exact string `Nihongo Cinema` with `Korume` at each reported line — same substitution
rule as Task 2.

- [ ] **Step 2: Verify**

```bash
grep -rc "Nihongo Cinema" .claude/docs/workflow.md .claude/commands/build-layer.md \
  .claude/commands/new-module.md .claude/agents/backend-engineer.md .claude/agents/tech-lead.md \
  .claude/agents/frontend-engineer.md .claude/agents/code-reviewer.md .claude/agents/ai-engineer.md \
  .claude/agents/test-engineer.md .claude/agents/database-engineer.md .claude/agents/motion-engineer.md
```
Expected: every file's count is `0`.

- [ ] **Step 3: Commit**

```bash
git add .claude
git commit -m "docs(rebrand): rename product to Korume across operational and agent docs"
```

---

## Phase 2 — Nav Column restructure

### Task 4: `navigation-system.md` § Navigation Inventory

**Files:**
- Modify: `docs/design/screens/navigation-system.md`

**Interfaces:**
- Consumes: spec §2.
- Produces: the canonical 5-group nav structure every future doc referencing `NAV_ITEMS` must match
  (no other task in this plan references it further).

- [ ] **Step 1: Rewrite § Navigation Inventory**

Find:
````markdown
# Navigation Inventory

The shipped navigation (`components/layout/app-nav.tsx`, `NAV_ITEMS`) is a single ordered list, no
grouping, no nesting:

| Order | Label key | Route |
|---|---|---|
| 1 | `dashboard` | `/dashboard` |
| 2 | `kanji` | `/kanji` |
| 3 | `vocab` | `/vocab` |
| 4 | `grammar` | `/grammar` |
| 5 | `shadowing` | `/shadowing` |
| 6 | `mining` | `/mining` |
| 7 | `reading` | `/reading` |
| 8 | `conversation` | `/conversation` |
| 9 | `jlpt` | `/jlpt` |
| 10 | `community` | `/community` |
| 11 | `playlists` | `/playlists` |
| 12 | `leaderboard` | `/leaderboard` |
| 13 | `journal` | `/journal` |
| 14 | `profile` | `/profile` |

All 14 are shipped today — none are Planned or aspirational. Active acquisition-loop sub-routes
(Shadowing Practice, Pronunciation, Listening Practice, JLPT test-taking, SRS review, Mining review session)
are reached by drilling into their parent item (e.g. `/shadowing/[id]`), never listed as their own
top-level nav entry — this keeps the acquisition loops off the persistent chrome, consistent with
the Learning Loop Boundary (`docs/design/design-reconciliation.md` §4). "Shadowing" as a top-level
nav entry names the **Shadowing Hub** (`screen-shadowing-hub.md`) — the learner's home for browsing
and resuming lessons, itself not an acquisition loop; **Shadowing Practice** (`screen-shadowing-practice.md`), reached by drilling into a specific lesson, is the acquisition loop this paragraph's
ban is about. The two are not the same destination and must not be conflated when reading "Shadowing"
elsewhere in this document. There is no dedicated Search entry in this list — Search is a persistent
affordance inside the Nav Column chrome itself, not a separate destination
(see `docs/design/screens/screen-search.md` § Entry Points).
````

Replace:
````markdown
# Navigation Inventory

The shipped navigation (`components/layout/app-nav.tsx`, `NAV_ITEMS`) is **5 named groups**, each an
ordered list (`docs/superpowers/specs/2026-08-05-korume-rebrand-shadowing-figma-reconciliation-design.md`
§2 — supersedes the earlier "single ordered list, no grouping" model):

| Group | Order | Label key | Route |
|---|---|---|---|
| LEARN | 1 | `dashboard` | `/dashboard` |
| LEARN | 2 | `lessons` | `/shadowing` |
| LEARN | 3 | `kanji` | `/kanji` |
| LEARN | 4 | `vocab` | `/vocab` |
| LEARN | 5 | `grammar` | `/grammar` |
| LEARN | 6 | `reading` | `/reading` |
| LEARN | 7 | `speaking` | `/conversation` |
| LEARN | 8 | `jlpt` | `/jlpt` |
| STUDY | 9 | `review` | `/review` |
| STUDY | 10 | `mining` | `/mining` |
| STUDY | 11 | `playlists` | `/playlists` |
| STUDY | 12 | `challenges` | `/challenges` |
| STUDY | 13 | `community` | `/community` |
| STUDY | 14 | `leaderboard` | `/leaderboard` |
| INSIGHTS | 15 | `korume` | *(Companion surface, e.g. `/journal` or a future chat route — not decided by this plan)* |
| INSIGHTS | 16 | `roadmap` | *(existing Roadmap screen; route not yet mapped to `NAV_ITEMS` — decided by whichever plan implements this group)* |
| INSIGHTS | 17 | `weeklyReport` | *(Planned — `business-model.md` §8 "sample weekly report," not yet built)* |
| PROGRESS | 18 | `journey` | `/journal` |
| PROGRESS | 19 | `statistics` | *(not yet built — spec §7 leaves its source data undecided)* |
| PROGRESS | 20 | `achievements` | *(not yet built — spec §7 leaves its source data undecided)* |
| ACCOUNT | 21 | `profile` | `/profile` |
| ACCOUNT | 22 | `settings` | `/settings` *(Planned — L9b Plan 1, `mem:l9b_plan1_launch_blocker_debt_status`)* |

14 of these 22 rows are shipped today (`dashboard`, `lessons`/was `shadowing`, `kanji`, `vocab`,
`grammar`, `reading`, `speaking`/was `conversation`, `jlpt`, `mining`, `playlists`, `community`,
`leaderboard`, `journey`/was `journal`, `profile`) — the remaining 8 (`review`, `challenges`,
`korume`, `roadmap`, `weeklyReport`, `statistics`, `achievements`, `settings`) are new nav-level
entries this restructure surfaces; each is Planned/not-yet-wired except where noted, and none of
this plan's tasks build them. Active acquisition-loop sub-routes (Shadowing Practice, Pronunciation,
Listening Practice, JLPT test-taking, SRS review, Mining review session) are still reached by
drilling into their parent item (e.g. `/shadowing/[id]`), never listed as their own top-level nav
entry — this still keeps the acquisition loops off the persistent chrome, consistent with the
Learning Loop Boundary (`docs/design/design-reconciliation.md` §4). "Lessons" (was "Shadowing") as a
top-level nav entry names the **Shadowing Hub** (`screen-shadowing-hub.md`) — the learner's home for
browsing and resuming lessons, itself not an acquisition loop; **Shadowing Practice**
(`screen-shadowing-practice.md`), reached by drilling into a specific lesson, is the acquisition loop
this paragraph's ban is about. The two are not the same destination and must not be conflated when
reading "Lessons"/"Shadowing" elsewhere in this document. There is no dedicated Search entry in this
list — Search is a persistent affordance inside the Nav Column chrome itself, not a separate
destination (see `docs/design/screens/screen-search.md` § Entry Points).

The Nav Column is **toggleable** (show/hide via a small edge affordance) rather than an
always-fixed 240px column — generalizing the hidden-by-default behavior
`screen-shadowing-practice.md` § Sidebar already mandates inside the Lesson Workspace to the whole
product. The default visibility state outside the Lesson Workspace is not decided by this document —
see the source spec's §7.
````

- [ ] **Step 2: Verify**

```bash
grep -n "single ordered list, no grouping" docs/design/screens/navigation-system.md
```
Expected: no match (old wording fully replaced).

```bash
grep -c "^| LEARN \|^| STUDY \|^| INSIGHTS \|^| PROGRESS \|^| ACCOUNT " docs/design/screens/navigation-system.md
```
Expected: `22` (one per table row).

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/navigation-system.md
git commit -m "docs(design): restructure Navigation Inventory into 5 groups (Korume reconciliation)"
```

---

## Phase 3 — Companion Learning Loop Boundary

### Task 5: `screen-shadowing-practice.md` § Companion

**Files:**
- Modify: `docs/design/screens/screen-shadowing-practice.md`

**Interfaces:**
- Consumes: spec §4.
- Produces: the per-mode Companion boundary Task 6's `design-reconciliation.md` table must match.

- [ ] **Step 1: Rewrite § Companion**

Find:
````markdown
# Companion

✕ Not Supported, across all four Learning Modes (Shadowing, Pronunciation, Listening Practice,
Summary) — each is an active acquisition loop (`docs/design/design-reconciliation.md` §4, Learning
Loop Boundary), Companion is Dormant throughout. This is structurally enforced: no `CompanionAnchor`
may mount anywhere in the `/shadowing/[id]/**` route group (L9b scan test). Companion does not appear
during any session; any reflection it has about a completed session surfaces later, on a surface
where Companion is Available (Dashboard, `/journal`) — never inside the Lesson itself.

Summary Mode was explicitly considered as a possible Companion touchpoint and rejected — Summary
understands the lesson, Companion understands the learner; keeping this boundary intact lets future
Learning Modes be added indefinitely without ever touching Companion's architecture
(`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §0.5, §6.8).
````

Replace:
````markdown
# Companion

**Narrowed 2026-08-05** (`docs/superpowers/specs/2026-08-05-korume-rebrand-shadowing-figma-reconciliation-design.md`
§4 — supersedes the "all four Learning Modes" rule below in full for Pronunciation, Listening
Practice, and Summary; Shadowing mode is unchanged):

- **Shadowing mode: ✕ Not Supported.** Continuous video playback requiring full learner attention —
  an active acquisition loop (`docs/design/design-reconciliation.md` §4, Learning Loop Boundary),
  Companion is Dormant throughout. Structurally enforced: no `CompanionAnchor` may mount on the
  `/shadowing/[id]` route itself.
- **Pronunciation, Listening Practice, Summary: ○ Planned.** Architecture allows a Companion anchor
  on these three routes, not yet built. Rationale: Pronunciation and Listening Practice are already
  broken into discrete per-sentence units (record → score → next; play → check → next), not
  continuous playback — a Companion presence between units doesn't interrupt an in-progress action
  the way it would during Shadowing's continuous playback. Summary is read-only aggregation, not a
  playback experience at all.

This reopens and partially supersedes an earlier decision: Summary Mode was previously considered as
a possible Companion touchpoint and rejected outright, to keep the boundary simple as future Learning
Modes are added (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §0.5,
§6.8). That concern — a clean per-mode boundary that never needs architecture changes — still holds;
only the *value* assigned to Summary (and Pronunciation/Listening Practice) changed, not the shape of
the rule itself. Any reflection Companion has about a completed session may still also surface later
on Dashboard or `/journal`, as before — this narrowing adds a possible touchpoint during three of the
four modes, it does not remove the existing post-session ones.
````

- [ ] **Step 2: Verify**

```bash
grep -n "across all four Learning Modes" docs/design/screens/screen-shadowing-practice.md
```
Expected: no match.

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/screen-shadowing-practice.md
git commit -m "docs(design): narrow Companion Learning Loop Boundary to Shadowing-mode-only"
```

---

### Task 6: `design-reconciliation.md` §6 Anchor Availability

**Files:**
- Modify: `docs/design/design-reconciliation.md`

**Interfaces:**
- Consumes: spec §4.4. Depends on Task 5 being conceptually consistent (no file dependency — can run
  in either order, but should agree in content).
- Produces: nothing further in this plan depends on this table.

- [ ] **Step 1: Split the combined row and bump the version header**

Find:
```markdown
> **Version:** 1.2 (2026-07-31)
```
Replace:
```markdown
> **Version:** 1.3 (2026-08-05)
```

Find:
```markdown
| Shadowing Practice / Pronunciation / Listening Practice / Summary / Review / SRS review / JLPT / Grammar / Vocab / Kanji / Conversation | Not Supported | Active acquisition loop (§4) |
```
Replace:
```markdown
| Shadowing Practice | Not Supported | Active acquisition loop, continuous video playback requiring full attention (§4) |
| Pronunciation / Listening Practice / Summary (inside a Lesson) | Planned | Architecture allows it; not yet built. Each is a discrete per-sentence or read-only unit, not continuous playback (§4) |
| Review / SRS review / JLPT / Grammar / Vocab / Kanji / Conversation | Not Supported | Active acquisition loop (§4) |
```

- [ ] **Step 2: Verify**

```bash
grep -n "Version:" docs/design/design-reconciliation.md | head -1
```
Expected: `> **Version:** 1.3 (2026-08-05)`.

```bash
grep -n "^| Shadowing Practice \|^| Pronunciation / Listening Practice\|^| Review / SRS review" docs/design/design-reconciliation.md
```
Expected: 3 matching lines.

- [ ] **Step 3: Commit**

```bash
git add docs/design/design-reconciliation.md
git commit -m "docs(design): split Anchor Availability row for narrowed Companion boundary, bump v1.3"
```

---

## Phase 4 — Shadowing Hub collections and Shadowing Practice header

### Task 7: `screen-shadowing-hub.md` § Collections

**Files:**
- Modify: `docs/design/screens/screen-shadowing-hub.md`

**Interfaces:**
- Consumes: spec §5.
- Produces: nothing further in this plan depends on this section.

- [ ] **Step 1: Relax the collection-ordering rule**

Find:
```markdown
The grid is entirely collection-driven, ordered by each collection's stored display order — no
hardcoded sections in code (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §5). Three computed (virtual) collections are always prepended, in this order:

Continue Learning

My Lessons

Recently Added

Then editorial collections follow in their stored order (Featured typically first among those).
Editorial examples
```
Replace:
```markdown
The grid is entirely collection-driven, ordered by each collection's stored display order — no
hardcoded sections in code (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §5). Three computed (virtual) collections always exist:

Continue Learning

My Lessons

Recently Added

Editorial collections are no longer required to follow after all three — per
`docs/superpowers/specs/2026-08-05-korume-rebrand-shadowing-figma-reconciliation-design.md` §5.1, an
editorial collection (e.g. a "Popular Lessons" row) may render before some or all of the computed
collections. The three computed collections keep their order relative to *each other*
(Continue Learning, then My Lessons, then Recently Added, wherever they appear in the overall grid) —
only their position relative to editorial collections is no longer fixed-first.
Editorial examples
```

- [ ] **Step 2: Add the filter-pill shortcut note**

Find:
```markdown
Each collection feels like a bookshelf.

Not a filter menu.

---

# My Lessons
```
Replace:
```markdown
Each collection feels like a bookshelf.

Not a filter menu.

## Filter Pills as Collection Shortcuts

A compact, always-visible row of pills (e.g. All / Conversation / Business / Travel / Restaurant /
Daily Life / Anime / Podcast / News / Office / Cafe) may sit directly under Search as a quick jump
into the Collection grid below — this is a shortcut *into* the Collection model, not a second,
competing categorization system. The pill labels are the same kind of names already used as
Collection examples above (Anime, Slice of Life, …), not technical filter criteria (resolution,
duration, date) — so this pattern does not reopen "Collections replace traditional filters... not a
filter menu" above (`docs/superpowers/specs/2026-08-05-korume-rebrand-shadowing-figma-reconciliation-design.md` §5.2).

---

# My Lessons
```

- [ ] **Step 3: Verify**

```bash
grep -n "always prepended" docs/design/screens/screen-shadowing-hub.md
```
Expected: no match.

```bash
grep -n "Filter Pills as Collection Shortcuts" docs/design/screens/screen-shadowing-hub.md
```
Expected: 1 match.

- [ ] **Step 4: Commit**

```bash
git add docs/design/screens/screen-shadowing-hub.md
git commit -m "docs(design): relax Hub collection ordering, document filter-pill shortcut pattern"
```

---

### Task 8: `screen-shadowing-practice.md` § Header

**Files:**
- Modify: `docs/design/screens/screen-shadowing-practice.md`

**Interfaces:**
- Consumes: spec §6.
- Produces: nothing further in this plan depends on this section.

- [ ] **Step 1: Add the completion-percentage clarification**

Find:
```markdown
This header itself doesn't display Gamification (XP, Streak, Leaderboard, Badge) — that's a real,
shipped layer that lives elsewhere (Dashboard, post-session summaries), not banned product-wide
(`docs/design/design-reconciliation.md` §3). This header just isn't where it speaks.

No progress indicators.

No unnecessary controls.
```
Replace:
```markdown
This header itself doesn't display Gamification (XP, Streak, Leaderboard, Badge) — that's a real,
shipped layer that lives elsewhere (Dashboard, post-session summaries), not banned product-wide
(`docs/design/design-reconciliation.md` §3). This header just isn't where it speaks.

No progress indicators — e.g. no lesson-level completion percentage
(`docs/superpowers/specs/2026-08-05-korume-rebrand-shadowing-figma-reconciliation-design.md` §6). A
sentence position counter (e.g. "Sentence 3 / 18") is not a progress indicator in this sense — it's
orientation context (which sentence the learner is on), not a measure of how much of the lesson
remains, and is fine to show.

No unnecessary controls.
```

- [ ] **Step 2: Verify**

```bash
grep -n "orientation context" docs/design/screens/screen-shadowing-practice.md
```
Expected: 1 match.

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/screen-shadowing-practice.md
git commit -m "docs(design): clarify sentence-counter vs. progress-indicator in Shadowing Practice header"
```

---

## Self-review notes (completed while writing this plan)

- **Spec coverage:** §1 → Task 1–3. §2 → Task 4. §3 (no doc change, confirmed in spec text) → no
  task, correctly absent. §4 → Task 5–6. §5 → Task 7. §6 → Task 8. §7 (deferred items) → correctly
  excluded from every task's scope via Global Constraints.
- **Placeholder scan:** no TBD/TODO. The nav table's routes marked "not decided by this plan" (Task 4,
  INSIGHTS/PROGRESS/ACCOUNT rows) are honest unknowns carried from spec §7, not disguised placeholders
  — the surrounding prose explains why each is unresolved and that no task here is expected to resolve
  it.
- **Type/name consistency:** `korume` / `roadmap` / `weeklyReport` / `journey` / `statistics` /
  `achievements` / `settings` / `review` / `challenges` label-key spellings in Task 4 match the
  camelCase convention already used by existing keys (`dashboard`, `kanji`, `vocab`, …) in the
  original table.
