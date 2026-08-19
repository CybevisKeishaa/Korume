-- Phase 2b follow-up: on `certification_questions` and `certification_tests`,
-- revoke the write grants that `authenticated` still carried. Measured
-- 2026-08-19 against a real Postgres + PostgREST, not inferred.
--
-- SCOPE, stated precisely because this comment's first draft overclaimed it:
-- this closes the asymmetry ON THESE TWO TABLES ONLY. Other public tables hold
-- the same shape -- `authenticated` carries INSERT/UPDATE/DELETE while no policy
-- admits any write -- `subscriptions` among them. That residual, and the query
-- that enumerates it (never a count -- `L-002`), are recorded in
-- `mem:project_status` under Deferred follow-ups.
--
-- WHY THESE TWO, and by two different routes. 20260713000011_reading_jlpt.sql
-- revoked the write grants on both CONTENT tables it created (`reading_passages`,
-- `reading_questions`; it also created `user_reading_attempts`, which is per-user
-- and rightly keeps its writes) but not on `jlpt_questions`, now
-- `certification_questions`. `jlpt_tests` -- now `certification_tests` -- appears
-- nowhere in that migration at all. Both tables were created together back in
-- `20260712000001_schema.sql` (:280, :288) and both took their write grants from
-- the same `20260712000006_grants.sql` blanket; what differs is only how each
-- escaped the revoke -- one was overlooked by migration 11, the other was never
-- in its scope. Same end state, both corrected here.
--
-- MEASURED: with RLS on and only a SELECT policy present, a direct PostgREST call
-- as `authenticated` could not write -- POST returned `new row violates row-level
-- security policy`, and PATCH matched zero rows (confirmed by reading the data
-- back). So for INSERT/UPDATE/DELETE this is defence in depth, not an open hole.
-- It becomes one the moment anyone adds a permissive INSERT/UPDATE policy --
-- exactly the failure mode migration 11's own comment predicted for SELECT, one
-- gate over.
--
-- NOT ADDRESSED HERE, deliberately: `authenticated` AND `anon` also hold TRUNCATE,
-- TRIGGER and REFERENCES on every public table -- from Supabase's bootstrap
-- `pg_default_acl`, not from any migration in this repo. RLS does not gate
-- TRUNCATE, so "held shut by RLS" above is true of INSERT/UPDATE/DELETE and of
-- nothing else; it is however unreachable from the browser (PostgREST emits no
-- TRUNCATE verb). Repo-wide hardening item, recorded in `mem:project_status`.
--
-- VERIFYING THIS: never read a PostgREST PATCH's 204 as proof of a write, and do
-- not reach for `return=representation` on these tables. The probe and both of its
-- traps have one home -- `mem:project_status` Key gotchas, "Verifying a PostgREST
-- write"; `docs/lessons.md` L-001 carries the lesson it evidences.
--
-- SAFE TO REVOKE: no write path to either table runs as `authenticated`. Every one
-- goes through `createServiceClient()` behind `requireAdmin()`
-- (`lib/data/admin-content.ts`); `lib/data/jlpt.ts`'s only `authenticated` insert
-- targets `user_test_attempts`, which is untouched here.
--
-- SELECT IS DELIBERATELY UNCHANGED on both tables -- including the column-scoped
-- grant on `certification_questions` that withholds `correct_answer` and
-- `explanation`. The same run verified that grant survived the Phase 2b rename
-- intact, which was its open question.

revoke insert, update, delete on certification_questions from authenticated;
revoke insert, update, delete on certification_tests from authenticated;

-- Stale constraint names left behind by the Phase 2b rename. Postgres tracks
-- constraints by OID, so this changes no behaviour -- it only stops the names
-- lying. Recorded as Phase 2b residual 1, which said to rename these
-- opportunistically in the next migration that touches these tables rather
-- than to add a migration for it. This is that migration. (The residual named
-- only the FK; both primary keys carry the old name too and are corrected
-- here for the same reason.)
alter table certification_questions rename constraint jlpt_questions_test_id_fkey to certification_questions_test_id_fkey;
alter table certification_questions rename constraint jlpt_questions_pkey to certification_questions_pkey;
alter table certification_tests rename constraint jlpt_tests_pkey to certification_tests_pkey;
