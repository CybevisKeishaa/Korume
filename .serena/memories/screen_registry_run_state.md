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

Tests: `T1 · T2 · T2b · T3 · T4 · T5 · T6 · T7 · T8 · T9 · T10`, every one mutation-checked.

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
2. **Two-directional completeness is TWO invariants.** `T1` = *page → registry*. `T2b` = *nav → page*.
   Phase 1a nearly shipped without the second because the spec claimed T1 subsumed it — it does not,
   and that was proven by construction (a nav row pointing at a routeless page left every test green
   while the sidebar rendered a dead link). **Phase 1b adds `/companion` and `/pronunciation`, which
   are designed-before-built — exactly what T2b exists to catch.** Keep both.
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

## ⚠️ Owed to the user — decisions, not tasks

1. **`L-004` now has a fourth evidence entry**, which under `docs/lessons.md`'s own rule 3 **triggers
   a promotion review** (should it become law in `CLAUDE.md`?). Not automatic; the user decides.
2. **Name collision: `T2b` is used twice** — the spec §4.1 table already had `T2b` for the resolver
   unit test, and the new nav→page assertion took the same name. Renumber in 1b.
3. **The e2e suite cannot pass locally without backend credentials.** Measured: 5 fail / 8 pass on
   the branch **and the identical 5 fail / 8 pass at the branch point `e4f407a`** — all five die at
   registration. Delta is zero, so this is environmental, not a regression. Know this before trusting
   a CI result.

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
