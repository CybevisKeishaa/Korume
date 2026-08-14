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
