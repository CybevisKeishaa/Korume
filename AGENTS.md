# AGENTS.md — Korume

> Root rules for this repository. Every agent and every session MUST read and obey this file.
> Source of truth for the product is `japanese-learning-app-spec.md` (repo root, version-controlled
> since 2026-07-16 — it used to live in the parent folder, outside git).

---

## 1. What we are building

**Korume** — a web app for learning Japanese through video (shadowing / dictation),
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
- **Pronunciation**: Azure Speech Pronunciation Assessment (JA), selected by `SPEECH_PROVIDER`
- **AI**: **provider-agnostic** — application code speaks the port (`lib/ai/port.ts`), never an SDK.
  Adapters live in `lib/ai/providers/` (Anthropic = production; Gemini = **dev only**, its free tier
  trains on submitted data so real user data must never reach it — §2). A lint rule forbids importing
  a provider SDK anywhere else. Selection is explicit via `AI_PROVIDER`/`SPEECH_PROVIDER`/`APP_ENV`,
  **never inferred from which keys exist**; `none` = intentionally off (503), unset/invalid = startup
  failure. See `docs/superpowers/specs/2026-07-15-ai-provider-abstraction-design.md`.
- **SRS**: self-built SM-2, state per (user, item)
- **Storage**: Supabase Storage / S3 — recordings & avatars only, NEVER video
- **Deploy**: self-hosted at **almostgone.vn** (single long-running Node instance; NOT Vercel) + Supabase/Neon (DB)
- **Payments**: **PayOS** subscriptions, **no trial** (Stripe/7-day-trial superseded — see `docs/product/business-model.md`; conversion = Contextual Discovery)

> ✅ **Current repo state** (2026-07-16): the stack above is what actually runs — Next.js 14 App
> Router, React 18, TypeScript strict, Tailwind, Vitest + Playwright. The CRA migration was
> completed in Layer 1; Layers 1–7 are merged. Only **Layer 8** (PayOS billing, animation polish,
> performance audit) remains — see `.codex/docs/workflow.md` §3.

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
5. **Voice conversation mode** — STT (user speaks) → Codex reply → TTS, with live
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
- **One fact, one home.** If a fact would live in two places, make one derive from the other or
  delete one — "both, kept in sync by hand" is a defect, not a trade-off. (Promoted from
  `docs/lessons.md` L-026, which keeps the evidence.)

---

## 7. Testing — TDD is the default

Write the failing test first, then the implementation. Every feature and bugfix ships with
tests. Never claim something works without running the relevant command and seeing it pass.
- Unit/integration: the framework configured in the repo (Jest + RTL today; Vitest/Playwright
  as we move to Next.js — decided in Layer 1).
- The SRS engine and pitch/difficulty logic MUST have deterministic unit tests.

**A guard or invariant test written over code that already exists cannot fail first — mutation-check
it instead:** break the thing it guards, watch it go red, restore, and report both outputs. And any
assertion whose subject is a **collection gathered by a pattern** must additionally assert that the
collection is non-empty and of the size you expect — otherwise an empty match makes it
unconditionally green. (Promoted from `docs/lessons.md` L-004, which keeps the evidence.)

---

## 8. The agent system

Specialized sub-agents live in `.codex/agents/`. Coordination rules and the layer-by-layer
build plan live in `.codex/docs/workflow.md`. Reusable procedures are slash commands in
`.codex/commands/`.

**Roster (role-based):**
`tech-lead` · `frontend-engineer` · `motion-engineer` · `backend-engineer` ·
`database-engineer` · `ai-engineer` · `test-engineer` · `code-reviewer`

**Golden rule of routing:** pick the agent whose single responsibility matches the task. When
a task spans roles, `tech-lead` decomposes it and sequences the specialists. See `workflow.md`.

**Long-task rule:** every multi-task branch has one
`docs/superpowers/run-state/<branch>.md`; before dispatching or resuming, read it before the
cited task-plan section and its direct dependency graph.

---

## 9. Definition of Done (applies to every task)

- [ ] Meets the spec + the §2 non-negotiables + §5 priorities where relevant
- [ ] TypeScript strict passes, lint clean
- [ ] Tests written first and passing (command output shown, not assumed)
- [ ] a11y: keyboard-navigable, WCAG AA, respects reduced-motion
- [ ] No secrets client-side; inputs validated; user content sanitized
- [ ] `code-reviewer` has reviewed the diff for anything non-trivial, **and a whole-branch review has
      run before merge** — even when every task was already reviewed on its own (`docs/lessons.md` L-011)
- [ ] Lessons from this work recorded in `docs/lessons.md` per its four lesson-entry rules — merged
      into an existing entry where one applies, not appended as a new one

---

## 10. Operational lessons

`docs/lessons.md` is the single source of truth for lessons this project has already paid for.
Every lesson lives there once, under a stable `L-NNN` id. Everywhere else references the id;
nothing restates the rule.

**Read it before:** writing a spec or a plan · dispatching a subagent · running a completion
gate or claiming work done · reading back a subagent's or a reviewer's report.

**Write to it at the end of every branch** — in place of a "lessons" block anywhere else.

AGENTS.md holds **law**: breaking a rule here is a defect. `docs/lessons.md` holds **experience**:
ignoring it costs time. A lesson promoted to law moves here and leaves a pointer behind.
