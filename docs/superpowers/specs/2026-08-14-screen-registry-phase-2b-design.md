# Screen Registry — Phase 2b design

> **Status:** design approved by the user 2026-08-14, before any implementation.
> **Branch:** `screen-registry-phase-2b`, off master `8d01ed9` (Phase 2a merged at `e767537`).
> **Predecessor:** `docs/superpowers/specs/2026-08-13-screen-registry-phase-2a-design.md`.
> **Rulings executed here:** **A9** (`/jlpt` → `/certification`) and **A16** (`/jlpt-test` is dead
> route code). Both live in `docs/product/decision-register.md` §2, which stays their single home —
> this spec does not restate A16's edit list (Phase 2a's C1 finding: a restated edit list was wrong
> in two ways the moment A16 was corrected).

---

## 1. What Phase 2b is

Phase 2a settled the product model and changed no route. **2b is the first pass since Phase 1b that
touches application code**: routes, API paths, the database, and `components/`.

A9 was deferred out of Phase 1 for one recorded reason (`ia-proposal.md`):

> **`/certification` carries a migration** — `jlpt_section`'s enum cannot be the shared abstraction
> across three exam families with different section structures. ⇒ **Phase 2, not Phase 1.**

**The user ruled on 2026-08-14 that 2b does NOT act on that reason.** P5 states the repo implements
exactly one exam family, so the three-family abstraction has no second consumer to validate it, and
building it now would be designing an interface against an imagined caller. 2b renames the module and
stops there. The generalisation is deferred with its reason recorded, not forgotten — see §8.

---

## 2. The naming line — the single most important rule in this phase

