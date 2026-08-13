# Screen Registry — run state (⭐ THE LIVE NEXT ACTION: Phase 1b)

# ▶▶ RESUME HERE

**Phase 1a is MERGED to master at `fff90fa` (2026-08-13). Working tree clean. Post-merge verified on
master: `tsc` 0 · `vitest` 235 files / 2096 tests · `lint` 0 errors · `next build` OK.**

**▶ NEXT: Phase 1b — move the registry's nav data to the LOCKED IA.** One data-only commit.
Everything it needs is already decided; nothing about it is open.

---

## What Phase 1a shipped

Navigation is no longer a hand-written literal. It is a **derived view** of a typed screen registry.

| File | Role |
|---|---|
| `lib/product/screen-registry.ts` | one typed record per product screen — the data |
| `lib/product/screen-registry-types.ts` | `ScreenKind · ScreenImpl · ScreenChrome · RepoOnlyReason · NavGroupId · ScreenEntry` (exactly 12 fields, R12 forbids more) |
| `lib/product/route-resolver.ts` | page-file path → `{ route, chrome }`, plus `listPageRoutes` |
| `lib/product/nav-derivation.ts` | `deriveNavGroups(registry)` → the nav shape |
| `lib/product/nav-groups.ts` | the derived `NAV_GROUPS` / `NAV_ITEMS`, **server-side only** |
| `lib/product/nav-baseline.fixture.ts` | frozen pre-refactor oracle for T6 |

Tests: `T1 · T2 · T2b · T3 · T4 · T5 · T6 · T7 · T8 · T9 · T10 · T11`, every one mutation-checked.
(`T11` is the nav→page assertion. It shipped titled `T2b`, colliding with the resolver test that
already held that id in spec §4.1; renamed 2026-08-13, logic untouched.)

**Phase 1a deliberately encoded TODAY's navigation**, including the wrong `journey → /journal` row.
That is not an oversight — 1a proves the engine, 1b changes the product decision, and the two must
never share a diff.

---

## ⛔ PHASE 1b — the four traps, learned the hard way. Read before writing any code.

1. **⛔⛔ NEVER regenerate `nav-baseline.fixture.ts` from `deriveNavGroups()`.** It is an
   **independent oracle** and the only reason T6 means anything. Dump the derivation into it and T6
   becomes self-referential — it will pass forever while asserting nothing, and it takes the
   nav-completeness guards down with it. **Hand-write the new baseline from
   `docs/product/ia-proposal.md` §2.**
2. **Two-directional completeness is TWO invariants.** `T1` = *page → registry*. `T11` = *nav → page*.
   Phase 1a nearly shipped without the second because the spec claimed T1 subsumed it — it does not,
   and that was proven by construction (a nav row pointing at a routeless page left every test green
   while the sidebar rendered a dead link). **Phase 1b adds `/companion` and `/pronunciation`, which
   are designed-before-built — exactly what T11 exists to catch.** Keep both.
3. **`deriveNavGroups` now THROWS** on `navGroup !== null && route === null` rather than silently
   dropping the row. So a 1b entry with a nav group but no route yet **crashes both server layouts**.
   Give every new nav row a real route (an honest `UpcomingScreen` page is the established pattern
   from C1) or leave `navGroup: null` until the page exists.
4. **`components/layout/app-nav.tsx` is `"use client"` — never import the registry into it.**
   Doing so ships the whole registry to the browser (measured ~17.9 KB: Figma node ids, unshipped
   screen names, `legacy-unreviewed` debt labels). It is derived in the two server layouts and passed
   as a `groups` prop. Verify after any change by building and grepping the client chunks **with a
   positive control**, or a broken grep will read as a clean result.

### What Phase 1b must actually do

Apply `docs/product/decision-register.md` §2 (A1–A13, `LOCKED`). Concretely:

- Rewrite `NavGroupId` to the five new groups: `learn · practice · remember · journey · account`.
  ⚠️ `GROUP_ORDER` in `nav-derivation.ts` has a compile-time exhaustiveness check — a member added
  to the union without being added to `GROUP_ORDER` now **fails `tsc`**, which is intended.
