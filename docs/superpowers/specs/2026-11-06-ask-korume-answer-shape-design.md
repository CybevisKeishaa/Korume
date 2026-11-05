# Ask Korume — answer shape by question kind (floors + caps)

- Date: 2026-11-06 · Status: **approved by the owner in chat** ("Đồng ý, làm đi" to the proposal below).
- Builds on [2026-10-31-ask-korume-rich-answers-design.md](2026-10-31-ask-korume-rich-answers-design.md) (schema v2,
  depth by plan). Nothing in that spec's schema, storage or rendering changes.

## 1. Why

After rich answers shipped (master `6fe29c57`), live Plus answers to a whole-sentence analysis were 3–5 blocks,
~550–700 output tokens: a table and a ✓/✗ list, no sections, no grammar points, no practice — far from the owner's §7
reference. The depth instruction says "when the question warrants it" and the persona says "no padding", so the model
always picks the short shape. The owner wants a **minimum** for both plans, without padding a question that only needs
a short answer.

## 2. Decision (owner-approved)

1. **Three question kinds**, each with its own floor and ceiling per plan:

   | Kind | Examples | Free | Plus |
   |---|---|---|---|
   | `quick` | meaning of a word, yes/no, how to read | 1–3 blocks | 2–4 blocks, includes one example |
   | `explain` | one grammar point, A vs B | ≥ 3 blocks, includes an example | ≥ 5 blocks, includes an example and a ✓/✗ list |
   | `analyze` | "analyse this sentence" | ≥ 4 blocks: components table + key grammar (rich-answers §7 sections 1–2, compact) | ≥ 8 blocks: the full §7 shape |

   Counts include the `followups` block. The plan's hard cap (`askKorumeAnswer[tier].maxBlocks`, 16 / 32) still bounds
   every answer.
2. **Required elements, not only counts** (a 10-row table is one block):
   - Plus `analyze`: level-1 numbered section headings; a components table; grammar points, each a level-2 heading
     with a short explanation and an example; a common-mistakes check list (✓/✗); practice sentences as a numbered
     list; followups.
   - Free `analyze`: a components table and the key grammar points, compact; no practice section required.
3. **The planner classifies.** The planner call that already runs every turn returns `kind` beside `steps`; no extra
   call. A missing or invalid `kind`, or a failed planner, means `explain` (the middle shape).
4. **Floors are asked for, not enforced by retry.** The answer prompt states the kind's floor, ceiling and required
   elements. The server never re-asks the model (double cost, double wait). It logs one line per answered turn —
   `[korume/answer] kind=<k> tier=<t> blocks=<n> floor=<f> below=<bool>` — so the owner can see how often floors miss.
5. **A way to go deeper.** A `quick` answer always ends with a followups block whose first chip offers a fuller
   analysis in the learner's language (e.g. "Phân tích chi tiết hơn"); the learner asks for depth with one tap.
6. **Plus token ceiling** rises from 4 096 to **6 144** by default (the full §7 shape in Vietnamese approaches 4 096 and a
   cut-off JSON answer fails the turn). Still an env knob (`AI_ASK_KORUME_PLUS_ANSWER_MAX_TOKENS`, bound 256–8 192).
   Free stays 2 048.

## 3. Non-goals

- No change to schema v2, storage, rendering, quotas, or retrieval tools.
- No server-side padding or rewriting of answers; no retry on a floor miss.
- No env vars for the floor table: it is one constant in code (`ANSWER_SHAPES`), edited in one place. (YAGNI — the
  existing per-plan caps stay env knobs.)

## 4. Shape of the change

- `lib/korume/plan.ts`: `AnswerKind = "quick" | "explain" | "analyze"`; `planSchema` gains `kind` (optional in the
  schema so an older-shaped plan still yields its steps); `planKind(raw): AnswerKind` returns `explain` when absent.
- `lib/korume/prompts.ts`: planner system text gains the classification rule (one line per kind with the examples
  above). The answer's depth block becomes the tier instruction **plus** the kind's floor/ceiling/elements from
  `ANSWER_SHAPES[kind][tier]`; the persona stays tier- and kind-independent (cache key). The persona's current
  "short question … at most three blocks" sentence moves into the `quick` shape (it is a kind rule now).
- Reservation: the answer's input bound is taken **before** the planner runs, so `answerInputBytesUpperBound(tier,
  maxBlocks)` is the maximum over the three kinds' depth blocks.
- `lib/korume/turn.ts`: kind from the plan (or `explain`), passed to the answer prompt; the log line after a usable
  answer.
- `lib/knowledge/config.ts`: Plus answer max tokens default 6 144.

## 5. Proof

- Unit: planner schema accepts each kind and a plan without `kind`; `planKind` defaults; depth text carries the floor,
  ceiling and elements per kind × tier; the persona is identical across kinds and tiers; the upper bound covers the
  longest kind; the turn passes the planner's kind (and `explain` when the planner fails) and logs the line.
- **Live** (Gemini, the probe runs planner → answer like a real turn, no DB): three questions × free/plus × 2 runs —
  "まま nghĩa là gì?" (no line) → `quick`; "まま và ながら khác nhau thế nào?" (no line) → `explain`; the §7 line +
  "Phân tích câu này giúp mình" → `analyze`. Pass bar per run: the planner's kind is the expected one; the block count
  is within the kind × tier range; Plus `explain` has an example and a check list; Plus `analyze` has ≥ 3 level-1
  headings, a table, a check list and a numbered list; every `quick` answer ends with followups; no error; output
  tokens < 90 % of the tier's max. A miss → tune the shape/planner text, never the bar.
