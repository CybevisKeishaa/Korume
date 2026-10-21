# Branch Run State

Branch `practice-listening`, worktree `.worktrees/practice-listening`, base master `5c076987`.

## Goal and scope

B2 of the Shadowing practice modes: Listening Practice (Part 3) — Word Bank (default) + Typing — with its Summary,
Dashboard and Mission changes, the D25 privilege change for `dictation_attempts`, and the legacy `/dictation` route
retired. B1 `practice-pronunciation` is merged (`036ca621`, 2026-10-19).

## Authorities

- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md`.
- Spec `docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md` (approved 2026-10-15; B2 = §5, §6.2,
  B2 rows of §7–§9).
- Plan `docs/superpowers/plans/2026-10-21-practice-listening.md` (10 tasks, rulings P1–P9). Owner 2026-10-21:
  subagent-driven chosen; P1–P9 accepted in direction with notes (P3 must work on fresh replay AND upgrade, one
  home; P5 label "Nghe (gõ chính tả)"; redirect keeps locale, id, deep links, E2E). Revised plan sent for the
  owner's final review; no product code before that approval. No merge before the owner's Chrome check.
- Owner review round 2 (2026-10-21), applied in the plan: Task 1 proves 048, gates and SQL mutations on disposable
  databases (D1 upgrade copy at 047 with the owner's legacy rows, D2 fresh chain) and only then upgrades the owner's
  DB once — no experiment or mutation on the owner's DB, a disposable DB that cannot be built is an unmet gate;
  Task 9 E2E enumerated in 13 cases; P10 URL is the one source of the format (D9 fallback = URL replace);
  P11 reveal keyed by line + format + attempt, reset during render; P12 chunks memo only after the RLS read.

## Accepted commits

| Task | Status | Commit |
|---|---|---|
| plan | APPROVED by the owner 2026-10-21 at `f800a8af` (subagent-driven), plus the Task 1 representativeness condition | `0288a15e`, `b051a539`, `f800a8af`, `b4565f92` |
| 1 migration 048 | accepted (task review Approved, fix round 1 re-reviewed); owner's DB upgraded once to 048 | `b6d795bc`, `678fa543` |
| 2 chunker v1, bank order, coverage | accepted (review Approved, fix round 1 re-reviewed); coverage sent to the owner, no rule changed | `0cd71392`, `b6d5069d` |

## Contracts and decisions

- Plan-time rulings P1–P9 are in the plan. P3 revised 2026-10-21 after measuring: 043/045/047 are applied on the
  owner's DB; nothing in 044–047 calls the five read functions; `check_function_bodies = on` rejects a `language
  sql` body naming a missing column. So all five functions that read B2 columns (incl. `practice_stats` from 047)
  have their single home in 048; Task 1 gates both the upgrade path and a fresh replay.

## Verification

- Worktree dependencies installed from the lockfile (`npm ci`, 2026-10-21).
- Task 1 (2026-10-21): D1 = faithful copy of the owner's DB, representativeness gate PASS (grants, 110 table counts,
  444 constraints, 130 FKs 0 orphans, Step 0 outputs byte-identical); D0 master replay 0 lines of drift; 048 GREEN on
  D1 upgrade and D2 fresh replay (6 SQL gates + 4 races), SQL mutations RED (the trigger mutation that stayed green was
  replaced by two RED ones); owner's DB took one `migration up` (048 only), 107 legacy rows byte-identical; D0–D3
  dropped. Visible number change on the owner's data, per P9: `practice_activity.dictation_lines` 1 → 0 for 101
  accounts whose only row has no line (score 70, 2026-10-12..14, test artefacts), 6 → 3 for one account.
- Task 2 chunker coverage (spec §5.2 gate, chunker v1, 603 local lines, read-only; sent to the owner 2026-10-21, no
  rule changed): Word Bank usable 431 (71.5%); fallback `latin_or_digit` 110 (18.2%: 今日は21番目の文を読みます。,
  今日は2番目の文を読みます。, ②普段から美味しい情報を逃がさない); `single_chunk` 36 (6.0%: おやすみなさい, 今日は,
  だって); `unknown_token` 26 (4.3%: お値段が…みたいな時が結構あるんですね, ねこの新しいポッドジャストビギナー今鉄平を毎日きいてください,
  「いつもお店探しはどうやってしていますか？」). Chunk counts 2:98, 3:156, 4:101, 5:51, 6:17, 7:7, 8:1.

## Working tree and environment

- Owner: Claude
- Docker Desktop + `npx supabase start` needed from Task 1; build and serve only in this worktree; every shell
  command `Set-Location`s here first (the tool cwd is the main checkout).

- Owner approval 2026-10-21 (`f800a8af`) with one stop condition, written into Task 1 Step 3: D1 is a faithful copy
  of the owner's DB (same version ≠ same schema, since 043/045 were edited after being applied); a schema + grants
  diff and a data/FK/function-result gate must pass before anything else on D1; a D0 replay of master's 001–047
  reports drift. Any B2-relevant difference or an unbuildable D0/D1/D2 → UNMET, stop before the owner's DB.
  Learner-data dumps stay in the git-ignored `.superpowers/` workspace. Owner: no need to ask about small design
  choices already in the spec; stop for data-loss risk, scope change or architecture change.

## Blockers

- None.

## Next actions

1. Task 3 (units and scoring). Open owner question: loosen digits for Word Bank only, and/or treat `…` `？` as
   punctuation (Task 2 coverage) — no chunking rule changes until the owner answers.
