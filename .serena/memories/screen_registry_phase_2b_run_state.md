# Screen Registry Phase 2b — ✅ COMPLETE AND MERGED

> Superseded as "live work". This file is the **historical record of 2b, and of the 2026-08-19 run
> that closed both of its debts**. `mem:screen_registry_run_state` covers 1a/1b/2a. Neither is the
> live next action — there is no live next action for the screen registry until Phase 3 is scoped.

# ▶▶ RESUME HERE

**Phase 2b MERGED to master at `10caaac`** (`--no-ff`, 2026-08-14), off `8d01ed9`. Branch
`screen-registry-phase-2b` **kept**, per this repo's convention. 16 commits, 53 files.

Post-merge gate re-run **on master**, measured not inherited:
`tsc` 0 · `vitest` **237 files / 2113 tests** · `lint` **77 warnings / 0 errors** (baseline) ·
`next build` exit 0 · `playwright` 8/8 over real HTTP.

**Nothing is owed on 2b's process.** The review chain ran to the end: per-task reviews →
whole-branch review (`L-011`) → fix wave → **the `L-012` re-review of that wave** → the two findings
that re-review raised → controller verification of each.

**Both of 2b's debts are now CLOSED (2026-08-19) on branch `certification-grants-hardening` —
`74a752a` (migration) + `ff985f7` (lessons). ⚠️ NOT YET MERGED to master at the time of writing;
if `git log master` does not contain `74a752a`, the merge is the one step still owed.**
What carries forward is one *new*, deliberately-scoped task — a DB-backed regression guard — plus
two residuals that were never load-bearing. See § CARRY FORWARD at the end.

## ✅ DEBT 1 — CLOSED 2026-08-19, by measurement against a real database

**The column grant survived the Phase 2b rename.** Verified on a real local Supabase (full migration
chain applied from zero) as the real `authenticated` role, over PostgREST — the exact vector this
debt named:

- `authenticated` SELECT is scoped to exactly `id, test_id, section, question_data, question_type,
  order_index`. **`correct_answer` and `explanation` are absent**, at the SQL grant layer and through
  PostgREST alike.
- `select=correct_answer` / `select=explanation` / `select=*` → **403 `42501`**; anon → 401.
- Non-vacuous: the six granted columns returned 68 real rows, so "denied" is a denial and not an
  empty table (`L-004`).

**The migration's other two unknowns closed in the same run.** `20260814000027` executed for the
first time ever, inside a full chain from zero, exit 0 — no partial failure. And its own DEPLOY NOTE
("confirm on FIRST deploy that the PostgREST schema cache picked the rename up") is answered: it did,
unprompted, with no `notify pgrst`.

**What the run additionally found, and fixed.** Both certification tables still carried table-wide
INSERT/UPDATE/DELETE for `authenticated` — `20260713000011_reading_jlpt.sql` revoked them on
`reading_passages` and `reading_questions` but not on `jlpt_questions`. RLS was holding it shut alone
(POST → `new row violates row-level security policy`; PATCH → zero rows, confirmed by reading the data
back). Defence-in-depth, not an open hole — but a real one the moment anyone adds a permissive
INSERT/UPDATE policy. Closed by **`20260819000028_certification_grants_hardening.sql`**, which also
renamed the stale constraints (DEBT 2 item 1, now closed with it).

⚠️ **`L-001`, learned here the hard way:** a PostgREST `PATCH` with `Prefer: return=minimal` answers
**204 whether it wrote every row or none**. Never read that as proof of a write. Read the data back,
or ask for `return=representation,count=exact` — which turns the same call into a truthful 403.

**The reproducible recipe, better than the one this file used to carry.** Docker Desktop up →
`npx supabase db reset` → query `information_schema.column_privileges`, then probe PostgREST with a
JWT minted off the local `JWT_SECRET`. Real `authenticated`/`anon` roles and a live PostgREST beat the
old vanilla-`postgres:16` + stub-role recipe on every axis, and PostgREST is the only layer that tests
the browser-facing vector rather than a proxy for it. **Always include a positive control** — a query
shape returning zero rows proves nothing until you have seen it return rows where it should.

## DEBT 2 — ✅ item 1 CLOSED 2026-08-19; items 2 and 3 still open (non-blocking, deliberate)

