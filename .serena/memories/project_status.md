# Nihongo Cinema — Project Status

Read this first each session. Product spec: `japanese-learning-app-spec.md` (**repo root** — moved
in from the parent folder and put under version control 2026-07-16; old references say `../`);
root rules: `CLAUDE.md`; agent workflow + 8-layer order + branching policy: `.claude/docs/workflow.md`.

## What this is
Learn Japanese through video shadowing/dictation + kanji/vocab/grammar/JLPT, cinematic UI.
8 layers, one per session; all 8 = finished product. Use `/build-layer <n>`.

## ✅ L9a Plans 1/3 AND 2/3 COMPLETE — both MERGED to master (Plan 1 `69f22e6`, Plan 2 `fcd35af`, 2026-07-18)

**Plan 2 (design system) merged `fcd35af` --no-ff same day** — full token system + semantic
colour tiers + 8 Radix/in-house primitives + living style guide `/[locale]/admin/style-guide`
+ enforcement tests (P8 lint fire-tested, §8 logical-properties scan, token contract,
middleware-composition guard). Post-merge: tsc 0 · **1293/1293 (174 files)**. Manual
style-guide browser pass STILL OWED (checklist in `mem:l9a_localization_run_state`).
Plan-1 details below unchanged:
**Branch `layer-9a-localization-architecture` merged & local branch deleted (user chose merge).
NOT pushed (origin/layer-9a-... still holds a stale pre-finish tip — prune when pushing).
Post-merge verify on master: tsc 0, 1229/1229.** All 8 tasks done + task-reviewed; final whole-branch review (opus):
READY TO MERGE = YES, 0 Critical/Important. Shipped: `lib/i18n/**` foundation (next-intl 4.13.2,
vi/en, prefix "always"), `app/`→`app/[locale]/`, Supabase-first middleware composition, locale-
stripped route protection + security matrix, all feature code on `@/lib/i18n/navigation`, ESLint
boundary (merged with AI-SDK guard, fire-tests). Zero user-visible change (shell still EN).
Baseline @ ceb7445: **unit 1229/162 files · build 52s · playwright 2/2 37s · tsc 0 · lint 0**.
Plans 2 (design system) & 3 (extraction + VN) both UNBLOCKED, not yet written.
**→ Load-bearing constructs, reuse patterns, and review-assigned follow-ups: `mem:l9a_localization_run_state`. READ THAT before Plans 2/3 or touching middleware/i18n.**
Spec `docs/superpowers/specs/2026-07-17-l9a-i18n-design-system-design.md`;
plan `docs/superpowers/plans/2026-07-17-l9a-localization-architecture.md`;
SDD ledger `.superpowers/sdd/progress.md` (gitignored, richer per-task detail).

## ▶ NEXT ACTION (updated 2026-07-22) — Task **12** (`mining`) is next; tree is clean, nothing owed
**L9a Plan 3 IS BEING EXECUTED** on branch **`layer-9a-string-extraction`** (off master @ `e5893e9`)
via `superpowers:subagent-driven-development`. **Tip `faca02f`. Tasks 1-10 + 6b + 11a–11e ALL committed
and reviewed clean — Task 11 (the 6.9× monster, split into 11a–11e) is DONE.** Gate at the tip, all
three re-run by the controller itself: **tsc 0 · 1530 tests / 192 files · lint exit 0 / 80 pre-existing
warnings across 23 files, 0 new.**

**Task 11e done `1795471` + wiring fix `faca02f`** (`shadowing-recorder-panel` → `shadowing` ns; 41 leaves,
all pinned; 3 carry-forwards handled; Azure `errorType` enum mapped via exhaustive `Record` so it's
translated not leaked; review found + closed 1 wiring survivor — 発音/リズム labels not paired to scores).
Details in `mem:l9a_localization_run_state`.

Commits 2026-07-22: `23a8f84` (11b `dictation`) · `36534b0` (plan-doc file-list patch) · `da41411`
(11c `shadowing` + `common.player.*`) · `9c9b3bf` (11d capture). **The user made their own commit
`3e4b4a3` "[LongTNP]: mascot" mid-run** (deleted `.docx`, added `MASCOT.md`) — those files are handled,
stop excluding them.

**NEXT: Task 12** (`mining` namespace) — `components/video-player/mining-review-session.tsx` (+ test) +
`app/[locale]/(app)/mining/page.tsx`. Consumes `common.srs.*` (Task 7) + `common.errors.network` (Task
11b/11e). Glossary: mining = "Thu thập câu". **Task 12 OWNS the LAST `body.error`/`Error.message` defect
instance:** `mining-review-session.tsx:61` routes raw `Error.message` to the DOM — stop rendering it,
classify to a descriptor. Read `mem:l9a_localization_run_state` top block first.

