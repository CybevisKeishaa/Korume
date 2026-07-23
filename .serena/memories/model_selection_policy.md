# Model Selection Policy (cross-layer) — Opus 4.8 default, Fable only for the hardest parts

User-codified 2026-07-23. Session default set to **Opus 4.8** (`/model`). This governs which
Claude model to run on for the remaining layers (L9b → L8 → L9c), for BOTH the main session and
subagents (the Agent tool's `model` param accepts `opus` / `fable` / `sonnet` / `haiku`).

## The rule
- **Default = Opus 4.8** (`claude-opus-4-8`, $5/$25 per 1M). It is state-of-the-art at coding AND
  has strong design instincts — use it for almost everything: React components, Tailwind/CSS,
  tests, feature UIs, migrations, routine agentic builds.
- **Fable 5** (`claude-fable-5`, **$10/$50 = 2× Opus**) — Anthropic's most capable model, for the
  hardest reasoning + **long-horizon autonomous** work. Reserve it for genuinely frontier-hard,
  long-running tasks. Do NOT run routine implementation on Fable — it burns ~2× cost with little
  quality gain on component/CSS/test work.
- Sonnet 5 / Haiku 4.5: not needed by default. (Haiku only if a truly trivial, cost-sensitive
  batch subtask ever comes up.)

## When to CONSIDER Fable (and therefore STOP + ASK — see feedback below)
- A **layer brainstorm** (e.g. L9b brainstorm).
- **Plan decomposition** — writing a layer's plan docs (like L9a's Plan 1/2/3).
- The **hardest long-horizon builds** specifically: cinematic scroll orchestration
  (GSAP/ScrollTrigger landing), the companion (mascot) state machine / read-time journal logic.
- Everything else in L9b (feature UIs, GDPR delete-my-data, transcript-submit UI, restyle via the
  semantic-colour tier, tutorial) → **stay on Opus 4.8**, no ask needed.

## ⚠ Money caveat — verify before assuming Fable is "free"
User has **$100 free Fable credit**. It only offsets cost if Claude Code bills through the SAME
API account/key that holds the credit. If Claude Code runs on a **subscription (Max/Pro)**, it does
NOT draw from API credits — the $100 is spent via API/Console instead, not via these layers. At the
$10/$50 Fable rate, $100 does not go far across a multi-plan layer. Confirm the billing path before
treating Fable work as covered.

## Working-style notes for Fable (if/when used)
- Thinking is always on; a single hard request can run **many minutes** (long turns) — normal, not a hang.
- Keep prompts **goal + constraints**, not step-by-step over-prescription (over-prescriptive prompts
  reduce Fable output quality).
- Safety classifiers (bio/cyber) can refuse — irrelevant to this Japanese-learning app.

## Behavioral commitment (also in ~/.claude auto-loaded memory as a feedback entry)
When one of the "consider Fable" tasks above is about to start, **PAUSE and ASK** the user whether to
switch the model (and, for a subagent, whether to pass `model: "fable"`). Never silently switch, and
never silently proceed on the default for a Fable-candidate task. Roadmap order: L9b → L8 → L9c.
