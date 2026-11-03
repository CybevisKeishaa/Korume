# Ask Korume — rich, structured answers; depth by plan

- Date: 2026-10-31 · Status: **approved by the owner (options B + C), deferred** (practice-listening ships first).
- Builds on [2026-10-03-ask-korume-design.md](2026-10-03-ask-korume-design.md) §6.1 (answer = typed blocks, never
  HTML/Markdown). Companion to [2026-10-31-ask-korume-resizable-sheet-design.md](2026-10-31-ask-korume-resizable-sheet-design.md)
  (the larger sheet is what makes long answers readable; either can ship first).

## 1. Why

The owner compared a Korume answer with the answer they want (§7, a real Vietnamese analysis of
`間違った使い方のまま、…一番良くないんですね。`): numbered sections, a component **table**, numbered grammar points,
**✗ / ✓** mistake lists, practice sentences, then follow-up offers. Korume's answers are shorter and flatter, for
three reasons in the code (2026-10-31):

1. `ANSWER_SYSTEM` (`lib/korume/prompts.ts`) asks for *"a warm, concise"* answer.
2. Caps: `answerV1Schema` max **12 blocks**; `ANSWER_MAX_TOKENS = 2_048` (`lib/korume/turn.ts`). Live runs used
   ~700–900 output tokens.
3. **No block can carry the structure**: v1 has only `paragraph`, `example`, `context_card`, `followups`. No heading,
   list or table — which is also why Gemini kept inventing block types (blocks were dropped, see `b8740a02`).

And Plus vs free differ **only in quantity** today (10 vs 100 turns/day, Plus spends credits): same model, same
prompt, same length.

## 2. Goals

- G1 **Answer schema v2** with three new typed blocks — `heading`, `list`, `table` — rendered as escaped text.
- G2 A prompt that asks for **structured depth** when the question warrants it (sentence analysis, grammar point,
  comparison), and stays short for a short question ("what does X mean?").
- G3 **Depth by plan**: free gets a solid, mid-length answer; Plus gets the full analysis of §7.
- G4 Old v1 messages keep rendering exactly as before.

## 3. Non-goals / anti-goals

- No Markdown, no HTML, no model-authored links — the §6.1 rule stands; new blocks are data, the UI renders them.
- No padding: length must follow the question. A one-line question answered with four sections is a failure.
- No change to retrieval, grounding, quotas or the planner.
- Not a paywall on correctness: free answers stay correct and complete for what was asked; Plus adds depth
  (more sections, mistakes, practice), not truth.

## 4. Schema v2 (decided shape; builder may tune bounds)

`ANSWER_SCHEMA_VERSION = 2`; `answerV2Schema` = v1's four blocks unchanged **plus**:

```ts
| { type: "heading"; level: 1 | 2; runs: Run[] }                       // "1. Liệt kê thành phần câu"
| { type: "list"; style: "bullet" | "number" | "check"; items: { mark?: "good" | "bad"; runs: Run[] }[] }
                                                                        // check-style renders ✓ / ✗ from `mark`
| { type: "table"; header: Run[][]; rows: Run[][][] }                   // cells are runs → `jp` runs keep JP styling
```

- `Run` is v1's (`{ text, strong? } | { jp }`), so Japanese inside a heading, list item or cell gets the same
  `lang="ja"` styling as in paragraphs.
- Bounds (all enforced by zod; Gemini's `responseJsonSchema` still strips every `maxItems` — nested arrays 400 —
  see `lib/ai/providers/gemini.ts`): blocks ≤ **32**; list items ≤ 12; table columns 2–4, rows ≤ 12, cell runs ≤ 8;
  heading runs ≤ 8. A table is a 3-deep nested array: verify Gemini accepts the stripped schema live before
  building on it (the 2026-10-04 nested-`maxItems` 400 is the precedent).
- `dropInvalidBlocks` (already in `answer.ts`) applies unchanged: a malformed table is dropped, the answer survives.
- Storage: `conversation_messages.content_schema_version` already exists — write 2 for new answers. `messages.ts`
  reads v1 with `answerV1Schema` and v2 with `answerV2Schema`; nothing is migrated.
- `answerToPlainText` learns the new blocks (heading → its text; list → one line per item with `- ` / `n. ` / ✓ ✗;
  table → `cell | cell` lines). No markup in the stored text either.