**Task 11 was SPLIT into 11a-11e** (plan commit `087b342`) after measuring it at 3793 LOC = 6.9x Task 10.
11a ✅ `9d745bc` · 11b ✅ `23a8f84` · 11c ✅ `da41411` · 11d ✅ `9c9b3bf` · 11e ✅ `1795471`+`faca02f` — Task 11
DONE; **Tasks 12-19 + a metadata sweep (Task 18) remain**. Namespaces so far: `common`, `nav`, `auth`,
`marketing`, `dashboard`, `kanji`, `vocab`, `grammar`, `videos`, `dictation`, `shadowing` (11 done).

**⚠ The plan's file lists have now been wrong FOUR times, and 11d's miss crossed MODULES:** translating
the `useRecorder` hook broke 13 tests in `components/conversation/` because `voice-recorder-button.tsx`
consumes it and no list mentioned that. **Grep the IMPORT GRAPH of whatever you translate, not just the
directory you were handed.**
The 2026-07-20 pause is long resolved (the Task 5 draft was verified in place and kept).
**Before resuming, read `mem:l9a_localization_run_state` "▶ Plan 3 EXECUTION IN PROGRESS" FIRST** —
it holds the patterns Tasks 9-19 must follow (two were Critical review findings), the three things
Tasks 6/6b/7/8 settled, the review lesson about mutation-testing pins, the backlog items no task
owns, and the debugging gotchas. Then the SDD ledger `.superpowers/sdd/progress.md` (gitignored;
reconstruct from `git log` if lost), which carries the per-task detail and the carry-forward defects.

**Cadence that is working (keep it):** one fresh implementer subagent per task (sonnet) → an
independent code-review (opus) → one fix wave → controller marks complete. Every task so far needed
exactly one fix wave and every finding was a real defect, not polish. The reviews have been worth
more than the implementations: the three highest-value catches of the run all came from reviewers
and all were invisible to a green test suite (ICU `#` silently reformatting 1234 → "1,234"; no
Vietnamese message ever being ICU-parsed in CI; raw `Error.message` reaching the DOM and making the
translated error string unreachable).
**FIVE STANDING CONVENTIONS, binding for Tasks 12–19 (user-codified after Task 11, 2026-07-22) — full
text in `mem:l9a_localization_run_state` top block "⭐⭐ STANDING CONVENTIONS", put ALL in every implementer
AND reviewer brief:** (1) report mutation in TWO layers — catalog vs wiring — never one number; (2) audit
the IMPORT GRAPH not the folder (translate exported APIs); (3) NEW binding pattern — label↔value PAIRING,
existence assertions insufficient; (4) server-authored diagnostics (`body.error`/`error.message`) NEVER
reach the DOM — Task 12 owns the last instance; (5) Task 19 exit criterion — re-audit `common.player.*`
consumers by surface, demote to `shadowing.*` if still single-surface. The original two below are (1)+(B):
(A) Mutation testing has **two classes** and a review must report **separate survivor counts** for each:
**catalog mutations** (append/prepend, punctuation, ICU placeholders, rich tags → prove the
`messages/en/*.pin.test.ts` literal pins) and **wiring mutations** (swap two `t()` keys, swap the
namespace, point two elements at one key, delete a translated prop → prove the RTL tests, and must run
against the **RTL tests ONLY, pin tests excluded**). At 11c the blended number was 0 survivors while the
RTL-only pass was 5 — the pin tests were masking the gap, and one number cannot show that.
(B) When promoting into `common.*`, **record the actual consumer count, naming the unit** — importing
FILES vs consuming SURFACES differ, and P4 tests MODULES. Measured: `common.player.*` = 3 files but
**1 surface** (demotion candidate); `common.errors.network` = **2 consumers**, NOT the 28-places/8-modules
figure, which counts un-migrated raw English literals (a backlog, not consumers).

**Two ROADMAP additions decided during execution:**
1. **Task 6b (inserted, done)** — `lib/i18n/catalog.test.ts` now parses every message in every
   locale as a real ICU AST instead of matching regexes.
2. **A metadata sweep task (not yet written)** — 25 pages carry `export const metadata` in English;
   the user chose one dedicated task near the end over doing it piecemeal. **Module tasks LEAVE
   metadata in English.**

