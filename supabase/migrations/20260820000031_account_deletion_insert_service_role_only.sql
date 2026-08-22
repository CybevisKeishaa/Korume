-- Whole-branch review, C2: the 7-day cancellation window was client-controlled
-- and bypassable end to end.
--
-- `account_deletion_requests_insert_own` (20260820000029) constrained only
-- `user_id` and `status`. `tier`, `execute_after`, `purge_after` and
-- `requested_at` were unconstrained, and `requestDeletion` wrote through the
-- USER's client — so `authenticated` had to keep INSERT, and PostgREST is
-- reachable with the anon key. Anyone holding a session token could POST
-- directly to `/rest/v1/account_deletion_requests` with
-- `{"tier":"erase_all","execute_after":now,"purge_after":now}`. Within one
-- 60-second scheduler tick the row is claimed, `executeDeletion` runs the full
-- erasure, and the SAME pass's purge loop deletes the `auth.users` row: the
-- typed `DELETE` confirmation, the acknowledgement checkbox and the whole
-- cancellation window bypassed, with no notification email anywhere on this
-- branch to make the victim aware.
--
-- Reproduced against this database at `ba28de2` before writing this file:
-- HTTP 201, and the landed row reported `execute_after <= now()` and
-- `purge_after <= now()` both true.
--
-- The fix duplicates nothing. The grace window stays a single fact in
-- `lib/account-deletion/lifecycle.ts` (CLAUDE.md §6) — no DB-level floor, no
-- CHECK restating "7 days". Instead the INSERT moves to the service-role
-- client (`lib/data/account-deletion.ts`), which derives `user_id` from
-- `requireUser` and therefore never needed RLS on that path, and the client
-- INSERT route is removed outright:

drop policy account_deletion_requests_insert_own on account_deletion_requests;

-- Defence in depth, the pattern 20260819000028 established: dropping the
-- policy alone leaves the table privilege in place and lets RLS refuse
-- SILENTLY, which is indistinguishable from a broken boundary. The revoke
-- makes the refusal a privilege error a probe can actually see.
revoke insert on account_deletion_requests from authenticated;

-- The SELECT policy and grant are deliberately UNTOUCHED: `getPendingDeletion`
-- still reads through the user's client, and `user_id = auth.uid()` is what
-- scopes that read to the caller's own row. A service-role read would be
-- scoped by nothing but the `.eq()` the caller remembered to write.
--
-- A new migration rather than an amendment to 29 on purpose: 29 has already
-- been proven against a real database by two separate probes, and amending it
-- again would invalidate that evidence for no gain. (The opposite call to the
-- Task 7 grant ruling, deliberately — that one was fixing a column the same
-- migration had just introduced.)
