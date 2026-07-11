# CLAUDE.md — Nihongo Cinema

> Root rules for this repository. Every agent and every session MUST read and obey this file.
> Source of truth for the product is `japanese-learning-app-spec.md` (in the parent folder).

---

## 1. What we are building

**Nihongo Cinema** — a web app for learning Japanese through video (shadowing / dictation),
kanji, vocab, grammar, and JLPT prep, with a cinematic / scroll-driven UI as its signature.
The core differentiator is the **video shadowing** experience plus a small set of features
almost no competitor ships well (see §5).

---

## 2. Non-negotiable rules (violating these is a defect, no exceptions)

1. **Never download, re-host, or proxy video** from YouTube or any platform. Video ALWAYS
   plays through the official YouTube IFrame Player API. The server stores only: video ID,
   metadata, transcripts/captions, and user learning data. No `youtube-dl`, `ytdl`, or any
   downloader — ever.
2. **User voice recordings belong to the user.** Not public by default, encrypted at rest,
   never used to train models without explicit consent. Provide full "delete all my data"
   (GDPR-friendly — we target EU users).
3. **All study content is original** (kanji, vocab, grammar, JLPT items). Never copy text
   verbatim from other sites. Licensed/open sources must be checked and attributed.
4. **Animation serves UX, never blocks learning.** Ship a global `prefers-reduced-motion`
   toggle. No heavy autoplay animation during repeated study loops.
5. **Accessibility is a requirement, not a nice-to-have.** WCAG AA contrast, full keyboard
   navigation across every learning flow.
6. **Security & privacy**: rate-limit all AI-scoring endpoints (quota abuse), sanitize and
   validate user-submitted transcripts against XSS, encrypt voice recordings at rest.

If a task appears to require breaking one of these, STOP and surface it to the user.

---

## 3. Tech stack (target — per spec)

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Animation**: GSAP + ScrollTrigger, Lenis (smooth scroll), Framer Motion (micro-interactions)
- **Backend**: Next.js API Routes (start here; extract to NestJS only if scale demands)
- **Database**: PostgreSQL via Supabase (Auth + Storage included) or Neon
- **Auth**: Supabase Auth / NextAuth.js (email + Google OAuth)
- **Audio**: Web Audio API (client waveform + pitch/rhythm compare)
- **Pronunciation**: Azure Speech Pronunciation Assessment (JA); Google STT fallback
- **AI**: Anthropic Claude API (conversation, summaries, example sentences, review hints)
- **SRS**: self-built SM-2, state per (user, item)
- **Storage**: Supabase Storage / S3 — recordings & avatars only, NEVER video
- **Deploy**: Vercel (app + API), Supabase/Neon (DB)
- **Payments**: Stripe subscriptions (7-day trial)

> ⚠️ **Current repo state**: this repo is still a Create React App (`react-scripts`, React 19).
> The target is Next.js 14. Migration is handled deliberately in **Layer 1** by `tech-lead` —
> do not silently mix CRA and Next patterns. Confirm the migration step before scaffolding.

---

## 4. Directory structure (target)

```
/app
  /(marketing)   /(auth)   /(app)   /(admin)
/api             (auth, kanji, vocab, grammar, videos, shadowing, dictation,
                  pronunciation, jlpt, srs, community, admin, conversation, pitch)
/lib             (srs-engine, youtube, speech-scoring, ai, pitch, difficulty)
/components       (motion, learning, video-player)
```

Full module list, DB schema, and API endpoints live in the spec (§2, §4, §5). Follow them.

---

## 5. Product priorities — the features that win users

Beyond the base spec, these approved differentiators target the real pain points of Japanese
learners. Treat them as first-class, not add-ons:

1. **Pitch accent visualization** (差別化 #1) — extract F0 pitch contour from reference audio
   and the user's recording, overlay them, and score intonation. Lives inside the shadowing
   flow. Owners: `ai-engineer` (F0/scoring) + `motion-engineer` (contour rendering).
2. **i+1 comprehensible-input recommendation** — the retention engine. Score each video by
   the % of words the user already knows (from SRS data) and recommend content at the right
   difficulty. Owner: `backend-engineer` (`/lib/difficulty`).
3. **Sentence mining from video** — tap a transcript line → auto-build an SRS card with a
   frame screenshot + trimmed audio clip + sentence + target word. Owners: `frontend` + `backend`.
4. **Adaptive furigana** — show furigana ONLY for words the user hasn't mastered; fade as
   they learn. Not a hard on/off toggle. Owner: `frontend-engineer`.
5. **Voice conversation mode** — STT (user speaks) → Claude reply → TTS, with live
   pronunciation scoring. Extends the text chatbot. Owner: `ai-engineer`.
6. **Colloquial / keigo / counters / onomatopoeia micro-modules** — fill the textbook gaps
   (〜ちゃう, 敬語, 助数詞, オノマトペ). Extend the grammar module. Owner: `backend` + content.

---

## 6. Coding conventions

- **TypeScript strict**. No `any` unless justified with a comment. Prefer explicit types on
  public function signatures and API boundaries.
- **Server/client boundary**: keep secrets and third-party API calls server-side only. Never
  expose API keys to the client. All external keys via env vars.
- **Validation**: validate every API input (zod or equivalent). Sanitize all user-generated
  content before render.
- **Naming**: files `kebab-case`, React components `PascalCase`, hooks `useXxx`, DB tables
  and columns `snake_case` (per spec schema).
- **Small units**: one clear purpose per file/module; extract when a file grows past ~300 lines
  or takes on a second responsibility.
- **No dead code / no TODO left behind** in merged work.

---

## 7. Testing — TDD is the default

Write the failing test first, then the implementation. Every feature and bugfix ships with
tests. Never claim something works without running the relevant command and seeing it pass.
- Unit/integration: the framework configured in the repo (Jest + RTL today; Vitest/Playwright
  as we move to Next.js — decided in Layer 1).
- The SRS engine and pitch/difficulty logic MUST have deterministic unit tests.

---

## 8. The agent system

Specialized sub-agents live in `.claude/agents/`. Coordination rules and the layer-by-layer
build plan live in `.claude/docs/workflow.md`. Reusable procedures are slash commands in
`.claude/commands/`.

**Roster (role-based):**
`tech-lead` · `frontend-engineer` · `motion-engineer` · `backend-engineer` ·
`database-engineer` · `ai-engineer` · `test-engineer` · `code-reviewer`

**Golden rule of routing:** pick the agent whose single responsibility matches the task. When
a task spans roles, `tech-lead` decomposes it and sequences the specialists. See `workflow.md`.

---

## 9. Definition of Done (applies to every task)

- [ ] Meets the spec + the §2 non-negotiables + §5 priorities where relevant
- [ ] TypeScript strict passes, lint clean
- [ ] Tests written first and passing (command output shown, not assumed)
- [ ] a11y: keyboard-navigable, WCAG AA, respects reduced-motion
- [ ] No secrets client-side; inputs validated; user content sanitized
- [ ] `code-reviewer` has reviewed the diff for anything non-trivial