## ▶ (superseded) NEXT ACTION (2026-07-20, before execution began)
**Style-guide manual pass = ✅ DONE (the debt Plan 2 left). Plan 3 = ✅ WRITTEN, NOT executed.**
Three commits on master: `66ea4b7` (Plan 3 doc), `b4b4fcb` (contrast fix), `300ee94` (style-guide
palette + enforcement). Gates: tsc 0 · **1305/1305 (175 files)** · lint 80 pre-existing warnings,
0 new · build ✓.
**→ NEXT: execute Plan 3** — `docs/superpowers/plans/2026-07-19-l9a-string-extraction-vietnamese.md`
(19 tasks), via `superpowers:subagent-driven-development`. Branch off master as
`layer-9a-string-extraction` per branching policy. **Task 1 first and non-negotiable**:
`test/render.tsx` must serve the real EN catalogs or every later task breaks its own tests.
**Full findings from the style-guide pass — READ `mem:l9a_localization_run_state` before touching
colour tokens.** Headlines: a NEW `--*-strong` text-tone tier now exists (brand `--primary`
deliberately UNCHANGED); 93 sites migrated `text-X` → `text-X-strong`; pitch-contour/waveform
deliberately excluded (their `text-primary` is a CANVAS colour, not text — do not "finish" that
migration); dark-theme elevation measured at 1.005:1 between levels = shadows convey nothing on
ink-950, deferred to L9c as a design fix.
NOTE: remote still has STALE refs `origin/layer-9a-design-system` AND
`origin/layer-9a-localization-architecture` — prune both when pushing (never push unasked).
Local dev: `admin@almostgone.vn` / `styleguide-local-dev-2026` now exists as the bootstrap admin;
creating it signed the user's own `shamt2004@gmail.com` dev session out (just log back in).
CRITICAL gotcha (unchanged, load-bearing): `lib/utils.ts` cn() = `extendTailwindMerge` configured
with every custom token scale — plain twMerge silently STRIPS text-body/text-caption; any new
Tailwind scale must be added there too (`lib/utils.test.ts` guards, now also covering the
`-strong` tones from the opposite direction).
Sau L9a xong cả 3 plan → L9b surfaces (Companion Plans 2/3 + feature UIs + landing + transcript-
submit UI + GDPR delete) → L8 PayOS → L9c polish/perf.

## ⭐ ROADMAP SEQUENCING — decided 2026-07-16 (read before choosing what to build next)
**User launch philosophy (explicit):** still in BUILD phase; publish ONLY after everything is
complete, polished, and fully-featured. There is NO near-term launch, paid-beta, or revenue goal.
This resolves the "L8 vs finish-L9" question decisively:

**Order = finish L9 first, do L8 (billing) near the very end, right before publish:**
1. **L9a — i18n + design system** (foundation; VN-first, replace English shell). Unblocks EVERYTHING
   visual + Companion Plans 2/3. Split into 3 plans: **Plan 1 localization architecture = ✅ DONE,
   MERGED `69f22e6` 2026-07-18** (see block above + `mem:l9a_localization_run_state`); **Plan 2
   design system = ✅ DONE, MERGED `fcd35af` 2026-07-18** (plan doc w/ execution addendum:
   `docs/superpowers/plans/2026-07-18-l9a-design-system.md`); **Plan 3 string extraction
   EN-verbatim + Vietnamese (spec Phase 2/3) — NOT WRITTEN, THE LAST L9a PLAN**. ←
   **NEXT ACTION: see ▶ NEXT ACTION block above (manual style-guide pass, then write Plan 3).**
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
L3 `d6c2138`, L4 `63b965f`, L5 `74514cd`, L6 `3fe741b`, L7 `01ae59d`, Spec A `201a9b4`,
Companion Core `9f09cf2`, L9a-Plan1 `69f22e6`, L9a-Plan2 `fcd35af`.

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
  Radix polyfills (ResizeObserver, pointer capture, scrollIntoView) live in `vitest.setup.ts`.
- **`cn()` + custom Tailwind scales (L9a-Plan2)**: `lib/utils.ts` uses `extendTailwindMerge`
  configured with every custom token scale. Plain twMerge misreads `text-body`/`text-caption`
  as COLOURS and silently strips them. **Any new scale added to tailwind.config.ts MUST also be
  added there** — `lib/utils.test.ts` is the guard. Also: dynamic class names (`shadow-${x}`)
  are never emitted by Tailwind static extraction — use literal maps.
- **Design-system boundaries (L9a-Plan2)**: `@radix-ui/*` imports only in `components/ui/**`
  (ESLint, fire-tested); the `components/ui/**` ESLint override RESTATES the whole
  no-restricted-imports rule minus Radix — editing one copy requires editing both. New ui
  primitives must use CSS logical properties (ps-/pe-/ms-/me-/text-start…) — auto-enforced by
  `components/ui/logical-properties.test.ts`.

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
`npx tsc --noEmit` · `npx vitest run` (**1293 unit / 174 files** @ 2026-07-18 post-L9a-Plan2;
lint = exit 0 WITH 80 pre-existing warnings across 23 files — long-standing debt, "clean" means
0 NEW) · `npm run lint` ·
`npm run build` (~52s) · `npx playwright test` (2 e2e, ~37s; kill any stale node on :3000 first —
reuseExistingServer picks it up) · `npx supabase db reset` (15 migrations).
Known CPU-contention flakes (standalone-green): `pitch-contour.test.tsx`, `waveform.test.tsx`.
Component tests import render from **`@/test/render`** (NextIntlClientProvider, locale="en"). Shared test harness in
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
recommendations not done (unit+build coverage only). From L7: ~~admin dialog focus trap~~ **REPAID in L9a-Plan2** (`components/admin/dialog.tsx` is
now a thin wrapper over `components/ui/dialog.tsx`, Radix focus trap); `stroke_order_svg` stored/rendered as raw SVG (fine while only admins write — needs
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
