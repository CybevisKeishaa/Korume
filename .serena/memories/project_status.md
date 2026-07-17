# Nihongo Cinema — Project Status

Read this first each session. Product spec: `japanese-learning-app-spec.md` (**repo root** — moved
in from the parent folder and put under version control 2026-07-16; old references say `../`);
root rules: `CLAUDE.md`; agent workflow + 8-layer order + branching policy: `.claude/docs/workflow.md`.

## What this is
Learn Japanese through video shadowing/dictation + kanji/vocab/grammar/JLPT, cinematic UI.
8 layers, one per session; all 8 = finished product. Use `/build-layer <n>`.

## 🚧 IN PROGRESS RIGHT NOW — L9a Plan 1/3 (2026-07-17)
**Branch `layer-9a-localization-architecture` (off master @ `0419c15`), tip `37e00de`. NOT merged.**
Tasks 1–4 done+reviewed+committed (suite 1210). **Task 5 is ~85% done but UNCOMMITTED in the
working tree** — a subagent was interrupted mid-task; `app/` is already moved to `app/[locale]/`,
middleware is composed, tsc 0, suite 1216. **Do NOT redo Task 5 from scratch — finish and commit it.**
Tasks 6–8 not started.
**→ Full resumable detail is in `mem:l9a_localization_run_state`. READ THAT FIRST.**
Spec `docs/superpowers/specs/2026-07-17-l9a-i18n-design-system-design.md`;
plan `docs/superpowers/plans/2026-07-17-l9a-localization-architecture.md`;
SDD ledger `.superpowers/sdd/progress.md` (gitignored, richer per-task detail).

## ⭐ ROADMAP SEQUENCING — decided 2026-07-16 (read before choosing what to build next)
**User launch philosophy (explicit):** still in BUILD phase; publish ONLY after everything is
complete, polished, and fully-featured. There is NO near-term launch, paid-beta, or revenue goal.
This resolves the "L8 vs finish-L9" question decisively:

**Order = finish L9 first, do L8 (billing) near the very end, right before publish:**
1. **L9a — i18n + design system** (foundation; VN-first, replace English shell). Unblocks EVERYTHING
   visual + Companion Plans 2/3. ← **STARTED 2026-07-17, IN PROGRESS — see the block above and
   `mem:l9a_localization_run_state`.** Brainstormed + spec'd + split into 3 plans: Plan 1
   localization architecture (in progress), Plan 2 design system (not written), Plan 3 string
   extraction + Vietnamese (not written). Plans 2/3 both depend on Plan 1 and can then run in
   parallel.
2. **L9b — surfaces**: Companion Plan 2 → Plan 3, the missing feature UIs, landing/cinematic, tutorial.
   Fold the two launch-blocker debts in here (they count as "fully-featured"): **user transcript-submit
   UI** (backend done since L3, UI missing = core loop dead-ends) and **GDPR delete-my-data** (§2
   non-negotiable, owed since L1). Companion Plans 2/3 are HARD-BLOCKED on L9a.
3. **L8 — billing (PayOS)**: subscription + Founding price-lock + per-user Knowledge-Gen quota + auto
   kill-switch + Contextual Discovery UI nhúng vào L9b surfaces. Deferred to here because its conversion
   mechanism needs surfaces to exist, and cost-defense isn't urgent while AI is off in prod.
4. **L9c — polish + perf audit** on the final UI (why L9c was split out).

**HARD CONSTRAINT that overrides the order:** L8's per-user quota + auto kill-switch MUST land BEFORE
`ANTHROPIC_API_KEY` is added / AI is enabled for anyone (even mid-build end-to-end testing with other
people) — today only a manual ~$1-2 spend-cap exists. Reasoning behind all of the above is in this
session's discussion; flip to L8-first ONLY if the goal changes to open-paid/AI-to-real-users-soon.