**Certification is the MODULE. JLPT is the exam family implemented inside it** (P5:
*"`Certification Practice` is the module; JLPT · BJT · Tokutei Ginou are exam families. Repo
implements one."*).

Everything naming the **destination** is renamed. Everything naming the **family** stays, because it
is still true. This is the same distinction A15 forced for "Linh thú" — *propagate ≠ replace-all* —
and it is the reason a blanket rename of the 169 files matching `jlpt` would be a defect, not a
thorough job.

### Renamed

| Thing | From | To |
|---|---|---|
| Route | `/jlpt`, `/jlpt/[id]` | `/certification`, `/certification/[id]` |
| API | `/api/jlpt/**` | `/api/certification/**` |
| Table | `jlpt_tests` | `certification_tests` |
| Table | `jlpt_questions` | `certification_questions` |
| Nav label | `"JLPT"` / `"JLPT"` | **`"Certification"` / `"Luyện thi"`** (A17) |

### Deliberately NOT renamed

| Thing | Why it stays |
|---|---|
| `components/jlpt/` (17 files) | They render a JLPT test specifically. If a second family ever ships they need splitting, not renaming. |
| `messages/*/jlpt.json` | R9 makes `screenId` the catalog key; the screenId stays (below). |
| `screenId: "jlpt"` | Phase 1b precedent: identity is **not** renamed to prettify a key (`weeklyReport` is the precedent in the other direction). A14 is the same shape: a group's heading is not its id. |
| `screenId: "jlpt-practice-phase-1"`, `"jlpt-phase-test"`, `"jlpt-practice-phase-2"` | They name **Figma frames**. Renaming them would desync the registry from the design source. |
| enum `jlpt_level` (N5–N1) | The JLPT level scale. A real, family-specific fact. |
| enum `jlpt_section` | Kept per the ruling in §1. See the accepted consequence below. |
| `kanji.jlpt_level`, `vocab.jlpt_level`, `grammar_points.jlpt_level`, `jlpt_level_estimate` | Content difficulty labels. Nothing to do with the certification module. |
| `user_test_attempts` | Already family-neutral. Renaming it would be churn. |
| `lib/jlpt-ui.ts`, `jlptLevelSchema` | Level handling — family, not module. |

### Two consequences accepted knowingly

1. **`certification_questions.section` will be typed `jlpt_section`.** A table named for the module
   carrying a column typed for the family. This is the honest state under §1's ruling: the column
   holds JLPT sections because every row is a JLPT question. It is recorded here so a later reader
   does not "discover" it as an oversight.
2. **`lib/data/jlpt.ts` keeps its filename** while querying the renamed tables. Same rule: the file
   implements JLPT test loading.

---

## 3. The `/jlpt` redirect — the one architectural decision 2b forces

The user ruled: redirect old URLs, with a **dated removal note** so it cannot become the next
`/jlpt-test` — a dead redirect nobody could justify two phases later.

### Why the redirect must NOT be a page in the app tree

The obvious implementation — leave `app/[locale]/(protected)/(app)/jlpt/page.tsx` as a
`redirect("/certification")` — **breaks the registry's own model**:

- R5 requires every in-scope route to have a registry entry, so `/jlpt` would need one.
- The entry could not be `kind: "screen"` (T3 requires a `figmaNodeId`, and frame `232:2` now belongs
  to `/certification`).
- So it would be `kind: "repo-only"`, and **R13 machine-restricts `out-of-design-scope` to
  `chrome: "admin"`** (enforced by **T10**), leaving exactly one legal value:
  **`no-frame-at-last-pass`**.
- That value would be **false**. `/jlpt` is not un-surveyed — it has a frame, which moved. And it
  would land the redirect in the survey backlog that Phase 2a exists to keep honest.

R13 is explicit that widening that enum *"requires an explicit amendment to this spec — it is not a
judgement call at implementation time."* **2b does not amend it, because it does not need to.**

### The resolution: routing configuration, not a screen

A redirect is not a screen. It has no `page.tsx`, so `T1` (page → registry) never sees it and R5 is
never engaged. The repo already has the precedent — `next.config.mjs` `redirects()` handles the
`/videos` → `/shadowing` rename from Plan C1.

```js
{ source: "/:locale(vi|en)/jlpt/:path*",
  destination: "/:locale/certification/:path*",
  permanent: false }
```

Four properties, each inherited from the precedent's recorded reasoning:

1. **A wildcard `:path*` is correct here**, where it was wrong for `/videos`. That file's comment
   says *"A wildcard is wrong here because the second rule COLLAPSES a segment rather than renaming a
   prefix."* This rename **is** a straight prefix rename, so one rule covers `/jlpt` and
   `/jlpt/[id]`.
2. **`:locale(vi|en)` stays constrained.** Unconstrained, `:locale` matches the literal segment
   `api`, and `redirects()` runs *before* the filesystem — the recorded incident is `/api/videos`
   answering `307 → /api/shadowing` and then 404ing. `next.config.test.ts` asserts the alternation
   equals `routing.locales` as a set.
3. **`permanent: false` (307), never 308.** A 308 is cached hard by browsers, turning a later move
   into a debugging trap that presents as an app routing bug.
4. **No SEO cost.** `next.config.mjs` records, as a measured fact, that *"every one of these routes is
   auth-gated, and the app has never been published, so no external inbound link exists to
   preserve."* That same fact is what makes §4's direct table rename safe.

### The dated removal note

A17 records that this rule is **temporary**, and names the condition for deleting it: it may be
removed once the app is published and one release has passed, or immediately at launch if no
`/jlpt` traffic is observed. The note lives in `decision-register.md`, not in a comment alone,
because A16's whole finding was that the only record of a dead route lived somewhere untracked.

---

## 4. The migration

**One migration file**, `supabase/migrations/20260814000027_certification_rename.sql` — the next
number after `20260807000026_collections_seed.sql`, measured at HEAD — using
`alter table ... rename to ...`. Data is preserved in place; no copy, no views.

The user confirmed **no live users**, which is corroborated by `next.config.mjs`'s "never been
published" note. So no backward-compatible view layer, and no deploy-ordering dance.

The rename is not just two `alter table` statements. Every dependent object must move with it:

| Object | Where it lives today | Action |
|---|---|---|
| `jlpt_tests`, `jlpt_questions` | `20260712000001_schema.sql:280,288` | rename |
| FK `jlpt_questions.test_id → jlpt_tests` | `:290` | follows the rename automatically; verify |
| FK `user_test_attempts.test_id → jlpt_tests` | `:299` | follows automatically; verify |
| RLS enable statements | `20260712000002_rls.sql:27-28` | already applied to the relation; verify post-rename |
| policy `jlpt_tests_read` | `rls.sql:57` | rename policy for legibility |
| policy `jlpt_questions_read` | `20260713000011_reading_jlpt.sql:119` | rename policy |
| column grants on `jlpt_questions` | `reading_jlpt.sql:116-117` | **verify they survive** — `revoke select` + column-scoped `grant` is the guard keeping `correct_answer` unreachable |
| index `idx_jlpt_questions_test` | `20260712000003_indexes.sql:38` | rename |
| index `idx_jlpt_questions_test_section` | `reading_jlpt.sql:147` | rename |

> ⚠️ **The security-critical item is the column grant.** `jlpt_questions` has `revoke select ... from
> authenticated` plus a column-scoped `grant` that deliberately omits `correct_answer`, with RLS
> policy `jlpt_questions_read ... using (true)` on top. A rename must not silently restore
> table-wide select. This is `L-005` territory — the Supabase mock models no RLS, so **no unit test
> can prove it**. The plan must verify it against a real database, or state plainly that it was not
> verified.

> ⛔ **MIGRATIONS ARE APPEND-ONLY. Do not rename the tables inside the historical migrations.**
> This is the tempting wrong move — editing `20260712000001_schema.sql` to say `certification_tests`
> "for cleanliness" looks tidier and destroys the history: every environment that already ran the old
> file would diverge from every fresh one, and a migration tool comparing checksums would flag or
> re-run it. The historical files are **read-only artifacts of what already happened**.
>
> Concretely, five historical files **operate on** the old tables — `20260712000001_schema.sql`,
> `20260712000002_rls.sql`, `20260712000003_indexes.sql`, `20260713000011_reading_jlpt.sql` and the
> seed `20260713000012_jlpt_reading_content.sql` — and a sixth, `20260731000019_collections.sql:28`,
> mentions `jlpt_tests` **in a comment only**. **All six stay exactly as they are**, including the
> comment: it describes a naming convention that was true when written. The seed inserts into
> `jlpt_tests` /
> `jlpt_questions` under their old names, which is correct — it ran before the rename. The new
> migration is numbered after all of them and therefore runs after them.

---

## 5. Application changes

| Area | Change |
|---|---|
| Page dir | `app/[locale]/(protected)/(app)/jlpt/` → `.../certification/` (both `page.tsx` and `[id]/page.tsx`) |
| API dir | `app/api/jlpt/` → `app/api/certification/` (4 route files) |
| API callers | every `fetch` to `/api/jlpt/**` in `components/jlpt/**` |
| Data layer | `lib/data/jlpt.ts` — `.from("jlpt_tests")` ×3, `.from("jlpt_questions")` ×2 (lines 74, 93, 101, 168, 177) |
| Other table readers | `lib/data/admin-content.ts`, `lib/data/admin-stats.ts:106`, `lib/data/companion.ts:191`, `lib/data/gamification.ts:227`, `components/admin/content-fields.ts` |
| Registry | `jlpt` entry `route` → `/certification`; `jlpt-practice-phase-1` `route` → `/certification/[id]`. A16's own edits (including its registry deletion) are **not** enumerated here — read A16 |
| Protection | `PROTECTED_PREFIXES`: remove `/jlpt` and `/jlpt-test`, add `/certification` |
| Nav catalog | `messages/{en,vi}/nav.json` key `jlpt` → `"Certification"` / `"Luyện thi"` |
| Config | the redirect rule of §3 |
| Comment debt | `components/layout/app-nav.tsx:16-18` — "all **50** entries" is wrong (the registry holds **79**, measured) and "internal debt labels" is the framing Phase 2a retired |

**`/jlpt` keeps no `PROTECTED_PREFIXES` entry.** The redirect fires in `next.config.mjs` before the
filesystem, so no request ever reaches a `/jlpt` page — there is no page to protect. This is also why
the filesystem-driven coverage test in `route-protection.test.ts` stays green: it walks pages that
exist, and after the move none exists under `/jlpt`.

---

## 6. Page title — a deliberate divergence, NOT a parity extension

The design review's first draft claimed `messages/destination-name-parity.test.ts` would gain
`/certification`. **That was wrong, and reading the test is what showed it.**

That test compares `nav.json` against **`upcoming.json`** — it covers screens rendered by
`UpcomingScreen`. `/certification` is a **built** page whose title comes from
`messages/*/jlpt.json` → `title` (today: `"JLPT mock tests"`), via `generateMetadata`. The parity
test's mechanism cannot reach it.

**Ruling recorded in A17: the divergence is deliberate and the page title is NOT forced to match the
nav label.** Nav reads **Certification** (the module); the page heading names what the page actually
lists (**JLPT mock tests**). That is true under P5, and it is the same shape as the standing
counter-example the parity test already guards: A8 gives `/roadmap` the nav label "Journey" over the
page title "Roadmap".

⚠️ **Do not "helpfully" widen `destination-name-parity.test.ts` to cover this route.** Its own header
says the scoping is on purpose, and its bottom guard exists to turn red when someone generalises it.

---

## 7. Verification

Per the user's ruling: **tests first, and the route + registry entry + `PROTECTED_PREFIXES` move in
ONE commit**, so the suite is never knowingly red. `T2` (`screen-registry.routes.test.ts`) fails the
moment a registry entry claims a route that does not resolve, which is precisely what a staged rename
would produce.

### Guards that already exist and will fire on their own

| Guard | What it catches here |
|---|---|
| `next.config.test.ts` "still ships exactly the three rules" — `toHaveLength(3)` + exact `toEqual` | **Goes red the instant the 4th rule is added.** It must be updated to four; that update is the proof the rule landed, not a chore. |
| `next.config.test.ts` locale-alternation tests | An unconstrained `:locale` on the new rule |
| `T1` / `T2` (registry ↔ pages) | Route and registry entry moving apart |
| `route-protection.test.ts` pin (`:19-53`) | Any `PROTECTED_PREFIXES` edit — this is the forcing function, **not** the filesystem coverage test (A16's corrected mutation target) |
| `route-protection.test.ts` coverage test (`:120-154`) | A new page with no prefix. It **cannot** catch a prefix left behind after its page is deleted; no symmetric guard exists |
| `app-nav.test.tsx` `expectedCounts` | Nav group membership changes |

### New assertions 2b must add

1. The redirect rule exists, with the wildcard and the constrained locale (extend `next.config.test.ts`).
2. An e2e assertion that `/vi/jlpt` and `/vi/jlpt/<id>` land on the `/certification` equivalents, over
   real HTTP — `tests/e2e/route-rename-redirects.spec.ts` already exists for exactly this and is the
   right home. **`vitest.config.ts:13` excludes `tests/e2e`, so no unit run will execute it** —
   L-025's rule applies: sweep by hand and prove the replacement runs.
3. ~~A test that no `PROTECTED_PREFIXES` entry names a route with no page.~~ **DEFERRED — user
   ruling 2026-08-14, on review of this spec.** The reverse-direction guard A16 noted is missing is
   an *infrastructure improvement*, not a precondition for shipping A9, and 2b already carries
   enough moving parts. A16 said 2b *may* add one; the user has now said it should not.
   **In its place, a manual sweep is MANDATORY, not optional:** grep every surviving reference to
   `/jlpt-test` and `/jlpt` across the repo and adjudicate each one, because redirect + protection
   is precisely where a stale reference survives unnoticed. The sweep runs to exhaustion (`L-024`)
   and its output is pasted into the task report, not summarised.

### Gate

`tsc` 0 · `vitest` all green · `lint` 77 warnings / 0 errors (baseline) · `next build` exit 0.
Every count re-measured, never inherited (`L-002`, `L-003`).

---

## 8. Explicitly out of scope

Recorded so a later pass does not read the absence as an oversight:

- **No `exam_family` column, no section-enum generalisation.** Deferred with its reason: no second
  exam family exists, so the abstraction has no consumer to validate it. It becomes live work when
  BJT or Tokutei Ginou is actually scheduled — at which point `jlpt_tests.section_config jsonb`
  (which already exists) is the natural hook to reconsider.
- **No component or catalog renames** (`components/jlpt/`, `messages/*/jlpt.json`).
- **No `screenId` renames.**
- **No change to `jlpt_level` anywhere.**
- **No `kind: "redirect"` added to the registry** — §3 removes the need for it.
- **No reverse-direction `PROTECTED_PREFIXES` guard** (§7.3, user ruling 2026-08-14). Replaced by a
  mandatory manual sweep. The gap A16 identified stays open and stays recorded.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| **The column grant on `jlpt_questions` silently widens on rename, exposing `correct_answer`** | The one security-critical item. `L-005`: mocked tests cannot see it. Verify against a real DB or state plainly that it was not verified. |
| A blanket find-replace of `jlpt` → `certification` | §2's table is the contract. The renamed set is closed and small; everything else is family naming and must not move. |
| The redirect becomes the next `/jlpt-test` | A17 carries the dated removal condition, in a tracked file. |
| **An implementer "cleans up" the historical migrations by renaming the tables in them** | §4's ⛔ block. The five files that name the old tables are listed there by name so the boundary is checkable, not a matter of judgement. Append-only is not a style preference. |
| A stale `/jlpt` or `/jlpt-test` reference survives the rename | §7.3's mandatory sweep, run to exhaustion (`L-024`), output pasted rather than summarised. This replaces the deferred reverse-direction guard, so it is the only thing standing in that gap. |
| Registry and route move in separate commits | Forbidden by §7; T2 is the detector. |
| Stale counts in commit messages or docs | `L-002`: write the command, and sanity-check it against a second measurement — Phase 2a found a `grep -c` that matched its own documentation. |

---

## 10. New ruling this phase records

**A17** — three parts, all decided by the user on 2026-08-14:

1. The Vietnamese nav label for `/certification` is **"Luyện thi"** (not "Chứng chỉ", which names the
   credential rather than the practice, and not the longer "Luyện thi chứng chỉ"). EN reads
   **"Certification"**. Per A14, EN and VI need not be literal equivalents.
2. The page title is **deliberately not forced to match** the nav label (§6), on the `/roadmap`
   precedent.
3. The `/jlpt` redirect is **temporary**, with the removal condition named in §3.
