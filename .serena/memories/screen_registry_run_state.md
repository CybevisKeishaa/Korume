# Screen Registry — run state (⭐ THE LIVE NEXT ACTION: Phase 1b)

# ▶▶ RESUME HERE

**Phase 1b is COMPLETE and REVIEWED on branch `screen-registry-phase-1b` (off master `c000242`).
NOT merged — the user stopped here on 2026-08-13 and will continue next session.**

Commits: `276d0ac` (the IA change) · `4db8e7b` (memory) · `7ba870a` (fix wave closing the
whole-branch review) · plus the VN copy commit that follows it.

Gate at the last run: `tsc` 0 · `vitest` 235 files / 2102 tests all passing · `lint` 0 errors, mix
`54 no-non-null-assertion + 23 no-unused-vars` · `next build` OK.

## ▶ NEXT SESSION — do these in order

1. **Decide A15's propagation.** The user renamed the companion in Vietnamese to **"Linh thú"**
   (`nav.companion-home` = "Linh thú của tôi", and `/companion`'s page title matches). It has NOT
   propagated: `messages/vi/companion.json` (`a11y.sprite`), `MASCOT.md`, and the companion's whole
   first-person voice still say **"Người bạn đồng hành"**. Two names for one character is the
   `CLAUDE.md` §6 defect. Either propagate or scope A15 explicitly — **the user owns this, do not
   guess.** Full statement in `docs/product/decision-register.md` §2 under A15.
2. **Decide the English `journey` heading.** EN still reads **"Growth"** while VI is now
   **"Tiến trình"** (≈ Progress) — they no longer mean the same thing. Moving EN to "Progress" would
   also dissolve the known collision with the Companion's own `Growth Areas` surface (`187:6556`),
   which sits inside that very group.
3. **`L-012` — the fix wave has not been reviewed.** `docs/lessons.md` L-012 says a fix wave needs
   its own review; `7ba870a` touched 13 files including a Critical fix and the removal of a table
   from an **Approved** layer-A document. A narrow review of `4db8e7b..HEAD` was recommended and
   not run.
4. Then merge to master `--no-ff` (repo keeps merged branches).

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

- **`/companion` and `/pronunciation` had no `PROTECTED_PREFIXES` entry.** Caught by
  `lib/supabase/route-protection.test.ts`'s filesystem-driven coverage test. Same defect class as C1
  round 1's "eight protected routes missing from middleware".
  ⚠️ **Correction (whole-branch review, M3):** commit `276d0ac`'s message says "middleware would have
  skipped auth on both". **That overstates it** — `app/[locale]/(protected)/layout.tsx:28-29` does its
  own server-side `getCurrentUser()` redirect, so access control held. The real symptom is a dropped
  `redirectTo`: a signed-out learner opening a shared `/vi/companion` link would land on
  `/vi/dashboard` after logging in. Believe the test's own comment, not that commit message.
- **`L-025`'s hand sweep found TWO e2e specs**, not one: `journal.spec.ts` *and*
  `route-group-provider-identity.spec.ts` both clicked a nav link named "Journey" expecting
  `/journal`. `vitest.config.ts:13` excludes `tests/e2e`, so no unit run could ever have caught it.

### The product fact that came out of it, measured

**Losing its nav row did NOT strand `/journal`.** The companion sprite is the real door —
`ambient-provider.tsx:154` wires `openJournal: () => router.push("/journal")`, and `CompanionAnchor`
mounts on `/dashboard` and `/shadowing`. Both e2e specs now navigate that way, which is a *stronger*
reachability check than the nav link was. Do not "restore" a Diary nav row on the assumption it is
unreachable.

### What the whole-branch review found (verdict: "with fixes", all closed in `7ba870a`)

Every finding was real. Two were defects the implementer introduced; one was an overstated claim.

- **⭐ CRITICAL — both e2e specs 1b rewrote were BROKEN, and nothing here could have said so.** They
  click the companion sprite, which carries `companion-breathe` (`4.5s scale(1→1.03) infinite`,
  applied whenever reduce-motion is off = the default). **Playwright's click actionability waits for
  a STABLE bounding box; an infinitely animating element never has one.** Reproduced independently in
  an isolated harness: **FAILED after 8017ms by default, CLICKED in 63ms with
  `page.emulateMedia({ reducedMotion: "reduce" })`.** Fixed per-spec, not in `playwright.config.ts`
  (global would silently remove the motion path from the whole suite) and not with `force: true`
  (skips the hit-target check the specs exist to exercise).
  **This is `L-025`'s second half and it is now written into that lesson: sweeping `tests/e2e/` finds
  the break, but the REPLACEMENT is equally unrunnable here — prove it with a repro.**
- **An Approved layer-A doc outranked the truth.** `docs/design/screens/navigation-system.md` still
  declared the old 22-row table canonical. `ia-proposal.md:434` had named that amendment as a
  precondition of locking the IA and it was skipped. Table replaced by a pointer to the registry; the
  Gamification section rewritten (its "13 of the 14 shipped destinations" arithmetic died with the
  table); an L-024 sweep caught one more falsehood in the same file (`/settings` "does not exist" —
  it has since Plan C1).
- **Registry header contradicted itself 50 lines apart** — still sourcing `navGroup` from
  `app-nav.tsx`. `app-nav.tsx` has held no nav data since 1a; do not reinstate that.
- `upcoming-routes.test.tsx` keeps a **hand-written** route list that 1b added two routes to and did
  not update — an `L-023` miss.
- ⚠️ **Correction to `276d0ac`'s own commit message**, which cannot be edited: it says the missing
  `PROTECTED_PREFIXES` entries meant "middleware would have skipped auth". **That overstates it.**
  `app/[locale]/(protected)/layout.tsx:28-29` does its own server-side `getCurrentUser()` redirect, so
  access control held; the real symptom is a dropped `redirectTo`. Believe
  `lib/supabase/route-protection.test.ts`'s comment, not that message.

### Decisions taken during 1b that are not in the locked IA

- **Group HEADINGS were a genuine gap.** A1 locks group *ids* and §2 locks row labels; neither says
  what a group heading reads. Capitalising the id would have printed a heading "Journey" directly
  above an item "Journey". **User ruling 2026-08-13: keep id `journey`, display "Growth" (EN).**
  Recorded as **A14**. The Vietnamese was revised the same day: **"Tiến trình"**, not "Trưởng thành"
  (which leaned *maturity/adulthood*). `/roadmap` keeps **"Hành trình"**.
- **The companion's Vietnamese name is "Linh thú"** (**A15**, user ruling 2026-08-13) — nav row
  "Linh thú của tôi", with `/companion`'s page title matched to it so the destination has one name.
  **Its propagation is unresolved and is item 1 of the next session.**
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