## Stack
Next.js **14.2.35** App Router + TS strict + Tailwind. React **18.3.1**. Supabase
(Postgres + Auth + Storage) via `@supabase/ssr`. Zod. Motion: Lenis + Framer + GSAP.
AI: `@anthropic-ai/sdk` 0.111.0. Tests: Vitest+RTL (unit), Playwright (`tests/e2e`). Staying on
**Next 14** (revisit L8; don't silently bump — see `nextjs-14-pin-decision`).

## Branching policy (user-set)
One branch per layer `layer-<n>-<slug>` off master; merge `--no-ff` ONLY after DoD (tests pass +
code-reviewer sign-off); never push unless asked. History: L1 `1d1628e`, L2 `618e1a4`,
L3 `d6c2138`, L4 `63b965f`, L5 `74514cd`, L6 `3fe741b`.

## Progress
- **Layer 1 (Foundation): DONE, merged.** Next 14 migration, full spec §4 schema (RLS on all),
  Supabase auth (email+Google) + middleware, design system + reduce-motion, layout shell, motion.
- **Layer 2 (Static content): DONE, APPROVED, merged.** SM-2 SRS engine (`lib/srs`, 9 tests) +
  due-queue (`getReviewQueue` in `lib/data/srs.ts`); review API `POST /api/srs/review`; content
  APIs `GET /api/{kanji,kanji/[id],vocab,grammar}`; original content migrations (45 kanji/88
  readings/60 vocab/10 grammar) + `interval_days` col + `grants.sql` (table GRANTs to
  authenticated/service_role — RLS still row gate); pages `/kanji`(+detail)/`/vocab`/`/grammar`
  + flashcard review UI; kanji stroke-order animation (5 hand-authored glyphs + fallback).
- **Layer 3 (Video/Shadowing): DONE, APPROVED, merged.** Foundation libs: `lib/youtube`
  (URL parse + keyless oEmbed — NO Data API key, NO download), `lib/transcript` (SRT/VTT/plain
  parse + XSS sanitize), `lib/japanese` (kuromoji `0.1.2` tokenizer + furigana, server-only,
  dict at `node_modules/kuromoji/dict`), `lib/dictation` (LCS diff score), `lib/pitch` (client
  F0/YIN extraction + contour — user audio only), `lib/difficulty` (i+1 % known-words scorer),
  `lib/rate-limit` (in-memory, per-instance). APIs: `/api/videos/{import,[id],[id]/transcript,
  [id]/progress,[id]/difficulty}`, `/api/dictation/attempt`, `/api/shadowing/session`,
  `/api/mining{,/review,/queue}` (all zod-validated, rate-limited on writes). Migrations 7–9:
  private `recordings` bucket (owner-path RLS), `sentence_mining_cards` (+SM-2 cols, owner RLS),
  video/transcript write policies (owner-only, column-scoped `duration_seconds` grant).
  UI: `/videos` (import+list), `/videos/[id]/shadowing` (IFrame sync, A–B loop, speed, adaptive
  furigana 3-state, tap-to-mine), `/videos/[id]/dictation`, `/mining` (deck+SM-2 review).
- **Layer 4 (AI features): DONE, APPROVED, merged (`63b965f`).**
  - `lib/ai`: Claude wrapper on official SDK — model `claude-opus-4-8` (single source
    `lib/ai/constants.ts`), `messages.parse` + `output_config.format` + `zodOutputFormat`, NO
    temperature/top_p (Opus rejects), typed SDK error mapping (`lib/ai/errors.ts`), stable
    system prompts first for prompt caching. Chatbot (scenario roleplay + corrections),
    video summaries, example-sentence generation.
  - `lib/speech-scoring`: Azure Speech pronunciation assessment (JA), STT, TTS — every entry
    point degrades to a clean 503 "not configured" result when keys are absent. (Keys WERE
    absent during L4; Azure was configured at L5 start, 2026-07-13 — features now live.)
  - `lib/audio`: pure PCM/WAV encode (`pcm-encode.ts`) + decode (`wav-decode.ts`),
    `blobToWav16kMono` (`blob-to-wav.ts`), shared `read-blob.ts`. **Azure short-audio uploads
    must be WAV/PCM or OGG/Opus — recorder webm/opus is converted client-side before every
    Azure-bound upload (STT + both pronunciation call sites); stored recordings stay webm.**
  - `lib/pitch`: `scorePitchAccent` (`score.ts`, deterministic, register-shift + offset
    invariant, 0–100 + overlay points + lowConfidence), `contourFromSamples` (`pipeline.ts`),
    `reference.ts` (TTS of line TEXT → `riff-16khz-16bit-mono-pcm` → contour, cached per
    sentence; 503 cached forever, transient failures retried).
  - Pitch overlay (差別化 #1): `components/video-player/pitch-contour-overlay.tsx` (SVG,
    reference dashed + user line with `.stroke-draw` reveal → reduced-motion-safe via
    globals.css kill switch) + `pitch-comparison.ts`. Recorder panel attaches `pitch_score`
    to the session POST (only accepted at creation — no PATCH) racing a 3s budget
    (`pitchScoreUploadBudgetMs` prop) so saving never blocks on TTS.
  - APIs: `/api/conversation/{session,session/[id],session/[id]/end,message}`,
    `/api/pronunciation/score`, `/api/speech/{stt,tts}`, `/api/videos/[id]/summary`,
    `/api/vocab/[id]/examples` — all zod-validated + rate-limited; writes to shared content
    (video_summaries, vocab_examples) go through `lib/supabase/service.ts` (service-role,
    server-only).
  - Migration 10: `video_summaries` (RLS, SELECT-only policy for authenticated + explicit
    revoke of write grants), `vocab_examples.source` ('curated'|'ai_generated' — AI content
    labeling), conversation-table grants audit.
  - UI: `/conversation` (scenario picker, chat, voice mode, corrections, history),
    video summary panel, vocab example generation panel (`/vocab/[id]`), pronunciation score
    display in recorder panel.
  - Test harness additions in `test/`: `claude-mock`, `azure-speech-mock`, `audio-context-mock`,
    `blob-utils` (`readBlobBytes` — jsdom Blob lacks `arrayBuffer()`), fixtures.
- **Layer 5 (JLPT + Reading): DONE, APPROVED, merged (`74514cd`, 2026-07-13).**
  - Migration 11: `reading_passages`/`reading_questions`/`user_reading_attempts` + JLPT hardening —
    `jlpt_questions.correct_answer`+`explanation` UNREADABLE by authenticated (revoke SELECT then
    column-scoped grant; CRITICAL: migration-6 default-privileges blanket-grants new tables, so
    revoke-first or the column grant is a silent no-op); `user_test_attempts` += started_at/answers/
    mode('full'|'section')/section. Migration 12: original content — 2 tests (N5+N4, 34 câu each,
    12v/10g/6r/6l), 7 passages (4 N5 + 3 N4) + 21 questions; listening = `audio_text` in
    question_data, played via `/api/speech/tts` (NO audio files); answers round-robined 0–3.
  - `lib/jlpt`: deterministic scoring — pillar structure (N5/N4 combined LK+Reading 0-120 min 38 +
    Listening 0-60 min 19; N3–N1 three pillars 0-60 min 19), pass thresholds N5 80/N4 90/N3 95/
    N2 90/N1 100 (official), scaled = linear approx (labeled estimate), `passed: boolean|null`
    (null = insufficient data or section mode), `weaknessStats` by question_type weakest-first.
  - APIs: `/api/jlpt/tests{,/[id],/[id]/submit}`, `/api/jlpt/attempts`, `/api/reading{,/[id],
    /[id]/submit}` — GET strips answers (column grant = backstop, `select *` would fail); submit
    fetches answers via service-role, scores server-side, reveals correctAnswer+explanation only
    post-submit; rate-limit 20/60s on submits. Logic lives in `lib/data/jlpt.ts`/`reading.ts`
    (routes are thin, untested per repo convention; `test/supabase-mock.ts` = new reusable mock).
    Score column: full mode → scaledTotal (nullable), section mode → totalPercent. `started_at`
    client-supplied — timer is a study aid, NOT authoritative (commented in code).
  - Reading furigana: lazy generate-on-first-read (kuromoji `toFurigana`) cached into
    `furigana_json` via service client; failure → null, UI falls back to sentence-level lookup.
  - UI: `/jlpt` (list + attempts history), `/jlpt/[id]` (pre-start → timed runner w/ navigator,
    1–4 shortcuts, aria-live timer warnings, TTS listening + 503 degrade → results w/ pillar bars +
    weakness links), `/reading` + `/reading/[id]` (furigana toggle, tap-to-lookup popover,
    translation disclosure, quiz). ENGLISH shell (convention: shell EN, DB content VN). Old
    `/jlpt-test` placeholder → redirect `/jlpt`; middleware protects `/jlpt` + `/reading`.
  - code-reviewer: approve-with-nits, both fixed pre-merge (Reading shell VN→EN; timer comment).
- **Layer 6 (Gamification + Notifications): DONE, APPROVED, merged (`3fe741b`, 2026-07-14).**
  - **Principles G1–G3 formalized** in `business-model.md` §1.1 (decision filter, same rank as the 6):
    G1 XP = completed learning outcomes not app activity; G2 self-improvement before social
    comparison (→ leaderboard deferred to L7 as a PRODUCT decision); G3 notifications support
    learning not attention (no FOMO copy anywhere).
  - Migration 13: `xp_events` ledger (unique `(user_id, source_type, source_id)` = idempotency;
    source_id = natural-unit-per-VN-day, e.g. `{lineId}:{yyyy-MM-dd}`; conversation = sessionId only),
    `notifications` (type check badge_earned/level_up/srs_due; UPDATE grant column-scoped to
    `read_at`), +8 badges (11 total), belt-and-suspenders revokes on user_badges AND user_stats
    (the latter = review nit #1, fixed pre-merge). All writes service-role only.
  - `lib/gamification` (pure, clock-injected): XP table (srs_review 5, mining 5, dictation 10,
    shadowing 15, reading 20, conversation 25, jlpt section 30/full 50), triangular level curve
    (threshold L = 100·L·(L−1)/2), streak in fixed UTC+7 (VN no DST since 1975 — hardcoded shift,
    commented), badge evaluator zod-parses criteria jsonb and SKIPS malformed (forward-compat).
  - `lib/data/gamification.ts` `recordActivity()`: service-role award pipeline — NEVER throws into
    callers (best-effort), duplicate outcome = 0 XP but streak still advances, badge-snapshot
    aggregate skipped on duplicate+unchanged-streak, "learned kanji" reuses MASTERY_THRESHOLD
    (srs_stage>=2) from lib/data/difficulty.ts. Wired into all 7 lib/data write success paths.
  - `lib/notifications`: emit/deliver split (deliberately minimal — emitNotification → deliverer
    list, today only in-app insert; push/email later = new deliverer, zero business-logic change).
    NO srs_due producer wired yet (UI computes due count live; producer comes with push/email).
  - APIs: GET /api/user/stats (stats+level+badge catalog+srsDueCount), GET+PATCH /api/notifications
    (limit≤50; mark-read ids|all, rate-limited 30/60s), GET /api/videos/recommendations (i+1:
    known-vocab fetched ONCE, SCAN_LIMIT=100 approved videos, completed excluded, ideal→too-easy→
    too-hard, insufficient-data dropped).
  - UI: dashboard rebuild (level/streak/SRS-due/badges/recommendation rail), notification bell+
    panel in app-nav (optimistic mark-read w/ rollback, 429-aware, focus-return Esc/outside-click),
    profile stats, rail also on /videos. Client-safe type mirrors in lib/*-types.ts (repo
    convention). Motion: 4 pure-CSS one-shot keyframes + useUnreadIncreasePulse hook (no pulse on
    mount, only on live increase); all covered by existing reduced-motion kill-switch.
  - code-reviewer: approve-with-nits; nit #1 (user_stats revoke) fixed pre-merge; #2 (mark-read
    maps DB errors to 400 not 500) + #3 (recommendations tokenizes ≤100 transcripts/request,
    no cache — fine behind Suspense) left as noted follow-ups.
- **Layer 7 (Community + Admin CMS): DONE, APPROVED, merged (`01ae59d`, 2026-07-14).**
  - Migration 14: `users.is_admin` (client CANNOT write — users UPDATE grant re-scoped to exactly
    9 self-editable columns incl. new `leaderboard_opt_in`; email/created_at remain client-writable
    = pre-existing carryover, flagged for hardening) · forum `topic` (check: general/grammar/vocab/
    listening/speaking/jlpt/study-tips) + `updated_at` trigger · `user_playlists.is_public` +
    `description` + public-read policies · `peer_review_shares` (unique session_id = one explicit
    revocable consent per recording; owner INSERT/DELETE, no UPDATE anywhere) + `peer_reviews`
    (unique (share_id, reviewer_id), RLS backstop blocks self-review) · `idx_xp_events_created_at`.
  - Community backend: `lib/data/{forum,playlists,peer-review,leaderboard}.ts` + thin routes.
    Peer-review audio = the ONLY cross-user recording read path: verify share row exists → mint
    5-min service-role signed URL, rate-limited; storage policies untouched. Leaderboard = weekly
    (Monday 00:00 UTC+7, `lib/leaderboard/week.ts` clock-injected), service-role aggregation of
    xp_events, opt-in rows only, top 20, NO userId in payload (consent = name/avatar/weeklyXp only),
    callerWeeklyXp always returned. G1 enforced: zero recordActivity in community code.
  - Admin backend: `lib/admin/guard.ts` — `requireAdmin()` (401/403; DB `is_admin` = source of
    truth; `ADMIN_EMAILS` env = bootstrap-only self-heal promotion, fires ONLY inside requireAdmin)
    + side-effect-free `isAdmin()`. Video approve/reject/transcript-attach via service role
    (reject = HARD DELETE — no 'rejected' enum value; reason not persisted). Generic content CRUD
    `lib/data/admin-content.ts` (per-type config: kanji/vocab/grammar/jlpt_tests/reading_passages)
    + dependency-free CSV parser `lib/csv/parse.ts` + per-row-error import. `admin-stats.ts` w/
    labeled retention methodology, NO revenue (L8).
  - UI: `/community` (forum board/thread/composer), `/community/peer-review` (queue/mine tabs,
    on-demand signed-URL <audio>, share+revoke in shadowing recorder w/ consent copy), `/playlists`
    (own + public browse + save-to-playlist popover on videos), `/leaderboard` (**own week FIRST,
    then opt-in community ranking — user-mandated G2 UX order**), `app/(admin)/admin/**` (separate
    AdminShell; layout gates via `requireAdmin()` — NOT `isAdmin()`, so the ADMIN_EMAILS bootstrap
    completes on a plain /admin visit; this was review finding #1, fixed pre-merge). Middleware:
    +/admin (auth-only, admin check in layout), +/playlists, +/leaderboard.
  - code-reviewer: approve-with-nits; #1 (bootstrap reachability) + #2 (leaderboard userId leak)
    fixed pre-merge; #3 (admin dialog focus trap) + #4 (stroke_order_svg raw SVG, admin-trust) +
    #5 (users.email/created_at client-writable) = follow-ups below.
  - **L6 flaky test RESOLVED**: it was `components/video-player/pitch-contour.test.tsx` — waitFor
    1s default timeout under full-suite CPU contention; bumped to 5s.
- **Spec A (AI provider abstraction): DONE, APPROVED, merged (`201a9b4`, 2026-07-16).** 26 commits,
  15 TDD tasks, 1098 → **1166 tests**. Design + D1–D9 decisions live in the version-controlled spec
  `docs/superpowers/specs/2026-07-15-ai-provider-abstraction-design.md` (§3 known limits, §4 decisions);
  plan `docs/superpowers/plans/2026-07-15-ai-provider-abstraction.md`. (The separate
  `design_checkpoint_ai_provider_abstraction_2026-07-15` memory was pruned 2026-07-16 — merged work,
  its content folded here.) **Binding L8 constraint** (user, spec §2): abstraction must NOT narrow the
  product — deferring/disabling when `none` is fine, redesigning the AI API around Gemini-Free is NOT;
  `REQUIRED_CAPABILITIES` deliberately demands `promptCaching`+`reasoning` the only runnable provider
  (Gemini) reports false — that is correct, not a gap. Principle: **"Explicit config. Fail fast. Never
  infer. Never silently fall back."** **Hardest-won lesson (saved 6 times):** *when reality contradicts
  what a plan/spec/review says, the INSTRUCTION is wrong, not reality — verify, report, don't force.*
  (e.g. real `GEMINI_API_KEY` is 53-char `AQ.`-prefixed not `AIza`; `AZURE_SPEECH_KEY` 84 alphanumeric
  not 32-hex — both would have false-crashed boot if the rule had been written from memory.) Two
  load-bearing constructs a review twice wrongly called "redundant" (`EnvSource` union; the `?.` in
  `lib/ai/env.ts`) — do NOT "clean" them, removing them breaks typecheck.
  - `lib/ai` speaks a **provider-agnostic port** (`lib/ai/port.ts`, 2 operations); adapters live in
    `lib/ai/providers/` (`anthropic.ts`, `gemini.ts`, `fake.ts`). `client.ts` + `run.ts` deleted;
    `toAiError` moved into the Anthropic adapter. `AiErrorKind` + `lib/http-status.ts` UNCHANGED (D1).
  - **Provider selection is explicit, never inferred**: `AI_PROVIDER` (`none`|`anthropic`|`gemini`) +
    `SPEECH_PROVIDER` (`none`|`azure`) + `APP_ENV` (`dev`|`production`) are all REQUIRED. `none` =
    intentionally off → keeps the L4/L5 503 path byte-for-byte. Unset/invalid = **startup crash**.
    `APP_ENV=production` + `gemini` = crash (free tier trains on data — CLAUDE.md §2).
  - `instrumentation.ts` + `lib/env/validate.ts` validate ALL registered specs once at boot and report
    ONE aggregated error (the 2026-07-14 audit found two bugs at once — stopping at the first hides
    the second). `lib/env.ts` → `lib/env/index.ts` (`@/lib/env` still resolves).
  - `GET /api/admin/health` = on-demand liveness (D2: boot NEVER depends on a third party's uptime).
  - `.eslintrc.json` forbids provider-SDK imports outside `lib/ai/providers/` — verified the rule
    actually fires, not just that it exists.
  - **Env keys now (supersedes the audit rows below)**: `GEMINI_API_KEY` **VALID** (live 200; real
    shape is 53-char `AQ.`-prefixed, NOT `AIza`). `AZURE_SPEECH_KEY` **VALID** (user's fix worked;
    real shape 84 alphanumeric, NOT 32-hex). `ANTHROPIC_API_KEY` still absent → prod = `AI_PROVIDER=none`.
  - **LAUNCH CONFIG BOOT-VERIFIED**: `APP_ENV=production AI_PROVIDER=none SPEECH_PROVIDER=none` →
    Ready in 524ms, `GET /` → 200. almostgone.vn is deployable today with all AI intentionally off.
  - **KNOWN LIMIT, accepted (spec §3), deferred to scope D**: "fails at boot" is TRUE for `next dev`
    (crashes before the port opens) and **FALSE for `next start`** — it opens the port, prints Ready,
    then serves a permanent HTTP 500 per request WITHOUT exiting. So a crash-restart supervisor never
    sees a failure; only an HTTP health check would. Decide `process.exit(1)` when the almostgone.vn
    supervisor is set up.
  - **Deferred to a follow-up (final review finding, recorded)**: `gemini.test.ts` module-mocks the
    whole SDK, so `toContents`' `role: "ai"→"model"` translation has NO assertion — emit the wrong
    role and every test still passes while the live API 400s. V1 verified `@google/genai` routes
    through global `fetch`, so a fetch-level `test/gemini-mock.ts` mirroring `test/claude-mock.ts`
    IS possible. Gemini is dev-only, so this is low-risk but real.
  - PayOS env: renamed to `PAYOS_CLIENT_ID`/`PAYOS_API_KEY`/`PAYOS_CHECKSUM_KEY` and committed to
    `.env.local.example` (2026-07-16, `c3bd686`) — this open item is now CLOSED. Actual PayOS wiring = L8.
- **L6 flake NOT actually resolved** (project_status previously claimed it was): 
  `components/video-player/pitch-contour.test.tsx` failed once again during the Spec A merge
  verification, then passed in isolation AND on a full-suite re-run. The 5s `waitFor` bump reduced
  but did not eliminate it — it is CPU-contention-sensitive under the full suite. Re-run before
  believing it.
- **Session 2026-07-16 — doc reconciliation + Layer 9 (Companion) DESIGNED & PLANNED (not built).**
  - **Doc fixes committed (`c3bd686`)**: CLAUDE.md §3 CRA→Next reality; workflow.md/backend-engineer
    Stripe→PayOS; `.env.local.example` env renamed to `PAYOS_CLIENT_ID/PAYOS_API_KEY/PAYOS_CHECKSUM_KEY`
    (the old bare `CLIENT_ID/…` open item is now CLOSED); spec §4 dropped `stripe_customer_id`; README
    rewritten from CRA boilerplate. Spec now version-controlled at repo root.
  - **L8/L9 RE-SCOPE (user decision)**: **L8 = PayOS billing ONLY.** "site-wide animation polish +
    performance audit" and ALL new UI/UX MOVED OUT of L8 into a **new Layer 9**. Reason: the app is
    functional but the UI is bare frames — landing/cinematic never built, F-002/004/006/010 UI orphaned,
    12 of 16 F-00x features UI-less, shell still English. Polishing/auditing a UI that doesn't exist = wasted.
  - **L9 split into 3 sequential specs (user-approved)**: **L9a** = foundation (i18n + design system) —
    **NOT BUILT, and it is the prerequisite for L9b/L9c**; **L9b** = surfaces (landing, feature UIs,
    tutorial) incl. the Companion; **L9c** = polish + perf audit (audit runs on the FINAL UI).
  - **Companion System spec = DONE** (`docs/superpowers/specs/2026-07-16-companion-system-design.md`,
    commits `24bbf1c`→`2773e8a`→`3d5a8c4`→`cd828dd`→`8ba42c1`→`10dae79`→`3eb0037`). The mascot as a
    product mechanism, NOT decoration. Spec 1 of 2 = **mechanism**; Spec 2 (Character Identity: name,
    lore, look) deliberately deferred so art never blocks engineering. Locks: North Star axiom (P0:
    exists only to make the journey meaningful, never engagement) + P1–P12 + supporting principles;
    two tracks — growth (`relationship_phase = f(xp)`, 4 phases, monotonic, hidden thresholds) vs memory
    (`companion_memories`: discovered vs gifted, NO media §2, immutable, owner-only); capture gate
    (idempotent, best-effort, hooks `recordActivity`); Ambient Layer + per-surface anchors + context bus
    + state machine + arbitration/cooldown + 4-verb Companion API; Free/Premium AI boundary (AI reads
    Journal never writes it; canon hierarchy; silent degradation with AI off = launch state; model
    independence); placeholder-first + Character Swap Invariant (replace all of Spec 2 → zero data/logic
    migration). Companion exists even with `AI_PROVIDER=none`.
  - **Companion Core (Plan 1 of 3) = BUILT, MERGED** (`--no-ff` merge `9f09cf2` → master, 2026-07-16;
    subagent-driven-development, 8 commits `d66c0c1`→`4183f73`). The data+logic core, deliberately
    INDEPENDENT of the unbuilt L9a and of AI. Ships: **migration #15** `20260716000015_companion_memories`
    (immutable via `revoke update from authenticated` — the migration-6 default-privileges gotcha bites,
    plain grant is additive; owner-only RLS + gifted-only INSERT; no-media, pointers + line text only);
    `lib/companion/*` (pure `relationshipPhaseForXp` w/ hidden `PHASE_THRESHOLDS=[0,500,2500,10000]` +
    fast-check monotonicity property; `dedupeKeyFor`/`titleFor` non-AI VN template titles; types + barrel);
    `lib/data/companion.ts` (`recordDiscoveredMemory` insert-or-ignore, `listJournal`/`getAnchorMemories`
    ordered by `occurred_at`, the `captureCompanionMemories` gate, `pinMemory`/`getJournal`); gate wired
    best-effort into `recordActivityInner` (service-role client, never throws — double-guarded); Zod
    `pinMemorySchema` + `POST /api/companion/memories` (gifted pin, user-client/RLS, 400 on bad line
    mirroring `createMiningCard`) + `GET /api/companion/journal`. Full suite **1190/1190**, tsc/lint/build 0.
  - **Producers wired now:** `companion_grew` (anchor, on hidden phase-threshold crossing), `mining_saved`
    (on mining_review), `jlpt_passed` (anchor, **gated on an actual pass** — `passed` threaded
    RecordActivityInput→gate→jlpt.ts as `result.passed===true`; a FAILED/insufficient JLPT records NOTHING).
    This gating was a **final-review catch** (`fix` commit `4183f73`): the plan's verbatim code fired
    jlpt_passed on every submit incl. fails = a failed-N4→"N4 milestone" anchor = North-Star violation;
    user chose fix-in-branch. **`first_shadow` DEFERRED to Plan 2** (fires only on first line to REACH
    TARGET SCORE — the score isn't available at recording-upload time; `resolveLinePointer` removed with it).
  - **Deferred to Plan 2/3:** `first_shadow` + `line_mastered` + `first_video_completed` producers (need
    score/completion reads); Ambient Layer, anchors surfacing, context bus, state machine, arbitration,
    Companion API, placeholder sprite, Journal UI (Plan 2, needs L9a); adaptive voice + AI reflection +
    move template titles into i18n (Plan 3). Minor cleanups carried: dedupe.ts switch `never`-guard,
    phase.ts redundant `!`, dead `@/lib/supabase/service` mock in companion.test, pinMemory 400/401/429
    unit coverage (repo-wide gap — no harness for `createClient()`/`requireUser()`-style fns), and the
    `companion_grew` title says "giai đoạn 2" (a raw phase index / "stage" — P12 forbids; fix in i18n Plan 3).
- **Layer 8: NOT STARTED.** Now scoped to **Billing (PayOS) ONLY** (polish + perf audit moved to L9c
  above). Per `business-model.md`: single tier 49k/490k + Founding 39k, no trial, Contextual Discovery,
  Knowledge-Gen quotas + global kill-switch FIRST. Lead: backend (+ tech-lead). Start: `git checkout
  master`, branch `layer-8-<slug>`. **Spec A's port is the billing/AI-metering foundation**: model
  tiering, the Knowledge Economy cache and the kill-switch all plug into `lib/ai/port.ts`. **SEQUENCING
  (user decision 2026-07-16): L8 is DEFERRED to near the end — after L9a/L9b — right before publish. Do
  NOT start L8 next; NEXT ACTION is L9a. See the ⭐ ROADMAP SEQUENCING block at the top.** Independence
  still holds technically (L8 core only needs Spec A's port), but its conversion mechanism wants L9b
  surfaces and cost-defense isn't urgent while AI is off in prod.

- **Business model / monetization = DECIDED** → `docs/product/business-model.md` (product manifesto +
  operational model; commits `3fb3232`→`14aafba`). Layer 8 reference; supersedes spec §3.12 Stripe/trial.
  Canonical detail in Serena `monetization_brainstorm`. Key: VN/PayOS/free-first · value-based Free/Premium
  (computed-from-your-data = free, AI-authored-over-it = premium) · Knowledge Economy (sentence+word-level
  cache, quota on generating not reading) · single tier 49k/490k, Founding 39k locked, no lifetime ·
  Contextual Discovery (no trial) · KPI = Knowledge Reuse Ratio.
- **docs/features registry reconciled with real build state** (it was authored post-L4). `README.md` now
  marks **F-002 / F-004 / F-006 / F-010 = 🟨 Partial** (foundations shipped L3/L4: `lib/difficulty` +
  `/api/videos/[id]/difficulty`; `shadowing_sessions`+pitch; `/mining`+`vocab_examples`; known-words+
  adaptive-furigana). Every feature's Free/Premium home is mapped in `business-model.md` **§2.1**. When
  building F-010, keep §2 "mining stores NO media" (thumbnail = YouTube URL reference, don't store images).

## Key gotchas learned
- **Table GRANTs**: migration-created tables do NOT inherit Supabase default grants → queries as
  `authenticated` failed with 42501 until `20260712000006_grants.sql`. Every NEW table needs RLS
  enabled (default-privileges auto-grant DML to authenticated → table without RLS = open hole).
- Content is versioned reference data → lives in MIGRATIONS (not seed.sql) so `db push` deploys it.
- **RLS gates ROWS, not columns.** Column control = `revoke update ... ; grant update (<col>)`.
  **Layer 7 admin approval MUST use the service-role client** (authenticated has zero UPDATE on
  videos.status/title/etc.). For shared AI content the L4 pattern: SELECT-only policy + explicit
  revoke of write grants + service-role write path.
- **§2 & YouTube audio**: never extract/compare YouTube source audio; pitch reference = TTS of
  the transcript line TEXT; user contour = mic recording only.
- **Sentence mining stores NO media** (§2): card = text + `{video_id,start,end}`.
- **Azure short-audio format**: webm/opus is rejected — convert to 16kHz mono 16-bit PCM WAV
  client-side (`blobToWav16kMono`) before upload; keep stored recordings webm.
- **Claude API**: official SDK only, `claude-opus-4-8`, no temperature/top_p, `messages.parse` +
  `zodOutputFormat`, no prefills, typed error handling (RateLimitError/AuthenticationError/…).
- **Admin auth**: `users.is_admin` (DB) = source of truth; `ADMIN_EMAILS` = bootstrap-only, and
  the promotion fires ONLY inside `requireAdmin()` — any server gate for admin surfaces must call
  `requireAdmin()`, not `isAdmin()` (side-effect-free), or the first admin can never get in.
- **Consent-scoped payloads**: what a user opted into showing defines the response shape —
  leaderboard returns name/avatar/weeklyXp but NOT userId; peer-review authors never include email.
- jsdom quirks: Blob has no `arrayBuffer()` (use `@/test/blob-utils` `readBlobBytes` /
  `lib/audio/read-blob.ts`), no Web Audio (use `@/test/audio-context-mock`), no canvas 2D.

## Deploy target (user-set)
**Self-hosted at `almostgone.vn`** — a single long-running Node instance (NOT Vercel/serverless).
Consequence: `lib/rate-limit.ts` in-memory sliding-window IS a real limiter here (state persists across
requests, no per-cold-start reset) — the "per-instance / resets" caveat only bites if we later scale to
multiple instances behind a load balancer (then → Redis). Cost-defense: user runs a low Anthropic Console
spend cap (~$1–2) = a manual global kill-switch (defense layer #1); it's a monthly org budget, near-real-time
(can slightly overshoot), and blunt (all-or-nothing app-wide, not per-user) — still need per-user Knowledge-Gen
quota (L8) before opening to real users. Supersedes spec's "Deploy: Vercel". Payments = PayOS (not Stripe).

## DB / running locally
Local Supabase (Docker) is the dev DB; `.env.local` points at it. Docker Desktop must be running
(`npx supabase start`). `npm run dev` → localhost:3000. Studio :54323. `npx supabase db reset`
re-applies migrations (**15 built** — Companion migration #15 `20260716000015_companion_memories`
merged 2026-07-16). Cloud move (still not done): create free project → swap 4
`.env.local` values → `supabase link` + `supabase db push`; add Google OAuth creds in dashboard.
Env keys (AUDITED 2026-07-14, see `mem:product_readiness_audit_2026-07-14`):
`ANTHROPIC_API_KEY` **NOT in .env.local** (earlier "set" claim stale) → all Claude features
degrade to "not configured". `AZURE_SPEECH_KEY` present but **INVALID — Azure returns 401**
(value looks like a GUID/resource-ID, not Key1/Key2) → TTS/STT/pronunciation all fail (502).
`ADMIN_EMAILS="admin@almostgone.vn"` added 2026-07-14 (bootstrap admin exists locally).

## Verify commands
`npx tsc --noEmit` · `npm test` (**1098 unit**) · `npm run lint` · `npm run build` ·
`npx playwright test` (2 e2e) · `npx supabase db reset` (14 migrations). Shared test harness in
`test/` (`@/test/*`): media mocks, YouTube IFrame stub, Claude + Azure Speech + AudioContext
mocks, tone-buffer/transcript/URL fixtures, blob utils, `supabase-mock.ts` (chainable
query-builder mock for lib/data tests).

## Deferred follow-ups

**USER-FACING FEATURES đã hoãn nằm ở memory riêng `mem:feature_backlog_deferred` — PHẢI đọc nó
khi plan bất kỳ layer mới nào (user mandate 2026-07-14: không bỏ sót chức năng đã brainstorm).**
Mục dưới đây chỉ là engineering debt/nits.
From L1: GDPR delete-my-data; getUser() in middleware on all routes (perf); conditional
aria-describedby; users_update_own email/level column scope. From L2: `unique(word, reading)`
won't dedupe reading-less vocab (NULLs distinct) — matters when admin CMS adds entries; add CI
guard asserting RLS enabled on all public tables. From L3 (non-blocking nits): adaptive furigana
homograph false-hide + `Object.hasOwn`; mine popover outside-click dismiss + aria live-region;
radiogroup roving tabindex; mining duplicate-card dedup; `lib/rate-limit` unbounded map (Redis in
L8); `VideoRow` type duplication; Supabase-backed integration tests; difficulty scorer caching.
From L4 (review nits, non-blocking): persist voice-mode pronunciation score to
`conversation_messages.pronunciation_score` (column exists, deliberately unwired — best-effort
client-side only for now); human-review/publish gate for `source='ai_generated'` vocab examples
(candidate for L7 admin tools). From L5: "Add to flashcard" from reading passages is disabled —
`/api/mining` requires `lineId` FK into `transcript_lines` (video-only); generalizing the mining
schema (nullable lineId + source discriminator) is a future decision (fits F-010/F-014);
listening weakness links route to `/videos?level=` (no dedicated listening drill module yet);
site-wide i18n/VN-localization of the English shell = deliberate product decision, not per-module;
`jlpt_questions.question_type` free-form text (add check constraint if vocabulary stabilizes);
manual click-through of /jlpt + /reading in the browser not yet done (only unit/e2e-registration
coverage) — worth doing before real users. From L6: one intermittent unit-test failure observed
once (822/823, then 823/823 twice; test unidentified, reviewer found no time-fragile test in the
new code — watch for recurrence); markNotificationsRead maps DB errors to 400 (should split 500);
recommendations tokenizes ≤100 transcripts/request with no cache (revisit with catalog growth or
L3's deferred difficulty-cache); Supabase default grants give authenticated TRUNCATE/REFERENCES/
TRIGGER repo-wide (not exploitable via PostgREST, hardening candidate); badge iconUrl all null
(SVG fallback in UI — real icons = content task); srs_due notification producer unwired (needs
scheduler, pairs with push/email deliverer later); manual browser click-through of dashboard/bell/
recommendations not done (unit+build coverage only). From L7: admin `components/admin/dialog.tsx`
lacks a focus trap (Tab escapes the modal; matches repo popover precedent but WCAG 2.4.3 wants a
trap); `stroke_order_svg` stored/rendered as raw SVG (fine while only admins write — needs
allowlist SVG sanitizer before less-trusted contributors); `users.email`/`created_at` still
client-writable (hardening migration candidate); no 'rejected' video status (reject = hard delete,
moderator reason logged not persisted) and no 'admin' transcript_source (admin-attached transcripts
stored as 'user_submitted') — both need a migration if wanted; CSV import is flat rows only (nested
kanji readings / test questions / passage questions via JSON create/update after import) and the
table doesn't auto-refresh post-import; admin content edit form only pre-fills fields present in
the list query (no GET-single endpoint); forum comment optimistic insert shows "You" until reload
(cosmetic); save-to-playlist overlay on /videos uses ARIA role="list" wrapper (revisit if
video-card gets a slot); community cursor pagination assumes distinct created_at at page
boundaries; admin stats count ids in JS not count:'exact' (fine at current scale); manual browser
click-through of /community, /playlists, /leaderboard, /admin not done (unit+build only).

## Working agreements
TDD-first, tests shown passing. code-reviewer signs off every non-trivial change before "done".
Data flows down schema→API→UI. Never download/proxy video (YouTube IFrame only). **Commit freely
without asking** (user granted standing permission 2026-07-13 — supersedes old "commit only when
asked"); push to remote still requires an explicit ask. Branch-per-layer + merge-to-master-when-done.
