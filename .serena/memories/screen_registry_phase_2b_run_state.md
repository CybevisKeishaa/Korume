# Screen Registry Phase 2b — ✅ COMPLETE AND MERGED

> Superseded as "live work". This file is now the **historical record of 2b plus its two open
> debts**. `mem:screen_registry_run_state` covers 1a/1b/2a. Neither is the live next action —
> there is no live next action for the screen registry until Phase 3 is scoped.

# ▶▶ RESUME HERE

**Phase 2b MERGED to master at `10caaac`** (`--no-ff`, 2026-08-14), off `8d01ed9`. Branch
`screen-registry-phase-2b` **kept**, per this repo's convention. 16 commits, 53 files.

Post-merge gate re-run **on master**, measured not inherited:
`tsc` 0 · `vitest` **237 files / 2113 tests** · `lint` **77 warnings / 0 errors** (baseline) ·
`next build` exit 0 · `playwright` 8/8 over real HTTP.

**Nothing is owed on 2b's process.** The review chain ran to the end: per-task reviews →
whole-branch review (`L-011`) → fix wave → **the `L-012` re-review of that wave** → the two findings
that re-review raised → controller verification of each.

**Two debts survive, and they are the only things to carry forward. Both are below.**

## ⭐⭐ DEBT 1 — the unverified column grant (security, OPEN)

`certification_questions` inherits `revoke select … from authenticated` plus a column-scoped `grant`
that deliberately **omits `correct_answer`** (`20260713000011_reading_jlpt.sql:116-117`), with RLS
`using (true)` on top. The rename must not have silently restored table-wide select.

**This was never verified.** No Docker, no reachable Postgres, no `psql`. `L-005`: the Supabase mock
models no RLS and no column grants, so the green 2113-test suite **is not evidence about this** and
must never be allowed to close it.

**Residual risk is bounded but not zero** — the whole-branch review confirmed the second line of
defence survives: `lib/data/jlpt.ts` selects an explicit column list excluding `correct_answer`,
`toPublicQuestionData` strips it, the scoring path that does read it goes through
`createServiceClient()` server-side, and the "never leaks correct_answer/explanation" regression test
is still live. Exposure would therefore need a **direct PostgREST query from a browser** with the
anon/authenticated key — a real vector on Supabase, but a second independent failure on top.

**Also unverified: the migration has never run anywhere.** Its first execution will be against a real
database. It is non-idempotent (consistent with every migration in this repo — none uses
`if not exists`), so a partial failure leaves a half-renamed schema.

### The recipe that settles it — do this first, next time a database is reachable

1. Start Docker Desktop, then `docker run --rm -e POSTGRES_PASSWORD=x -p 5433:5432 postgres:16`.
2. Create a stub `authenticated` role first (Supabase's roles do not exist in vanilla Postgres), then
   apply **in order**: `20260712000001_schema.sql` · `20260712000002_rls.sql` ·
   `20260712000003_indexes.sql` · `20260713000011_reading_jlpt.sql` ·
   `20260814000027_certification_rename.sql`.
3. Run and require the exact row set:
   ```sql
   select grantee, privilege_type, column_name
   from information_schema.column_privileges
   where table_name = 'certification_questions' and grantee = 'authenticated'
   order by column_name;
   ```
   Expect `id, order_index, question_data, question_type, section, test_id` and **no
   `correct_answer` row**.
4. Also assert `relrowsecurity` is still true and that policy `certification_questions_read` exists on
   the renamed relation.

That run doubles as the migration's first execution test, which is the other thing nobody has done.

## DEBT 2 — three recorded residuals (all non-blocking, all deliberate)

1. **FK constraint keeps its old name.** `certification_questions.test_id` still carries the
   auto-generated `jlpt_questions_test_id_fkey`. Behaviour is fully preserved (Postgres tracks FKs by
   OID, not name), and the whole-branch review confirmed nothing depends on the name — PostgREST
   embedding at `lib/data/admin-content.ts` resolves by **table** name, and there is only one FK
   between the pair, so no `!constraint_name` disambiguation is needed. **Rename it opportunistically
   in the next migration that touches these tables** — do not add a migration just for it.
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

## Related

`docs/superpowers/specs/2026-08-14-screen-registry-phase-2b-design.md` (read §2 first) ·
`docs/superpowers/plans/2026-08-14-screen-registry-phase-2b.md` ·
`docs/product/decision-register.md` (A9, A16, A17) · `docs/lessons.md` (L-019, L-023, L-032, L-033) ·
`mem:screen_registry_run_state` (1a/1b/2a) · `mem:screen_registry_inputs` ·
`docs/superpowers/specs/2026-08-08-screen-registry-design.md` (R1–R13, T1–T11).
