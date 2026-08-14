# Screen Registry Phase 2b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the certification module's destination — route, API and its two tables — from `jlpt` to `certification`, delete the dead `/jlpt-test` route, and leave every name that refers to the JLPT *exam family* untouched.

**Architecture:** Eight tasks. A16's dead-route deletion goes first because it is independent and shrinks the surface. Then the rename moves inward-out: database → data layer → API → page+registry+protection (one commit, mandatory) → nav label → redirect → docs. The redirect is routing configuration in `next.config.mjs`, never a registry entry.

**Tech Stack:** Next.js 14 App Router · TypeScript strict · Supabase/Postgres migrations (append-only) · Vitest · Playwright.

**Spec:** `docs/superpowers/specs/2026-08-14-screen-registry-phase-2b-design.md`. Read §2 before touching anything.

---

## Global Constraints

Every task's requirements implicitly include this section.

1. **The naming line (spec §2).** Certification is the MODULE; JLPT is the exam family inside it. Rename ONLY: the route `/jlpt`→`/certification`, `/api/jlpt`→`/api/certification`, tables `jlpt_tests`→`certification_tests` and `jlpt_questions`→`certification_questions`, and the nav label. **Everything else keeps its name.**
2. **NEVER rename**, and a diff touching these is a defect: `components/jlpt/**` · `messages/*/jlpt.json` (filename and contents) · `lib/data/jlpt.ts` · `lib/jlpt-ui.ts` · `lib/validation/jlpt.ts` · enums `jlpt_level` and `jlpt_section` · every `jlpt_level` column · `user_test_attempts` · every registry `screenId` · the admin **ContentType key** `jlpt_tests`.
3. **Migrations are append-only.** Do not edit any existing file in `supabase/migrations/`. The rename is one NEW file.
4. **No schema generalisation.** No `exam_family` column, no change to the `jlpt_section` enum. Out of scope, spec §8.
5. **No `kind: "redirect"`** and no new `RepoOnlyReason` member. `lib/product/screen-registry-types.ts:4` must still read exactly `export type RepoOnlyReason = "out-of-design-scope" | "no-frame-at-last-pass";` at the end of the branch.
6. **Registry `name` fields are Figma frame names, copied verbatim.** `"JLPT Practice"` stays `"JLPT Practice"`. Only `route` changes.
7. **TDD.** Failing test first, watched fail, then implementation. Guard tests over existing code cannot fail first — mutation-check them instead and paste both outputs (CLAUDE.md §7).
8. **Never write a derived count from memory.** Measure with a command, and sanity-check against a second measurement (`L-002`).
9. **Gate after every task:** `npx tsc --noEmit` (0) · `npx vitest run` (all green) · `npx next lint` (77 warnings / 0 errors, the baseline) · `npx next build` (exit 0) before the final review.

## Plan-wide guards

Each is scheduled in a named task, not only listed here (`L-029`).

| Guard | Assertion | Scheduled |
|---|---|---|
| **G1** | The "NEVER rename" list of constraint 2 is untouched | Task 8 |
| **G2** | `git diff master...HEAD -- supabase/migrations/` shows exactly ONE added file and zero modified | Task 2 **and** Task 8 |
| **G3** | `RepoOnlyReason` still has exactly two members; no `kind: "redirect"` anywhere | Task 8 |
| **G4** | Sweep every surviving `/jlpt-test` and `/jlpt` reference to exhaustion, adjudicate each, paste raw output | Task 7 |

---

## File Structure

**Created**
- `supabase/migrations/20260814000027_certification_rename.sql` — the whole DB rename, one file.

**Deleted**
- `app/[locale]/(protected)/(app)/jlpt-test/page.tsx` — A16.
- `app/[locale]/(protected)/(app)/jlpt/` — moved, not deleted (git mv).
- `app/api/jlpt/` — moved (git mv).

**Modified**
- `lib/data/jlpt.ts` (5 `.from()` calls) · `lib/data/admin-content.ts` · `lib/data/admin-stats.ts` · `lib/data/companion.ts` · `lib/data/gamification.ts`
- `lib/product/screen-registry.ts` (header note, `jlpt` route, `jlpt-practice-phase-1` route, delete `jlpt-test` entry)
- `lib/supabase/route-protection.ts` + `.test.ts` pin
- `messages/{en,vi}/nav.json` + a new pin
- `next.config.mjs` + `next.config.test.ts` + `tests/e2e/route-rename-redirects.spec.ts`
- `components/jlpt/jlpt-test-runner.tsx` + `.test.tsx` (the one API caller)
- `components/layout/app-nav.tsx` (comment debt) · `docs/product/decision-register.md` (A17)

