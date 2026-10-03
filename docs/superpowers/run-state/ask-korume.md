# Branch Run State

Branch `ask-korume`.

## Goal and scope

Ask Korume: one Korume conversation in two viewports — a floating-mascot side sheet in Shadowing (anchored to
the sentence) and the full page `/korume/chat` — via a two-stage retrieval planner over the Knowledge core, with
per-turn economics, idempotency and grounding. Removes "Sensei" from every user-facing surface. `/companion`
(Korume Memory home) is OUT of scope.

## Authorities

- Spec (LOCKED `bafeea6`, 2026-10-03): `docs/superpowers/specs/2026-10-03-ask-korume-design.md`
- Plan (APPROVED by the owner 2026-10-03, `9f1bd85`): `docs/superpowers/plans/2026-10-03-ask-korume.md` —
  Task 0 probe + Tasks 1–11; its "Corrections to the spec found while planning" 1–9 are binding.
- `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md` §8

## Accepted commits

- `0e29fcb` spec draft · `bafeea6` spec locked · `9f1bd85` plan

## Contracts and decisions

- Owner approvals 2026-10-03: plan approved; **`npx supabase db reset` is approved on this branch**.
- Live Gemini runs still need the owner's go-ahead each time (spec §7.7).
- Execution: Claude writes a packet per task in `.superpowers/sdd/ask-korume/`, Codex implements, Claude reviews
  and commits; Codex never runs Playwright (Claude does); if Codex hits its quota, Claude finishes the task.

## Verification

Task 0 probe (Claude, 2026-10-03):

- Opus price (`claude-api` skill, cached 2026-09-25): `claude-opus-4-8` is **Active**, $5 input / $25 output per
  MTok, cache read 0.1× input = $0.50/MTok. Task 2 writes these into `DEEP_TIER_PRICE`.
- Route: `app/[locale]/(protected)/(focus)/shadowing/[id]/(workspace)/page.tsx` takes the **video** id;
  `workspace-shell.tsx:55` reads `?line=`. `originRouteFor` must produce `/shadowing/<videoId>?line=<lineId>`
  (no locale prefix — same shape as `components/companion/journal-view.tsx:86`).
- Gemini: main-checkout `.env.local` has `AI_PROVIDER=gemini` and non-empty `GEMINI_API_KEY`, `GEMINI_MODEL_FAST`,
  `GEMINI_MODEL_DEEP` → a live smoke needs no owner setup (still needs the owner's go-ahead).
- Baseline after `npm ci`: tsc 0, lint 0, verify:protocol 0, vitest 482 files / 4357 tests green.
  `verify:db:*` baseline deferred: Docker was not running; started for Task 1's reset.
- Task 1 (Codex, 183k tokens; Claude reviewed): `npx supabase db reset` 0; `verify:db:` korume, knowledge, settings,
  lesson-jobs, pronunciation, shadowing, dictionary, notes all 0; live mutation (drop the line-anchor trigger) →
  korume gate red on `span_needs_line`, restored → green. tsc/lint/protocol 0; vitest 483 files / 4365 tests.
- Execution model: owner asked for "sol-6.1"; `-m sol-6.1` is rejected for a ChatGPT account (400) and no such slug
  exists, so Codex runs with `-m gpt-6-sol` (closest listed model).

## Working tree and environment

- Owner: Claude
- Worktree `.worktrees/ask-korume`, branched from master `ede3833`.

## Blockers

None.

## Next actions

1. Write Task 2's packet (migration 042 entitlement + `korume_complete_turn` + race gate + pricing/config), hand to
   Codex (`-m gpt-6-sol`). Plan Correction 10 applies to Task 4.
