# Screen Registry — run state (⭐ THE LIVE NEXT ACTION: Phase 1b)

# ▶▶ RESUME HERE

**Phase 1b is DONE and MERGED to master at `6f67dd1` (`--no-ff`, 2026-08-13). Reviewed twice, all
three open items closed. Nothing is owed on it.** Lessons merged separately at `708f47e`.

**⭐ The live next action is now PHASE 2**, whose backlog is already decided and written down —
see `mem:screen_registry_inputs` (the A10 hides: `/reading`, `/leaderboard`, `/community`; the
`/jlpt` → `/certification` rename with its schema migration, A9) and § Deferred findings below.
Post-merge verify on master: `tsc` 0 · `vitest` 236 files / 2110 tests.

Commits: `276d0ac` (the IA change) · `4db8e7b` (memory) · `7ba870a` (fix wave closing the
whole-branch review) · `2c58e70` (the user's VN naming rulings — A14 revised, A15 added) ·
`7c39419` (A15 propagated, A14's English settled) · the L-012 fix wave that follows them.

Gate at the last run: `tsc` 0 · `vitest` **236 files / 2110 tests** all passing · `lint` 0 errors,
mix `54 no-non-null-assertion + 23 no-unused-vars` (unchanged from baseline) · `next build` OK.

## ▶ NEXT SESSION — one step left

**Merge to master `--no-ff`** (repo keeps merged branches). Nothing blocks it.

⚠️ If you are about to re-ask the user about the companion's Vietnamese name or the English
`journey` heading: **don't — both were ruled and implemented on 2026-08-13.** See below.

## ✅ The three items that were open on 2026-08-13 — all closed the same day

1. **A15 propagation — RULED: propagate. DONE in `7c39419`.** And the scope turned out to be one
   twentieth of what this file previously claimed. **This file said the companion's "whole
   first-person voice" still said "Người bạn đồng hành". That was false and is retracted**:
   `messages/vi/companion.json`'s `speech`, `journal` and `memoryTitle` catalogs speak as **"mình"**
   and **never name the creature at all**. Exactly **one** shipped VN string was affected —
   `a11y.sprite`, a third-person label addressed to the learner. (`L-002`: the claim was inherited,
   never measured.)
   - **"Propagate" ≠ replace-all**, and measuring is what showed why: most of the 21 repo-wide
     occurrences of "đồng hành" are a **verb** or a description of the relationship, not a name
     ("yêu cảm giác được đồng hành cùng một sinh vật nhỏ bé"). Only name-uses changed. That rule is
     now written into `docs/product/decision-register.md` §2 so the next pass cannot re-litigate it.
   - **`MASCOT.md` contradicted a LOCKED ruling and was reconciled to it.** Its § Danh tính still
     read "tên sẽ được xác định trong Character Identity Spec" with six open candidates — text that
     **predates P2's lock (2026-08-12: the name IS `Korume`)**. "Linh thú" is the Vietnamese
     **common noun**, not the proper name; A15 and P2 compose ("my cat" vs the cat's name).
2. **English `journey` heading — RULED: keep "Growth".** The user was offered "Progress" (which
   would also have dissolved the `Growth Areas` collision) and declined. **EN and VI are
   deliberately not literal equivalents**, and the collision **stands knowingly**. Already
   render-pinned at `components/layout/app-nav.test.tsx`; the *reason* is now pinned beside it, so
   a later pass cannot reopen it by rediscovery.
3. **`L-012` review of `4db8e7b..HEAD` — RUN. Verdict: CHANGES REQUIRED, no code defect.**
   Everything it blocked on was documentation and test coverage. All findings closed; see below.

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

### What the L-012 review of the fix wave found (`4db8e7b..HEAD`) — verdict: CHANGES REQUIRED

**No code defect in the whole range**, and the Critical fix the wave existed for was independently
re-reproduced (default → FAILED 8019ms; `reduce` → CLICKED 67ms; **and `emulateMedia` set *after*
`page.goto`, which is what both specs actually do, → CLICKED 53ms** — the CSS media query
re-evaluates live, so ordering is not a defect). Everything blocking was **documentation outranking
the truth** — the exact failure the wave was written to close, recurring one layer up. That is the
whole argument for L-012 in one range.

- **⭐ The branch's own "read this first" memory — THIS FILE — was false at HEAD.** It still listed
  two rulings as open that the last commit had implemented, and repeated the first-person-voice
  claim that the same commit had formally retracted in `decision-register.md`. `MEMORY.md` names
  this file the authority on resume, so merging it would have instructed the next session to
  re-ask the user for rulings already given. **A resume document is code for the next session:
  stale-check it in the same pass that changes what it describes, not afterwards.**
- **`navigation-system.md` still asserted `/journal` is a nav row in FOUR places** — including a
  contract table cell claiming it is "reachable from the `(app)` Nav Column", while
  `app-nav.test.tsx` asserts in the same range that it is absent from the sidebar. `7ba870a`'s own
  message said an L-024 sweep "found one more" stale claim; **the sweep stopped at one and missed
  the branch's headline change in the file it was already editing.** A sweep that stops at the first
  hit is a spot fix wearing a sweep's name.
- The Gamification rewrite deleted "13 of the 14 shipped destinations" as stale arithmetic, then
  **re-asserted the same number twelve lines later** as "the same 13-of-14 scope, described just
  above" — pointing at text it had itself removed.
- `messages/vi/upcoming.json` was **unpinned**, so A15's second half had no test: reverting the VI
  page title alone left the suite green. Closed with the parity invariant above rather than another
  hand pin, because the invariant catches the *relationship* neither pin can.
- Minors: a hand-kept table of all ten group headings added by the very commit that deleted another
  table for being a hand-synced duplicate (now cut to the one row carrying a decision) · a "read the
  rows with this command" that ran a pass/fail test and printed no rows · `A1–A14` cited as a range
  one commit before A15 existed · `vi/companion.json` missing the trailing newline the same wave had
  just fixed on its sibling · an unmeasured "the motion path stays exercised by the rest of the
  suite" (a sweep found **no** spec asserts a motion path — reworded to default-state fidelity,
  `L-003`) · `upcoming-routes.test.tsx`'s `it.each` list still had no length assertion, so an
  emptied list would generate zero tests and report green.

### Decisions taken during 1b that are not in the locked IA

- **Group HEADINGS were a genuine gap.** A1 locks group *ids* and §2 locks row labels; neither says
  what a group heading reads. Capitalising the id would have printed a heading "Journey" directly
  above an item "Journey". **User ruling 2026-08-13: keep id `journey`, display "Growth" (EN).**
  Recorded as **A14**. The Vietnamese was revised the same day: **"Tiến trình"**, not "Trưởng thành"
  (which leaned *maturity/adulthood*). `/roadmap` keeps **"Hành trình"**.
- **The companion's Vietnamese name is "Linh thú"** (**A15**, user ruling 2026-08-13) — nav row
  "Linh thú của tôi", with `/companion`'s page title matched to it so the destination has one name.
  **Propagated the same day in `7c39419`; see § RESUME HERE for the scope correction it forced.**
  That "one destination, one name" property is now an *invariant*, not a hand pin:
  `messages/destination-name-parity.test.ts` asserts nav label === page title per locale for the two
  screens a ruling binds — and asserts that **`/roadmap` deliberately does NOT match** (A8 gives it
  nav "Journey"/"Hành trình" over title "Roadmap"/"Lộ trình"), so nobody widens the rule by accident.
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
