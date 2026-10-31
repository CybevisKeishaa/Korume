# practice-pronunciation (B1 of Shadowing practice modes) — PLAN APPROVED, NOT STARTED (2026-10-15)

▶ RESUME HERE. Branch `practice-pronunciation`, worktree `.worktrees/practice-pronunciation`, base master `03a3b400`,
tip `c5de176b`. No product code, no migration yet. Owner: Claude (Codex is gone; Claude implements, reviews, merges).

## Authorities (read first)
- Spec `docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md` — APPROVED after review round 1
  (`d278843a` + `f8580170`). Decisions D1–D25. One spec, two branches: B1 Pronunciation (this), B2
  `practice-listening` (Word Bank default + Typing) branched from master only after B1 merges with owner approval.
- Plan `docs/superpowers/plans/2026-10-15-practice-pronunciation.md` (`4e88ae7c`, 15 tasks) — APPROVED 2026-10-15.
  Execution method NOT chosen yet: ask the owner first (recommended subagent-driven).
- Run state `docs/superpowers/run-state/practice-pronunciation.md`.

## Key decisions to remember
- Keep the h-dvh workspace + one player instance; modes under `(workspace)/`; mode switched on in-branch (D24).
- Pronunciation: WAV 16k mono saved first, server scores by `sessionId` from the stored file + line text_jp,
  lease token `scoring_claim` (90 s lease, Azure timeout 30 s), versioned `assessment` jsonb, word colouring only at
  >=90% alignment, pitch labelled reference-only, progress line only with >=2 scored takes.
- D25: revoke INSERT/UPDATE on `shadowing_sessions` (B1) / `dictation_attempts` (B2) from authenticated; server
  writes via `createServiceClient()`. Residual accepted risk: client-measured `pitch_score`.
- Summary: Shadowing = "Watched to sentence X/Y" (`reachedLine` from last_watched_position), never complete;
  Pronunciation mean = latest scored per line. Mission `shadow_lines` copy -> "Practise speaking N sentences",
  link -> /pronunciation. Mission progress already counts DISTINCT line ids.
- Plan-time findings: sentence lock lives in the playback controller (`setLock`), attempt store lives in the shell
  (survives browser Back), recordings bucket has no MIME limit, shortcuts already skip inputs.

## 2026-10-15 late — execution STARTED then PAUSED by the owner
- Owner chose **subagent-driven**. SDD ledger `.superpowers/sdd/2026-10-15-practice-pronunciation/progress.md`
  (git-ignored, in the worktree) holds the pre-flight table + rulings R1–R4 (R1: Azure 429 carries Retry-After only
  when Azure sent one -> Task 5; R4: legacy dumps in the SDD workspace, not `.tmp/`). Resume from the ledger.
- Task 1 stopped mid-way by the owner ("dừng code lại"): untracked `supabase/migrations/20261015000047_practice_pronunciation.sql`
  exists, NOT applied (DB at 046), no commit. Step 0 legacy counts done: shadowing_sessions 208 (0 webm, 0 unscored),
  dictation_attempts 107 (0 unscored); dump `practice-legacy-before.txt` in the SDD workspace.

## Next session
1. Execution method = subagent-driven (chosen). Re-dispatch Task 1 fresh; check or delete the untracked migration first.
2. Owner starts Docker Desktop + `npx supabase start`; Task 1 Step 0 counts legacy shadowing_sessions/dictation rows
   on the owner's local DB BEFORE migrating (Docker was off at spec time — nothing assumes zero legacy rows).
3. Build/serve only inside the worktree. Never `supabase db reset` on the owner's DB.