## 5. Rendering

`components/korume/answer-blocks.tsx` gains three cases, tokens only (the resizable-sheet spec §6 rules):

- `heading`: level 1 = section title (`text-body-lg`, semibold, ember numeral if the text starts with one);
  level 2 = sub-point (`text-body`, semibold). Spacing from `--space-*`.
- `list`: semantic `<ul>`/`<ol>`; `check` style renders a ✓ (`--success`) or ✗ (`--danger`) icon per item
  with an accessible label ("Đúng" / "Sai"), never colour alone.
- `table`: a real `<table>` with `<th scope="col">`; hairline `--border` rules, `--muted` header row; inside a
  horizontal scroller (the quiet Korume scrollbar) when the sheet is narrow — never squeezed below readable.
- Long answers: the small sheet still works (scroll); the large layout of the resizable-sheet spec is where they
  read best. No "show more" collapse in this spec (builder may propose one if real answers prove too long).

## 6. Depth by plan

Plan tier is already resolved per turn (`getActivePlanTier` in `turn.ts`). Pass it to the answer stage:

| | Free | Plus |
|---|---|---|
| Prompt depth instruction | "answer fully but compactly: what it means, the key grammar, one example" | "give the full analysis when the question warrants it: components (table), grammar points, common mistakes (✓/✗), practice sentences, follow-ups" |
| Max blocks | 16 | 32 |
| `maxTokens` (answer) | 2 048 | 4 096 |
| Model | `GEMINI_MODEL_DEEP` | `GEMINI_MODEL_DEEP` (a separate `…_PLUS` model is a config option, not required) |

- Every number above is **config**, next to the existing knobs in `lib/knowledge/config.ts`
  (`AI_ASK_KORUME_FREE_…` / `…_PLUS_…`, defaults as in the table), not literals.
- The reservation upper bound (`answerUpper` via `upperBoundCostUsdForTier`) must use the **tier's** `maxTokens`,
  so a Plus turn reserves enough credits and a free turn is not over-reserved.
- The free/plus difference is in the instruction and caps only; the schema is the same v2 for both (a free answer
  may still contain a small list or table when that is the clearest form).
- Owner-facing copy: the Plus page / upsell may say Plus answers are "phân tích đầy đủ" — wording for the owner.

## 7. Reference answer (owner, 2026-10-31)

The owner pasted this as the target — structure, not text, is the spec. Sections:
**Phân tích câu quan trọng** (the sentence + translation) → **1. Liệt kê thành phần câu** (table: Thành phần /
Tiếng Nhật / Vai trò, 10 rows; then the general pattern
`[Aのまま、Bのまま、Cのまま、] + そのまま + [mệnh đề] + っていうのが + 一番良くない + んですね`) →
**2. Điểm ngữ pháp cần chú ý** (①〜のまま ②反復 ③〜てしまう ④〜っていうの ⑤一番+adj ⑥んですね, each with form,
nuance, example) → **3. Lỗi thường gặp** (✗/✓ pairs: 間違ったのまま→間違ったまま; まま vs ながら; てしまう ≠ only
"finished"; 一番良くない ≠ "not the best"; っていう in formal writing; missing の) → **4. Câu luyện tập** (3
sentences) → follow-up offers. That is the Plus target; free is roughly sections 1–2 compacted.

## 8. Proof

- Unit: v2 schema accepts §7's shape and rejects markup/overflow; v1 rows still parse; plain-text rendering.
- **Live** (green units missed both Gemini schema failures so far — the 2026-10-04 nested `maxItems` 400 and the
  2026-10-31 invented block / 41-char chip): run the §7
  question against the real Gemini model for a free and a Plus learner, 3 runs each, record block types, output
  tokens and validity; Plus must produce a table and a ✓/✗ list at least once per run on that sentence.
- Browser: table and lists render in both sheet layouts at 1280×529; screen reader reads table headers and ✓/✗ labels.

## 9. Files known to be involved

`lib/korume/answer.ts` (+ test), `lib/korume/messages.ts`, `lib/korume/prompts.ts` (+ test), `lib/korume/turn.ts`
(+ test), `lib/knowledge/config.ts`, `components/korume/answer-blocks.tsx` (+ a new `answer-blocks.test.tsx`; none exists yet), `messages/{vi,en}/companion.json`
(✓/✗ labels).
