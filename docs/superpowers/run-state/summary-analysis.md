# Branch Run State

Branch `summary-analysis`, worktree `.worktrees/summary-analysis`, from master `09d2684`.

- Owner: Claude

## Goal and scope

Summary / Analysis mode (Part 4, Figma `125:1030`): deterministic lesson snapshot, shared grounded lesson analysis,
personal lesson-local Korume reflection, Review Tomorrow, saving words and expressions. Free = Plus.

## Authorities

- Spec: `docs/superpowers/specs/2026-10-04-summary-analysis-design.md` — frozen by the owner at `2b701cd`.
- Plan: `docs/superpowers/plans/2026-10-04-summary-analysis.md` (17 tasks; Plan corrections C1–C5 await the owner's review).
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
- Worktree has its own `node_modules` (`npm ci`) and a copy of the main `.env.local`.

## Verification

- (none yet)

## Next

Owner reviews the plan (and C1–C5), chooses the execution method; then Task 1.
