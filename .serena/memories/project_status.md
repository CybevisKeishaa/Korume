# Korume (was Nihongo Cinema) — Project Status

Read this first each session. Product spec: `japanese-learning-app-spec.md` (**repo root** — moved
in from the parent folder and put under version control 2026-07-16; old references say `../`);
root rules: `CLAUDE.md`; agent workflow + 8-layer order + branching policy: `.claude/docs/workflow.md`.

## What this is
Learn Japanese through video shadowing/dictation + kanji/vocab/grammar/JLPT, cinematic UI.
8 layers, one per session; all 8 = finished product. Use `/build-layer <n>`.

## ✅ L9a Plans 1/3 AND 2/3 COMPLETE — both MERGED to master (Plan 1 `69f22e6`, Plan 2 `fcd35af`, 2026-07-18)

**Plan 2 (design system) merged `fcd35af` --no-ff same day** — full token system + semantic
colour tiers + 8 Radix/in-house primitives + living style guide `/[locale]/admin/style-guide`
+ enforcement tests (P8 lint fire-tested, §8 logical-properties scan, token contract,
middleware-composition guard). Post-merge: tsc 0 · **1293/1293 (174 files)**. Manual
style-guide browser pass STILL OWED (checklist in `mem:l9a_localization_run_state`).
Plan-1 details below unchanged:
**Branch `layer-9a-localization-architecture` merged & local branch deleted (user chose merge).
NOT pushed (origin/layer-9a-... still holds a stale pre-finish tip — prune when pushing).
Post-merge verify on master: tsc 0, 1229/1229.** All 8 tasks done + task-reviewed; final whole-branch review (opus):
READY TO MERGE = YES, 0 Critical/Important. Shipped: `lib/i18n/**` foundation (next-intl 4.13.2,
vi/en, prefix "always"), `app/`→`app/[locale]/`, Supabase-first middleware composition, locale-
stripped route protection + security matrix, all feature code on `@/lib/i18n/navigation`, ESLint
boundary (merged with AI-SDK guard, fire-tests). Zero user-visible change (shell still EN).
Baseline @ ceb7445: **unit 1229/162 files · build 52s · playwright 2/2 37s · tsc 0 · lint 0**.
Plans 2 (design system) & 3 (extraction + VN) both UNBLOCKED, not yet written.
**→ Load-bearing constructs, reuse patterns, and review-assigned follow-ups: `mem:l9a_localization_run_state`. READ THAT before Plans 2/3 or touching middleware/i18n.**
Spec `docs/superpowers/specs/2026-07-17-l9a-i18n-design-system-design.md`;
plan `docs/superpowers/plans/2026-07-17-l9a-localization-architecture.md`;
SDD ledger `.superpowers/sdd/progress.md` (gitignored, richer per-task detail).

## ▶ NEXT ACTION (updated 2026-08-22) — **L9b Plan 1 is MERGED. There is no live next action; the next one must be scoped.**

**L9b Plan 1 (GDPR data deletion) is DONE and MERGED to master at `4b1fef7`** (merge commit,
2026-08-22; the branch `l9b-plan1-gdpr` is kept, per this repo's convention). All 13 tasks built and
reviewed, the whole-branch review (`L-011`) run, its single fix wave landed and re-reviewed clean, and
the merged master verified green (tsc 0, 257 files / 2327 tests). GDPR was the `CLAUDE.md` §2
non-negotiable owed since Layer 1; it is now paid.
**Read `mem:l9b_plan1_gdpr_run_state` — it is the authority on what shipped and what it still owes.
This block must not restate it.**

Phase 0 is COMPLETE AND CLOSED and **Screen Registry Phases 1a, 1b, 2a and 2b are all built and
merged** (2b at `10caaac`; its two debts closed 2026-08-19 at `a371a4b`). **There is no live
screen-registry next action until Phase 3 is scoped**, and scoping it is not urgent — see
`mem:screen_registry_phase_2b_run_state`.

**Candidates for the next action, none started, in no fixed order:**
- **Layer 8** — PayOS billing, animation polish, the performance audit. It is the last unbuilt layer
  (`.claude/docs/workflow.md` §3). ⚠️ It inherits a hard dependency: deletion currently removes the
  `subscriptions` row like any other, and L8 must cancel with PayOS *first*.
- **Two product decisions L9b left open, both small and both on the same screen:**
  `deleteDialog.support` names a support channel that does not exist anywhere in the repo, and there
  is **no deletion-requested notification email** — after the C2 fix the 7-day window is the only
  thing letting a victim notice a deletion they did not request, and the only channel announcing one
  is the settings page itself.
- **Two scoped follow-ups L9b sized deliberately so nobody re-derives them:** wiring the voice
  pronunciation score to its column (the client scores *after* the message POST and never learns the
  row id, so it needs the POST to return that id plus an endpoint to attach a score); and a
  repo-wide fix for `components/ui/dialog.tsx`, which restores focus blindly to a trigger that may
  have become disabled or unmounted while the dialog was open.
- **A DB-backed regression guard for RLS and column grants** — still owed, and L9b is the third
  branch to prove grant claims by hand (`L-005`).
- **Figma re-capture** — see below.

Four rulings from 2026-08-20 (the 7-day window vs the modal's "cannot be undone", the two deletion
tiers, the AI-training split, `/settings/privacy`) were made against two Figma frames Phase 0 never
saw. Do not re-litigate them, or decisions 2–3.

⚠️ **The Figma file has 69 top-level frames against `figma-frame-map.md`'s 57** (measured 2026-08-20),
so every registry row's `figmaCheckedAt` overstates what was compared. A re-capture pass is owed and
is deliberately outside L9b Plan 1.

**⚠️ Standing instruction that survives all of the above: do NOT settle navbar/routes/registry without
the user's review.** ("Do not port any screen yet" is retired — the IA is locked and the registry
exists, so porting is ordinary work now rather than something to block on.)

<details><summary>(superseded 2026-08-19) the 2026-08-12 block — "the IA proposal is BLOCKED on 5 answers from the user"</summary>

⚠️ **All five questions below were answered, and every stage downstream of them has since shipped.**
Kept only as the record of what Phase 0 delivered. This block sat in the file's "read this first"
region long after it stopped being true, which is `L-026` exactly: a resume document is code for the
next session.

**Read `mem:phase0_figma_inventory_run_state` § "▶▶ RESUME HERE" first — it is the authority.**

**Delivered 2026-08-12, all committed to master (working tree clean, last commit `5dfe498`):**
- `docs/product/screen-inventory.md` — **all 57 Figma frames read and analysed**, Part II §6–§19,
  ~1,900 lines, committed cluster by cluster. **§20 lists 10 content conflicts for the user to fix in
  Figma.**
- `docs/product/capability-map.md` — the aggregation: **12 capability areas**, the **six cross-cutting
  systems**, §3's four IA blockers, §4's rules for building the IA proposal.
- `docs/product/figma-frame-map.md` — name → node id, post-rename and read back from Figma.

**⛔ The IA proposal must not start until the user answers:**
1. `AI Sensei` vs the Companion — one intelligent presence or two?
2. One canonical **skill taxonomy** — three conflicting sets exist today.
3. **`Journey`** — the nav label points at the Diary; the design means the Roadmap.
4. **Both kanji surfaces** (discovery + curriculum) or one?
5. **Model choice** — policy requires asking before IA synthesis. **Recommendation on record: stay on
   Opus 5, no Fable** (the hard reasoning is already written down across the 8 clusters).

Then: propose IA → **STOP for the user's review** → lock IA → Screen Registry Phase 1 →
route/API reconciliation → UI implementation → L8 → L9.

**⚠️ Standing instructions: do NOT port any screen yet, and do NOT settle navbar/routes/registry
without the user's review.**

</details>

### The six cross-cutting systems the inventory found (this is the headline result)
A capability sighted in 3+ independent modules is **not a feature of any of them**:
**Learning Intelligence** (6 sightings) · **Companion presence** (all modules) · **save & collect /
mining** (6) · **pitch accent** (4) · **provenance-attached claims** (3+) · **progress narrative** (3).
**None of them may take a nav row** — they surface *inside* destinations.

