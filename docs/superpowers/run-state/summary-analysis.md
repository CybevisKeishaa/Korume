# Branch Run State

## Goal and scope

Summary / Analysis mode (Part 4, Figma `125:1030`): deterministic lesson snapshot, shared grounded lesson analysis,
personal lesson-local Korume reflection, Review Tomorrow, saving words and expressions. Free = Plus.

## Authorities

- Spec: `docs/superpowers/specs/2026-10-04-summary-analysis-design.md` — frozen by the owner at `2b701cd`.
- Plan: `docs/superpowers/plans/2026-10-04-summary-analysis.md` (17 tasks) — **approved by the owner 2026-10-04 with
  Plan corrections C1–C5**; `selection` stays in the Vocabulary tile and Saved Knowledge Retention as the frozen spec says.
- `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md` §8.

## Accepted commits

- `4b1ea1c` spec · `2b701cd` spec contract fixes (frozen) · plan (this commit).

## Contracts and decisions

- Owner 2026-10-04: `npx supabase db reset` approved for THIS branch, local Supabase only; a reset wipes the local
  dictionary and the Ep.729 demo lesson — re-import with the 1b worktree's `.tmp/import.sh` and
  `scripts/seed-real-lesson.ts` before any live or Chrome check.
- Live Gemini smoke pre-approved (free tier, synthetic evidence rows only).
- Measured before planning (2026-10-04, live Gemini, 2/2 each): item schemas from `z.looseObject(...)` and
  `z.looseObject(...).catch(null)` are accepted; Gemini put a requested reading into free text instead of an extra
  field — strict item schemas cannot catch facts smuggled into prose (prompt rule + manual live review instead).

## Verification

- Task 1 (Codex via Paseo, 1 run; Claude reviewed): 11 files / 68 tests green on re-run; `db reset` 0. Live Postgres
  probe (rolled back): duplicate vocabulary → 23505 on `sentence_mining_cards_one_knowledge`; selection repeats OK;
  null-ref selection and ref-carrying sentence → 23514; `ON CONFLICT (cols)` without predicate → 42P10 (proves the
  brief's correction). Mutations: drop the 23505 branch → RED; drop `.strict()` → RED. Deferred nit: POST route
  conflict test does not assert the body carries the existing card.

- Execution (owner 2026-10-04): Codex via Paseo, one task per run, packets in `.superpowers/sdd/summary-analysis/`;
  Claude reviews, runs DB/e2e gates and commits each task; tasks back to back.
- Plan-code correction (Task 1 brief): Summary saves use insert + `23505` → re-read, not `upsert(onConflict)` —
  the knowledge unique index is partial and `ON CONFLICT (cols)` without its predicate cannot infer it (42P10).

## Working tree and environment

- Owner: Claude
- Worktree `.worktrees/summary-analysis`, branch `summary-analysis`, from master `09d2684`. Own `node_modules`
  (`npm ci`) and a copy of the main `.env.local`. Paseo workspace `wks_8b67611c339e7409`.

## Blockers

None.

## Next actions

1. Task 2 (migration 043 + export registry) → Codex.
