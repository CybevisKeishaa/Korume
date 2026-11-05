# Ask Korume answer shape by question kind — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The planner classifies each question as `quick` / `explain` / `analyze`; the answer prompt asks for that kind's floor, ceiling and required elements per plan; the server logs floor misses; Plus gets room (6 144 tokens) for the full §7 shape.

**Architecture:** One constant table `ANSWER_SHAPES[kind][tier]` in `lib/korume/prompts.ts` drives the depth system block. `kind` rides on the existing planner call (`planSchema.kind`, optional; default `explain`). The reservation bound takes the max over kinds because it is computed before the planner runs.

**Tech Stack:** Next.js 14, zod/v4, Vitest, Gemini (live probe).

**Spec:** `docs/superpowers/specs/2026-11-06-ask-korume-answer-shape-design.md`

## Global Constraints

- Floors/ceilings (blocks, followups included): quick free 1–3, quick plus 2–4 (+ one example); explain free ≥ 3 (+ example), explain plus ≥ 5 (+ example + ✓/✗ check list); analyze free ≥ 4 (components table + key grammar, compact), analyze plus ≥ 8 (level-1 numbered section headings, components table, grammar points as level-2 heading + explanation + example, common-mistakes check list, practice sentences as a numbered list, followups). Tier hard caps 16 / 32 still apply.
- Missing/invalid `kind` or failed planner → `explain`.
- A `quick` answer ends with followups whose first chip offers a fuller analysis in the learner's language.
- Persona (`ANSWER_SYSTEM`) stays identical across kinds and tiers; kind/tier text lives only in the depth block.
- No retry on a floor miss. Log exactly: `[korume/answer] kind=<k> tier=<t> blocks=<n> floor=<f> below=<bool>` (`console.info`).
- Plus answer max tokens default 6 144 (env bound unchanged 256–8 192); free 2 048.
- Work only in `.worktrees/ask-korume-answer-depth`; never build/serve in the main checkout.

## Review Focus

1. **Planner returns no `kind`** (older-shaped or partial JSON) → steps still used, kind `explain`. Pinned in Task 1.
2. **Reservation under-reserves** because the bound was taken for one kind but the answer used a longer depth block → bound = max over kinds. Pinned in Task 1 (prompt) and Task 2 (turn).
3. **Short question padded**: the persona sentence "short question … at most three blocks" must move into the `quick` shape, not be duplicated or lost. Pinned in Task 1 (persona no longer contains it; quick depth text does).
4. **Planner failure** → `explain`, the log line still printed. Pinned in Task 2.
5. **A floor miss is not an error**: the turn still answers and charges normally; only the log says `below=true`. Pinned in Task 2.

---

### Task 1: Kind in the planner, shape table in the prompt

**Files:** Modify `lib/korume/plan.ts`, `lib/korume/prompts.ts`; Test `lib/korume/plan.test.ts`, `lib/korume/prompts.test.ts`

**Interfaces — Produces:**
- `type AnswerKind = "quick" | "explain" | "analyze"`, `ANSWER_KINDS` (readonly tuple), `planKind(raw: { kind?: AnswerKind }): AnswerKind` in `plan.ts`; `planSchema` gains `kind: z.enum(ANSWER_KINDS).optional()`.
- `interface AnswerDepth { tier: PlanTier; kind: AnswerKind; maxBlocks: number }` (adds `kind`).
- `ANSWER_SHAPES: Record<AnswerKind, Record<PlanTier, { min: number; max: number | null; elements: string }>>` exported from `prompts.ts` (`max: null` = only the tier cap). Values per Global Constraints; `elements` is the English instruction text for that cell.
- `answerFloor(kind, tier): number` (= `ANSWER_SHAPES[kind][tier].min`).
- `answerInputBytesUpperBound(tier: PlanTier, maxBlocks: number): number` = max over the 3 kinds of (persona + depth block bytes) + `ANSWER_DATA_MAX_BYTES`.

- [ ] **Step 1: Failing tests**
  - plan.test: `planSchema` parses `{ steps: [], kind: "analyze" }` and `{ steps: [] }`; refuses `kind: "deep"`; `planKind({ steps: [] })` → `"explain"`, `planKind({ steps: [], kind: "quick" })` → `"quick"`.
  - prompts.test: planner system text contains `"quick"`, `"explain"`, `"analyze"` and the instruction to return `kind`. For each kind × tier, `answerPrompt(...).system[1].text` contains `at least ${min} blocks` (and `at most ${max} blocks` when `max` is set, else `at most ${maxBlocks} blocks`) and that cell's `elements` text; Plus analyze text contains "level-1", "table", "check list", "numbered list"; quick text (both tiers) contains the fuller-analysis first-chip rule. `system[0].text` identical across all 6 combinations and no longer contains `"a short question about one word"`. `answerInputBytesUpperBound("plus", 32)` ≥ bytes of every kind's system blocks + `ANSWER_DATA_MAX_BYTES`, and equals the max.
