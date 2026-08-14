# Screen Registry Phase 2b — run state (⭐ THE LIVE RUN STATE)

> This file is the authority for Phase 2b. `mem:screen_registry_run_state` is now **historical**
> (Phases 1a/1b/2a) and points here. Do not record 2b status in two places.

# ▶▶ RESUME HERE

**Branch `screen-registry-phase-2b`, off master `8d01ed9`. All 8 plan tasks are IMPLEMENTED. The
whole-branch review (`L-011`) has run and its single fix wave has landed.**

⚠️ **This header used to say "HEAD `777b326`, three commits, ALL DOCUMENTATION, zero application
code touched" and named "execute Task 1" as the next action.** All of that is superseded — it
described the branch before implementation began. It also carried an open question about execution
mode (subagent-driven vs inline); that question is closed by events, the plan having been executed.
Corrected by the whole-branch review's fix wave, 2026-08-14, in the same pass that corrected the
nav-pin claim below (`L-026`: stale-check a handoff doc in the pass that falsifies it).

The commit list is not restated here — read it off the branch (`L-002`):

```
$ git log --oneline master..HEAD
$ git diff --name-status master...HEAD
```

**⭐ THE NEXT ACTION: the scoped re-review of the fix wave (`L-012`), then merge `--no-ff` —
and the merge is the user's call, exactly as 2a was not merged until they said so.**

---

## What 2b is, in one line

Rename the certification **module** — route, API, and its two tables — from `jlpt` to
`certification`. Leave every name that refers to the JLPT **exam family** alone.

## The four user rulings that set the scope (2026-08-14)

Each was a real fork; none is re-openable without the user.

1. **NO schema generalisation.** A9 was deferred to Phase 2 precisely because "`jlpt_section`'s enum
   cannot be the shared abstraction across three exam families". **2b deliberately does not act on
   that reason**: P5 says the repo implements exactly one family, so the abstraction has no second
   consumer to validate it. No `exam_family` column, no enum change. Deferred **with its reason
   recorded**, not forgotten — `jlpt_tests.section_config jsonb` already exists and is the natural
   hook when BJT or Tokutei Ginou is actually scheduled.
2. **Old URLs redirect**, with a dated removal condition so the rule cannot become the next
   `/jlpt-test`.
3. **Module surface only.** `components/jlpt/`, `messages/*/jlpt.json`, `lib/data/jlpt.ts`, the
   enums, every `jlpt_level` column, `user_test_attempts`, every `screenId`, and the admin
   ContentType **key** `jlpt_tests` all keep their names — those names are still true. Same
   *propagate ≠ replace-all* line A15 forced.
4. **Tests first**, and route + registry + `PROTECTED_PREFIXES` move in **ONE commit**.

Plus, from the user's review of the spec:

5. **The reverse-direction `PROTECTED_PREFIXES` guard is DEFERRED, not optional** — infrastructure
   improvement, not a precondition for shipping A9. **In its place a manual sweep is MANDATORY**
   (guard G4, Task 7 Step 3), run to exhaustion, output pasted not summarised.
6. **Migrations are append-only.** The tempting wrong move — renaming the tables inside
   `20260712000001_schema.sql` "for cleanliness" — is named explicitly in spec §4 with a ⛔ block,
   because it destroys history: environments that ran the old file diverge from fresh ones.

## The one architectural finding — do not re-derive it

**A `/jlpt` redirect CANNOT be a registry entry.** R13 machine-restricts `out-of-design-scope` to
`chrome: 'admin'` (enforced by **T10**), so a `kind: 'repo-only'` entry would be forced to claim
**`no-frame-at-last-pass`** — which is **false**, since `/jlpt` has frame `232:2`, and it would
pollute the survey backlog Phase 2a exists to keep honest. R13 says widening that enum needs an
explicit spec amendment.

**2b needs no amendment:** a redirect is *routing configuration*, not a screen. It goes in
`next.config.mjs` `redirects()`, following the existing `/videos` → `/shadowing` precedent. No
`page.tsx` ⇒ `T1` never sees it ⇒ `R5` is never engaged.

A **wildcard is correct here** (`/:locale(vi|en)/jlpt/:path*`) where it was wrong for `/videos`:
this renames a **prefix**; the `/videos` rules **collapse a segment**. `:locale` stays constrained —
unconstrained it matches the literal `api`, and `redirects()` runs before the filesystem (the
recorded `/api/videos` → 307 incident). `permanent: false` (307), never 308.

## Two claims the spec's own review corrected — by reading the tests, not assuming

Recorded because both are the exact "plausible but wrong" shape 2a was burned by:

1. **`messages/destination-name-parity.test.ts` structurally CANNOT cover `/certification`.** It
   compares `nav.json` against **`upcoming.json`**; `/certification` is a *built* page whose title
   comes from `messages/*/jlpt.json` (`"JLPT mock tests"`). ⛔ **Do not "helpfully" widen that
   test** — its own header says the scoping is deliberate and its bottom guard fires on widening.
   The nav/title divergence ("Certification" vs "JLPT mock tests") is **deliberate under A17**, on
   the `/roadmap` precedent (A8 gives it nav "Journey" over title "Roadmap").
2. **`next.config.test.ts` asserts an exact rule count** (`toHaveLength(3)` + an exact `toEqual`), so
   the fourth redirect rule turns it red on its own. Updating it to four **is the proof the rule
   landed**, not a chore.

## Measured facts worth not re-deriving

