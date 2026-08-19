-- Phase 2b follow-up: close the belt-and-suspenders asymmetry that the
-- 2026-08-19 verification run measured against a real Postgres + PostgREST.
--
-- WHY THIS EXISTS. 20260713000011_reading_jlpt.sql revoked the write grants
-- from `authenticated` on both tables it created (`reading_passages`,
-- `reading_questions`) but not on `jlpt_questions` -- now
-- `certification_questions`. Both module tables therefore reached HEAD with
-- table-wide INSERT/UPDATE/DELETE still granted to `authenticated`, held shut
-- by RLS alone:
--
--   reading_questions        -> SELECT (5 cols), REFERENCES
--   certification_questions  -> SELECT (6 cols), REFERENCES, INSERT, UPDATE, DELETE
--   certification_tests      -> SELECT,          REFERENCES, INSERT, UPDATE, DELETE
--
-- MEASURED, not assumed: with RLS on and only a SELECT policy present, a
-- direct PostgREST call as `authenticated` could not write -- POST returned
-- `new row violates row-level security policy`, and PATCH matched zero rows
-- (confirmed by reading the data back: nothing was modified). So this is
-- defence in depth, not an open hole. It becomes one the moment anyone adds a
-- permissive INSERT/UPDATE policy -- exactly the failure mode migration 11's
-- own comment predicted for SELECT, one gate over.
--
-- WARNING for whoever verifies this: a PostgREST PATCH with
-- `Prefer: return=minimal` answers 204 whether it wrote every row or none.
-- Never read that status as proof of a write. Read the data back, or ask for
-- `return=representation,count=exact`.
--
-- SAFE TO REVOKE: no write path to either table runs as `authenticated`.
-- Every one goes through `createServiceClient()` behind `requireAdmin()`
-- (`lib/data/admin-content.ts`); `lib/data/jlpt.ts`'s only `authenticated`
-- insert targets `user_test_attempts`, which is untouched here.
--
-- SELECT IS DELIBERATELY UNCHANGED on both tables -- including the
-- column-scoped grant on `certification_questions` that withholds
-- `correct_answer` and `explanation`. The same run verified that grant
-- survived the Phase 2b rename intact, which was its open question.

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