---

## Task 1: A16 — delete the dead `/jlpt-test` route

Independent of the rename; done first so it never interacts with it. A16 in `docs/product/decision-register.md` §2 is the single home of its edit list — **read it there**, it is not restated here.

**Files:**
- Delete: `app/[locale]/(protected)/(app)/jlpt-test/page.tsx`
- Modify: `lib/supabase/route-protection.ts` (remove `"/jlpt-test"`)
- Modify: `lib/supabase/route-protection.test.ts:19-53` (the pin)
- Modify: `lib/product/screen-registry.ts` (delete the `jlpt-test` entry and its comment block)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing later tasks import. `PROTECTED_PREFIXES` loses one element; Task 4 edits the same array.

- [ ] **Step 1: Confirm the route is genuinely dead before deleting it**

```bash
git grep -n "jlpt-test" -- '*.ts' '*.tsx' | grep -v "components/jlpt/jlpt-test-"
```

Expected: hits ONLY in `route-protection.ts`, `route-protection.test.ts`, `screen-registry.ts`, and the page file itself. Every `components/jlpt/jlpt-test-*` hit is a component filename (`jlpt-test-runner`, `-list`, `-card`) and is **not** this route — that is why the `grep -v` is there. If any *other* file references the route, STOP and report: A16's "no callers" finding would be false.

- [ ] **Step 2: Update the pin test first, and watch it fail**

In `lib/supabase/route-protection.test.ts`, delete the `"/jlpt-test",` line from the `toEqual([...])` array (it sits between `"/jlpt"` and `"/community"`).

