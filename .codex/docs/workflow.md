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

Between two harnesses a handoff has one more requirement: `npm run verify:protocol` must exit 0 before the `- Owner:` line changes. See §8.

## 5. Long-task protocol

For a multi-task branch, the coordinator creates and maintains exactly one `docs/superpowers/run-state/<branch>.md`. Before dispatching or resuming, read `AGENTS.md`, `docs/lessons.md`, that run state, the cited task-plan section, and the direct dependency graph only. Checkpoint after every accepted task and before a new owner, review/fix round, user decision, or external verification.

The run state contains current branch facts, not a task transcript. The plan records intended work, Git records changed work, and `docs/lessons.md` records durable process learning.

## 6. Definition of Done

The Definition of Done in AGENTS.md applies to every task. A layer is done only when every module meets it, evidence is recorded, and `code-reviewer` has signed off on the integrated diff.

## 7. Branching and merge policy

Use one branch per layer and merge to `master` only after its Definition of Done is met. Use `git merge --no-ff` so each layer remains a visible unit in history. Do not push to a remote unless the user explicitly asks.

## 8. Two-harness protocol

Two agent runtimes work this repository. Authority is split by kind of work, not by file type.

| | Claude Code | Codex |
| --- | --- | --- |
| Owns | Architecture, specs, plans, task packets, whole-branch review, merge | Implementation, per-task `code-reviewer`, run-state checkpoints |
| Works in | The main worktree on `master` | `.worktrees/<branch>` |
| Writes | `AGENTS.md`, `.codex/**`, `.claude/**`, `docs/superpowers/specs/**`, `.superpowers/sdd/**`, `docs/lessons.md`, and `docs/superpowers/run-state/<branch>.md` while it owns that branch | Product source and tests, and `docs/superpowers/run-state/<its branch>.md` while it owns that branch |
| Never | Edits code during review | Edits the instruction layer |

**Instruction layer.** `.codex/` is the only home of role, routing and procedure content. `.claude/` is a runtime adapter: Claude Code cannot load `.toml` role definitions and needs its own frontmatter to route a subagent, so each of its files is a stub that names its canonical counterpart. A stub holds no fact of its own.

`npm run verify:protocol` enforces that by **enumerating both trees**, never by consulting a list of names — a rule that walks a hardcoded list cannot see the new file that is exactly how content comes back. Every file under `.claude/agents`, `.claude/commands` and `.claude/docs` must have a canonical counterpart and vice versa; each stub is capped at 25 lines **and** 4096 bytes, must name its counterpart, and must carry the same `description` (and `argument-hint`, where the canonical procedure takes an argument) as that counterpart, compared character for character.

What that does **not** cover: prose inside a stub, under both caps, is bounded but not compared. The guard makes silent drift of the routed fields impossible; it does not make a badly written stub impossible.

**Ownership.** One worktree has exactly one writer at a time. The run state records it on a single `- Owner: Claude|Codex` line, and a handoff is the commit that changes that line. There is no implicit handoff. Reading another worktree is always allowed; writing into one you do not own is a defect.

**Task lifecycle.**

1. Claude creates the branch and its worktree, writes the spec, plan and task packets there, and sets `- Owner: Codex`.
2. Codex reads `AGENTS.md`, `docs/lessons.md`, this file, the run state and its packet, then implements under TDD, reviewing and checkpointing each accepted task.
3. Codex sets `- Owner: Claude` when the branch is ready. That line is the only handoff signal; neither side infers readiness.
4. Claude reviews the whole branch from `git diff master...<branch>` in the main worktree — no checkout, no edits — and returns findings to Codex, who fixes them.
5. Claude records lessons, merges with `git merge --no-ff`, and removes the worktree.

**Gate.** `npm run verify:protocol` must exit 0 before any owner change and before merge. A red protocol blocks the handoff, not just the merge.

Specs and plans live on the feature branch from the moment they are written. `master` receives only completed, reviewed work.
