# Nihongo Cinema — Project Status

Read this first each session. Product spec: `../japanese-learning-app-spec.md`; root rules:
`CLAUDE.md`; agent workflow + 8-layer order + branching policy: `.claude/docs/workflow.md`.

## What this is
Learn Japanese through video shadowing/dictation + kanji/vocab/grammar/JLPT, cinematic UI.
8 layers, one per session; all 8 = finished product. Use `/build-layer <n>`.

## Stack
Next.js **14.2.35** App Router + TS strict + Tailwind. React **18.3.1**. Supabase
(Postgres + Auth + Storage) via `@supabase/ssr`. Zod. Motion: Lenis + Framer + GSAP.
Tests: Vitest+RTL (unit), Playwright (`tests/e2e`). Staying on **Next 14** (revisit L8; don't
silently bump — see `nextjs-14-pin-decision`).

## Branching policy (user-set)
One branch per layer `layer-<n>-<slug>` off master; merge `--no-ff` ONLY after DoD (tests pass +
code-reviewer sign-off); never push unless asked. History: L1 `1d1628e`, L2 `618e1a4`.

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
  video/transcript write policies (owner-only, column-scoped `duration_seconds` grant — fixes a
  self-approval/vandalism hole L1 left). UI: `/videos` (import+list), `/videos/[id]/shadowing`
  (IFrame sync, A–B loop, speed, adaptive furigana 3-state, tap-to-mine), `/videos/[id]/dictation`,
  `/mining` (deck+SM-2 review, timestamp-replay). Pitch contour + waveform in recorder panel.
  **331 unit tests**, code-reviewer APPROVED (no Blockers/Majors).
- **Layers 4–8: NOT STARTED.** Next = **Layer 4 — AI features**: pronunciation scoring (Azure),
  conversation chatbot, voice mode, video summaries, example-sentence generation. Also finishes
  the deferred pitch **scoring/overlay** (needs TTS reference or accent data — Layer 3 only
  visualizes the user's own F0; seam documented in `lib/pitch/f0.ts`). Populates
  `shadowing_sessions.{pronunciation_score,rhythm_score,pitch_score}` (all null after L3). Start:
  `git checkout master`, branch `layer-4-ai-features`.

## Key gotchas learned
- **Table GRANTs**: migration-created tables do NOT inherit Supabase default grants → queries as
  `authenticated` failed with 42501 until `20260712000006_grants.sql`. Any NEW table in future
  migrations needs RLS enabled (default-privileges now auto-grant DML to authenticated, so a table
  without RLS = open hole — enable RLS on every new table).
- Content is versioned reference data → lives in MIGRATIONS (not seed.sql) so `db push` deploys it.
- **RLS gates ROWS, not columns.** L1 gave videos/transcripts SELECT-only policies → all writes
  broke; the fix (mig 9) also had to prevent self-approval/cross-user edits. Pattern used:
  `revoke update on <t> from authenticated` then `grant update (<col>) to authenticated` +
  owner-only row policy. **Layer 7 admin approval MUST use the service-role client** (authenticated
  now has zero UPDATE on videos.status/title/etc.).
- **§2 & YouTube audio**: you CANNOT extract/compare YouTube source audio (forbidden) and the
  cross-origin iframe audio is inaccessible via Web Audio → pitch/waveform visualize the USER's
  own mic recording only; any "vs reference" scoring needs TTS/accent data (Layer 4).
- **Sentence mining stores NO media** (§2): card = text + `{video_id,start,end}`; replay by
  seeking the IFrame player. Server derives sentence/timestamps from the line (never trust client).

## DB / running locally
Local Supabase (Docker) is the dev DB; `.env.local` points at it. `npm run dev` →
localhost:3000 (register/login/study/review all work). Studio :54323. `npx supabase stop` to
halt; `npx supabase db reset` re-applies migrations. Cloud move (still not done): create free
project → swap 4 `.env.local` values → `supabase link` + `supabase db push`; add Google OAuth
creds in dashboard.

## Verify commands
`npx tsc --noEmit` · `npm test` (331 unit) · `npm run build` · `npx playwright test` (2 e2e) ·
`npx supabase db reset` (9 migrations). Shared test harness for Layer-3 browser features in
`test/` (`@/test/*`): media mocks, YouTube IFrame stub, tone-buffer + transcript/URL fixtures.

## Deferred follow-ups
From L1: GDPR delete-my-data; getUser() in middleware on all routes (perf); conditional
aria-describedby; users_update_own email/level column scope. From L2: content migration header
says "safe on re-run" but ALTER ADD CONSTRAINT throws on literal re-run (harmless under migration
tooling); `unique(word, reading)` won't dedupe reading-less vocab (NULLs distinct) — matters when
admin CMS adds entries; add CI guard asserting RLS enabled on all public tables. From L3
(code-reviewer nits, all non-blocking): adaptive furigana matches surface-string against mastery
map → homograph false-hide + should use `Object.hasOwn` (not `in`); mine popover lacks
outside-click dismiss + swaps aria live-region role; furigana/speed `radiogroup`s lack roving
tabindex/arrow keys; mining allows duplicate cards (no dedup); `lib/rate-limit` map is unbounded
(dev-only → Redis in L8); `VideoRow` type duplicated (`lib/data/videos.ts` vs `lib/video-types.ts`,
`as unknown as` casts); no Supabase-backed integration tests for data-layer routes yet; difficulty
scorer re-tokenizes per request (cache when L6 surfaces it at list volume).

## Working agreements
TDD-first, tests shown passing. code-reviewer signs off every non-trivial change before "done".
Data flows down schema→API→UI. Never download/proxy video (YouTube IFrame only). Commit only
when asked; branch-per-layer + merge-to-master-when-done.