Run: `npx vitest run lib/supabase/route-protection.test.ts`
Expected: **FAIL** — an array mismatch naming `/jlpt-test`, because the pin no longer lists it while `PROTECTED_PREFIXES` still does. (Deliberately no expected lengths here: a draft of this plan wrote two counts that were both wrong, which is `L-002` in miniature. Read the numbers off the failure, do not check them against a plan.) This is the pin doing its job: it is the forcing function for any `PROTECTED_PREFIXES` edit (A16's corrected mutation target — *not* the filesystem coverage test, which structurally cannot detect a prefix outliving its route).

- [ ] **Step 3: Delete the prefix and the page**

In `lib/supabase/route-protection.ts`, delete the line `  "/jlpt-test",`.

```bash
git rm "app/[locale]/(protected)/(app)/jlpt-test/page.tsx"
```

- [ ] **Step 4: Delete the registry entry**

In `lib/product/screen-registry.ts`, delete the whole `screenId: "jlpt-test"` object **and the comment block directly above it** (the block beginning "an 8-line dead redirect() to /jlpt" and ending "not amended here"). Deleting the entry rather than nulling its fields is what A16 specifies: an entry keeping `route: "/jlpt-test"` + `impl: "built"` fails T2 once the page is gone.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run` and `npx tsc --noEmit`
Expected: all green. T1 (page→registry) and T2 (registry→page) both stay green because the page and the entry disappeared together.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(product): A16 — delete the dead /jlpt-test route

Eight-line bare redirect() to /jlpt, superseded in Layer 5, no callers.
Page, PROTECTED_PREFIXES entry and registry entry deleted together so T2
never sees an entry claiming a route that no longer resolves.

The pin at route-protection.test.ts:19-53 was edited first and watched fail
before the prefix was removed — it is the forcing function for this array,
not the filesystem coverage test, which cannot detect a prefix outliving its
route."
```

---

## Task 2: The database rename

**Files:**
- Create: `supabase/migrations/20260814000027_certification_rename.sql`
- Modify: `lib/data/jlpt.ts:74,93,101,168,177` · `lib/data/admin-content.ts:187-199` · `lib/data/admin-stats.ts:106` · `lib/data/companion.ts:191` · `lib/data/gamification.ts:227`
- Modify (test mocks): `lib/data/admin-stats.test.ts` · `lib/data/companion.test.ts` · `lib/data/gamification.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: tables named `certification_tests` and `certification_questions`. Every later task assumes those names. Exported function names in `lib/data/jlpt.ts` (`listJlptTests`, `listJlptAttempts`) are **unchanged** — they name the family.

- [ ] **Step 1: Update the test mocks first, and watch them fail**

The Supabase mock is keyed by table name, so the mocks ARE the failing test. In each of the three test files, rename the mock resolver key `jlpt_tests` → `certification_tests` (and `jlpt_questions` → `certification_questions` where present).

Exact sites to change: `lib/data/admin-stats.test.ts:88,136` · `lib/data/companion.test.ts:316,346` · `lib/data/gamification.test.ts:266,277`.

Run: `npx vitest run lib/data/admin-stats.test.ts lib/data/companion.test.ts lib/data/gamification.test.ts`
Expected: **FAIL.** The mock throws on an unregistered table, because the source still calls `.from("jlpt_tests")` while only `certification_tests` is registered. Paste the raw failure text into the task report.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260814000027_certification_rename.sql`:

```sql
-- Phase 2b / A9: the certification MODULE is renamed; the JLPT exam FAMILY is
-- not. Only the two module tables move. `jlpt_level`, `jlpt_section`, every
-- `jlpt_level` column and `user_test_attempts` keep their names deliberately —
-- they describe the family, which is still exactly what they hold
-- (spec 2026-08-14-screen-registry-phase-2b-design.md §2).
--
-- No `exam_family` column and no change to the `jlpt_section` enum: the repo
-- implements one exam family, so the multi-family abstraction has no consumer
-- to validate it (spec §1, user ruling 2026-08-14).
--
-- APPEND-ONLY: the historical migrations that create and seed these tables are
-- NOT edited. They ran under the old names, which was correct at the time.

alter table jlpt_tests rename to certification_tests;
alter table jlpt_questions rename to certification_questions;

-- Postgres carries indexes, FK constraints, RLS policies and column-level
-- grants across a table rename automatically — it renames the relation, not
-- its dependents. The statements below only rename the OBJECTS themselves so
-- their names stop lying; they are not what preserves the behaviour.
alter index idx_jlpt_questions_test rename to idx_certification_questions_test;
alter index idx_jlpt_questions_test_section rename to idx_certification_questions_test_section;

alter policy jlpt_tests_read on certification_tests rename to certification_tests_read;
alter policy jlpt_questions_read on certification_questions rename to certification_questions_read;
```

- [ ] **Step 3: Update the five source call sites**

`lib/data/jlpt.ts` — `.from("jlpt_tests")` at lines 74, 93, 168 and `.from("jlpt_questions")` at 101, 177 become `.from("certification_tests")` / `.from("certification_questions")`. **The filename and the exported function names do not change.**

`lib/data/admin-stats.ts:106`: `service.from("jlpt_tests")` → `service.from("certification_tests")`.

`lib/data/companion.ts:191`: `supabase.from("jlpt_tests")` → `supabase.from("certification_tests")`.

`lib/data/gamification.ts:227`: `supabase.from("jlpt_tests")` → `supabase.from("certification_tests")`.

`lib/data/admin-content.ts:187-199` — change **only** the two `table:` values and the embedded-resource name inside `detailColumns`. ⛔ **The map KEY `jlpt_tests:` stays**, because it is the admin ContentType identifier, pinned at `messages/en/admin.pin.test.ts:94,141-144` and used for message lookup:

```ts
  jlpt_tests: {                                   // ← KEY UNCHANGED (ContentType id)
    table: "certification_tests",                 // ← changed
    orderColumn: "created_at",
    listColumns: "id, level, title, created_at",
    detailColumns:
      "id, level, title, section_config, created_at, certification_questions(id, section, question_type, question_data, correct_answer, explanation, order_index)",
    searchColumn: "title",
    sanitizeMainRow: (row) => collapseFields(row, ["title"]),
    createSchema: createJlptTestSchema,
    updateSchema: updateJlptTestSchema,
    csvRowSchema: jlptTestCsvRowSchema,
    child: { table: "certification_questions", parentColumn: "test_id", key: "questions", sanitize: sanitizeJlptQuestion },
  },
```

The `certification_questions(...)` string is PostgREST embedded-resource syntax and names the **table**, so it must move with the rename. `createJlptTestSchema` / `sanitizeJlptQuestion` are family names and stay.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run` and `npx tsc --noEmit`
Expected: all green.

- [ ] **Step 5: Verify G2 — no historical migration was edited**

```bash
git diff --name-status master...HEAD -- supabase/migrations/
```

Expected: exactly one line, `A	supabase/migrations/20260814000027_certification_rename.sql`. **Any `M` line is a defect** — revert it. Paste the raw output.

- [ ] **Step 6: The security check that no unit test can perform**

`certification_questions` inherits `revoke select ... from authenticated` plus a column-scoped `grant` that deliberately omits `correct_answer` (`20260713000011_reading_jlpt.sql:116-117`). **`L-005`: the Supabase mock models no RLS, so the green suite above is not evidence about this.**

Against a real database with the migration applied:

```sql
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_name = 'certification_questions' and grantee = 'authenticated'
order by column_name;
```

Expected: rows for `id, test_id, section, question_data, question_type, order_index` and **no row for `correct_answer`**. Paste the raw result.

**If no real database is available, do NOT claim this passed.** Write in the report, verbatim: *"Column-grant preservation NOT VERIFIED — no database available. `correct_answer` exposure is unproven."* and carry it to Task 8.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(db): rename the certification module's two tables

jlpt_tests -> certification_tests, jlpt_questions -> certification_questions,
plus their indexes and RLS policies so the names stop lying. Postgres carries
indexes, FKs, policies and column grants across a rename automatically; the
alter statements only rename the objects.

The family keeps its names: jlpt_level, jlpt_section, every jlpt_level column
and user_test_attempts are untouched, as is the admin ContentType KEY
jlpt_tests (only its table: value moved).

Test mocks were renamed first and watched fail — the mock throws on an
unregistered table, so it is the forcing function here.

Append-only: git diff --name-status against master shows one A line and zero M
lines under supabase/migrations/."
```

---

## Task 3: Rename the API namespace

**Files:**
- Move: `app/api/jlpt/` → `app/api/certification/` (4 `route.ts` files)
- Modify: `components/jlpt/jlpt-test-runner.tsx:100` · `components/jlpt/jlpt-test-runner.test.tsx:134`
- Modify (comments only): `lib/jlpt-ui.ts:4,66` · `lib/validation/jlpt.ts:9,14,23`

**Interfaces:**
- Consumes: the renamed tables from Task 2.
- Produces: endpoints under `/api/certification/**`. The only runtime caller is `jlpt-test-runner.tsx`.

- [ ] **Step 1: Update the caller's test first, and watch it fail**

In `components/jlpt/jlpt-test-runner.test.tsx:134`:

```ts
    expect(url).toBe(`/api/certification/tests/${TEST.id}/submit`);
```

Run: `npx vitest run components/jlpt/jlpt-test-runner.test.tsx`
Expected: **FAIL** — received `/api/jlpt/tests/<id>/submit`, expected `/api/certification/...`. Paste it.

- [ ] **Step 2: Move the API directory**

```bash
git mv app/api/jlpt app/api/certification
```

Confirm four route files moved:

```bash
find app/api/certification -name "route.ts" | sort
```

Expected exactly: `attempts/route.ts`, `tests/route.ts`, `tests/[id]/route.ts`, `tests/[id]/submit/route.ts`.

- [ ] **Step 3: Update the caller**

`components/jlpt/jlpt-test-runner.tsx:100`:

```ts
      const res = await fetch(`/api/certification/tests/${test.id}/submit`, {
```

- [ ] **Step 4: Fix the doc comments that name the endpoints**

These are comments, but a comment naming a dead endpoint is the stale-doc defect this project keeps paying for. Update the paths in `lib/jlpt-ui.ts:4,66` and `lib/validation/jlpt.ts:9,14,23` (`/api/jlpt/*` → `/api/certification/*`). **Do not rename the files or any symbol in them.**

- [ ] **Step 5: Verify no caller was missed**

```bash
git grep -n "/api/jlpt" -- '*.ts' '*.tsx'
```

Expected: **no output** (exit 1). Paste the result.

- [ ] **Step 6: Run tests and commit**

Run: `npx vitest run` and `npx tsc --noEmit` — expected green.

```bash
git add -A
git commit -m "feat(api): /api/jlpt -> /api/certification

Four route handlers moved with git mv. One runtime caller
(jlpt-test-runner.tsx); its test was updated first and watched fail.

Comments in lib/jlpt-ui.ts and lib/validation/jlpt.ts that name the endpoints
were corrected too — a comment naming a dead endpoint is the stale-doc defect
this project keeps paying for. Neither file is renamed: both describe the JLPT
family, not the module.

git grep '/api/jlpt' now returns nothing."
```

---

## Task 4: The page route, the registry and route protection — ONE commit

⛔ **Spec §7 and the user's ruling: these three move together.** `T2` fails the moment a registry entry claims a route that does not resolve, so a staged version of this task is knowingly-red by construction.

**Files:**
- Move: `app/[locale]/(protected)/(app)/jlpt/` → `.../certification/`
- Modify: `lib/product/screen-registry.ts` (header note, `jlpt` entry, `jlpt-practice-phase-1` entry)
- Modify: `lib/supabase/route-protection.ts` + `lib/supabase/route-protection.test.ts:19-53`

**Interfaces:**
- Consumes: `/api/certification` (Task 3), renamed tables (Task 2).
- Produces: routes `/certification` and `/certification/[id]`.

- [ ] **Step 1: Update the protection pin first, and watch it fail**

In `lib/supabase/route-protection.test.ts`, change `"/jlpt",` to `"/certification",` **in place** — same position in the array, between `"/conversation"` and `"/community"`. (Task 1 already removed `"/jlpt-test"`.)

Run: `npx vitest run lib/supabase/route-protection.test.ts`
Expected: **FAIL**, naming `/jlpt` vs `/certification`. Paste it.

- [ ] **Step 2: Move the page directory**

```bash
git mv "app/[locale]/(protected)/(app)/jlpt" "app/[locale]/(protected)/(app)/certification"
```

Both `page.tsx` and `[id]/page.tsx` move. **Do not edit their contents** — they import from `components/jlpt/**` and `lib/data/jlpt.ts`, which keep their names (constraint 2).

- [ ] **Step 3: Update the prefix**

In `lib/supabase/route-protection.ts`, change `  "/jlpt",` to `  "/certification",` in place.

- [ ] **Step 4: Update the two registry entries**

In `lib/product/screen-registry.ts`, the `screenId: "jlpt"` entry: `route: "/jlpt"` → `route: "/certification"`. **`name: "JLPT Practice"` does NOT change** — it is frame `232:2`'s name, copied verbatim from `figma-frame-map.md` (constraint 6).

Replace the ⛔ comment block above that entry with:

```ts
  // A9 APPLIED in Phase 2b (2026-08-14): the route is `/certification`. The
  // `name` stays "JLPT Practice" because it is frame 232:2's name, copied
  // verbatim — the MODULE was renamed, the frame was not. The nav label lives
  // in messages/*/nav.json under the key `jlpt` (R9: screenId is the catalog
  // key, and identity is not renamed to prettify a key).
```

The `screenId: "jlpt-practice-phase-1"` entry: `route: "/jlpt/[id]"` → `route: "/certification/[id]"`. Its `name` and `screenId` do not change.

- [ ] **Step 5: Update the registry header's "NOT applied" note**

At `lib/product/screen-registry.ts:21-23`, replace the `⛔ NOT applied: /jlpt → /certification (A9)` paragraph with:

```
 * ✅ APPLIED in Phase 2b: `/jlpt` → `/certification` (A9). The rename covers
 * the MODULE only — route, API and the two module tables. The JLPT exam family
 * keeps its names (`jlpt_level`, `jlpt_section`, `components/jlpt/**`), and the
 * schema generalisation A9 anticipated is deliberately NOT done: the repo
 * implements one exam family, so it has no consumer to validate it.
```

- [ ] **Step 6: Run the whole suite**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all green — T1, T2 and the protection pin together. If T2 is red, the registry and the page disagree; fix before committing rather than committing a red suite.

- [ ] **Step 7: Commit — all of it, at once**

```bash
git add -A
git commit -m "feat(product): A9 — /jlpt becomes /certification

Page directory, both registry entries and PROTECTED_PREFIXES move in ONE
commit, per the spec: T2 fails the instant a registry entry claims a route
that does not resolve, so any staged version of this change is knowingly red.

The pin was edited first and watched fail. Page file contents are untouched —
they import components/jlpt/** and lib/data/jlpt.ts, which keep their names
because they name the exam family, not the module.

Registry `name` fields deliberately unchanged: 'JLPT Practice' is frame
232:2's name copied verbatim. The module was renamed; the frame was not."
```

---

## Task 5: The nav label (A17) — and a pin, because there is none today

Measured: **no existing pin asserts the `jlpt` nav row** (`messages/en/nav.pin.test.ts` does not exist; `messages/vi/nav.pin.test.ts` does not mention it). So this label can currently be changed or reverted with the suite staying green. Task 5 closes that.

**Files:**
- Modify: `messages/en/nav.json:16` · `messages/vi/nav.json:16`
- Create: `messages/nav-certification.pin.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nav row label `Certification` / `Luyện thi` under the unchanged key `jlpt`.

- [ ] **Step 1: Write the failing pin**

Create `messages/nav-certification.pin.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import enNav from "./en/nav.json";
import viNav from "./vi/nav.json";

/**
 * A17 (user ruling, 2026-08-14): the certification module's nav row reads
 * "Certification" in EN and "Luyện thi" in VI — the ACTIVITY, not the
 * credential ("Chứng chỉ" was offered and declined).
 *
 * Pinned because nothing else asserts this row: there is no
 * messages/en/nav.pin.test.ts, and messages/vi/nav.pin.test.ts does not cover
 * it — so before this file, changing or reverting either label left the suite
 * green.
 *
 * ⚠️ The KEY stays `jlpt` on purpose. R9 makes `screenId` the catalog key and
 * the screenId was not renamed (Phase 1b precedent: identity is not renamed to
 * prettify a key). A14 is the same shape — a group's heading is not its id.
 * Renaming this key to `certification` is therefore a defect, not a tidy-up.
 */
describe("A17 — the certification nav row", () => {
  it("reads 'Certification' in EN, under the unchanged key `jlpt`", () => {
    expect(enNav.jlpt).toBe("Certification");
  });

  it("reads 'Luyện thi' in VI — the activity, not the credential", () => {
    expect(viNav.jlpt).toBe("Luyện thi");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run messages/nav-certification.pin.test.ts`
Expected: **FAIL** twice — received `"JLPT"` for both. Paste the raw output.

- [ ] **Step 3: Change the labels**

`messages/en/nav.json:16`: `"jlpt": "Certification",`
`messages/vi/nav.json:16`: `"jlpt": "Luyện thi",`

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run messages/nav-certification.pin.test.ts` — expected PASS (2 tests).
Then `npx vitest run` — expected all green.

⚠️ **Do NOT add `/certification` to `messages/destination-name-parity.test.ts`.** Spec §6: that test compares `nav.json` against `upcoming.json`, and `/certification` is a built page whose title comes from `messages/*/jlpt.json`. The nav/title divergence ("Certification" vs "JLPT mock tests") is deliberate under A17, on the `/roadmap` precedent, and that file's own header says its scoping is on purpose.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(i18n): A17 — the certification nav row reads Certification / Luyện thi

'Luyện thi' names the activity, matching P5's 'Certification Practice'.
'Chứng chỉ' was offered and declined: it names the credential, so a nav row
carrying it suggests a place to view certificates you hold.

The catalog KEY stays `jlpt` — R9 makes screenId the catalog key and the
screenId was not renamed.

Shipped with a new pin because nothing asserted this row before: there is no
messages/en/nav.pin.test.ts and the VI one does not cover it, so either label
could be reverted with the suite green. Watched fail on both locales first."
```

---

## Task 6: The redirect — routing configuration, not a screen

**Files:**
- Modify: `next.config.mjs` (add a 4th rule) · `next.config.test.ts` · `tests/e2e/route-rename-redirects.spec.ts`

**Interfaces:**
- Consumes: `/certification` exists (Task 4).
- Produces: `/:locale/jlpt/*` → `/:locale/certification/*`, 307.

- [ ] **Step 1: Update `next.config.test.ts`'s rule-count test, and watch it fail**

That file asserts `expect(sources).toHaveLength(3)` plus an exact `toEqual` of three sources. Change both to four — append `"/:locale/jlpt/:path*"` to the expected array:

```ts
  it("still ships exactly the four rules the specs define", async () => {
    const sources = (await rules).map((r) => r.source);
    expect(sources).toHaveLength(4);
    expect(sources.map((s) => s.replace(/\(.*?\)/, ""))).toEqual([
      "/:locale/videos",
      "/:locale/videos/:id/shadowing",
      "/:locale/videos/:id/dictation",
      "/:locale/jlpt/:path*",
    ]);
  });
```

Run: `npx vitest run next.config.test.ts`
Expected: **FAIL** — length 3 vs 4. Paste it. This is the guard doing the work; the other three tests in that file (locale constrained, locale set equals `routing.locales`, every rule 307) then apply to the new rule automatically.

- [ ] **Step 2: Add the rule**

In `next.config.mjs`, append to the array returned by `redirects()`, after the three `/videos` rules:

```js
      // Phase 2b / A9: /jlpt -> /certification. A WILDCARD is correct here,
      // unlike the /videos rules above: this renames a PREFIX, so one rule
      // covers /jlpt and /jlpt/[id]. The rules above collapse a segment, which
      // is why they are enumerated instead.
      //
      // TEMPORARY, with a removal condition (A17): remove once the app is
      // published and one release has passed, or at launch if no /jlpt traffic
      // is observed. Recorded in decision-register.md so this cannot become the
      // next /jlpt-test — a dead redirect nobody could justify two phases on.
      {
        source: "/:locale(vi|en)/jlpt/:path*",
        destination: "/:locale/certification/:path*",
        permanent: false,
      },
```

`:locale(vi|en)` must stay constrained: unconstrained, `:locale` matches the literal segment `api`, and `redirects()` runs before the filesystem.

- [ ] **Step 3: Run the config tests**

Run: `npx vitest run next.config.test.ts`
Expected: **PASS**, all four tests.

- [ ] **Step 4: Add the e2e assertions**

Append to `tests/e2e/route-rename-redirects.spec.ts`:

```ts
test("certification: /en/jlpt redirects with 307 to /en/certification", async ({ request }) => {
  const res = await request.get("/en/jlpt", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(locationPathname(res.headers()["location"])).toBe("/en/certification");
});

test("certification: the wildcard carries the id segment", async ({ request }) => {
  const res = await request.get(`/en/jlpt/${ID}`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(locationPathname(res.headers()["location"])).toBe(`/en/certification/${ID}`);
});

test("certification: the rule is not over-broad — /en/jlptsomething is not swallowed", async ({
  request,
}) => {
  // `/:locale(vi|en)/jlpt/:path*` matches the segment `jlpt` exactly, so a
  // longer first segment must not redirect at all. Asserted unconditionally,
  // never branched on the status — a branch lets an `else` arm assert
  // something true by construction.
  const res = await request.get("/en/jlptsomething", { maxRedirects: 0 });
  expect([301, 302, 303, 307, 308]).not.toContain(res.status());
});
```

- [ ] **Step 5: Prove the e2e specs actually run**

⚠️ `vitest.config.ts:13` excludes `tests/e2e`, so `npx vitest run` **cannot** execute the block above. `L-025`: a sweep finds the break, but the replacement must be proven to run.

Run: `npm run test:e2e -- route-rename-redirects`
Paste the raw output. If the environment cannot run Playwright, say so explicitly in the report — do **not** report the unit suite's green as evidence for these three tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(routing): redirect /jlpt/* -> /certification/* (307, temporary)

A redirect is routing configuration, not a screen: it has no page.tsx, so T1
never sees it and R5 is never engaged. Registering it would have been forced
to claim repoOnlyReason 'no-frame-at-last-pass' (R13 restricts the only other
member to chrome:'admin' via T10) — false, since /jlpt has frame 232:2, and it
would pollute the survey backlog Phase 2a exists to keep honest.

A wildcard is correct here where it was wrong for /videos: this renames a
prefix rather than collapsing a segment. :locale stays constrained to (vi|en)
so the rule cannot swallow /api.

307 not 308 — the rule is temporary and A17 carries its removal condition.

next.config.test.ts's exact-rule-count assertion was updated first and watched
fail; that is the proof the rule landed."
```

---

## Task 7: Docs, A17, the comment debt, and the mandatory sweep (G4)

**Files:**
- Modify: `docs/product/decision-register.md` (A17 + A9/A16 status)
- Modify: `components/layout/app-nav.tsx:16-18`

- [ ] **Step 1: Record A17 in the decision register**

Add a row to §2's table and a prose block beneath it. A17 has three parts (spec §10): the VN label `Luyện thi` with the reason "Chứng chỉ" was declined; the deliberate nav/page-title divergence on the `/roadmap` precedent; and the `/jlpt` redirect's removal condition. Also mark **A9 and A16 as executed in 2b**, with the commit shas.

- [ ] **Step 2: Fix the `app-nav.tsx` comment debt — measure, never copy**

```bash
grep -c 'screenId: "' lib/product/screen-registry.ts
```

Use **that** number. Do not copy 79 from this plan — Task 1 deleted an entry, so the count has moved since this plan was written, and copying it would reproduce exactly the `L-002` defect the comment is being fixed for.

In `components/layout/app-nav.tsx:16-18`, correct "ships all 50 entries" to the measured count and drop "internal debt labels" — Phase 2a retired that framing (a survey field records an observation, never a work-list membership).

- [ ] **Step 3: G4 — the mandatory sweep, run to exhaustion**

The user ruled the reverse-direction `PROTECTED_PREFIXES` guard out of 2b; this sweep replaces it and is **not optional**.

```bash
git grep -n "jlpt-test" -- ':!docs/superpowers/plans' ':!docs/superpowers/specs'
git grep -n "/jlpt" -- ':!docs/superpowers/plans' ':!docs/superpowers/specs'
```

Adjudicate **every** hit into one of: (a) a `components/jlpt/jlpt-test-*` component filename — correct, family naming; (b) a historical migration or dated artifact — correct, leave it; (c) a genuine stale reference — fix it. Paste the raw output and the verdict per hit. `L-024`: a sweep that stops at its first hit is a spot fix wearing a sweep's name.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs(product): A17, the app-nav comment debt, and 2b's exhaustive sweep

A17 records three things: the VN nav label 'Luyện thi' (the activity, not the
credential); the deliberate nav/page-title divergence on the /roadmap
precedent; and the /jlpt redirect's removal condition, so it cannot become the
next /jlpt-test.

app-nav.tsx's comment claimed 'all 50 entries' where the registry holds a
different number — re-measured with grep -c rather than copied from the plan,
since Task 1 changed it. 'Internal debt labels' dropped: Phase 2a retired that
framing.

G4 sweep of /jlpt and /jlpt-test run to exhaustion, every hit adjudicated."
```

---

## Task 8: Whole-branch review

Required by CLAUDE.md §9 even though every task was reviewed on its own (`L-011`), and its fix wave will need its own review (`L-012`).

- [ ] **Step 1: Run the four guards, paste actual output**

```bash
# G1 — the NEVER-rename list is intact
ls components/jlpt/ | wc -l                       # expect 17
ls messages/en/jlpt.json messages/vi/jlpt.json     # both exist
grep -n "RepoOnlyReason =" lib/product/screen-registry-types.ts
git grep -c "jlpt_level" -- supabase/migrations/20260712000001_schema.sql

# G2 — migrations append-only
git diff --name-status master...HEAD -- supabase/migrations/   # one A, zero M

# G3 — no new registry vocabulary
git grep -n '"redirect"' -- lib/product/

# G4 — Task 7's sweep output is in its report
```

- [ ] **Step 2: Full gate**

```bash
npx tsc --noEmit ; npx vitest run ; npx next lint ; npx next build
```

Expected: 0 · all green · 77 warnings / 0 errors · exit 0. Re-measure each; never inherit a number from a task report (`L-003`).

- [ ] **Step 3: Dispatch the whole-branch review**

Range `master..HEAD`. Give the reviewer the spec, this plan, and the four guards. Require it to check the naming line of spec §2 in **both** directions: nothing renamed that should not be, and nothing left that should have moved.

⚠️ Carry forward Task 2 Step 6's column-grant result explicitly. If it was not verified against a real database, the review must record that as an **open, unverified security item**, never as passed.

- [ ] **Step 4: Fix wave, then re-review it (`L-012`)**

- [ ] **Step 5: Write lessons to `docs/lessons.md`** per its four entry rules — merge into an existing entry where one applies.

---

## Self-review

**Spec coverage.** §2 naming line → constraints 1–2 + G1. §3 redirect → Task 6. §4 migration → Task 2 (append-only checked twice: Task 2 Step 5 and G2). §5 app changes → Tasks 2–4, 7. §6 title divergence → Task 5 Step 4's explicit prohibition. §7 verification → every task's TDD steps; §7.3's mandated sweep → Task 7 Step 3 (G4). §8 out of scope → constraints 4–5 + G3. §9 risks → the column grant (Task 2 Step 6), historical migrations (G2), stale references (G4), separate commits (Task 4's single-commit rule). §10 A17 → Tasks 5 and 7.

**Placeholders.** None: every code step carries real content, and the one deliberately un-numbered value (the registry entry count in Task 7 Step 2) is un-numbered *on purpose*, with the measuring command given and copying explicitly forbidden.

**Type/name consistency.** `certification_tests` / `certification_questions` used identically in Tasks 2, 8. `listJlptTests` / `listJlptAttempts` / `createJlptTestSchema` / `sanitizeJlptQuestion` referenced only as names that do **not** change. The admin ContentType key `jlpt_tests` vs its `table:` value is called out explicitly in Task 2 Step 3, which is the single place the two could be confused.
