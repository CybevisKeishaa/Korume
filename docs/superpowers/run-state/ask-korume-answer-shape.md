# Branch Run State

Branch `ask-korume-answer-depth`, worktree `.worktrees/ask-korume-answer-depth`, base master `6fe29c57`.

## Goal and scope

Ask Korume answer shape by question kind: the planner classifies the question (`quick` / `explain` / `analyze`), the
answer prompt carries a floor, ceiling and required elements per kind and plan tier, floor misses are logged, and the
Plus answer token default is 6144.

## Authorities

- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md`.
- Spec `docs/superpowers/specs/2026-11-06-ask-korume-answer-shape-design.md`.
- Plan `docs/superpowers/plans/2026-11-06-ask-korume-answer-shape.md` (3 tasks).

## Accepted commits

| Task | Status | Commit |
|---|---|---|
| Spec + plan | done | `836e4290` |
| 1 Planner kind + shapes in the answer prompt | done | `91af10d3` |
| 2 Turn wiring, floor-miss log, Plus 6144 tokens | done | `4bf0ab99` |
| 3 Live proof, gates, run state | done | this commit |

## Contracts and decisions

- Ruling: floor table is a code constant (ANSWER_SHAPES), not env vars — told the owner it would be "config"; one-place
  edit, YAGNI — cost if wrong: add env knobs later.
- Ruling: Plus default answer tokens 6144 (not 8192) — room for §7 depth while keeping latency under
  PROVIDER_TIMEOUT_MS 60s for slower production models — cost if wrong: a truncated Plus answer fails; raise via env.
- Ruling: floor misses are logged with console.info (no DB column/migration) — cost if wrong: no queryable metric; add
  a column later.
- Ruling: plan-mandated "planSchema refuses kind: deep" conflicts with spec §2.3 (invalid kind → explain) and would
  drop a good plan's steps — spec wins: an invalid kind parses to undefined (→ explain), steps kept — cost if wrong:
  none (more lenient parse).
- Probe repeats `PLAN_MAX_TOKENS = 512` as a literal: `turn.ts` imports server-only + Supabase. Cost if wrong: drift
  if the turn constant changes.

## Verification

- Live (Gemini, vi, planner → answer, no retrieval), round 1, no tuning needed:
  - quick free: `kind=quick ok paragraph,example,followups n=3 out=386/2048` / `… n=3 out=389/2048`
  - quick plus: `kind=quick ok paragraph,example,followups n=3 out=395/6144` / `… n=3 out=408/6144`
  - explain free: `kind=explain ok n=5 out=740/2048 check=true` / `n=8 out=862/2048 check=true`
  - explain plus: `kind=explain ok n=12 out=1200/6144 table check` / `n=9 out=1189/6144 table check`
  - analyze free: `kind=analyze ok n=5 out=655/2048 table check` / `n=5 out=713/2048 table check`
  - analyze plus: `kind=analyze ok n=14 out=1394/6144 h1=3 table check numbered` / `n=13 out=1250/6144 h1=3 table
    check numbered`
  - All 12 runs meet the spec §5 bar (kind, block range, elements, quick ends with followups, tokens < 90 %).
- Commands (each `npx vite-node --config vitest.config.ts scripts/probe-korume-answer.ts -- --tier <free|plus> --runs 2 ...`, both tiers):
  - quick: `--question "まま nghĩa là gì?" --line ""`
  - explain: `--question "まま và ながら khác nhau thế nào?" --line ""`
  - analyze: `--question "Phân tích câu này giúp mình" --line "<the section 7 line>"` (間違った使い方のまま、間違った発音のまま、間違った文法のまま、そのまま覚えてしまうっていうのが一番良くないんですね。)
- Gates: vitest 735 files / 6682 tests passed; `tsc --noEmit` clean; `npm run lint` 0 errors (warnings only); `verify:protocol` valid.

## Working tree and environment

- Owner: Claude
- `.env.local` present in the worktree; no server or build running.

## Blockers

- None.

## Next actions

- Owner reviews the branch / merges. Optional deferred minors: planner-throws test does not spy the log line; invalid
  planner kind coerced silently with no log; planKind param `steps?: unknown` only for test typing; free quick depth
  text mixes "answer fully … one example" with "keep it short" (live free quick was 3 blocks, fine).
- Anthropic (production provider) not live-checked, as on the rich-answers branch.
