# Branch Run State

## Goal and scope

Close the two Summary follow-ups left at the `summary-analysis` merge (`0bdcfee`):
- m6: a double-click that selects a word in a clamped Summary card toggled the card.
- m8: the Summary transcript → `SummaryLine[]` mapping lived twice (page load and analysis route), and both feed
  the analysis cache key.

## Authorities

- `docs/superpowers/run-state/summary-analysis.md` (follow-ups m6, m8).
- Owner 2026-10-05: "Bạn làm đi" after the `verify-db-erasure` merge; Codex is out of quota until 2026-10-10, so
  Claude implements (auto-memory `codex-limit-claude-continues`).

## Accepted commits

- (none yet)

## Contracts and decisions

- `summaryLines(rows)` in `lib/summary/snapshot.ts` is the single home; `load-snapshot.ts` and
  `analysis/service.ts` call it.
- `ExpandableCard` delays a card-click toggle by `CARD_CLICK_DELAY_MS` = 500 (the Windows default double-click
  time; raised from 300 at review) and any later click cancels it; a `detail > 1` click schedules nothing. The
  timer re-measures before OPENING (text no longer cut → no open). Keyboard "Show more" is not delayed. Cost: a
  card click takes 500ms to open the card — the owner may lower it. Ceiling (ponytail comment): a slower OS
  double-click setting still toggles once.

## Verification

- m8: `summaryLines` tests RED first (`summaryLines is not a function`), GREEN after; mutation (no blank-line
  filter) RED. `lib/summary` 18 files / 117 tests green.
- m6: unit case RED first once the selection jsdom does not make was modelled (it was GREEN before — L-004);
  three mutations RED (no clearTimeout, no detail check, original immediate toggle). `components/lesson-summary`
  green. tsc 0, lint 0.
- `code-reviewer`: 0 Critical; Important I1 (two old unit tests un-failable under a deferred toggle → moved to
  fake timers) and I2 (300 < Windows default 500) fixed; minors fixed: clearTimeout before every guard (a control
  click cancels a pending toggle), re-measure before opening, reuse `TranscriptLineRow` via `Pick`. The `!cut`
  guard became redundant (mutation stayed green) and was removed. Mutations: control guard, clearTimeout,
  re-measure → each RED.
- e2e `summary.spec.ts` 11/11 on a fresh build (`AI_PROVIDER=none`); case 11 RED against the master component
  (`Received: "text-body"` — card opened by a real Chromium double-click).
- Full vitest 550 / 4857, tsc 0, lint 0 after the last edit.

## Working tree and environment

- Owner: Claude
- Worktree `.worktrees/summary-followups` off master `ac2f793`; `.env.local` copied; `node_modules` is a junction
  to `.worktrees/verify-db-erasure/node_modules` (the main checkout's lacks `yauzl`).
- The stale `summary-analysis` `next start` on :3000 was stopped for Playwright (L-017).

## Blockers

- None.

## Next actions

1. Owner: Chrome look on :3000 (served from this worktree) and merge decision.
