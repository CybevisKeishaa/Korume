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
- Task 6 (Claude): `tools/exposure.ts` (`seenLines` progress-aware with no high-water mark, per-video
  server-side `lte(start_time, position)`, shadowed lines added, cap 20 videos / 3000 lines → `capped`,
  `countExposure` by identity — when a term names several identities the one on most lines wins, so は the
  particle beats 歯), `grounding.ts` (`buildGroundedEntities` from ok results only, merge by id, JLPT label, lesson
  link only to a readable video); exposure wired into `DEFAULT_TOOLS`. 7 mutations red — the substring one first
  SURVIVED (the max-identity choice masked it), fixed by a substring-only case. vitest 500 / 4451.
  Not yet proven against a live DB (PostgREST filter shapes): the Task 11 live smoke with its independent oracle.
- Task 7 (Claude): `answer.ts` (zod/v4 `answerV1Schema`, `groundingSchema`, `dropUngroundedCards`,
  `answerToPlainText`), `messages.ts` (`toMessageView` re-validates stored JSON on every read), `memory-store.ts`
  (test-only, RLS + unique-index + complete-turn parity), `prompts.ts` `answerPrompt` (data block capped at
  `ANSWER_DATA_MAX_BYTES` so the reserved input bound is a real ceiling), `turn.ts` `runTurn` (§5 order; any
  unexpected error after the hold releases it with the spend so far; an answer left with only follow-ups after
  dropping ungrounded cards is `answer_failed`), `postTurn` façade, `POST /api/korume/threads/[id]/turns`.
  **Body gains `locale: "vi" | "en"`** — an API route cannot read the next-intl locale (see
  `lib/data/account-deletion.ts` note). 11 mutations red (conflict, AI gate, release, spend, card drop,
  turn_exists, turn id, Plus credits, limit literal, memory unique, chip cap). vitest 504 / 4492.
  The SQL store's `insertUserMessage` / `completeTurn` RPC shapes are proven only by the Task 11 live smoke.
- Task 8 (Claude): `components/korume/` — `AnswerBlocks` (text nodes only; ruby via `FuriganaText` only when the
  ruby bases spell the sentence, since `RubySentence` needs the lesson context), `ListenButton` +
  `useJapaneseVoice` (absent without a `ja*` voice, `cancel()` before `speak()`), `MessageList` (follow-ups live
  only on the latest answer), `Composer` (IME-safe Enter), `TurnNotice` (client-side time formatting, countdown),
  `useKorumeThread` (draft id, same ids on retry, 2 s poll capped at 180 s, notice mapping; Plus fuse → "resting").
  `ask.*` copy EN/VI + pins; `components/korume` scanned by the token rule. 10 mutations red (the hard-coded-limit
  one first SURVIVED — the test used 10; now 7). `rounded-xl` caught by the style-guide radius rule (no such rung).
  vitest 506 / 4519.
- Task 9 (Claude) — **IMPLEMENTED, NOT COMMITTED** (owner stopped the session 2026-10-03 ~12:55 while the full
  vitest run was in progress; tsc/lint/protocol were 0). Files: `korume-mascot.tsx` (`useKorumeOverlay`: draft per
  mount, anchor = selection span read on pointerdown else active line, `askCurrent` = new draft),
  `korume-sheet.tsx` (non-modal dialog placed in the transcript column's grid area via gridRow 2 / gridColumn
  -2/-1, `w-[--korume-sheet-width] min-w-[--korume-sheet-min]`, kept mounted while closed, conditional
  `flex`/`hidden` class because Tailwind `flex` overrides the `hidden` attribute), shell wiring (mascot inside the
  transcript cell, hidden in Focus / fullscreen / when `companionEnabled` is false; `k` only when visible; Escape
  `close-korume` after popover), `escapeAction` + `ask-korume` shortcut, globals tokens in BOTH density blocks,
  `CompanionSprite` `label` prop + `useThemeOrNull` (workspace tests have no ThemeProvider), `ask.open` /
  `ask.sheet.*` copy. 7 overlay tests green; 6 mutations red (the "k when disabled" one survived until a
  Focus-view k case was added).
- Execution model: owner asked for "sol-6.1"; `-m sol-6.1` is rejected for a ChatGPT account (400) and no such slug
  exists, so Codex runs with `-m gpt-6-sol` (closest listed model).

## Working tree and environment

- Owner: Claude (session stopped by the owner mid-Task 9; Task 9 changes are uncommitted in the worktree)
- Worktree `.worktrees/ask-korume`, branched from master `ede3833`.

## Blockers

None.

## Next actions

1. **Resume Task 9:** in the worktree run full vitest (`npx vitest run --reporter=dot --minWorkers=1 --maxWorkers=2`);
   if green, add `components/shadowing-workspace` source count bump in `components/ui/token-scale.test.ts` if it
   fails (+2 files), review the diff (`git status`), commit `feat(korume): anchored Korume sheet in the Shadowing
   workspace`. Still open for Task 9: a selection-span anchor test (Playwright in Task 11) and the 1280x529
   geometry / no-remount proof (Task 11).
2. Task 10 (`/korume/chat` page + rail + Back + thread menu + disabled state; `/sensei` redirect; §6.5 persona
   sweep). Figma 215:15164 screenshot already reviewed (header Back · "Korume / Japanese Knowledge", right
   "Korume Memory" + settings; chat column with TODAY divider, grounding line, bubbles, KORUME answer cards,
   followup chips, composer; rail: Learning context / In this conversation / A small memory). No mic, no correction
   mode (spec §6.3).
3. Task 11 (seeded Playwright §7.6, then ASK THE OWNER before the live Gemini smoke §7.7, then whole-branch review). Codex (`-m gpt-6-sol`) if its
   quota is back (~14:30 2026-10-03), else Claude. Plan Correction 11 lists the as-built Task 4 interface.
