# Ask Korume rich answers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ask Korume answers gain `heading` / `list` / `table` blocks (schema v2), a prompt that asks for structure only when the question warrants it, and per-plan depth (free compact, Plus full analysis).

**Architecture:** One v2 zod schema (v1 blocks + 3 new) validates every new answer; v1 rows keep parsing with the untouched v1 schema, chosen by `content_schema_version`. Plan tier picks a depth instruction (second cacheable system block), a block cap and `maxTokens` from config; the reservation uses the tier's `maxTokens`. The SQL `korume_complete_turn` gets the version as a parameter (today it writes a literal `1`).

**Tech Stack:** Next.js 14, zod/v4, Supabase (plpgsql), Vitest + RTL, Playwright, Gemini `responseJsonSchema`.

**Spec:** `docs/superpowers/specs/2026-10-31-ask-korume-rich-answers-design.md`

## Global Constraints

- No Markdown, no HTML, no model-authored links: new blocks are data; React renders escaped text (spec §3).
- v2 bounds: blocks ≤ 32; list items ≤ 12; table columns 2–4, rows ≤ 12, cell runs ≤ 8; heading runs ≤ 8 (spec §4).
- `Run` is v1's: `{ text, strong? } | { jp }`; `jp` runs keep `lang="ja"` styling everywhere.
- `dropInvalidBlocks` semantics unchanged: a bad block is removed, never repaired; nothing left → `min(1)` fails.
- Tier knobs are config, defaults: free 16 blocks / 2 048 tokens, Plus 32 blocks / 4 096 tokens; both use `tier: "deep"`.
- Tokens only (`--space-*`, `text-*` scale, `--success`, `--danger`, `--border`, `--muted`); ✓/✗ never colour alone.
- Old v1 messages render exactly as before (G4). Nothing is migrated.
- Every new `security definer` function: `revoke all … from public, anon, authenticated` (memory: anon EXECUTE default).
- Work only in `.worktrees/ask-korume-rich-answers`; never build or serve in the main checkout.

## Review Focus

