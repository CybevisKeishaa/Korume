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
- Task 2 (Codex, 164k tokens, hit its usage limit after writing the report; Claude reviewed): per AGENTS.md §6 the
  ledger changes are IN PLACE in 038 (`ai_reserve` + `p_turn_id`, kinds, `turn_id` index, snapshot) and 040
  (`ai_settle`); 042 holds only `korume_complete_turn`. Claude fixed one ambiguous column in
  `korume-race/assert.sql`. Reset 0; all 8 `verify:db:*` 0 (korume = single-session + 20-connection race). Live
  mutations each red then restored green: Free `>=`→`>` (case 8), no `ai_release_expired` (9), held turns ignored
  (12), no per-user advisory lock (race), `ai_settle` skipped (13). tsc/lint/protocol 0; vitest 486 / 4374.
- Task 3 (Claude — Codex quota out): `companion_enabled boolean not null default true` IN PLACE in migration 033
  (its own contract test pins "user_preferences in exactly one migration", so the plan's 043 would have gone red);
  options/data/validation wired; Settings row after Camera with a speech-bubble `companion` glyph; `korumeGate()`
  fail-closed via `readPreferencesOrThrow`. RED 8 tests first; mutation (gate → `readPreferences`) → fail-closed
  test red, restored green. Reset 0; all 8 `verify:db:*` 0; live column default `true`, NOT NULL. tsc/lint/protocol
  0; vitest 487 / 4381.
- Task 4 (Claude — Codex quota out): text/route/validation modules, `lib/korume/store.ts` (service writes, RLS
  reads — Correction 10), `lib/data/korume.ts` (createThread / listThreads with keyset cursor / getThread +
  `pendingTurnsFor`), `lib/korume/http.ts`, routes `POST|GET /api/korume/threads`, `GET /api/korume/threads/[id]`,
  `/korume` protected. As-built interface recorded as plan Correction 11 (memory-store deferred to Task 7; answer
  and grounding stay null until Task 7 validates them). Mutations (anchor compare, UTF-16 span length, held →
  running) each turned one test red, restored green. E2E `tests/e2e/korume-threads.spec.ts` on the worktree build
  (`.env.local` copied from main with `AI_PROVIDER=none`, gitignored): parallel POSTs → {200, 201}, one row; moved
  anchor → 409; client `originRoute` → 400; other learner GET/POST → 404. tsc/lint/protocol 0; vitest 493 / 4414.
- Task 5 (Claude): `plan.ts` (allowlist schema, `validatePlan` NFKC/letter/length/dedupe/anchor-only/max 4,
  `fallbackPlan`), `limits.ts` (TTL invariant reuses `lib/ai/constants` `PROVIDER_TIMEOUT_MS`), `prompts.ts`
  (`plannerPrompt`, `quoteBlock` escaping), `retrieval.ts` (parallel, per-tool + stage deadlines, error codes only),
  tools line-analysis (staticAnalyses full scope, so grammar matches reach the answer), dictionary (active snapshot,
  `lookupForms`/`entriesFor` now exported), memory (SELECT only, two escaped `ilike` reads instead of `or()`),
  knowledge (`readCachedSection` only). `learner_exposure` reports `unavailable` until Task 6. 8 mutations each red
  then restored. tsc/lint/protocol 0; vitest 498 / 4435.
- Execution model: owner asked for "sol-6.1"; `-m sol-6.1` is rejected for a ChatGPT account (400) and no such slug
  exists, so Codex runs with `-m gpt-6-sol` (closest listed model).

## Working tree and environment

- Owner: Claude
- Worktree `.worktrees/ask-korume`, branched from master `ede3833`.

## Blockers

None.

## Next actions

1. Task 6 (progress-aware `learner_exposure` tool + `buildGroundedEntities`). Codex (`-m gpt-6-sol`) if its
   quota is back (~14:30 2026-10-03), else Claude. Plan Correction 11 lists the as-built Task 4 interface.