### Method corrections that now bind all downstream work
- **Four layers, never collapsed:** A product intent · B UX representation · C implementation ·
  D constraint. A contradiction exists only when B is mistaken for C.
- **B splits:** **B-design is authoritative; B-content may be wrong** (report it).
- **⭐ Layer C is NOT a baseline.** The backend was built for a smaller product — a designed capability
  with no endpoint means *the design is larger*, never that the design is wrong. Do not phrase findings
  as "conflicts with the API".
- **Layer D still binds absolutely** (`CLAUDE.md` §2).
- **Never infer a frame's identity from its name** — the picture corrected four names this run.

<details><summary>(superseded 2026-08-12) the instruction that started this stage — Phase 0: Figma Product Inventory, Do NOT start Screen Registry Phase 1</summary>

## ▶ (historical) NEXT ACTION (2026-08-11) — **Phase 0: Figma Product Inventory. Do NOT start Screen Registry Phase 1.**

**User ruling 2026-08-11.** Screen Registry Phase 1 is still correct and its spec is still approved —
it just is **not next**. A new stage runs before it, because Phase 1 was about to be fed by guesswork:

```
Figma → Product Inventory → Capability Map → IA/Navigation → Screen Registry
      → Route/API reconciliation → UI implementation → L8 → L9
```

**The rule that drives it: navigation is an OUTPUT of the analysis, never an input.** Both navbars in
play are demos, not IA — the repo's `NAV_GROUPS` (provisional since C1) *and* the one in the user's
reference render. Judging Figma against either is a method error; the controller made exactly that
error on 2026-08-11 and it is what triggered this restructure.

Phase 0 answers, per frame: screen or state? · which capability? · entered from where? · exits to
where? · what actions? · what data? · API exists? · route exists? · related screens? Then capabilities
aggregate into product areas, and **IA is designed from those** — with a **human checkpoint before IA
is locked** (user requirement: never let the assistant settle IA and navbar unreviewed).

**Two artifacts, not one — this is load-bearing.** The analysis is prose/tables and one-time; the
registry is 12 typed fields and durable. `ScreenEntry` has no `purpose`/`entryPoints`/`actions`/
`dataNeeds`/`api` and must not grow them, or it becomes the "product ontology system" the user
explicitly forbade. Phase 0's doc *produces* decisions; the registry *holds* them.

Live inventory draft: `docs/product/screen-inventory.md` (`9580ad5`, `6074024`) — the frame list
classified into screens vs state-variants, plus the user's rulings. Product inputs and adjudications:
`mem:screen_registry_inputs`.

⚠️ **The 44↔56 divergence figure is DISCREDITED as a starting point.** It was produced by matching
route strings to frame names, which counted JLPT — fully designed *and* fully built — as a gap purely
because a dead `/jlpt-test` redirect stub has no frame. `R3` makes `screenId` the join key precisely to
avoid this. Re-derive from screen identity; inherit no count (`L-002`).

### Verified input path (probed 2026-08-11, use this, don't re-derive it)
- **Figma desktop MCP is live.** File key `IwFHZDZdHW7qsSFiNbWrkd`, one page `0:1`.
- **`get_screenshot` is the Phase 0 workhorse and is cheap** — it returns a short-lived URL (~80
  tokens), not an inline image. `curl` it, then Read the file. Verified on `149:2` (1536×2746).
- **Do NOT use `get_metadata` in Phase 0.** It is a *geometry* tool; the whole page is ~4.4M chars.
  Phase 0 asks about purpose and flow, which a screenshot plus the prose prompts answer far better.
- **`figma-mcp-go` returns `plugin not connected`** — that route needs the user to run the plugin.
- ✅ **Frame enumeration is SOLVED. `docs/product/figma-frame-map.md` (`9af7d7a`) holds all 57
  frames, name → node id.** Method, if it ever needs redoing: the user selects frames in Figma, then
  `get_metadata` with **no `nodeId`** prepends a `Currently selected nodes` block — it prints at most
  16, so capture in runs of ≤15.

**▶ Execution state and the concrete next action live in `mem:phase0_figma_inventory_run_state`.
READ THAT FIRST when resuming.** ✅ *(superseded 2026-08-12: the frame map AND the per-frame inventory
are both complete — see the current NEXT ACTION block above.)*

</details>

