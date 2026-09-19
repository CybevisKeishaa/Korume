-- Terminal code for an admin job that deduped onto a lesson it cannot publish.
-- Owner ruling 2026-09-19 (A+C): such a job must not report `succeeded`.
--
-- Its own migration because a value added by ALTER TYPE is not usable in the
-- transaction that added it, and 20260919000034 uses it.
alter type public.lesson_creation_error_code add value 'existing_private_lesson';

/* DOWN (manual): PostgreSQL cannot drop an enum value. Reversing this means
   recreating the type and rewriting every dependent column; export first. */
