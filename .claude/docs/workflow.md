# Agent Workflow — Nihongo Cinema

How the sub-agents collaborate. Read this together with `CLAUDE.md`.

---

## 1. Roles at a glance

| Agent | Owns | Never does |
|---|---|---|
| `tech-lead` | Architecture, layer planning, decomposition, scaffolding, final integration | Deep single-module implementation better suited to a specialist |
| `frontend-engineer` | Next.js pages/components, Tailwind, responsive, a11y, adaptive furigana, mining UI | Heavy scroll animation (→ motion), server/DB logic |
| `motion-engineer` | GSAP/ScrollTrigger/Lenis/Framer, stroke-order, particle highlight, pitch contour render | Business logic, data fetching |
| `backend-engineer` | API routes, SRS (SM-2), i+1 difficulty engine, rate-limiting, validation | Schema/migrations (→ database), UI |
| `database-engineer` | Postgres/Supabase schema, migrations, RLS, indexes, seeds | Application/UI code |
| `ai-engineer` | Claude wrapper, prompts, pronunciation + pitch (F0) scoring, voice mode, quotas | UI rendering, schema |
| `test-engineer` | Test strategy, Jest/RTL/Vitest/Playwright, coverage, TDD harnesses | Shipping features without tests |
| `code-reviewer` | Reviewing diffs vs CLAUDE.md, security, a11y, correctness | Writing/editing code (review only) |

---

## 2. Routing rules

1. **Single-role task** → hand directly to that specialist.
2. **Cross-role task** → `tech-lead` decomposes into ordered sub-tasks and names the owner of each.
3. **Data flows down**: `database-engineer` defines schema → `backend-engineer` builds APIs on it
   → `frontend-engineer`/`motion-engineer` consume the APIs. Don't build UI against a schema that
   doesn't exist yet — sequence it.
4. **AI features** always pair with `backend-engineer` for the endpoint + rate-limit and, when
   visual, with `motion-engineer` (e.g. pitch contour).
5. **Every non-trivial change** ends with `code-reviewer` before it is called done.
6. **Tests come first** — `test-engineer` sets the pattern; each specialist writes tests for their
   own code (TDD). Do not defer testing to the end.

---

## 3. Build order (the 8 layers)

This is NOT an MVP cut — all 8 layers together are the finished product. Build one layer per
session so each is testable before the next depends on it. Use `/build-layer <n>`.

- **Layer 1 — Foundation**: **Migrate CRA → Next.js 14 App Router + TS + Tailwind**, full DB
  schema (all spec §4 tables), Auth, main layout, shared design system + shared motion components.
  _Lead: `tech-lead` → `database-engineer`, `frontend`, `motion`._
- **Layer 2 — Static content**: Kanji + Vocab + Grammar modules + **SRS engine (SM-2)**.
  Independent of video, so SRS logic can be tested in isolation.
  _Lead: `backend-engineer` (SRS) + `frontend` + `database`._
- **Layer 3 — Video / Shadowing (core, hardest)**: YouTube import → transcript pipeline →
  synced player → shadowing recording + waveform → **pitch accent contour** → dictation →
  **sentence mining** → **adaptive furigana**.
  _Lead: `frontend` + `backend` + `ai` (pitch) + `motion`._
- **Layer 4 — AI features**: pronunciation scoring, conversation chatbot, **voice mode**,
  video summaries, example-sentence generation.
  _Lead: `ai-engineer` + `backend`._
- **Layer 5 — JLPT test engine + Reading module**. _Lead: `backend` + `frontend`._
- **Layer 6 — Gamification + Notifications** (XP, streak, badges, SRS-due reminders).
  Includes **i+1 recommendation** surfacing. _Lead: `backend` + `frontend`._
- **Layer 7 — Community + Admin CMS**. _Lead: `frontend` + `backend` + `database`._
- **Layer 8 — Billing/Stripe + site-wide animation polish + performance audit**.
  _Lead: `tech-lead` + `motion` + `backend`._

Feed ONE layer per working session. Broader scope degrades code quality.

---

## 4. Handoff protocol

When an agent finishes its slice it reports back with:
1. **What changed** (files + one-line why).
2. **Contracts exposed** for the next agent (API shape, types, component props, table columns).
3. **What's verified** (commands run + result) and what's still open.
4. **Next owner** and the exact remaining task.

`tech-lead` keeps the thread coherent and calls `code-reviewer` before marking a layer done.

---

## 5. Definition of Done

Inherited from `CLAUDE.md` §9. A layer is "done" only when every module in it meets that
checklist AND `code-reviewer` has signed off on the integrated diff.

---

## 6. Branching & merge policy

**One branch per layer; merge to `master` when the layer is done.**

1. At the start of a layer, create a branch named `layer-<n>-<slug>` (e.g. `layer-2-static-content`)
   off the current `master`. Do all of that layer's work there.
2. A layer is merged **only after** it meets the Definition of Done (§5) — tests passing with
   shown output AND `code-reviewer` sign-off.
3. Merge with `git merge --no-ff` so each layer stays a single visible unit in history.
4. Do **not** push to any remote unless the user explicitly asks (per `CLAUDE.md` git rules).
5. Layer history so far: Layer 1 → merged (`1d1628e`); Layer 2 → merged (`618e1a4`);
   Layer 3 → merged (`d6c2138`); Layer 4 → merged (`63b965f`); Layer 5 → merged (`74514cd`);
   Layer 6 → merged (`3fe741b`); Layer 7 → merged (`01ae59d`) — community (forum, public
   playlists, peer review, weekly opt-in leaderboard) + admin CMS. Friends leaderboard
   deferred until a real social graph exists (product decision, `business-model.md` §1.1 G2).