- **Richest un-read source: the Figma Make bundle's tier-A prose prompts** —
  `C:\Users\tplon\Downloads\Design Shadowing Page UI\src\imports\pasted_text\`, 21 files, 208 KB of
  design intent in words (`companion-home-design.md`, `kanji-explorer-screen.md`,
  `pronunciation-studio.md`, `about-philosophy.md`, …). Never read. It is a decaying snapshot for
  *numbers* (proven within a day) but far more stable for *intent*; cross-check against live
  screenshots. See `mem:figma_make_design_source`.

### Figma cleanup ordering — the circular dependency, resolved
The user was advised to delete obsolete frames *before* the analysis, while also wanting the assistant
to flag `CONFIRMED / LIKELY / AMBIGUOUS / OBSOLETE / STATE-VARIANT`. Doing the deletion first discards
the very frames the flagging would have identified. **Order: inventory pass first with every frame
tagged → the user deletes using the OBSOLETE list → only AMBIGUOUS gets discussed.** Exception: three
frames are already known dead and can go now — `Unuse` (`5:1718`), `Pricing-remove` (`71:2`), and the
superseded `Shadowing Hub` (`90:1985`, build against `149:2` instead).

**The boundary the user set, and it is binding:** the registry is a **derived identity/structure index**,
never a second Figma. Phase 1 answers only
`Figma screen ↔ screenId ↔ route ↔ IA/nav ↔ implementation`, plus `kind`/`impl` and the declared
`repo-only` exceptions. **Phase 1 does NOT fix catalog, copy, data, components or responsive just because
the inventory surfaces them** — that is Phase 2 adjudication. Acceptance is **zero visual diff**, with the
derived `NAV_GROUPS` deep-equalling a snapshot of today's literal captured BEFORE the refactor.

**Frame this correctly or the whole thing goes wrong:** merging C1 does NOT mean "the repo is now correct
against the product". It means "the implementation meets C1's contract; the registry will now say where it
matches the product and where it diverges." So when the inventory finds Pricing/FAQ/Checkout designed but
unbuilt, that is a **reconciliation finding, not new scope**.

Open items carried forward:
- **⚑ Product question the user must answer before C2 touches ranking:** may "Popular" render fewer than
  `limit` lessons when RLS hides some, or must the strategy over-fetch and backfill? Two deferred
  `lib/data/lesson-ranking.ts` defects wait on that answer (unbounded read vs `max_rows = 1000`, and
  `.slice(0, limit)` running before the RLS-filtered `videos` read).
- Two copy items parked for the localization/copy pass: the hardcoded English `"Reduce motion"` label with
  no catalog key in either locale, and `"Chưa có gì ở đây"` opening 5 of 10 `vi/upcoming.json` entries
  while `/vi/roadmap` does the same job forward-lookingly.

<details><summary>(completed) Lessons Registry — MERGED <code>88c1301</code> --no-ff, 2026-08-11</summary>

All 6 tasks done. `docs/lessons.md` is now the single canonical home for process lessons, guarded by
`docs/lessons.test.ts` (I1: every `L-NNN` reference in a tracked file resolves to a defined lesson; I2:
every id is defined exactly once). `CLAUDE.md` §10 (read contract) and §9 (write contract) now govern when
to consult and when to add to the registry — note `CLAUDE.md` itself carries zero `L-NNN` tokens today, so
the guard covers it in principle but is not yet exercised by it. Lesson bodies elsewhere — this file,
`project_status_archive.md`, `l9a_localization_run_state.md`, `shadowing_hub_plan_c_run_state.md` — are cut
to `L-NNN` pointers. Count entries with `grep -c "^### L-" docs/lessons.md`, never from a written figure.

**⚑ FOUR parked promotion reviews are the user's call, and they are the only open item this work leaves.**
`L-011`, `L-016`, `L-023` and `L-026` have each crossed lesson-entry rule 3's three-evidence
promotion-*review* threshold; all four carry a `Status:` line deferring the decision. Promotion to
`CLAUDE.md` law stayed out of this work's scope by design — see
`docs/superpowers/specs/2026-08-08-lessons-registry-design.md` §7. Only `L-011` was known during
execution; the final review found the other three, and this branch's own edits pushed `L-023` from two
evidence entries to four.

**Merged `88c1301` `--no-ff`.** Post-merge verified ON MASTER: tsc 0 · unit 2066/2066 across 231 files ·
lint 0 errors / 77 warnings, mix `54 no-non-null-assertion + 23 no-unused-vars` identical to baseline.
Branch retained, per this repo's convention of keeping merged feature branches. → Read
`mem:lessons_registry_run_state` for the full record, including all five upstream plan-authored defects
this run caught and the mitigation that closed them.

**The final review's two findings worth remembering, because both are the disease inside the cure:**
(a) the plan itself is a tracked, already-diverged second copy of every entry, while `docs/lessons.md`
claims to be the only place a lesson is written out — resolved with a banner line, since spec §7 forbids
rewriting a committed plan; (b) the l9a **mutation taxonomy** (which operator lists run against which test
layer) had been cut with no destination and existed nowhere, while its consumer is live — L9a Plan 3 Tasks
14–19 are pending and this file still tells their briefs to take its full text from that memory. It was a
run-scoped *instruction*, not a lesson, and the classification pass swept it up with the body around it.
Restored byte-identical under the `L-007` pointer. **That distinction — instruction vs lesson — is the one
to hold on to the next time anything is cut down to pointers.**

**Task 6 gate: tsc/lint/unit all green**, lint matching the pre-branch baseline mix and unit adding exactly
one test file (`docs/lessons.test.ts`). Task 6 round 1 found and fixed a real `tsc` failure in
`docs/lessons.test.ts` (`noUncheckedIndexedAccess` on a `matchAll` capture group) that had shipped
undetected since Task 2, which never ran `tsc`; fixed with a type-guard filter, not a non-null assertion or
a fallback default, so the guard's detection is unchanged — both mutation checks (I1, I2) were re-proven
red then green against the fix.

</details>

<details><summary>(completed) Shadowing Hub Plan C1 — merged `bd7f574`, 2026-08-08</summary>

Read `mem:shadowing_hub_plan_c_run_state` for the full record.

Spec `docs/superpowers/specs/2026-08-07-shadowing-hub-plan-c-design.md` **LOCKED** at `22c9d18`
(17 decisions D1–D17 + a measured evidence appendix). Plan C was split into three sequential plans —
**C1 Foundation / C2 Shadowing Hub / C3 Explore Lessons** — because measurement showed it was three
screens' worth of work, not one. Only C1 is planned so far, deliberately: C2 and C3 get their plans
after the plan before them merges, so each is written against a real foundation.

**C1 MERGED at `bd7f574` (`--no-ff`), 2026-08-08.** Post-merge on master: tsc 0, unit 2064/2064 across
230 files. The branch was KEPT, matching this repo's convention of retaining merged feature branches.
Never record a commit count — run `git rev-list --count`; see
`mem:shadowing_hub_plan_c_run_state` correction 1 for why. All 11 tasks done;
all four human gates approved, D on 2026-08-08. Gate, controller-measured after round 1's fixes: tsc 0 ·
lint 0 errors / 77 warnings (mix unchanged) · unit **2064/2064 across 230 files** · build ✓ · Playwright
**13/13** · browser pass 6/6. Both earlier open items are closed: Checkpoint B was approved, and the
Vietnamese copy ruling landed when the user rewrote the catalogs themselves (`d7ac610`, `60abdef`).

**Round 1 of the whole-branch review returned CHANGES REQUIRED and was right — five for five.** Its two
blockers (a redirect rule swallowing `/api/videos`; eight protected routes missing from middleware) are
fixed at `b4d624b` and `65ebb4c`. Two ranking defects are deferred to C2 by user ruling, one of them
carrying a product question that must be answered before a fix shape is chosen.

**⚠️ A green C1 does NOT mean the product's IA is settled.** The 22 NAV rows, 9 empty-state routes and 6
seeded collections are **provisional**; confirming them is Screen Registry Phase 2 —
`docs/superpowers/specs/2026-08-08-screen-registry-design.md`, committed at `e861150`.

Everything else — the full commit list, decisions amended during execution, the carry-forward lessons,
the plan defects the controller authored, and the deferred minors — is in
`mem:shadowing_hub_plan_c_run_state`, which was itself corrected on 2026-08-08 after the review found it
stale.

</details>

<details><summary>(superseded) previous NEXT ACTION — screen-port workflow, merged `7277ac1`</summary>

## ▶ (done 2026-08-07) — **Screen-port workflow MERGED to master `--no-ff` at `7277ac1` (17 commits). Branch deleted, not pushed.**

Spec `docs/superpowers/specs/2026-08-07-screen-port-workflow-design.md`,
plan `docs/superpowers/plans/2026-08-07-screen-port-workflow.md`, 7 tasks (an 8th was dropped).
Post-merge verified ON MASTER: **unit 2007/2007 across 221 files · tsc 0 · lint 0 errors + 77
warnings (mix `54 no-non-null-assertion + 23 no-unused-vars`) · Playwright 8/8.**

**Delivered — the token half:** `Rule #0` (Figma pixels are not an API; every value maps to a semantic
token) is enforced by `components/ui/token-scale.test.ts`, and `token-scale-adoption.test.ts` bans raw
numeric Tailwind in `components/ui/**`. One typography step added, `hero` = `4rem/4.25rem`. Seven
primitives moved onto `--space-*`. `bg-inputBackground` → `bg-input-background`.

**Delivered — the chrome half:** `app/[locale]/(protected)/` owns the authenticated session's lifetime
and mounts `AmbientProvider`; `(app)` (nav visible) / `(focus)` (nav mounted, hidden by default) /
`(immersive)` (no nav landmark) sit beneath it. `/journal` is immersive; `videos/[id]/shadowing` and
`.../dictation` are focus. **URLs did not change** — route groups never enter the path.
`lib/auth/current-user.ts` exports `getCurrentUser()`, `cache()`-wrapped and `server-only`.

### Rules this branch established — they bind every screen port from here on
- **Rule #0: semantic tokens are the public design API; Figma is an authoring tool, not a runtime
  contract.** Never port a px value. Measured evidence: the design's dominant body size is 10px
  across 883 sites, ≈×1.4 off the shipped scale. That ratio is an observation about one snapshot,
  NOT an invariant — do not build on it.
- **Large Japanese glyphs are content presentation, not interface typography.** 104/128/150px are
  never tokenised; no `kanji-xl`.
- **Provider lifetime > layout lifetime.** A state owner must outlive every chrome change. Future
  session-scoped owners (AI conversation, study queue, draft journal, mining selection) belong in
  `(protected)`, not in a chrome group.
- **Route groups express chrome contracts, not feature categories.** `(learning)`/`(study)` would be
  wrong; features churn, chrome contracts do not.
- **Overlay is presentation, not navigation.** A Figma modal becomes a dialog/drawer component, never
  a `page.tsx`, unless the URL must be shareable or state-recoverable — and then it is justified in
  writing, per screen.
- **`figma-prompt-style.md` (repo root) is authoritative for INTENT and for nothing numeric.** Its
  colour and font sections match the code; every geometry number in it is approximate. Measured:
  sidebar 224 vs real 220, collapsed 62 vs 68, content 1500 vs 1180, and its radius scale lists 12px,
  which appears nowhere in the design.

### Still deferred, by decision
- **All shell geometry** (sidebar width, collapsed width, toolbar height, right column, content
  max-width, gutters). `components/ui/container.tsx` still has Tailwind defaults (`max-w-6xl`,
  `px-4/6/8`) that were never compared against the design. Measure against the LIVE Figma at the
  moment the first screen in a group is ported — the local bundle decays, proven within one day.
- **Avatar primitive** — the design has one (initial letter in a `rounded-full`), `components/ui/`
  does not.