1. **Free answer over its cap** (Gemini returns 20 blocks to a free learner) → the learner still gets an answer: blocks are cut to the cap, the trailing `followups` block survives. Pinned in Task 1 (`capBlocks`) and Task 6.
2. **Ragged table** (a row with fewer cells than the header) → still renders; a row is 1–4 cells, not forced equal (a whole table dropped for one short row loses the answer's core). Pinned in Task 1 + Task 7.
3. **Stored v2 row read by the v1 path** (version written wrong) → would silently degrade to plain text. Pinned in Task 5: the store passes `ANSWER_SCHEMA_VERSION`, the migration test asserts the parameter is inserted, `korume.sql` asserts the stored version.
4. **Short question gets four sections** (padding) — prompt rule "length follows the question"; measured live in Task 8 with a one-line question.
5. **Recent-turn context with v2 answers** → `answerToPlainText` output feeds `recent` (clipped 600 chars): list/table lines must be readable text, no JSON. Pinned in Task 1.

---

### Task 1: Answer schema v2

**Files:**
- Modify: `lib/korume/answer.ts`
- Test: `lib/korume/answer.test.ts`

**Interfaces:**
- Produces:
  - `type BlockV1` (today's four-block union), `interface AnswerV1 { blocks: BlockV1[] }` (unchanged meaning).
  - `type Block = BlockV1 | HeadingBlock | ListBlock | TableBlock`, `interface Answer { blocks: Block[] }`.
    - `{ type: "heading"; level: 1 | 2; runs: Run[] }`
    - `{ type: "list"; style: "bullet" | "number" | "check"; items: { mark?: "good" | "bad"; runs: Run[] }[] }`
    - `{ type: "table"; header: Run[][]; rows: Run[][][] }`
  - `ANSWER_SCHEMA_VERSION = 2`, `MAX_ANSWER_BLOCKS = 32`.
  - `answerV1Schema: z.ZodType<AnswerV1>` (unchanged: v1 blocks only, max 12), `answerV2Schema: z.ZodType<Answer>` (max `MAX_ANSWER_BLOCKS`).
  - `capBlocks(answer: Answer, max: number): Answer`
  - `dropUngroundedCards(answer: Answer, …): Answer`, `answerToPlainText(answer: Answer, …): string` (widened from `AnswerV1`; `AnswerV1` is assignable).

- [ ] **Step 1: Write the failing tests** in `answer.test.ts` (new `describe("answerV2Schema")`, `describe("capBlocks")`, extend `answerToPlainText`):
  - `accepts the §7 shape`: heading L1 `[{text:"1. Liệt kê thành phần câu"}]`, a table header `[[{text:"Thành phần"}],[{text:"Tiếng Nhật"}],[{text:"Vai trò"}]]` with 10 rows whose middle cell is `[{jp:"のまま"}]`, a `check` list `[{mark:"bad",runs:[{jp:"間違ったのまま"}]},{mark:"good",runs:[{jp:"間違ったまま"}]}]`, a `number` list, followups → `success === true`, all 5 blocks kept.
  - `drops an out-of-bounds block, keeps the rest`: table with 5 header columns; table with 1 column; list with 13 items; heading `level: 3`; heading with 9 runs; a row with 5 cells; a cell with 9 runs — each beside a valid paragraph → parsed blocks are `["paragraph"]`.
  - `keeps a ragged table` (header 3 columns, one row of 2 cells) → kept.
  - `accepts 32 blocks, refuses 33` (33 valid paragraphs → `success === false`).
  - `rejects unknown keys` on each new block (`{...heading, html:"<b>"}` → dropped).
  - `answerV1Schema still drops heading/list/table` (existing test at :31 keeps passing with a *valid v2* heading too).
  - `still sends Gemini the full block schema`: `z.toJSONSchema(answerV2Schema)` contains all 7 type literals.
  - `capBlocks(answer, 3)` on `[p,p,p,p,followups]` → `[p,p,followups]`; on `[p,p,p,p]` → `[p,p,p]`; on an answer within the cap → same object contents.
  - `answerToPlainText`: heading → its run text; `number` list → `1. a\n2. b`; `bullet` → `- a`; `check` → `✓ a` / `✗ b` (no mark → `- `); table → header line then rows, cells joined with ` | `, runs joined. Blocks still separated by `\n\n`. Asserted output contains no `{`, `<`, `*`, `#`.

- [ ] **Step 2: Run** `npx vitest run lib/korume/answer.test.ts` — Expected: FAIL (`answerV2Schema` not exported).

- [ ] **Step 3: Implement in `lib/korume/answer.ts`.** Split today's `block` into `blockV1` (unchanged entries) and `block` = `z.discriminatedUnion("type", [...blockV1 options, heading, list, table])`; `dropInvalidBlocks(schema)` becomes a factory used by both schemas. Bounds exactly per Global Constraints (row = `z.array(cell).min(1).max(4)`, cell = `z.array(run).min(1).max(8)`, header = `z.array(cell).min(2).max(4)`, rows `.min(1).max(12)`). All objects `.strict()`. `capBlocks`: if `blocks.length <= max` return as is; if the last block is `followups`, return first `max - 1` + that block; else first `max`. Update the doc comment on `answerV1Schema` ("v1 rows only") and on `answerV2Schema` (spec §4 of the rich-answers spec).

- [ ] **Step 4: Run** `npx vitest run lib/korume/answer.test.ts` then `npx tsc --noEmit` — Expected: PASS, tsc clean (callers typed `AnswerV1` still compile; widen `store.ts`/`types.ts` to `Answer` here if tsc requires).

- [ ] **Step 5: Commit** `feat(korume): answer schema v2 — heading, list, table blocks`

---

### Task 2: Live schema probe (gate before building on the shape)

**Files:**
- Create: `scripts/probe-korume-answer.ts`

**Interfaces:**
- Consumes: `answerV2Schema`, `capBlocks` (Task 1); `answerPrompt` (today's signature; Task 4 adds `depth`); `createGeminiProvider` from `lib/ai/providers/gemini.ts`.
- Produces: `npx vite-node --config vitest.config.ts scripts/probe-korume-answer.ts -- [--tier free|plus] [--runs N] [--question "…"] [--line "…"]` printing one line per run: `run i · ok|invalid|error · blocks: <types joined> · out=<outputTokens> · table=<bool> · check=<bool>`, exit 1 if any run is `error` with HTTP 400.

- [ ] **Step 1: Write the script.** Load env with `process.loadEnvFile(".env.local")` (Node stdlib; run from the worktree, whose `.env.local` has the Gemini key). Build the provider with `GEMINI_API_KEY`, `GEMINI_MODEL_FAST`, `GEMINI_MODEL_DEEP`. Defaults: question `"Phân tích câu này giúp mình"`, line `"間違った使い方のまま、間違った発音のまま、間違った文法のまま、そのまま覚えてしまうっていうのが一番良くないんですね。"` (reconstructed from spec §7 — the real line is not in the local DB; say so in the header comment), locale `vi`, empty retrieval/entities. Call `provider.generateStructured({ tier: "deep", system, messages, maxTokens, reasoning: false }, answerV2Schema)`. No DB, no reservation — a probe only.

- [ ] **Step 2: Run once** `… -- --tier plus --runs 1` — Expected: `ok` or `invalid`, **not** a 400. A 400 `INVALID_ARGUMENT` means Gemini refuses the 3-deep table array even with `maxItems` stripped: STOP, report to the owner with the error text, and propose `rows: { cells: Run[][] }[]` (object between array levels) before any later task.

- [ ] **Step 3: Commit** `chore(korume): live answer probe for schema v2` — paste the run line into the commit body.

---

### Task 3: Depth config knobs

**Files:**
- Modify: `lib/knowledge/config.ts`, `.env.local.example` (beside `AI_ASK_KORUME_*_TURNS_PER_DAY`)
- Test: `lib/knowledge/config.test.ts` (create if absent)

**Interfaces:**
- Produces: `KnowledgeConfig.askKorumeAnswer: Record<PlanTier, { maxBlocks: number; maxTokens: number }>` from env `AI_ASK_KORUME_FREE_MAX_BLOCKS` (16), `AI_ASK_KORUME_PLUS_MAX_BLOCKS` (32), `AI_ASK_KORUME_FREE_ANSWER_MAX_TOKENS` (2048), `AI_ASK_KORUME_PLUS_ANSWER_MAX_TOKENS` (4096). Blocks: int 1–`MAX_ANSWER_BLOCKS`; tokens: int 256–8192.

- [ ] **Step 1: Failing tests:** `readKnowledgeConfig({}).askKorumeAnswer` equals `{ free: { maxBlocks: 16, maxTokens: 2048 }, plus: { maxBlocks: 32, maxTokens: 4096 } }`; env strings `"12"`/`"3000"` are coerced; `AI_ASK_KORUME_PLUS_MAX_BLOCKS: "33"` and `AI_ASK_KORUME_FREE_ANSWER_MAX_TOKENS: "0"` throw.
- [ ] **Step 2: Run** `npx vitest run lib/knowledge/config.test.ts` — FAIL.
- [ ] **Step 3: Implement** in `knowledgeEnvSchema` + `readKnowledgeConfig`; add the four commented lines with defaults to `.env.local.example`.
- [ ] **Step 4: Run** the test + `npx vitest run lib/env` — PASS.
- [ ] **Step 5: Commit** `feat(knowledge): Ask Korume answer depth knobs per plan`

---

### Task 4: Prompt — structured depth, length follows the question

**Files:**
- Modify: `lib/korume/prompts.ts`, `scripts/probe-korume-answer.ts` (pass `depth`)
- Test: `lib/korume/prompts.test.ts`

**Interfaces:**
- Consumes: `PlanTier`; `askKorumeAnswer[tier].maxBlocks` (Task 3).
- Produces: `interface AnswerDepth { tier: PlanTier; maxBlocks: number }`; `AnswerPromptInput.depth: AnswerDepth` (required); `answerPrompt` returns `system: [persona, depthBlock]`, both `cacheable: true`; `answerInputBytesUpperBound(depth: AnswerDepth): number` = persona + depth block + `ANSWER_DATA_MAX_BYTES`.

- [ ] **Step 1: Failing tests:**
  - persona (`system[0]`) no longer contains `"concise"`; names all 7 block types; contains `"No HTML, no Markdown"`; contains a rule that answer length follows the question (assert substring `"short question"`).
  - free `system[1]` contains `"answer fully but compactly: what it means, the key grammar, one example"` and `"at most 16 blocks"`; plus `system[1]` contains `"give the full analysis when the question warrants it: components (table), grammar points, common mistakes (✓/✗), practice sentences, follow-ups"` and `"at most 32 blocks"`.
  - `system[0].text` is identical for free and plus (cache key stable).
  - existing upper-bound test updated: `answerInputBytesUpperBound(depth)` equals bytes of both system blocks + `ANSWER_DATA_MAX_BYTES`, for each tier.
- [ ] **Step 2: Run** `npx vitest run lib/korume/prompts.test.ts` — FAIL.
- [ ] **Step 3: Implement.** Persona rewrite (keep every existing safety line verbatim — data-not-instructions, locale, grounding, learner_profile): replace "warm, concise" with "warm"; describe the blocks: `heading` (level 1 = a numbered section, level 2 = a sub-point; put the number in the text), `list` (`bullet` | `number` | `check`, where check items carry `mark: good|bad` for ✓/✗ pairs), `table` (header + rows of cells; use for sentence components), plus today's four; rules: "Match length to the question: a short question gets a short answer (one to three blocks), with no headings. Use headings, lists and tables only when they make a longer answer clearer. followups, if any, come last." Depth block = the spec §6 instruction for the tier + `Use at most ${maxBlocks} blocks.`
- [ ] **Step 4: Run** prompts tests + `npx tsc --noEmit` (turn.ts will now fail to compile — that is Task 6; if tsc must be green per commit, pass a temporary `depth: { tier, maxBlocks: 16 }` in `turn.ts` here and let Task 6 replace it).
- [ ] **Step 5: Commit** `feat(korume): answer prompt asks for structure when warranted, depth by plan`

---

### Task 5: Persist v2 — version parameter end to end

**Files:**
- Create: `supabase/migrations/20261105000052_korume_answer_schema_version.sql`, `supabase/migrations/20261105000052_korume_answer_schema_version.test.ts`
- Modify: `lib/korume/store.ts` (`CompleteTurnArgs`, `completeTurn`), `lib/korume/memory-store.ts`, `lib/korume/messages.ts`, `lib/korume/types.ts` (`answer: Answer | null`), `supabase/tests/korume.sql` (3 calls)
- Test: `lib/korume/messages.test.ts`

**Interfaces:**
- Consumes: `ANSWER_SCHEMA_VERSION`, `answerV1Schema`, `answerV2Schema`, `Answer` (Task 1).
- Produces: `CompleteTurnArgs.contentSchemaVersion: number`, `contentJson: Answer`; SQL `korume_complete_turn(uuid, uuid, uuid, uuid, int, numeric, text, jsonb, jsonb, text, smallint)`; `KorumeMessageView.answer: Answer | null`.

- [ ] **Step 1: Failing tests:**
  - migration test (same `normalized()` helper as `20261003000042_…test.ts`): contains `drop function korume_complete_turn(uuid, uuid, uuid, uuid, int, numeric, text, jsonb, jsonb, text)`; `create function korume_complete_turn(` with `p_content_schema_version smallint`; `values (p_session, 'ai', p_content, p_content_json, p_content_schema_version, p_grounding_json, 1, p_turn)`; the revoke `… from public, anon, authenticated` and grant `… to service_role` on the 11-arg signature; everything else asserted by the old test still present.
  - `messages.test.ts`: version 1 row with a v1 answer → parsed; version 2 row with heading/list/table → parsed with all blocks; version 1 row whose JSON holds a table → `answer` keeps only v1 blocks (v1 schema); version 3 → `answer: null`, `text` kept.
- [ ] **Step 2: Run** `npx vitest run supabase/migrations/20261105000052_korume_answer_schema_version.test.ts lib/korume/messages.test.ts` — FAIL.
- [ ] **Step 3: Implement.** Migration: drop the 10-arg function, re-create it from `20261003000042` with `p_content_schema_version smallint` appended (no default — a caller that forgets it must fail loudly), same body otherwise. `messages.ts`: pick the schema by version (`1 → answerV1Schema`, `ANSWER_SCHEMA_VERSION → answerV2Schema`, else null). `store.ts` passes `p_content_schema_version: args.contentSchemaVersion`. `memory-store.ts` stores it on the row. `korume.sql`: append `, 2::smallint` to the three calls and assert `content_schema_version = 2` on the first stored answer.
- [ ] **Step 4: Run** the two tests, `npx tsc --noEmit`, `npx supabase db reset` is **owner-only** — instead apply with `npx supabase migration up` (local) and run `npm run verify:db:korume` if present, else `powershell -File scripts/verify-korume-gate.ps1` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(korume): store the answer schema version the turn wrote`

---

### Task 6: Turn wiring — tier depth, tier reservation, cap

**Files:**
- Modify: `lib/korume/turn.ts`
- Test: `lib/korume/turn.test.ts`

**Interfaces:**
- Consumes: `config.askKorumeAnswer` (Task 3), `answerPrompt({ …, depth })`, `answerInputBytesUpperBound(depth)` (Task 4), `answerV2Schema`, `capBlocks`, `ANSWER_SCHEMA_VERSION` (Task 1), `contentSchemaVersion` (Task 5).
- Produces: `ANSWER_MAX_TOKENS` export removed (only `turn.ts` used it).

- [ ] **Step 1: Failing tests** (use the existing `fake`/`deps()` harness, provider name `"anthropic"` so cost is non-zero):
  - free turn: the deep request has `maxTokens === 2048` and its system has 2 blocks, the second containing `"at most 16 blocks"`; plus turn: `4096` and `"at most 32 blocks"`.
  - reservation: `knowledge.reservations[0].reservedUsd` for plus equals `upperBoundCostUsdForTier("anthropic","fast",planBytes,512) + upperBoundCostUsdForTier("anthropic","deep",answerInputBytesUpperBound(plusDepth),4096)`; free uses 2048 and is strictly smaller.
  - config override `askKorumeAnswer.free = { maxBlocks: 3, maxTokens: 2048 }` and a fake answer of 5 paragraphs + followups → stored `contentJson.blocks.length === 3`, last is `followups`.
  - a fake answer with a heading + table → `completeTurn` receives `contentSchemaVersion: 2` and the table intact; outcome `message.answer` equals it.
- [ ] **Step 2: Run** `npx vitest run lib/korume/turn.test.ts` — FAIL.
- [ ] **Step 3: Implement.** `const depthCfg = config.askKorumeAnswer[tier]; const depth = { tier, maxBlocks: depthCfg.maxBlocks };` Use `depthCfg.maxTokens` for `answerUpper` and the deep request; schema `answerV2Schema`; `capBlocks(dropUngroundedCards(parsed, grounding), depth.maxBlocks)`; pass `contentSchemaVersion: ANSWER_SCHEMA_VERSION`. Leave `limits.ts` alone: `PROVIDER_TIMEOUT_MS` (60 s) already bounds the longer answer.
- [ ] **Step 4: Run** `npx vitest run lib/korume` + `npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `feat(korume): depth and reservation follow the plan tier`

---

### Task 7: Render heading, list, table

**Files:**
- Modify: `components/korume/answer-blocks.tsx`, `messages/vi/companion.json`, `messages/en/companion.json`
- Create: `components/korume/answer-blocks.test.tsx`

**Interfaces:**
- Consumes: `Answer`, `Block` (Task 1).
- Produces: `AnswerBlocks({ answer: Answer, … })`; i18n keys `ask.mark.good` ("Đúng" / "Correct"), `ask.mark.bad` ("Sai" / "Wrong").

- [ ] **Step 1: Failing tests** (RTL, render inside the repo's i18n test wrapper used by `message-list.test.tsx`):
  - heading level 1 renders a heading element whose text is the runs; a leading numeral (`"1."`, `"①"`) is wrapped in an element with class `text-primary-strong`; level 2 renders smaller (`text-body`) and has no numeral styling requirement.
  - `number` list → `<ol>`, `bullet` → `<ul>`, `check` → `<ul>` where a `bad` item exposes accessible text "Sai" and a `good` item "Đúng" (`getByText` on a visually-hidden label or `aria-label` on the icon with `role="img"`).
  - table → `getAllByRole("columnheader")` has the header texts, each `<th scope="col">`; a `jp` cell run has `lang="ja"`; a ragged row renders without throwing; the table sits inside an element with `overflow-x-auto`.
  - escaping: a run `{ text: "<script>x</script>" }` inside a table cell renders as text (`container.querySelector("script") === null`).
  - a v1 answer (paragraph + example + followups) renders the same DOM as before (snapshot of `container.innerHTML` taken on `master` first, committed with the test).
- [ ] **Step 2: Run** `npx vitest run components/korume/answer-blocks.test.tsx` — FAIL.
- [ ] **Step 3: Implement** the three `case`s per spec §5 (tokens only; table `border-collapse`, `border-border` hairlines, header `bg-muted`, cells `px-sm py-2xs`, `min-w-max` table inside `overflow-x-auto` so it scrolls instead of squeezing). Reuse `RunText`. Check icons from `lucide-react` (already used in `components/`: `Check` / `X`), coloured `text-success` / `text-danger`, plus the label.
- [ ] **Step 4: Run** the new test + `npx vitest run components/korume` + `npm run lint` — PASS.
- [ ] **Step 5: Commit** `feat(korume): render heading, list and table answer blocks`

---

### Task 8: Proof — live, browser, run state

**Files:**
- Modify: `tests/e2e/fixtures/korume-data.ts` (add `richThreadId`: a v2 answer, `content_schema_version: 2`, with a heading, a `check` list and a 3-column table), `tests/e2e/korume-sheet.spec.ts` (one case)
- Create: `docs/superpowers/run-state/ask-korume-rich-answers.md`; append lessons to `docs/lessons.md` if any were learned

- [ ] **Step 1: E2E case** `rich answer renders in both layouts`: open `richThreadId` at 1280×529, assert `columnheader` names, "Sai"/"Đúng" labels, table scrollable (`scrollWidth >= clientWidth`) in the small layout; Enlarge → same assertions in `data-layout="large"`. Run against a worktree build (`next build` + `next start` in the worktree, placeholder Gemini envs in the process env only): `npx playwright test tests/e2e/korume-sheet.spec.ts` — PASS, then mutate (render `table` as `null`) → that case FAILS → restore.
- [ ] **Step 2: Live proof** (spec §8): `probe-korume-answer.ts -- --tier free --runs 3` and `--tier plus --runs 3` on the §7 line, plus `--tier free --runs 1 --question "まま là gì?"` with no line. Record every line in the run state. Pass bar: 0 errors; Plus has `table=true` and `check=true` in each of the 3 runs; the short question has ≤ 3 blocks and no heading. A miss → tune the depth/persona text (Task 4 file) and re-run; do not loosen the bar.
- [ ] **Step 3: Gates:** `npx vitest run --minWorkers=1 --maxWorkers=2`, `npx tsc --noEmit`, `npm run lint`, `npm run verify:protocol` — all green; record counts.
- [ ] **Step 4: Run state** file: range, tasks → commits, live numbers, open items (Plus page wording "phân tích đầy đủ" is the owner's call, spec §6).
- [ ] **Step 5: Commit** `test(korume): rich answer E2E + live proof; run state`
