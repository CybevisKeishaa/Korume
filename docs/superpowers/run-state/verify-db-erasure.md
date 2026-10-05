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
- `executeDeletion` step order unchanged (ban → storage → tombstone → rows); its last step becomes
  `rpc("erase_account_rows")` instead of `.from("users").delete()`.
- `verify:db:erasure` = `supabase/tests/account-erasure.sql`, run inside `begin … rollback`.

## Verification

- (pending)

## Working tree and environment

- Owner: Codex
- Worktree `.worktrees/verify-db-erasure` off master `0bdcfee`; `.env.local` copied from main.
- Local DB holds the owner's Ep.729 + demo learner: no `db reset` without the owner's go-ahead.

## Blockers

- None.

## Next actions

1. Codex: Task 1 per packet (migration function, eraser call, gate, mutations).
2. Claude: review, re-run gate + mutations, full vitest, `code-reviewer`, commit.
3. Owner: approve a fresh `db reset` for the final gate run, then merge decision.