- Widening the Rule #0 scan beyond `components/ui/**`; `collectPrimitives` in
  `token-scale-adoption.test.ts` drops directory prefixes (fails loudly, no subdirs today);
  `anchor-boundary.test.ts` still pre-declares `(app)/shadowing/[id]/…` paths that now belong under
  `(focus)`; `supabase db reset` is not wired into `test:e2e`, so a fresh machine needs it before the
  new e2e can reach its seeded video.
- **Task 8 was DROPPED, not deferred** (user, 2026-08-07): moving `requireUser` out of
  `lib/data/videos.ts`. The spec's rationale was measured false — protected layouts use
  `getCurrentUser()`, and `requireUser`'s 22 importers are all in `lib/data/**`. Do not re-derive
  this question from spec §5.5.

### Lessons worth carrying
Migrated to `docs/lessons.md`: L-003, L-010, L-011, L-012, L-013, L-018.

</details>

## ▶ (superseded 2026-08-07) — **Figma Make token + typography foundation MERGED at `86328bc`.** Kept because its lessons and its two open browser-pass items are still live.

Post-merge verified on master: **218 files / 1966 tests**, tsc 0. Branching history gains
`figma-token-foundation 86328bc`.

Spec `docs/superpowers/specs/2026-08-06-figma-make-token-typography-adoption-design.md` (`f728731`),
plan `docs/superpowers/plans/2026-08-06-figma-make-token-typography-foundation.md` (`99f8978`),
9 tasks via `superpowers:subagent-driven-development` in a worktree.

**Delivered:** dark-only Korume palette in `:root` (no `[data-theme]` blocks); primitives renamed off
the Japanese scheme to `void/paper/ink/slate/ember/sand/mint/coral`; indigo deleted; new `--secondary`,
`--danger-foreground`, `--input-background`; absolute 8/14/20/28 radius; re-valued elevation; five
`next/font` roles (Plus Jakarta Sans / Be Vietnam Pro / Noto Serif / IBM Plex Mono / Noto Sans JP);
ThemeToggle unmounted from the shell but retained in the admin style guide.

**Final state:** unit 1966/1966 · tsc 0 · lint 0 errors, 77 warnings (78 baseline, rule mix identical,
none new) · Playwright **6/6** · LCP warm **300ms → 220ms** · font bytes fetched on `/vi`
**169 KB → 82 KB** (only sans + jp preload).

### Lessons worth carrying (the SDD ledger is deleted; these are the parts that generalise)
Migrated to `docs/lessons.md`: L-003, L-011, L-020, L-021, L-022.

### Open, deliberately deferred
- ⚠️ **Not verified: `/dashboard` and `/admin/style-guide` in a browser.** Spec §6 asked for a dense
  real screen; both are auth-gated and account creation is not something the assistant may do. Only
  `/vi` and `/vi/login` were checked visually. **Ask the user to click through those two.**
- `bg-inputBackground` is camelCase where the repo otherwise uses kebab Tailwind classes. Parked for
  the component-verification spec (spec §1 step 3).
- `--slate-800` hue is 217° where its hex rounds to 218°; contrast figures quoted from hex comments
  run ~0.08 higher than the HSL the tests actually evaluate. Both pre-existing-style rounding nits.
- `theme-toggle.tsx` hardcodes an English `aria-label` in an i18n'd app (pre-existing, not this branch).

> **Superseded NEXT ACTION blocks moved to `mem:project_status_archive` (2026-08-07)** — this file had
> outgrown a single read. Nothing was deleted; the history is verbatim in that file.

