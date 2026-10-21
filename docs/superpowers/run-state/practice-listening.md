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
| 3 units and scoring | accepted (review Needs fixes → fix round 1 re-reviewed) | `377c57d6`, `b96b56fa` |
| 2b punctuation-only UNKNOWN keeps Word Bank (owner 2026-10-21) | accepted (review Needs fixes → fix round 1 re-reviewed); chunker v1 edited in place (R17), coverage 431 → 433 | `a48fc6be`, `4131333e` |
| 4 chunks API, submit/reveal API, per-format stats | accepted (review Approved, 0 Critical/Important); dictation save works again via the service client; includes the minimal navigator `revealed` state (R21) | `79ba1bca` |
| 4b original-character display, `"` as punctuation (P13) | accepted 2026-10-22 (review Approved); coverage 433 → 434/603, no null display map | `617c47d0` |
| 5 Listening-aware shell: reveal provider, cover, per-format strip | accepted 2026-10-22 (review Needs fixes → fix round 1 re-reviewed: re-entering Listening conceals again, R28; Show video is a plain button, R29) | `99b1bf15`, `3f7aa276` |
| 6 mode body, Word Bank, P14 feedback, D9 URL fallback | accepted 2026-10-22 (review Approved, 6 Minor deferred); `listening/page.tsx` moved to Task 9 with the registry move (R30) | `ab609716` |

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
- Owner 2026-10-21 decision on that report: loosen punctuation only (UNKNOWN tokens that are all punctuation no
  longer fail; punctuation kept in chunks; Latin/digit unchanged). Task 2b result: usable 431 → 433 (71.8%); only
  お値段が…みたいな時が結構あるんですね and 「いつもお店探しはどうやってしていますか？」 moved; remaining unknown_token 24
  (loanwords インスタ/バズ/フォロワー…, ー, fragments; `[音楽]` and `"` quotes outside the punctuation set). Chunks render
  NFKC forms (`...`, `?`, `!`) per P7. Digits decision pending with the owner.

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

1. Owner 2026-10-22: stop after Task 6. **Resume at Task 7** (Typing + format switch), BASE `ab609716`, brief
   `.superpowers/sdd/2026-10-21-practice-listening/task-7-brief.md` (already trimmed of 7b); then 7b, 8, 9, 10.
   Ledger (rulings R1–R30, deferred minors): `.superpowers/sdd/2026-10-21-practice-listening/progress.md`.
   Carry into Task 7: Typing diff op `display` is "" on the 2nd+ char of a multi-char NFKC expansion (㌘);
   the hook already exposes `setInProgress` / `reloadChunks` / `feedback` for Task 7; R3 notice lives in the body.
   For the owner at the Chrome look: VI format names (R26) and most new VI feedback copy; Hint takes the lowest
   unhinted chunk even if already placed correctly (D10); YouTube native captions may show the line once the
   cover is lifted.
2. Owner decisions 2026-10-21 that close the open questions: Latin/digits keep the Typing fallback; `"` joins the
   punctuation set; learners see the original `text_jp` characters; the revealed label stays "Answer shown" /
   "Đã xem đáp án". The floating Korume mascot stays hidden in Listening; only P15's small figure beside the
   feedback appears, after a successful Check or Show answer.