- [ ] **Step 2: Run** `npx vitest run lib/korume/plan.test.ts lib/korume/prompts.test.ts` — FAIL.
- [ ] **Step 3: Implement.** Planner text: one line per kind with the spec §2 examples, "Also return kind". Depth block: `For this learner, ${DEPTH_INSTRUCTION[tier]}. This question is ${kind}: use at least ${min} blocks and at most ${max ?? maxBlocks} blocks. ${elements}` (exact wording may differ; tests pin the substrings above). Remove the "short question" sentence from the persona (its rule now lives in quick). Update callers to keep tsc green: `turn.ts` passes `kind: "explain"` temporarily and calls the new bound signature; `scripts/probe-korume-answer.ts` passes `kind` (Task 3 reworks it).
- [ ] **Step 4: Run** the two test files, `npx vitest run lib/korume`, `npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `feat(korume): planner classifies the question; answer shape per kind and plan`

### Task 2: Turn wiring, log line, Plus token default

**Files:** Modify `lib/korume/turn.ts`, `lib/knowledge/config.ts`, `.env.local.example`; Test `lib/korume/turn.test.ts`, `lib/knowledge/config.test.ts`

**Interfaces — Consumes:** `planKind`, `AnswerKind`, `answerFloor`, `answerInputBytesUpperBound(tier, maxBlocks)` (Task 1).

- [ ] **Step 1: Failing tests**
  - planner returns `{ steps: [], kind: "analyze" }` → the deep request's `system[1]` contains the plus/free analyze floor text; planner throws → contains the explain text.
  - reservation: `answerUpper` uses `answerInputBytesUpperBound(tier, maxBlocks)` (assert `reservedUsd` recomputed from it, as the existing tier test does).
  - log: spy `console.info`; a plus analyze answer with 5 blocks logs exactly `[korume/answer] kind=analyze tier=plus blocks=5 floor=8 below=true`; a free quick answer with 2 blocks logs `… floor=1 below=false`; outcome is `answered` in both (a floor miss is not a failure).
  - config: default Plus max tokens 6144 (update the existing `toEqual`s and the turn test asserting 4096).
- [ ] **Step 2: Run** `npx vitest run lib/korume/turn.test.ts lib/knowledge/config.test.ts` — FAIL.
- [ ] **Step 3: Implement.** `let kind: AnswerKind = "explain"`; set from `planKind(plan.parsed)` in the planner's success branch; `depth = { tier, kind, maxBlocks }` built after the planner (the bound before it uses the max over kinds); log after the `usable` check, before `completeTurn`. Config default 6144; `.env.local.example` comment updated.
- [ ] **Step 4: Run** `npx vitest run lib/korume lib/knowledge`, `npx tsc --noEmit`, `npm run lint` — PASS.
- [ ] **Step 5: Commit** `feat(korume): answer shape follows the planner's kind; log floor misses; Plus 6144 tokens`

### Task 3: Live proof through planner → answer; run state

**Files:** Modify `scripts/probe-korume-answer.ts`; Create `docs/superpowers/run-state/ask-korume-answer-shape.md`

- [ ] **Step 1: Probe runs like a turn.** For each run: call the planner (`plannerPrompt`, `planSchema`, tier `fast`, 512 tokens) → `kind = planKind(...)` (planner error → `explain`) → answer with `depth { tier, kind, maxBlocks }` and the tier's maxTokens. `--line ""` means no anchor (anchor `null` in both prompts). Print: `run i · kind=<k> · ok|invalid|error · blocks: <types> · n=<count> · out=<tokens>/<max> · h1=<level-1 heading count> · table · check · numbered · followups`.
- [ ] **Step 2: Live matrix** (spec §5): 3 questions × free/plus × 2 runs. Pass bar per run as spec §5. Miss → tune planner/shape text in `prompts.ts` (re-run its tests), max 3 tuning rounds, never loosen the bar. Record every line.
- [ ] **Step 3: Gates:** full `npx vitest run --minWorkers=1 --maxWorkers=2`, `npx tsc --noEmit`, `npm run lint`, `npm run verify:protocol`.
- [ ] **Step 4: Run state** (shape of `docs/superpowers/run-state/ask-korume-rich-answers.md`): commits, live lines, rulings, open items.
- [ ] **Step 5: Commit** `test(korume): live proof of answer shapes by kind; run state`
