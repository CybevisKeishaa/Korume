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
- Task 9 (Claude) — committed after a full vitest run 507 files / 4530 tests (token-scale
  `components/shadowing-workspace` pin 42 → 44); tsc/lint/protocol 0. Files: `korume-mascot.tsx` (`useKorumeOverlay`: draft per
  mount, anchor = selection span read on pointerdown else active line, `askCurrent` = new draft),
  `korume-sheet.tsx` (non-modal dialog placed in the transcript column's grid area via gridRow 2 / gridColumn
  -2/-1, `w-[--korume-sheet-width] min-w-[--korume-sheet-min]`, kept mounted while closed, conditional
  `flex`/`hidden` class because Tailwind `flex` overrides the `hidden` attribute), shell wiring (mascot inside the
  transcript cell, hidden in Focus / fullscreen / when `companionEnabled` is false; `k` only when visible; Escape
  `close-korume` after popover), `escapeAction` + `ask-korume` shortcut, globals tokens in BOTH density blocks,
  `CompanionSprite` `label` prop + `useThemeOrNull` (workspace tests have no ThemeProvider), `ask.open` /
  `ask.sheet.*` copy. 7 overlay tests green; 6 mutations red (the "k when disabled" one survived until a
  Focus-view k case was added).
- Task 10a (Codex via Paseo `gpt-5.6-terra`, 2 runs; quota out in round 2 at 15:30 → Claude finished): `/korume/chat`
  server page (gate first, fail closed on `unavailable`; `?thread` uuid-parsed, an invalid/missing/unreadable thread →
  quiet not-found over free chat; `KorumeChatPage` keyed by thread id because Next keys a page without its search
  params — without it ⋯ thread switching kept and posted into the old thread), `KorumeConversation` re-keyed by a
  client nonce for "New conversation", `router.refresh()` after an answered turn (`staleTimes.dynamic` 30 s would
  otherwise re-seed a revisited thread without it), rail (`unionGrounding` shared with the server, merge keeps Seen
  N), ⋯ `ThreadMenu` (keyset load-more), Back (origin → same-origin referrer + history > 1 → /dashboard), divider
  date after mount, `smallMemoryFor` (escaped, ≤4 labels, null on error). Hook: polling never re-arms after unmount.
  `ask.seen` / `ask.chat.grounding` ICU plurals ("Shadowing lines" — what seenCount counts). Screen registry row
  `korume-chat` (215:15164, stamped 2026-10-03; `/sensei` row goes with 10b). Two independent code-reviewer passes
  (1 Critical + 4 Important, then 1 Important — all fixed); 29 mutations red then restored (one vacuous
  structuredClone test found and fixed). vitest 512 / 4566; tsc/lint/protocol 0.
  Deferred: M5 the URL does not follow a free chat's new thread (reload loses it from view); m2 not-found copy also
  covers read failures; m3 focus lands on body after a ⋯ switch — check in Task 11 Playwright with the thread-switch
  round trip and the 1280x529 layout.
- Task 10b (Claude — Codex quota out until 19:46): `/sensei` page deleted; `next.config.mjs` 5th rule
  `/:locale(vi|en)/sensei` → `/:locale/korume/chat` (307, A17 removal terms) + pin; e2e cases for both locales and a
  `/en/senseisomething` negative (Playwright not yet run — Task 11); `/sensei` out of PROTECTED_PREFIXES, upcoming
  copy + pin, upcoming-routes / app-nav lists, registry `sensei` row (stamps 87→86, 2026-08-12 70→69); Settings "Talk
  with Korume" → `/korume/chat`; Pronunciation hub rail copy EN/VI names Korume; `messages/no-sensei.test.ts` walks
  every catalog leaf (RED first with 3 hits per locale). Docs: capability-map §3.1, ia-proposal, screen-inventory
  amended with "superseded" pointers (history kept); domain-model gains the Ask Korume terms. Remaining "sensei" hits
  are identifiers/comments only: `getSenseiRecommendation` + `SenseiRecommendation` (`lib/data/collections.ts`),
  `hub.rail.sensei.*` key names and the `sensei` prop, registry `generate-sensei` (Figma frame name, route null,
  never rendered), comments. Root design docs (`error-state-guildline.md`, `japanese-learning-app-spec.md`) still say
  Sensei — guarded by no-sensei if ever copied into a catalog. 4 mutations red. Independent review: 0 Critical /
  0 Important, 7 Minor (6 applied, the 7th partially — comments). vitest 513 / 4566; tsc/lint/protocol 0.