- Re-point `navGroup`/`navOrder` on the registry rows per `ia-proposal.md` §2.
- `HIDE` (set `navGroup: null`, keep the entry and the code): `/vocab` · `/reading` · `/community` ·
  `/leaderboard`.
- `ABSORB`: `/sensei` · `/journal` · `/weekly-report` → under Companion · `/statistics` ·
  `/achievements` → Dashboard/Profile · `/challenges` → Roadmap.
- `NEW` rows: `/companion` · `/pronunciation` (see trap 3 — they need real routes first).
- `journey` label moves to `/roadmap`; `/journal` becomes the Diary.
- ⚠️ **`L-025`**: `vitest.config.ts:13` excludes `tests/e2e`, so **no unit run can catch a stale label
  in a Playwright spec**. Grep `tests/e2e/` **by hand** for `Journey`, `Journal`, `Sensei`, `Mining`,
  `JLPT`. This exact rename already broke `tests/e2e/journal.spec.ts` once.
- ❌ **NOT in 1b:** `/jlpt` → `/certification`. It carries a schema migration (three exam families
  with different section structures ⇒ `jlpt_section`'s enum cannot be the shared abstraction).
  **Phase 2.**

---

## ✅ Owed to the user — ALL THREE CLOSED 2026-08-13, before Phase 1b started

The user sequenced these deliberately: settle method-law and test naming *first*, so neither is left
hanging inside 1b's data-only diff. Find them with `git log --grep "promotion review"` and
`git log --grep T11`.

1. **`L-004` promotion review — DONE, promoted.** Ruling covered all five parked candidates against
   spec **G6** (the ≥3-evidence threshold measures *frequency*; promotion requires the lesson be
   restatable as a **checkable invariant**). **Promoted:** `L-004` → `CLAUDE.md` §7, `L-026` → §6,
   `L-011` → §9. **Declined with reasons recorded:** `L-016` (binds only worktree runs; observable
   only in a controller transcript) and `L-023` (no binary outcome, no bounded depth — unenforceable
   as law). Declined entries say *do not re-open on evidence count alone*, so this cannot re-trigger.
   Note `L-004`'s promoted form carries the clause that actually catches the bug class: **an
   assertion over a collection gathered by a pattern must assert the collection is non-empty and the
   expected size.**
2. **`T2b` collision — RESOLVED. The nav→page assertion is now `T11`.** The spec's `T2b` (resolver
   unit test) kept its id, being both older and more widely referenced. Rename only — one test title
   and one comment; `git diff` shows zero logic change. Spec §4.1 now defines `T11` in the table
   instead of leaving it as unnamed prose in the correction block.
3. **e2e credentials — NOT a blocker, and deliberately not "fixed".** The authoritative statement now
   lives in `mem:project_status` § Verify commands; it is repo-wide, not registry-specific. Short
   form: delta against the branch point is zero, so a non-green local Playwright run is
   environmental. Never repair the environment to improve the number — the comparison is the signal.

## Deferred findings from the final review — real, non-blocking, none load-bearing

Left deliberately so Phase 1a did not become an unbounded hardening pass:
`nav-derivation.test.ts`'s first test name no longer describes what it asserts ·
"last chrome group wins" in `route-resolver.ts` is untested (no real path has two known chrome
groups) · `walkPages` starts at `app/` not `app/[locale]/` (a future `app/health/page.tsx` would
surface as a baffling T1 orphan) · no invariant forbids `route: null` + `impl !== 'none'` ·
`figmaNodeId` uniqueness unchecked · `as number`/`as string` casts in `nav-derivation.ts` rest on T7
living in another file.

## Known flaky test — do not chase it

`components/video-player/pitch-contour.test.tsx` (`strokeCalls` / `arcCalls`) failed once on
**unmodified master** and passed on re-runs. Named per `L-003`, whose own evidence records
"1 flaky test reported unnamed" as a past failure of this project.

## Related

`mem:project_status` · `mem:phase0_figma_inventory_run_state` (Phase 0, now complete) ·
`mem:screen_registry_inputs` · `mem:model_selection_policy` ·
`docs/product/decision-register.md` (the index of every ruling) ·
`docs/superpowers/specs/2026-08-08-screen-registry-design.md` (R1–R13, T1–T10) ·
`docs/superpowers/plans/2026-08-12-screen-registry-phase-1a.md`
