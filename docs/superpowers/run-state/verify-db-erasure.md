# Branch Run State

## Goal and scope

Turn account erasure from "every new table must remember `on delete cascade`" into a schema invariant
with a live gate, and erase a learner's own PRIVATE lessons when `erase_all` executes.
Out of scope: the deletion UI, scheduler, Storage eraser, `close_account` tier (all merged `4b1fef7`).

## Authorities

- Owner rulings 2026-10-05 (chat): PRIVATE lessons created by the erased user are deleted, not
  orphaned; `videos.added_by_user_id` stays `on delete set null` (no global cascade); shared/public
  lessons by that user survive with attribution nulled; `knowledge_entries` untouched; FK not in the
  allowlist = FAIL.
- Claude refinement (verified in `20260913000032_lesson_creation_jobs.sql`): `videos.youtube_video_id`
  is unique and a second learner importing the same video is attached to the existing PRIVATE row via
  `user_lesson_library`. So the delete predicate also requires that NO OTHER user holds the lesson in
  `user_lesson_library`; otherwise their notes/marks/reflections would cascade away.
- Prior design: `mem:l9b_plan1_gdpr_run_state`, `lib/account-deletion/erase.ts` header.
- Packet: `.superpowers/sdd/verify-db-erasure/task-1-packet.md` (gitignored, in this worktree).

## Accepted commits

- (none yet)

## Contracts and decisions

- `public.erase_account_rows(p_user uuid) returns void` — defined IN PLACE in
  `20260820000029_account_deletion.sql` (AGENTS.md §6). One transaction: delete PRIVATE videos with
  `added_by_user_id = p_user` and no `user_lesson_library` row for another user, then delete
  `public.users` row. Execute: `service_role` only (revoked from public, anon, authenticated).
  NOT security definer (service_role bypasses RLS). Locks the candidate PRIVATE rows in one statement
  and deletes in the next, so a learner attaching concurrently is seen (review I1; reproduced with two
  live sessions: single-statement version lost B's lesson + note `0|0`, fixed version `1|1`).
- `executeDeletion` step order unchanged (ban → storage → tombstone → rows); its last step becomes
  `rpc("erase_account_rows")` instead of `.from("users").delete()`.
- `verify:db:erasure` = `supabase/tests/account-erasure.sql`, run inside `begin … rollback`.

## Verification

- Live DB (no reset, function applied by hand): `npm run verify:db:erasure` PASS; catalog = 35 FKs to
  `public.users` (30 cascade, 5 set null); only public FK to `auth.users` is `users.id`.
- Gate mutations, each a scratch copy with the change after `begin;`, all RED for their own reason:
  M1 FK action, M2 new FK, M3 unlinked user column, M4 anon EXECUTE, M5 no private delete (V1),
  M6 no `not exists` (V4), M7 no users delete, M8 public FK to `auth.users`, M3b `actor_id` uuid,
  M3c stale exemption, M10 security definer; M7 with the inline asserts
  stripped is caught by the catalog-driven loop. GREEN re-run after; no `zz_` table left.
- vitest `erase.test.ts` 17/17; RPC-error test RED when the error is swallowed, restored by SHA.
- tsc 0, lint 0. Section 2 now requires EVERY non-`id` uuid column (relkind r/p) to be an FK or one of 7
  exemptions (review M3: a name regex was an L-006 hole).
- Full vitest first run 550/4851 green; a later comment naming `lesson_creation_job` in 029 tripped the
  032 one-file pin (reworded) — full suite re-run after the last edit.
- Codex hit its quota (until 2026-10-10) mid round 1 and left mutation M7 written into the real gate
  file (FK drop + allowlist row removed); Claude removed both and finished the round.

## Working tree and environment

- Owner: Claude
- Worktree `.worktrees/verify-db-erasure` off master `0bdcfee`; `.env.local` copied from main.
- Local DB holds the owner's Ep.729 + demo learner: no `db reset` without the owner's go-ahead.

## Blockers

- None. Follow-ups from review (not fixed here): M4 a PostgREST timeout after the RPC committed makes
  the scheduler lift the ban on an account whose rows are gone (pre-existing); M5 an import job already
  running when A is banned can commit a PRIVATE row after erasure (orphan, no holder); M6 a PRIVATE
  lesson placed in an admin collection leaves that collection on erasure (accepted).

## Next actions

1. Claude: full vitest, `code-reviewer` on the branch diff, commit.
2. Owner: approve a fresh `db reset` for the final gate run, then merge decision.
