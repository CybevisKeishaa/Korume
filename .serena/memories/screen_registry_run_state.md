# Screen Registry — run state (⭐ THE LIVE NEXT ACTION: Phase 1b)

# ▶▶ RESUME HERE

**Phase 1b is COMMITTED on branch `screen-registry-phase-1b` at `276d0ac`
(branched from master `c000242`). NOT yet merged — it has had no whole-branch
review, which `CLAUDE.md` §9 now requires before merge (L-011 was promoted to law
the same day).**

Gate at the commit: `tsc` 0 · `vitest` 235 files / 2100 tests all passing ·
`lint` 0 errors, mix `54 no-non-null-assertion + 23 no-unused-vars` · `next build` OK.

**▶ NEXT: whole-branch review of `screen-registry-phase-1b`, then merge.**
Two things the reviewer should be pointed at specifically:
1. The **Vietnamese copy 1b authored** — the user asked to review it themselves.
   New strings: `groups.practice` "Luyện tập" · `groups.remember` "Ghi nhớ" ·
   `groups.journey` "Trưởng thành" · `mining` "Bộ sưu tập" ·
   `pronunciation-library` "Phát âm" · `companion-home` "Đồng hành" · plus the
   `pronunciation` and `companion` blocks in `vi/upcoming.json`.
2. **`messages/en/nav.pin.test.ts` was DELETED**, replaced by
   `messages/vi/nav.pin.test.ts`. Reasoning is in the commit message; it is a
   judgement call and the easiest thing in this branch to disagree with.

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

## ✅ PHASE 1b — how the four traps actually played out

All four were real. Recorded as evidence, because the next phase inherits the same shape.

1. **Baseline as an independent oracle — HELD.** `nav-baseline.fixture.ts` was hand-written from
   `ia-proposal.md` §2, never regenerated. Proven non-vacuous by mutation: reordering one row
   turned T6 red naming `['companion-home','roadmap']` vs `['roadmap','companion-home']`.
2. **Two-directional completeness — BOTH KEPT.** `T1` = page→registry, **`T11`** = nav→page
   (renamed from the colliding `T2b` just before 1b started).
3. **`deriveNavGroups` throws on `navGroup` + `route: null` — FIRED CORRECTLY.** Verified against
   1b's own data: nulling `companion-home`'s route threw and named the entry. Both new rows were
   given real `UpcomingScreen` pages *before* the registry pointed at them.
4. **Registry must not reach the client — HELD, but the first check was worthless.** The positive
   control (`"Pronunciation"`) FAILED, because catalog strings never reach static chunks at all —
   they travel in the RSC payload. Re-run with `data-nav-scroll`, a literal that genuinely lives in
   `app-nav.tsx`'s chunk, the control hit `8698-*.js` and only then did the zero registry markers
   mean anything. **Never accept a clean grep of a build output without a control that fires.**

### Two defects 1b's own guards caught — neither was an IA-expectation mismatch

- **`/companion` and `/pronunciation` had no `PROTECTED_PREFIXES` entry**, so middleware would have
  skipped auth on both. Caught by `lib/supabase/route-protection.test.ts`'s filesystem-driven
  coverage test. Same defect class as C1 round 1's "eight protected routes missing from middleware".
  **Any new route under `(protected)` needs this; the layout alone does not protect it.**
- **`L-025`'s hand sweep found TWO e2e specs**, not one: `journal.spec.ts` *and*
  `route-group-provider-identity.spec.ts` both clicked a nav link named "Journey" expecting
  `/journal`. `vitest.config.ts:13` excludes `tests/e2e`, so no unit run could ever have caught it.

### The product fact that came out of it, measured

**Losing its nav row did NOT strand `/journal`.** The companion sprite is the real door —
`ambient-provider.tsx:154` wires `openJournal: () => router.push("/journal")`, and `CompanionAnchor`
mounts on `/dashboard` and `/shadowing`. Both e2e specs now navigate that way, which is a *stronger*
reachability check than the nav link was. Do not "restore" a Diary nav row on the assumption it is
unreachable.

### Decisions taken during 1b that are not in the locked IA

- **Group HEADINGS were a genuine gap.** A1 locks group *ids* and §2 locks row labels; neither says
  what a group heading reads. Capitalising the id would have printed a heading "Journey" directly
  above an item "Journey". **User ruling 2026-08-13: keep id `journey`, display "Growth" /
  "Trưởng thành".**
- **`screenId` doubles as the catalog key** (R9 + `deriveNavGroups` maps `key: entry.screenId`), so
  the catalog gained `pronunciation-library` / `companion-home`, not `pronunciation` / `companion`.
  Identity was NOT renamed to prettify a key — `weeklyReport` is the precedent in the other direction.
- **`/jlpt` kept BOTH its route and its "JLPT" label.** A9's rename to Certification is Phase 2 in
  full, not just the route. Only the row's group moved in 1b.

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