> Except where a bullet says otherwise, these were measured **before implementation**, at master
> `8d01ed9`, and are kept as a dated record of the starting state — not as claims about HEAD. The
> branch has since consumed several of them (migration `20260814000027` is no longer "next free";
> the registry lost an entry to A16). Re-measure at HEAD before using any of them (`L-002`).

- **The `jlpt` nav row's pin coverage, corrected by the whole-branch review (2026-08-14).** This
  bullet previously read *"Nothing pins the `jlpt` nav row today … the label could be changed or
  reverted with the suite green."* **That was false for EN**, and the correction matters because it
  changes what Task 5 was for. Measured at master:
  - **No CATALOG-level pin for either locale** — `messages/en/nav.pin.test.ts` does not exist, and
    `messages/vi/nav.pin.test.ts` does not mention `jlpt` (`grep -c jlpt` → 0). This part was right.
  - **EN was already pinned at RENDER level.** `components/layout/app-nav.test.tsx`'s
    `EXPECTED_LABELS` is a hand-written literal map — `jlpt: "JLPT"` at master — asserted against
    the rendered link text. Changing `en/nav.json`'s `jlpt` value would have turned it red
    immediately, which is exactly why Task 5 had to edit that file to ship A17.
  - **VI was genuinely unpinned at BOTH levels**, because `test/render.tsx` mounts every component
    test at `locale="en"` (`NextIntlClientProvider locale="en"`), so no render test ever reads the
    Vietnamese catalog.

  So Task 5's real gap was **VI**, plus catalog-level directness for EN — not "nothing pins it".
  `messages/nav-certification.pin.test.ts`'s header states this accurately; prefer it over any
  restatement here.
- Registry holds **79** entries at `8d01ed9` (`grep -c 'screenId: "'`). Task 1 deletes one, so
  **Task 7 forbids copying this number from the plan** and requires re-measuring.
- `PROTECTED_PREFIXES` has **28** entries. A plan draft wrote 31; both drafted counts were wrong, so
  the plan now carries **no expected lengths** and tells the implementer to read them off the
  failure (`L-002` in miniature).
- `components/jlpt/` = **17** files. `app/api/jlpt/` = **4** route handlers. Exactly **one** runtime
  caller of the API: `components/jlpt/jlpt-test-runner.tsx:100` (+ its test at `:134`).
- Exactly **six** historical migrations mention the tables — five that *operate* on them, plus
  `20260731000019_collections.sql:28` which names `jlpt_tests` **in a comment only**. All six stay.
- Next free migration number: **`20260814000027`**.

## ⚠️ The one thing that cannot be proven by the test suite

`certification_questions` inherits `revoke select ... from authenticated` plus a column-scoped
`grant` that deliberately **omits `correct_answer`** (`20260713000011_reading_jlpt.sql:116-117`).
**`L-005`: the Supabase mock models no RLS, so a green suite is NOT evidence about this.**

Task 2 Step 6 requires DB-level evidence (`information_schema.column_privileges`), or the words
**"NOT VERIFIED"** written into the report. **Never let a unit-test claim stand in for it**, and
Task 8 must carry the unresolved state into the whole-branch review as an open security item.
This is a user-locked condition, not a nicety.

## Two subtleties an implementer will get wrong if unwarned

1. **The admin ContentType KEY `jlpt_tests` stays; only its `table:` value moves.** The key is
   pinned at `messages/en/admin.pin.test.ts:94,141-144` and drives message lookup. But the
   `detailColumns` string contains `jlpt_questions(...)`, which is PostgREST **embedded-resource**
   syntax naming the *table* — so that one **does** move. Both live in
   `lib/data/admin-content.ts:187-199`, four lines apart.
2. **Registry `name` fields are Figma frame names copied verbatim** — `"JLPT Practice"` **stays**.
   The module was renamed; the frame was not. Only `route` changes.

## Guards (each scheduled in a named task, per L-029)

| | Assertion | Where |
|---|---|---|
| **G1** | the NEVER-rename list is intact | Task 8 |
| **G2** | `git diff --name-status master...HEAD -- supabase/migrations/` = one `A`, zero `M` | Task 2 **and** Task 8 |
| **G3** | `RepoOnlyReason` still has exactly two members; no `kind: "redirect"` | Task 8 |
| **G4** | the mandatory `/jlpt` + `/jlpt-test` sweep, run to exhaustion | Task 7 |

## Gate (re-measure, never inherit — L-003)

`tsc` 0 · `vitest` all green · `lint` **77 warnings / 0 errors** (baseline) · `next build` exit 0.
At `8d01ed9` the suite was **236 files / 2111 tests**; Task 5 adds a file, so expect it to move.

## After implementation

Task 8: whole-branch review (`L-011`) → fix wave → **the L-012 re-review of that fix wave** → then
lessons in `docs/lessons.md` → then merge `--no-ff` (**the merge is the user's call; 2a was not
merged until they said so**).

## Related

`docs/superpowers/specs/2026-08-14-screen-registry-phase-2b-design.md` (the spec — read §2 first) ·
`docs/superpowers/plans/2026-08-14-screen-registry-phase-2b.md` (the plan) ·
`docs/product/decision-register.md` (A9, A16, and A17 — Task 7 wrote A17; it is present now) ·
`mem:screen_registry_run_state` (historical: 1a/1b/2a) · `mem:screen_registry_inputs` ·
`docs/superpowers/specs/2026-08-08-screen-registry-design.md` (R1–R13, T1–T11).
