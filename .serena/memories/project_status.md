# Nihongo Cinema — Project Status

Read this first each session. Product spec: `../japanese-learning-app-spec.md`; root rules:
`CLAUDE.md`; agent workflow + 8-layer order + branching policy: `.claude/docs/workflow.md`.

## What this is
Learn Japanese through video shadowing/dictation + kanji/vocab/grammar/JLPT, cinematic UI.
8 layers, one per session; all 8 = finished product. Use `/build-layer <n>`.

## Stack
Next.js **14.2.35** App Router + TS strict + Tailwind. React **18.3.1**. Supabase
(Postgres + Auth + Storage) via `@supabase/ssr`. Zod. Motion: Lenis + Framer + GSAP.
AI: `@anthropic-ai/sdk` 0.111.0. Tests: Vitest+RTL (unit), Playwright (`tests/e2e`). Staying on
**Next 14** (revisit L8; don't silently bump — see `nextjs-14-pin-decision`).

## Branching policy (user-set)
One branch per layer `layer-<n>-<slug>` off master; merge `--no-ff` ONLY after DoD (tests pass +
code-reviewer sign-off); never push unless asked. History: L1 `1d1628e`, L2 `618e1a4`,
L3 `d6c2138`, L4 `63b965f`.

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
    point degrades to a clean 503 "not configured" result when keys are absent (they ARE absent:
    only `ANTHROPIC_API_KEY` is configured; Azure paths are latent).
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
- **Layers 5–8: NOT STARTED.** Next = **Layer 5 — JLPT test engine + Reading module**
  (lead: backend + frontend). Start: `git checkout master`, branch `layer-5-<slug>`.

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
- jsdom quirks: Blob has no `arrayBuffer()` (use `@/test/blob-utils` `readBlobBytes` /
  `lib/audio/read-blob.ts`), no Web Audio (use `@/test/audio-context-mock`), no canvas 2D.

## DB / running locally
Local Supabase (Docker) is the dev DB; `.env.local` points at it. Docker Desktop must be running
(`npx supabase start`). `npm run dev` → localhost:3000. Studio :54323. `npx supabase db reset`
re-applies migrations (now 10). Cloud move (still not done): create free project → swap 4
`.env.local` values → `supabase link` + `supabase db push`; add Google OAuth creds in dashboard.
Env keys: `ANTHROPIC_API_KEY` set; `AZURE_SPEECH_KEY`/`AZURE_SPEECH_REGION` empty (features
degrade to 503 by design).

## Verify commands
`npx tsc --noEmit` · `npm test` (**533 unit**) · `npm run lint` · `npm run build` ·
`npx playwright test` (2 e2e) · `npx supabase db reset` (10 migrations). Shared test harness in
`test/` (`@/test/*`): media mocks, YouTube IFrame stub, Claude + Azure Speech + AudioContext
mocks, tone-buffer/transcript/URL fixtures, blob utils.

## Deferred follow-ups
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
(candidate for L7 admin tools).

## Working agreements
TDD-first, tests shown passing. code-reviewer signs off every non-trivial change before "done".
Data flows down schema→API→UI. Never download/proxy video (YouTube IFrame only). Commit only
when asked; branch-per-layer + merge-to-master-when-done.