1. ✅ **Stale constraint names — CLOSED** in `20260819000028_certification_grants_hardening.sql`.
   The policy this residual set ("rename opportunistically in the next migration that touches these
   tables — do not add a migration just for it") worked exactly as intended: the grants-hardening
   migration was that migration. ⚠️ **This residual under-counted the problem — it named only the FK,
   and there were three stale names**, because both primary keys carried the old name too:
   `jlpt_questions_test_id_fkey` → `certification_questions_test_id_fkey`,
   `jlpt_questions_pkey` → `certification_questions_pkey`,
   `jlpt_tests_pkey` → `certification_tests_pkey`. All renamed and verified in `pg_constraint`;
   no `jlpt_*` constraint name remains on either table. (`L-002` again — the residual was written
   from what the reviewer happened to notice, not from a query over `pg_constraint`.)
2. **`lib/data/admin-content.ts`'s "(see migrations 1, 2, 11, 13)" is wrong about 13.**
   `20260713000013_gamification.sql` creates only `xp_events` and `notifications` and contains none of
   the tables listed. **Pre-dates this branch** (since `f4fad73`, Layer 7) and was deliberately left
   verbatim rather than asserting a new citation set inside a wave whose job was removing false
   claims. Fix it when someone is already editing that comment for another reason.
3. **`japanese-learning-app-spec.md`'s `/(app)` tree has other stale entries** beyond the two 2b
   fixed — e.g. `/speaking` where the route is `/conversation`. Out of 2b's scope. ⚠️ Because 2b
   edited two lines of that tree, a later reader may mistake the section for freshly audited. It is
   not.

---

## What 2b actually shipped

The certification **MODULE** was renamed; the JLPT exam **FAMILY** was not.

| Renamed | From → To |
|---|---|
| Route | `/jlpt` → `/certification` (+ `/[id]`) |
| API | `/api/jlpt/**` → `/api/certification/**` |
| Tables | `jlpt_tests` → `certification_tests`, `jlpt_questions` → `certification_questions` |
| Nav label | "JLPT" → **"Certification"** / **"Luyện thi"** (A17) |

**Kept, because those names are still true:** `components/jlpt/**` (17 files) · `messages/*/jlpt.json`
· `lib/data/jlpt.ts` · `lib/jlpt-ui.ts` · `lib/validation/jlpt.ts` · enums `jlpt_level` and
`jlpt_section` · every `jlpt_level` column · `user_test_attempts` · every registry `screenId` · the
admin ContentType **key** `jlpt_tests` · registry `name` fields (verbatim Figma frame names —
`"JLPT Practice"` stays). Plus exported function names (`listJlptTests`, `submitJlptTest`, …), the
`xp_events.source_type = "jlpt_submit"` value, and the rate-limit key `jlpt:submit:`.

Rulings executed: **A9**, **A16**. Recorded: **A17** (three parts — the VN label "Luyện thi" as the
activity not the credential; the deliberate nav/page-title divergence on the `/roadmap` precedent; the
`/jlpt` redirect's dated removal condition).

**Accepted knowingly, do not "discover" these as oversights:** `certification_questions.section` is
still typed `jlpt_section` (no schema generalisation — the repo implements one exam family, so the
abstraction has no second consumer to validate it), and `lib/data/jlpt.ts` keeps its filename while
querying the renamed tables.

## Two architectural facts worth not re-deriving

1. **A `/jlpt` redirect cannot be a registry entry.** R13 machine-restricts `out-of-design-scope` to
   `chrome: 'admin'` (enforced by **T10**), so a `repo-only` entry would be forced to claim
   `no-frame-at-last-pass` — **false**, since `/jlpt` has frame `232:2` — and it would pollute the
   survey backlog Phase 2a exists to keep honest. A redirect is **routing configuration**: no
   `page.tsx` ⇒ `T1` never sees it ⇒ `R5` is never engaged. It lives in `next.config.mjs`.
   A **wildcard is correct here** (`/:locale(vi|en)/jlpt/:path*`) where it was wrong for `/videos`,
   because this renames a **prefix** while only the middle `/videos` rule **collapses** a segment.
   `:locale` stays constrained — unconstrained it matches the literal `api`, and `redirects()` runs
   before the filesystem. `permanent: false` (307), never 308.
2. **In-app links were deliberately moved off `/jlpt` rather than left on the redirect**, because A17
   makes that redirect temporary. When it is deleted, nothing in-app should break.

## What this branch cost, and the lesson that repeated

**`L-012` fired four times: every fix wave introduced a fresh false claim while removing one.** All
four were caught, but only because each wave got its own review. Two new lessons came out of it and
are now in `docs/lessons.md`:

- **`L-032`** — a cross-file `path:NN` citation is falsified by the next commit that touches that
  file. Cite symbols, not line numbers. (Task 5 correctly cited `app-nav.tsx:91`; Task 7 added a line
  to that file's header and the citation silently became wrong.)
- **`L-033`** — a sweep must classify each hit as a **live reference** or a **dated record** before
  rewriting it. (Task 7's sweep "fixed" a dated provenance comment into a path that had never
  existed at any commit.)

Two existing lessons were extended rather than duplicated:

- **`L-019`** — widened, id kept so citations still resolve. ⚠️ **The environment fact that matters
  most in this repo:** in Git Bash, a `git grep` pattern **beginning with `/`** is silently mangled by
  MSYS path conversion and returns **nothing regardless of the truth**. Use
  `MSYS_NO_PATHCONV=1 git grep …` or write the pattern `[/]jlpt`, and **fire a positive control before
  trusting any empty result**. This made two of 2b's own plan steps vacuous by construction.
- **`L-023`** — a rename plan must enumerate every *kind* of reference, **link sites, not just fetch
  sites**. The spec scoped all of `components/jlpt/**` to "every `fetch` to `/api/jlpt/**`"; the
  directory also held four `Link`s and a `basePath`, three of them template literals that a
  `href="/jlpt"` literal grep never finds (`L-022`).

## Known flake — do not chase it

`components/video-player/pitch-contour.test.tsx` fails intermittently under the parallel run and
passes standalone. Confirmed on **unmodified master** before this branch existed, and diagnosed here
across five checks. Root cause never investigated; the parallel-worker explanation is an unverified
hypothesis, not a finding. It makes "vitest all green" a coin-flip gate for every branch — worth its
own ticket.

## ▶ CARRY FORWARD — one scoped task, deliberately not done on 2026-08-19

**A DB-backed regression guard for RLS and column grants. NOT YET SCOPED — and that is a decision,
not an omission** (user ruling 2026-08-19).

The 2026-08-19 run closed the *current* security question but left **no guard against a future
regression**. `L-005` is explicit that no mocked test can ever be that guard, so the only instrument
that works is a test running against a real Postgres. **That run proved such a test is feasible on
this machine** — full chain applied from zero, real `authenticated`/`anon` roles, PostgREST probed
with a locally-minted JWT, ten assertions, exit 0.

**Why it was deliberately deferred rather than bolted on:** wiring a real database into the suite is
an architecture decision, not a fix. It has to settle DB lifecycle, CI dependency, seed/reset
strategy, credentials, suite runtime, and how it skips when Docker is absent. Folding that into a
grants migration would have turned a bounded residual into an unbounded test-infrastructure project.
**Scope and design it on its own.**

The throwaway probes that prove feasibility are gone with the scratchpad — but every assertion they
made is enumerated in `20260819000028`'s commit message (`74a752a`), which is the spec to rebuild
from. Do not re-derive the assertion list from this file.

## Related

`docs/superpowers/specs/2026-08-14-screen-registry-phase-2b-design.md` (read §2 first) ·
`docs/superpowers/plans/2026-08-14-screen-registry-phase-2b.md` ·
`docs/product/decision-register.md` (A9, A16, A17) ·
`docs/lessons.md` (L-019, L-023, L-032, L-033 from 2b; L-001 and L-005 extended by the 2026-08-19
run) · `supabase/migrations/20260819000028_certification_grants_hardening.sql` ·
`mem:screen_registry_run_state` (1a/1b/2a) · `mem:screen_registry_inputs` ·
`docs/superpowers/specs/2026-08-08-screen-registry-design.md` (R1–R13, T1–T11).