## ⭐ L9b DECOMPOSITION — user-approved 2026-07-24 (4 sequential plans, brainstormed on Fable)
L9b was too large for one spec, so it was split. Order and rationale:
1. **Plan 1 — launch-blocker debt:** transcript-submit UI (backlog #14, CRITICAL — core loop dead-ends
   without it, scope pivoted to auto-fetch not user-paste) + GDPR delete-my-data (backlog #5, §2
   non-negotiable, owed since L1, now a 3-stage grace-period design) + small items (#6 persist voice
   pronunciation score, #4 badge icons). **BRAINSTORM IN PROGRESS — see NEXT ACTION above, spec not
   yet written.**
2. **Plan 2 — Companion Presence** = Companion Plan 2 of 3. **DONE, merged to master `61416bd`
   2026-07-30.**
3. **Plan 3 — missing feature UIs:** dictionary meanings on tap-to-lookup (#15), "add to flashcard" from
   reading (#8), particle highlighting (#16), listening drill (#9)? — scope to be brainstormed. **NOT STARTED.**
4. **Plan 4 — landing/cinematic + tutorial + Companion Plan 3** (adaptive voice, AI reflection).
   Tutorial deliberately AFTER Companion Presence: per `MASCOT.md` the companion is the tutorial's guide.
   **NOT STARTED.** Character Identity (Spec 2 — name/lore/art) should be brainstormed right before this.
Then → **L8** (PayOS billing) → **L9c** (polish + perf audit).

<details><summary>(historical) Plan 3 mid-execution snapshot — superseded by the COMPLETE line above</summary>

**L9a Plan 3 WAS BEING EXECUTED** on branch **`layer-9a-string-extraction`** (off master @ `e5893e9`)
via `superpowers:subagent-driven-development`. Tasks 1-10 + 6b + 11a–11e + 12–15 committed/reviewed clean;
gate then: tsc 0 · 1619 tests / 196 files · lint exit 0 / 80-23 / 0 new. (Tasks 16–19 landed after this.)
</details>

**Task 15 done `49553cc` + lint-fix `07cb3fa`** (`conversation` ns — AI voice module, most error-path-heavy so
far). ONE fix wave, but it was a GATE catch not a review finding: the feature commit shipped a lint ERROR
(`no-empty-function` in a test) that the controller's own gate re-run caught (impl's "0 new" claim was false)
— fixed via SendMessage. Review itself came back 0 Critical/Important. Load-bearing SCENARIOS 3-consumer label
rewire done right (shared `scenarioLabel(t,...)` helper, fallback chain preserved). Implementer found a THIRD
convention-#4 leak (conversation-app `friendlyErrorFrom`) → `common.errors.network` now = **7 surfaces**; also
reused `common.states.loading`. Three distinct honest 503 degrade paths (STT/TTS/Claude). Detail +2 carried
Minors in `mem:l9a_localization_run_state`.

**Task 14 done `ac29966`** (`reading` ns — 39 leaves; 2nd consecutive 0-fix-wave task). Import graph clean.
**The D8 content/chrome boundary was the risk and was drawn exactly right** — reading passages, their
translations, Japanese words, and furigana are CONTENT (not localized); only chrome extracted. NEW
Convention-4 instance found & fixed (`reading-quiz` `friendlyErrorFrom` leaked raw `body.error` to a
`role="alert"` node → now logged + translated fallback). `common.errors.network` now = 5 surfaces.
**Refined getTranslations rule:** wire a translator ONLY where chrome strings actually exist — `reading/[id]/
page.tsx` is a 12-line pass-through with zero chrome, correctly left unwired (a `t` there = dead code + lint
warning). The audit's "pages fetch data → async → getTranslations" premise was factually wrong (children own
the fetch); the implementer overrode it correctly. Full detail in `mem:l9a_localization_run_state`.

**Task 13 done `763c884`** (`jlpt` ns — 81 leaves, 107-line en+vi catalogs; the FIRST 0-fix-wave task of
the run — the implementer found & closed its own 2 wiring survivors before review). Convention-#2 audit was
CLEAN (no cross-module surprise). Handled the hotspot: `lib/jlpt-ui.ts`'s `SECTION_LABELS`/`PILLAR_LABELS`
(English maps = section/pillar NAMES) DELETED, all 5 call sites rewired to `t()`. **TWO NEW standing lessons
(full text in `mem:l9a_localization_run_state`):** (a) namespace wiring is a **5-step** list — `types/messages.d.ts`
`AppConfig.Messages` also needs the namespace or tsc fails; (b) use `useTranslations` for ALL synchronous
components (even without `"use client"`, if imported by a client component `getTranslations` hard-fails);
`await getTranslations` only for genuinely-async server components. N5–N1 + "JLPT" left untranslated as required.

**Task 12 done `5dde8c8` + error-path test `4f9b473`** (`mining` ns — 4 components + 2 pages, 18 leaves
all pinned; the plan list omitted `mining-review-session.tsx` a 5TH time, controller audited it in and
patched the plan doc; that file mirrors Task 7's `review-session.tsx`, reusing `common.srs.*` +
`common.states.error`; the LAST `Error.message`→DOM defect CLOSED; 1 fix wave added the error-path RTL
assertion). **Task 11e done `1795471` + `faca02f`** (`shadowing-recorder-panel`; 41 leaves; Azure
`errorType` enum mapped via exhaustive `Record`; 1 wiring survivor 発音/リズム closed). Details in
`mem:l9a_localization_run_state`.

Commits 2026-07-22: `23a8f84` (11b `dictation`) · `36534b0` (plan-doc file-list patch) · `da41411`
(11c `shadowing` + `common.player.*`) · `9c9b3bf` (11d capture). **The user made their own commit
`3e4b4a3` "[LongTNP]: mascot" mid-run** (deleted `.docx`, added `MASCOT.md`) — those files are handled,
stop excluding them.

**NEXT: Task 13** (`jlpt` namespace) — `app/[locale]/(app)/jlpt/{page,[id]/page}.tsx`,
`app/[locale]/(app)/jlpt-test/page.tsx`, `components/jlpt/*` (~965 LOC, 10 components). Timer `aria-live`
warnings → nest under `a11y`, ICU time args identical across locales; pillar names + pass/fail copy live
here; **N5–N1 level labels NOT translated**; JLPT stays "JLPT". **AUDIT the file list + import graph FIRST
(convention #2 — the plan list has been wrong 5×, incl. Task 12's missing `mining-review-session`).** Read
`mem:l9a_localization_run_state` top "⭐⭐ STANDING CONVENTIONS" block first.

**Task 11 was SPLIT into 11a-11e** (plan commit `087b342`) after measuring it at 3793 LOC = 6.9x Task 10.
11a–11e ✅ (Task 11 DONE) · 12 ✅ `5dde8c8`+`4f9b473` (`mining`). **Tasks 13-19 + a metadata sweep (Task 18)
remain**. Namespaces so far: `common`, `nav`, `auth`, `marketing`, `dashboard`, `kanji`, `vocab`, `grammar`,
`videos`, `dictation`, `shadowing`, `mining`, `jlpt`, `reading`, `conversation` (15 done).

**⚠ The plan's file lists have now been wrong FOUR times, and 11d's miss crossed MODULES:** translating
the `useRecorder` hook broke 13 tests in `components/conversation/` because `voice-recorder-button.tsx`
consumes it and no list mentioned that. **Grep the IMPORT GRAPH of whatever you translate, not just the
directory you were handed.**
The 2026-07-20 pause is long resolved (the Task 5 draft was verified in place and kept).
**Before resuming, read `mem:l9a_localization_run_state` "▶ Plan 3 EXECUTION IN PROGRESS" FIRST** —
it holds the patterns Tasks 9-19 must follow (two were Critical review findings), the three things
Tasks 6/6b/7/8 settled, the review lesson about mutation-testing pins, the backlog items no task
owns, and the debugging gotchas. Then the SDD ledger `.superpowers/sdd/progress.md` (gitignored;
reconstruct from `git log` if lost), which carries the per-task detail and the carry-forward defects.

**Cadence that is working (keep it):** one fresh implementer subagent per task (sonnet) → an
independent code-review (opus) → one fix wave → controller marks complete. Every task so far needed
exactly one fix wave and every finding was a real defect, not polish. The reviews have been worth
more than the implementations: the three highest-value catches of the run all came from reviewers
and all were invisible to a green test suite (ICU `#` silently reformatting 1234 → "1,234"; no
Vietnamese message ever being ICU-parsed in CI; raw `Error.message` reaching the DOM and making the
translated error string unreachable).
**SIX STANDING CONVENTIONS, binding for Tasks 13–19 (user-codified after Tasks 11–12, 2026-07-22) — full
text in `mem:l9a_localization_run_state` top block "⭐⭐ STANDING CONVENTIONS", put ALL in every implementer
AND reviewer brief:** (1) mutation in TWO layers → `docs/lessons.md` L-007; (2) audit the DEPENDENCY GRAPH
not the plan → `docs/lessons.md` L-023; (3) swap-proof render assertion for TYPE-INTERCHANGEABLE values →
`docs/lessons.md` L-008; (4) server-authored diagnostics NEVER reach the DOM — **defect class CLOSED after
Task 12** (5 instances all fixed; apply the rule to any NEW instance the audit finds, don't hunt); (5) Task
19 exit criterion — re-audit `common.*` consumer counts by surface (demote `common.player.*` to
`shadowing.*` if still single-surface); (6) proportionality → `docs/lessons.md` L-014. The original two are
(1)+(5B): (A) mutation's two-class separate-survivor-count reporting rule → `docs/lessons.md` L-007.
(B) When promoting into `common.*`, **record the actual consumer count, naming the unit** — importing
FILES vs consuming SURFACES differ, and P4 tests MODULES. Measured: `common.player.*` = 3 files but
**1 surface** (demotion candidate); `common.errors.network` = **2 consumers**, NOT the 28-places/8-modules
figure, which counts un-migrated raw English literals (a backlog, not consumers).

**Two ROADMAP additions decided during execution:**
1. **Task 6b (inserted, done)** — `lib/i18n/catalog.test.ts` now parses every message in every
   locale as a real ICU AST instead of matching regexes.
2. **A metadata sweep task (not yet written)** — 25 pages carry `export const metadata` in English;
   the user chose one dedicated task near the end over doing it piecemeal. **Module tasks LEAVE
   metadata in English.**

## ⭐ ROADMAP SEQUENCING — decided 2026-07-16 (read before choosing what to build next)
**User launch philosophy (explicit):** still in BUILD phase; publish ONLY after everything is
complete, polished, and fully-featured. There is NO near-term launch, paid-beta, or revenue goal.
This resolves the "L8 vs finish-L9" question decisively:

**Order = finish L9 first, do L8 (billing) near the very end, right before publish:**
1. **L9a — i18n + design system** (foundation; VN-first, replace English shell). Unblocks EVERYTHING
   visual + Companion Plans 2/3. Split into 3 plans: **Plan 1 localization architecture = ✅ DONE,
   MERGED `69f22e6` 2026-07-18** (see block above + `mem:l9a_localization_run_state`); **Plan 2
   design system = ✅ DONE, MERGED `fcd35af` 2026-07-18** (plan doc w/ execution addendum:
   `docs/superpowers/plans/2026-07-18-l9a-design-system.md`); **Plan 3 string extraction
   EN-verbatim + Vietnamese (spec Phase 2/3) — NOT WRITTEN, THE LAST L9a PLAN**. ←
   **NEXT ACTION: see ▶ NEXT ACTION block above (manual style-guide pass, then write Plan 3).**
2. **L9b — surfaces**: Companion Plan 2 → Plan 3, the missing feature UIs, landing/cinematic, tutorial.
   Fold the two launch-blocker debts in here (they count as "fully-featured"): **user transcript-submit
   UI** (backend done since L3, UI missing = core loop dead-ends) and **GDPR delete-my-data** (§2
   non-negotiable, owed since L1). Companion Plans 2/3 are HARD-BLOCKED on L9a.
3. **L8 — billing (PayOS)**: subscription + Founding price-lock + per-user Knowledge-Gen quota + auto
   kill-switch + Contextual Discovery UI nhúng vào L9b surfaces. Deferred to here because its conversion
   mechanism needs surfaces to exist, and cost-defense isn't urgent while AI is off in prod.
4. **L9c — polish + perf audit** on the final UI (why L9c was split out).

**HARD CONSTRAINT that overrides the order:** L8's per-user quota + auto kill-switch MUST land BEFORE
`ANTHROPIC_API_KEY` is added / AI is enabled for anyone (even mid-build end-to-end testing with other
people) — today only a manual ~$1-2 spend-cap exists. Reasoning behind all of the above is in this
session's discussion; flip to L8-first ONLY if the goal changes to open-paid/AI-to-real-users-soon.

## Stack
Next.js **14.2.35** App Router + TS strict + Tailwind. React **18.3.1**. Supabase
(Postgres + Auth + Storage) via `@supabase/ssr`. Zod. Motion: Lenis + Framer + GSAP.
AI: `@anthropic-ai/sdk` 0.111.0. Tests: Vitest+RTL (unit), Playwright (`tests/e2e`). Staying on
**Next 14** (revisit L8; don't silently bump — see `nextjs-14-pin-decision`).
**Fonts (since `86328bc`, five roles via `next/font/google`):** `--font-sans` Plus Jakarta Sans ·
`--font-display` Be Vietnam Pro · `--font-serif` Noto Serif · `--font-mono` IBM Plex Mono ·
`--font-jp` Noto Sans JP. **Only sans + jp preload**; the other three are `preload: false` +
`display:"swap"`. Outfit / Noto Serif JP / DM Mono were REJECTED — none has a `vietnamese` subset and
they had been assigned the headings and the Companion Diary prose in a VN-first app. `--font-jp`
stays a sans because it carries furigana at very small sizes, where mincho serifs break first.
⚠️ **`subsets: ["latin"]` does NOT suppress CJK** — Noto Sans JP still emits 373 unicode-range
`@font-face` rules and the browser fetches the needed slice. Verified in-browser. Also: **width
comparison cannot detect CJK fallback** (both real and fallback render full-width at exactly 1em) —
inspect `@font-face` unicode-ranges instead.

## Branching policy (user-set)
One branch per layer `layer-<n>-<slug>` off master; merge `--no-ff` ONLY after DoD (tests pass +
code-reviewer sign-off); never push unless asked. History: L1 `1d1628e`, L2 `618e1a4`,
L3 `d6c2138`, L4 `63b965f`, L5 `74514cd`, L6 `3fe741b`, L7 `01ae59d`, Spec A `201a9b4`,
Companion Core `9f09cf2`, L9a-Plan1 `69f22e6`, L9a-Plan2 `fcd35af`, L9a-Plan3 `d7b158c`,
Design-docs reconciliation `20d6eed`, Shadowing Hub Lesson Workspace Plan A `a6a7617` / Plan B
`b36c455`, Shadowing Practice Figma reconciliation `b56bba1`, Korume rebrand Plan A `69c4685` /
Plan B `44521bc`, Figma token + typography foundation `86328bc`, Screen-port workflow `7277ac1`
(2026-08-07), Shadowing Hub Plan C1 `bd7f574` (2026-08-08), Lessons Registry `88c1301` (2026-08-11),
Screen Registry Phase 1a `fff90fa` / 1b `6f67dd1` (2026-08-13) / 2a `e767537` / 2b `10caaac`
(2026-08-14), **certification grants hardening `a371a4b` (2026-08-19)**.
⚠️ This list went five merges stale before 2026-08-19 — every screen-registry phase was missing.
Re-derive it rather than trusting it: `git log --oneline --merges master`.

## Progress
**The layer-by-layer build log for L1–L7 lives in `mem:project_status_archive`** — it is a
completed-work record, not something a session needs in full. L1–L7 are all DONE and merged;
branch SHAs are in § Branching policy above. Only L8 (PayOS billing) and L9c (polish/perf) remain
unbuilt from the original 8 layers — see § ROADMAP SEQUENCING for why they are last.

## Key gotchas learned
- **Table GRANTs**: migration-created tables do NOT inherit Supabase default grants → queries as
  `authenticated` failed with 42501 until `20260712000006_grants.sql`. Every NEW table needs RLS
  enabled (default-privileges auto-grant DML to authenticated → table without RLS = open hole).
- Content is versioned reference data → lives in MIGRATIONS (not seed.sql) so `db push` deploys it.
- **RLS gates ROWS, not columns.** Column control = `revoke update ... ; grant update (<col>)`.
  **Layer 7 admin approval MUST use the service-role client** (authenticated has zero UPDATE on
  videos.status/title/etc.). For shared AI content the L4 pattern: SELECT-only policy + explicit
  revoke of write grants + service-role write path.
- **⭐ Verifying a PostgREST write — the STATUS CODE is the part that lies, not the whole response.**
  A `PATCH` answers **204 whether it updated every matching row or none**. The two differ only in
  `Content-Range`, which is easy to miss: under `Prefer: return=minimal` that header reads `*/*` for
  zero rows and `0-(N-1)/*` for N. Ask for **`count=exact`** (alone, or alongside `return=minimal` —
  behaviour is identical) to get the count itself: `*/0` for zero, `0-(N-1)/N` for N. **The figure
  after the slash is the affected-row count.** Two traps, both measured 2026-08-19 on
  `certification_questions` **with the write grants and a permissive UPDATE policy temporarily
  restored** — on a clean `db reset` every variant returns 403, so the recipe reproduces nothing
  without that setup:
  (a) **ANY `PATCH` needs SELECT on the columns named in its FILTER** — not on the columns being
  written, and not on what a representation would return. This is a Postgres `UPDATE … WHERE` rule,
  not something the count preference introduces. PostgREST rejects an unfiltered UPDATE outright
  (`400 21000 "UPDATE requires a WHERE clause"`), so the requirement is never optional; with SELECT
  revoked entirely the probe returns 403 and tells you nothing.
  (b) **A `*` representation is a trap on a column-grant-restricted table.** `return=representation`
  defaults to `*`, so it answers **403 `42501`** for a *read* reason indistinguishable from a refused
  write — which is why it is the one preference that spoils the probe here. Narrow it with
  `select=<granted cols>` and the same call returns 200, which is how you tell the two apart.
  This is the canonical home for the recipe; `docs/lessons.md` L-001 carries the lesson it evidences
  and points here.
- **§2 & YouTube audio**: never extract/compare YouTube source audio; pitch reference = TTS of
  the transcript line TEXT; user contour = mic recording only.
- **Sentence mining stores NO media** (§2): card = text + `{video_id,start,end}`.
- **Azure short-audio format**: webm/opus is rejected — convert to 16kHz mono 16-bit PCM WAV
  client-side (`blobToWav16kMono`) before upload; keep stored recordings webm.
- **Claude API**: official SDK only, `claude-opus-4-8`, no temperature/top_p, `messages.parse` +
  `zodOutputFormat`, no prefills, typed error handling (RateLimitError/AuthenticationError/…).
- **Admin auth**: `users.is_admin` (DB) = source of truth; `ADMIN_EMAILS` = bootstrap-only, and
  the promotion fires ONLY inside `requireAdmin()` — any server gate for admin surfaces must call
  `requireAdmin()`, not `isAdmin()` (side-effect-free), or the first admin can never get in.
- **Consent-scoped payloads**: what a user opted into showing defines the response shape —
  leaderboard returns name/avatar/weeklyXp but NOT userId; peer-review authors never include email.
- jsdom quirks: Blob has no `arrayBuffer()` (use `@/test/blob-utils` `readBlobBytes` /
  `lib/audio/read-blob.ts`), no Web Audio (use `@/test/audio-context-mock`), no canvas 2D.
  Radix polyfills (ResizeObserver, pointer capture, scrollIntoView) live in `vitest.setup.ts`.
- **`cn()` + custom Tailwind scales (L9a-Plan2)**: `lib/utils.ts` uses `extendTailwindMerge`
  configured with every custom token scale. Plain twMerge misreads `text-body`/`text-caption`
  as COLOURS and silently strips them. **Any new scale added to tailwind.config.ts MUST also be
  added there** — `lib/utils.test.ts` is the guard. Also: dynamic class names (`shadow-${x}`)
  are never emitted by Tailwind static extraction — use literal maps.
- **Design tokens are DARK-ONLY since `86328bc`.** Values live in `:root`; there is **no
  `[data-theme]` block at all**, and `lib/design-tokens.test.ts` asserts the string is absent.
  `ThemeProvider` + `data-theme` + `components/ui/theme-toggle.tsx` are all retained on purpose, so
  light mode returns as ONE added block. The toggle is mounted only in the admin style guide.
  `color-scheme: dark` is declared in `:root` and pinned by test — without it the UA keeps rendering
  scrollbars, autofill, native `<select>`s and checkboxes in the light scheme.
- **Primitive names are `void / paper / ink / slate / ember / sand / mint / coral`** — the Japanese
  scheme (`vermilion`/`indigo`/`washi`/`sumi`) is gone, and indigo was deleted outright. Primitives
  are referenced in exactly THREE places: `app/globals.css`, `PRIMITIVE_TOKENS` in
  `lib/design-tokens.test.ts`, and `PRIMITIVE_COLORS` in `components/style-guide/token-sections.tsx`.
  A **fourth** location must stay in sync for semantics: `tailwind.config.ts`. A token present in
  three of four is the classic drift.
- **`-foreground` is for SOLID fills; `-strong` is for text on an alpha tint.** Pairing `-foreground`
  with `bg-<c>/<alpha>` is a real bug that shipped twice. And structural correctness is not enough —
  the pairing must actually measure ≥4.5:1. `--paper-50` on `--accent` is 1.98:1 and on `--danger`
  2.98:1, so **text on a warm fill is always `--ink-950`**.
- **Auditing colour usage needs MORE than one grep.** This bit twice in one branch:
  `bg-<c>/<alpha>` missed `notification-bell` (no alpha suffix), and `hover:bg-muted` missed
  `select.tsx`'s `data-[highlighted]:bg-muted` — the keyboard-nav indicator, i.e. CLAUDE.md §2 rule 5.
  Always sweep variants (`data-[…]`, `focus`, `focus-visible`, `group-hover`, `aria-*`, `peer-*`)
  AND hardcoded colours (`text-white`, `text-black`, `text-[#…]`) on solid fills.
- **`--muted` is a RECESSED surface (1.07:1 vs background), not a hover surface.** Hover uses
  `--secondary` (`--void-800`, 1.26:1). `bg-muted` as the resting colour of an unselected tab/pill
  with `hover:text-foreground` is a different, legitimate pattern — leave those alone.
- **Design-system boundaries (L9a-Plan2)**: `@radix-ui/*` imports only in `components/ui/**`
  (ESLint, fire-tested); the `components/ui/**` ESLint override RESTATES the whole
  no-restricted-imports rule minus Radix — editing one copy requires editing both. New ui
  primitives must use CSS logical properties (ps-/pe-/ms-/me-/text-start…) — auto-enforced by
  `components/ui/logical-properties.test.ts`.

## Deploy target (user-set)
**Self-hosted at `almostgone.vn`** — a single long-running Node instance (NOT Vercel/serverless).
Consequence: `lib/rate-limit.ts` in-memory sliding-window IS a real limiter here (state persists across
requests, no per-cold-start reset) — the "per-instance / resets" caveat only bites if we later scale to
multiple instances behind a load balancer (then → Redis). Cost-defense: user runs a low Anthropic Console
spend cap (~$1–2) = a manual global kill-switch (defense layer #1); it's a monthly org budget, near-real-time
(can slightly overshoot), and blunt (all-or-nothing app-wide, not per-user) — still need per-user Knowledge-Gen
quota (L8) before opening to real users. Supersedes spec's "Deploy: Vercel". Payments = PayOS (not Stripe).

## DB / running locally
Local Supabase (Docker) is the dev DB; `.env.local` points at it. Docker Desktop must be running
(`npx supabase start`). `npm run dev` → localhost:3000. Studio :54323. `npx supabase db reset`
re-applies migrations (**15 built** — Companion migration #15 `20260716000015_companion_memories`
merged 2026-07-16). Cloud move (still not done): create free project → swap 4
`.env.local` values → `supabase link` + `supabase db push`; add Google OAuth creds in dashboard.
Env keys (AUDITED 2026-07-14, see `mem:product_readiness_audit_2026-07-14`):
`ANTHROPIC_API_KEY` **NOT in .env.local** (earlier "set" claim stale) → all Claude features
degrade to "not configured". `AZURE_SPEECH_KEY` present but **INVALID — Azure returns 401**
(value looks like a GUID/resource-ID, not Key1/Key2) → TTS/STT/pronunciation all fail (502).
`ADMIN_EMAILS="admin@almostgone.vn"` added 2026-07-14 (bootstrap admin exists locally).

## Verify commands
`npx tsc --noEmit` · `npx vitest run` · `npm run lint` — **never quote a test or file count from this
file; run the command.** (`docs/lessons.md` L-002. The figure that used to sit here went stale twice.)
The one number worth pinning is the lint debt, because it is a *comparison baseline*, not a measurement
of today: lint exits 0 with long-standing warnings, and "clean" means **0 NEW errors and an unchanged
RULE MIX** — `54 no-non-null-assertion + 23 no-unused-vars`. Compare the mix, never the total.
Last full gate on master: `88c1301`, 2026-08-11 — tsc 0, unit all green, lint mix as above.
⚠️ **With a worktree present, `npm test` from the repo root scans it too** — `vitest.config.ts`
excludes `node_modules`, `.next`, `tests/e2e` but NOT `.worktrees/`. Pass `--exclude ".worktrees/**"`
or remove the worktree first. Still not fixed in config.
⚠️ **A worktree has NO `.env.local`** — read `docs/lessons.md` L-020 before trusting any e2e run there.
`npm run build` (~52s) · `npx playwright test` (**8 e2e**, ~50s; free `:3000` first — `docs/lessons.md`
L-017) · `npx supabase db reset`
(15 migrations).

⚠️ **The e2e suite structurally CANNOT reach full green on a dev machine — this is permanent, and
"fixing" it is a mistake.** Five specs die at registration because there are no backend credentials
locally. Measured 2026-08-13 on the Phase 1a branch: **5 fail / 8 pass**, and an *identical* 5 fail /
8 pass at its branch point `e4f407a`. **Delta zero ⇒ environmental, not a regression.** Therefore:
read a local Playwright result only as a **comparison against the branch point**, never as an
absolute pass count, and never repair the environment just to make the number look nicer — the
comparison is the whole signal, and a green-by-configuration run destroys it. Record the comparison
in the branch's acceptance notes rather than treating a non-green run as a blocker. ⚠️ `tests/e2e/route-group-provider-identity.spec.ts` needs the seeded FREE-tier video
in `supabase/seed.sql`, so a fresh machine must run `db reset` before that spec can pass; nothing
wires the two together.
Known CPU-contention flakes (standalone-green): `pitch-contour.test.tsx`, `waveform.test.tsx`.
Component tests import render from **`@/test/render`** (NextIntlClientProvider, locale="en"). Shared test harness in
`test/` (`@/test/*`): media mocks, YouTube IFrame stub, Claude + Azure Speech + AudioContext
mocks, tone-buffer/transcript/URL fixtures, blob utils, `supabase-mock.ts` (chainable
query-builder mock for lib/data tests).

## Deferred follow-ups

**USER-FACING FEATURES đã hoãn nằm ở memory riêng `mem:feature_backlog_deferred` — PHẢI đọc nó
khi plan bất kỳ layer mới nào (user mandate 2026-07-14: không bỏ sót chức năng đã brainstorm).**
Mục dưới đây chỉ là engineering debt/nits.

**⭐ HARD DEPENDENCY ON L8 — PayOS cancellation before erasure (added 2026-08-20).** L9b Plan 1
builds account deletion while no billing integration exists, so it deletes the `subscriptions` row
like any other user-owned row. **When L8 lands, deletion must cancel the PayOS subscription first** —
erasing the account of someone with a live recurring charge, and keeping the charge, is the worst
shape this can take. Home of the reasoning:
`docs/superpowers/specs/2026-08-20-l9b-plan1-gdpr-design.md` §6. **L8’s spec must carry it as a
requirement**, not discover it.

**⭐ SCOPED TASK, not a nit — wire the voice-mode pronunciation score to a real caller (added
2026-08-22, user ruling).** `conversation_messages.pronunciation_score` is PREPARED end to end on the
server: accepted and range-validated at the API boundary (`lib/validation/conversation.ts`), carried
through the data-layer input type, and written on message insert (`lib/data/conversation.ts`). Those
three hooks are deliberate and must NOT be deleted as dead code — the user ruled explicitly that the
column stays prepared. What is missing is a caller, and it cannot be added without new surface: the
client scores asynchronously *after* the message POST resolves
(`components/conversation/conversation-app.tsx`) and never learns the created row's id, so at POST
time there is nothing to send. **Wiring it needs two things: the message POST must return the created
row id, and a new authenticated + rate-limited endpoint must exist to attach a score to a message the
caller owns.** L9b Plan 1 deliberately builds neither. Design notes and the reason live in
`docs/superpowers/specs/2026-08-20-l9b-plan1-gdpr-design.md` §12 and §14 — this entry is the task,
that spec is the reasoning. Natural home: whichever layer next touches voice conversation mode.

**⭐ SCOPED TASK, not a nit — a DB-backed regression guard for RLS and column grants (added
2026-08-19).** `L-005` says no mocked test can ever guard these, so the only instrument is a test
against a real Postgres. **Feasibility is proven**: on 2026-08-19 the full migration chain was applied
from zero to a local Supabase and probed as the real `authenticated`/`anon` roles over PostgREST —
ten assertions, exit 0 — which closed Phase 2b's open security debt and exposed a write-grant gap that
reading the migration had not surfaced (fixed in `20260819000028`). What does **not** exist is any
guard against a future regression. Deliberately deferred rather than bolted onto that migration: it
has to settle DB lifecycle, CI dependency, seed/reset, credentials, suite runtime, and how it skips
when Docker is absent — an architecture decision, not a fix. The assertion list to rebuild from is
enumerated in commit `74a752a`'s message. Pairs naturally with the long-standing L2 item below (CI
guard asserting RLS is enabled on all public tables), which the same harness would satisfy.

**⭐ RESIDUAL from the same run — the write-grant asymmetry is repo-wide, and only two tables were
fixed.** `20260819000028` closed it on `certification_questions`/`certification_tests`. Other public
tables still hold the same shape — `authenticated` carries INSERT/UPDATE/DELETE while no policy admits
any write — **`subscriptions` among them**. All are held shut by RLS alone, exactly as the certification
pair was: defence-in-depth missing, not an open hole. Never write the list or its size here (`L-002`);
enumerate it:
```sql
select t.table_name from information_schema.table_privileges t
 where t.grantee='authenticated' and t.table_schema='public'
   and t.privilege_type in ('INSERT','UPDATE','DELETE')
   and not exists (select 1 from pg_policies p
                    where p.schemaname='public' and p.tablename=t.table_name
                      and p.cmd in ('INSERT','UPDATE','DELETE','ALL')
                      and p.roles::text like '%authenticated%')
 group by t.table_name order by t.table_name;
```
(The `roles like` test misses a policy granted `to public`, which would also apply to `authenticated`;
none exists today and the failure direction is over-reporting, which is the safe one.) TRUNCATE is a
separate matter with its own home — see the L6 entry below, which is its one home.
From L1: GDPR delete-my-data; getUser() in middleware on all routes (perf); conditional
aria-describedby; users_update_own email/level column scope. From L2: `unique(word, reading)`
won't dedupe reading-less vocab (NULLs distinct) — matters when admin CMS adds entries; add CI
guard asserting RLS enabled on all public tables. From L3 (non-blocking nits): adaptive furigana
homograph false-hide + `Object.hasOwn`; mine popover outside-click dismiss + aria live-region;
radiogroup roving tabindex; mining duplicate-card dedup; `lib/rate-limit` unbounded map (Redis in
L8); `VideoRow` type duplication; Supabase-backed integration tests; difficulty scorer caching.
From L4 (review nits, non-blocking): persist voice-mode pronunciation score to
`conversation_messages.pronunciation_score` (column exists, deliberately unwired — best-effort
client-side only for now); human-review/publish gate for `source='ai_generated'` vocab examples
(candidate for L7 admin tools). From L5: "Add to flashcard" from reading passages is disabled —
`/api/mining` requires `lineId` FK into `transcript_lines` (video-only); generalizing the mining
schema (nullable lineId + source discriminator) is a future decision (fits F-010/F-014);
listening weakness links route to `/videos?level=` (no dedicated listening drill module yet);
site-wide i18n/VN-localization of the English shell = deliberate product decision, not per-module;
`jlpt_questions.question_type` free-form text (add check constraint if vocabulary stabilizes);
manual click-through of /jlpt + /reading in the browser not yet done (only unit/e2e-registration
coverage) — worth doing before real users. From L6: one intermittent unit-test failure observed
once (822/823, then 823/823 twice; test unidentified, reviewer found no time-fragile test in the
new code — watch for recurrence); markNotificationsRead maps DB errors to 400 (should split 500);
recommendations tokenizes ≤100 transcripts/request with no cache (revisit with catalog growth or
L3's deferred difficulty-cache); Supabase's bootstrap `pg_default_acl` (NOT
`20260712000006_grants.sql`, which grants `authenticated` only select/insert/update/delete and grants
`anon` nothing — its `grant all … to service_role` is a separate matter) gives **both `authenticated` AND `anon`** TRUNCATE/REFERENCES/TRIGGER on every public
table — count them, never quote a figure. **RLS does not gate TRUNCATE**, so "RLS holds it shut" is
only ever a claim about INSERT/UPDATE/DELETE. Not reachable via PostgREST (no TRUNCATE verb), hence a
hardening candidate rather than a live hole; badge iconUrl all null
(SVG fallback in UI — real icons = content task); srs_due notification producer unwired (needs
scheduler, pairs with push/email deliverer later); manual browser click-through of dashboard/bell/
recommendations not done (unit+build coverage only). From L7: ~~admin dialog focus trap~~ **REPAID in L9a-Plan2** (`components/admin/dialog.tsx` is
now a thin wrapper over `components/ui/dialog.tsx`, Radix focus trap); `stroke_order_svg` stored/rendered as raw SVG (fine while only admins write — needs
allowlist SVG sanitizer before less-trusted contributors); `users.email`/`created_at` still
client-writable (hardening migration candidate); no 'rejected' video status (reject = hard delete,
moderator reason logged not persisted) and no 'admin' transcript_source (admin-attached transcripts
stored as 'user_submitted') — both need a migration if wanted; CSV import is flat rows only (nested
kanji readings / test questions / passage questions via JSON create/update after import) and the
table doesn't auto-refresh post-import; admin content edit form only pre-fills fields present in
the list query (no GET-single endpoint); forum comment optimistic insert shows "You" until reload
(cosmetic); save-to-playlist overlay on /videos uses ARIA role="list" wrapper (revisit if
video-card gets a slot); community cursor pagination assumes distinct created_at at page
boundaries; admin stats count ids in JS not count:'exact' (fine at current scale); manual browser
click-through of /community, /playlists, /leaderboard, /admin not done (unit+build only).

## Parked

*(nothing currently parked — the one entry that lived here is resolved, see below)*

**~~Shadowing Hub Consolidation IA spec~~ — ✅ EXECUTED, no longer parked (corrected 2026-08-06).**
`docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` §6's 17-file change list was
carried out inside **Lesson Workspace Plan A (Docs)**, merged `a6a7617` (2026-07-31) — not as its own
branch, which is why this section wrongly still read "NOT yet executed" for a week. Proof: both
`docs/design/screens/screen-shadowing-hub.md` and `screen-shadowing-practice.md` exist.
The old "user deferred it to finish L9b first" note is historical only.
`mem:shadowing_hub_consolidation_status` has been rewritten to match.

## Working agreements
TDD-first, tests shown passing. code-reviewer signs off every non-trivial change before "done".
Data flows down schema→API→UI. Never download/proxy video (YouTube IFrame only). **Commit freely
without asking** (user granted standing permission 2026-07-13 — supersedes old "commit only when
asked"); push to remote still requires an explicit ask. Branch-per-layer + merge-to-master-when-done.
