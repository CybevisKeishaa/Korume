# Agent Workflow — Korume

How the specialized Codex agents collaborate. Read this together with `AGENTS.md`.

---

## 1. Roles at a glance

| Agent | Owns | Never does |
| --- | --- | --- |
| `tech-lead` | Architecture, layer planning, decomposition, scaffolding, final integration | Deep single-module implementation better suited to a specialist |
| `frontend-engineer` | Next.js pages/components, Tailwind, responsive, a11y, adaptive furigana, mining UI | Heavy scroll animation (→ motion), server/DB logic |
| `motion-engineer` | GSAP/ScrollTrigger/Lenis/Framer, stroke-order, particle highlight, pitch contour render | Business logic, data fetching |
| `backend-engineer` | API routes, SRS (SM-2), i+1 difficulty engine, rate-limiting, validation | Schema/migrations (→ database), UI |
| `database-engineer` | Postgres/Supabase schema, migrations, RLS, indexes, seeds | Application/UI code |
| `ai-engineer` | Provider-agnostic AI wrapper, prompts, pronunciation + pitch (F0) scoring, voice mode, quotas | UI rendering, schema |
| `test-engineer` | Test strategy, Vitest/Playwright, coverage, TDD harnesses | Shipping features without tests |
| `code-reviewer` | Reviewing diffs against AGENTS.md, security, a11y, correctness | Writing/editing code (review only) |

## 2. Routing rules

1. **Single-role task** → hand directly to that specialist.
2. **Cross-role task** → `tech-lead` decomposes it into ordered sub-tasks and names the owner of each.
3. **Data flows down**: `database-engineer` defines schema → `backend-engineer` builds APIs on it → `frontend-engineer`/`motion-engineer` consume the APIs. Do not build UI against a schema that does not exist yet.
4. **AI features** pair with `backend-engineer` for the endpoint + rate limit and, when visual, with `motion-engineer` (for example, pitch contour).
5. **Every non-trivial change** ends with `code-reviewer` before it is called done.
6. **Tests come first**: `test-engineer` sets the pattern; each specialist writes tests for their own code. Do not defer testing to the end.

## 3. Build order (the 8 layers)

This is not an MVP cut — all eight layers together are the finished product. Build one layer per session so each is testable before the next depends on it. Use `/build-layer <n>`.

- **Layer 1 — Foundation**: Next.js 14 App Router + TypeScript + Tailwind, full database schema, auth, main layout, shared design system and motion components. _Lead: `tech-lead` → `database-engineer`, `frontend-engineer`, `motion-engineer`._
- **Layer 2 — Static content**: Kanji, vocab, grammar, and SRS engine (SM-2). _Lead: `backend-engineer` + `frontend-engineer` + `database-engineer`._
- **Layer 3 — Video / Shadowing**: YouTube import, transcript pipeline, synced player, recording + waveform, pitch accent, dictation, sentence mining, and adaptive furigana. _Lead: `frontend-engineer` + `backend-engineer` + `ai-engineer` + `motion-engineer`._
- **Layer 4 — AI features**: pronunciation scoring, conversation chatbot, voice mode, video summaries, and example-sentence generation. _Lead: `ai-engineer` + `backend-engineer`._
- **Layer 5 — JLPT test engine + Reading module**. _Lead: `backend-engineer` + `frontend-engineer`._
- **Layer 6 — Gamification + Notifications**, including i+1 recommendation surfacing. _Lead: `backend-engineer` + `frontend-engineer`._
- **Layer 7 — Community + Admin CMS**. _Lead: `frontend-engineer` + `backend-engineer` + `database-engineer`._
- **Layer 8 — Billing (PayOS, no trial), site-wide animation polish, and performance audit**. _Lead: `tech-lead` + `motion-engineer` + `backend-engineer`._

Do not pull work forward from later layers.

## 4. Handoff protocol

When an agent finishes its slice it reports:

1. What changed (files and why).
2. Contracts exposed for the next agent (API shape, types, component props, or table columns).
3. What is verified (commands and results) and what remains open.
4. The next owner and exact remaining task.

The `tech-lead` keeps the thread coherent and calls `code-reviewer` before marking a layer done.

## 5. Long-task protocol

For a multi-task branch, the coordinator creates and maintains exactly one `docs/superpowers/run-state/<branch>.md`. Before dispatching or resuming, read `AGENTS.md`, `docs/lessons.md`, that run state, the cited task-plan section, and the direct dependency graph only. Checkpoint after every accepted task and before a new owner, review/fix round, user decision, or external verification.

The run state contains current branch facts, not a task transcript. The plan records intended work, Git records changed work, and `docs/lessons.md` records durable process learning.

## 6. Definition of Done

The Definition of Done in AGENTS.md applies to every task. A layer is done only when every module meets it, evidence is recorded, and `code-reviewer` has signed off on the integrated diff.

## 7. Branching and merge policy

Use one branch per layer and merge to `master` only after its Definition of Done is met. Use `git merge --no-ff` so each layer remains a visible unit in history. Do not push to a remote unless the user explicitly asks.