- Task 11 part 1 (Claude, 2026-10-03): `tests/e2e/fixtures/korume-data.ts` (seeded completed thread + retryable
  thread, fixed instants) and `tests/e2e/korume.spec.ts` (5 tests at 1280x529: sheet anchor/new draft/no remount/
  geometry/Escape/Expand/Back; seeded /korume/chat with persisted grounding, zero /api/korume on reload, ⋯ thread switch
  round trip; 402×2/429/503/409 inline + 502 Try again same turnId; Korume off → no mascot, 0 requests in 5 s, disabled
  page; no Sensei on Settings/Pronunciation, /companion has no composer). All green with korume-threads (6/6) and the
  redirect spec (11/11). Shadowing workspace e2e 16/16 green after T9.
  **Owner ruling 2026-10-03: the Shadowing sheet is a floating POPUP, not a full-height drawer** — bottom-right of the
  transcript column, 420 reference px tall (`--korume-popup-height`), rounded, bordered; spec §6.2 amended. Found while
  doing it: `gridRow: "2"` on an abspos grid item ends at the container EDGE (`2 / auto`), so the T9 sheet always ran
  under the drawer bar — now `2 / 3` (measured: 515 → 475 bottom; drawer bar at 489). Width is density-scaled
  (400 × 1280/1440 ≈ 355.6 px at the owner viewport) like every workspace size — the e2e measures the unit.
  Composer: removed the second (square) focus ring the global `:focus-visible` drew inside the form's ring.
  Full default e2e: 7 failures NOT from this branch's code — 3 `shadowing-intelligence` need dictionary data and the
  local DB has 0 dict snapshots (no source files on disk to import); 4 `landing-page` time out loading /en (the branch
  touches no landing file) — unverified against master.
  vitest 513 / 4566; tsc/lint/protocol 0.
- Whole-branch review (Task 11 step 5, Claude, 2026-10-03), `git diff master...ask-korume`: migrations, turn
  pipeline, store, routes, client hook, sheet, chat page, tools. Three findings, each fixed with a mutation-proven test:
  (1) Important — persisted grounding was never held to the read-side `groundingSchema` (gloss ≤300, ≤40 entities):
  one long JMdict gloss or a long line made every card of that answer vanish on reload; `buildGroundedEntities` now
  clips, filters by `groundedEntitySchema` and caps. (2) Important — before the first line (an intro, index null) the
  mascot and `k` did nothing; the anchor falls back to the first line, as `nextTarget` does. (3) Minor — the exposure
  tool's shadowed-line read put up to 3 000 ids in one `in` filter; now `fetchByIdChunks`. Checked and sound: per-user
  advisory lock serialises `turn_exists`, RLS-first ownership, release on every failure, escaped rendering.
  vitest 513 / 4569; tsc/lint/protocol 0.
- Owner Chrome look (2026-10-03 evening) → `54d7aae`: Enlarge mode for the Shadowing popup (centered, Learning context
  rail, Escape/backdrop shrinks); "Open full chat" creates the anchored thread before navigating (was a dead disabled
  button); `/korume/chat` is one viewport tall on desktop with internal scroll; MessageList keeps the newest turn in
  view. Measured at 1280×529: page scrollHeight 529, enlarged popup centred (178/178, 32/32). Spec §6.2/§6.3 amended.
  vitest 514 / 4572; Korume e2e 5/5. Real lesson Ep.729 imported locally (`scripts/seed-real-lesson.ts`).
- Execution model (owner 2026-10-03): Codex is dispatched through Paseo (`paseo run --provider codex --model
  gpt-5.6-terra --mode auto-review`), replacing raw `codex exec -m gpt-6-sol`. Task 10 is split: 10a page/rail/menu,
  10b `/sensei` redirect + persona sweep + docs (packets in `.superpowers/sdd/ask-korume/`).

## Working tree and environment

- Owner: Claude (Tasks 10a + 10b committed; Task 11 next)
- Worktree `.worktrees/ask-korume`, branched from master `ede3833`.

## Blockers

None.

## Next actions

1. Task 11 remaining: ASK THE OWNER before the live Gemini smoke §7.7 (step 4); owner Chrome look. Whole-branch
   review done (above). Still open: a selection-span anchor e2e; M5 (free-chat URL does not follow its new thread); focus
   after a ⋯ thread switch lands on body (m3); landing-page e2e timeouts vs master.
   Plan Correction 11 lists the as-built Task 4 interface.
