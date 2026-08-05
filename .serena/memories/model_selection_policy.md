# Model Selection Policy (cross-layer) — Opus 5 default, Fable only for the hardest parts

User-codified 2026-07-23 (Opus 4.8 default); **superseded 2026-07-29 — session default moved to
Opus 5** (`claude-opus-5`), same tier/pricing as Opus 4.8, just the newer model. This governs which
Claude model to run on for the remaining layers (L9b → L8 → L9c), for BOTH the main session and
subagents (the Agent tool's `model` param accepts `opus` / `fable` / `sonnet` / `haiku`).

## The rule
- **Default = Opus 5** (`claude-opus-5`, $5/$25 per 1M — same sticker as Opus 4.8, which it
  replaces as default). State-of-the-art at coding AND has strong design instincts — use it for
  almost everything: React components, Tailwind/CSS, tests, feature UIs, migrations, routine
  agentic builds.
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
  semantic-colour tier, tutorial) → **stay on Opus 5**, no ask needed.

### ⭐ REFINEMENT (user-approved 2026-07-24, after the L9b Companion Presence brainstorm+plan ran on Fable)
**The Fable trigger is the DESIGN/DECOMPOSITION phase, not the BUILD phase — even for a subject the
list above names as "hardest".** Once a plan doc exists with per-task tests, code, commands and
commit messages, the hard reasoning has been *extracted into the plan*; executing those tasks is
Opus work and Fable would be 2× cost for no gain. Worked example: "companion state machine" is
listed as a Fable candidate, but after decomposition Task 1 of
`docs/superpowers/plans/2026-07-24-l9b-companion-presence.md` is a ~30-line pure function with its
transition table and tests already written — no long horizon left. So: run brainstorm + plan-writing
on Fable (after asking), then **drop back to Opus 5 (was Opus 4.8) for execution**, including
subagents. Do not re-litigate this per task in L8/L9c.

## ✅ Money — RESOLVED 2026-08-05 by running `/status` (supersedes the old "$100 credit" caveat)

**Verified facts, not assumptions:**
- **Login method: Claude Pro account** (org `shamt2004@gmail.com's Organization`). Not an API key.
- **Fable is NOT covered by the subscription.** It draws from a separate **"Usage credits"** pool
  that is metered in dollars, even on Pro. Observed: session Fable spend `$6.09` matched the
  Usage-credits line `$6.09 / $50.00 spent` exactly.
- **Pool is $50.00, resets monthly** (next reset Sep 1, Asia/Saigon) — NOT the "$100 one-time"
  figure this memory previously claimed. Treat **$50/month** as the verified number.
- **Opus / Sonnet / Haiku do NOT touch that pool.** They count against the session and weekly
  rate-limit bars instead. So the practical tradeoff is: Fable spends real dollars from a finite
  monthly pool; the others spend rate-limit headroom.

**The old caveat's claim that "a subscription does NOT draw from credits" was WRONG** — corrected
here after direct observation. Do not restore it.

**Cost calibration (real datapoint, 2026-08-05):** one Fable plan-writing pass (Korume Plan B,
~5-task code plan, 29 tool uses, 146k cache write) cost **$6.09 ≈ 12% of the monthly $50 pool**.
Budget roughly 8 Fable plan-writing passes per month at that size. This is the number to reason
with when deciding whether a given brainstorm/decomposition is worth Fable.

## Working-style notes for Fable (if/when used)
- Thinking is always on; a single hard request can run **many minutes** (long turns) — normal, not a hang.
- Keep prompts **goal + constraints**, not step-by-step over-prescription (over-prescriptive prompts
  reduce Fable output quality).
- Safety classifiers (bio/cyber) can refuse — irrelevant to this Japanese-learning app.

## Behavioral commitment (also in ~/.claude auto-loaded memory as a feedback entry)
When one of the "consider Fable" tasks above is about to start, **PAUSE and ASK** the user whether to
switch the model (and, for a subagent, whether to pass `model: "fable"`). Never silently switch, and
never silently proceed on the default for a Fable-candidate task. Roadmap order: L9b → L8 → L9c.

### ⭐ L8 and L9c are pre-decided: Opus throughout, no ask (user, 2026-07-27)
Asked proactively before L9b Task 4 (Companion Presence): neither L8 (PayOS billing) nor L9c (polish +
perf audit) contains anything on the "hardest long-horizon" list (cinematic scroll orchestration,
companion state machine) — they're routine billing integration and a final-UI audit. User chose to
lock this in now rather than re-litigate when we get there: **run Opus (now Opus 5, was Opus 4.8 when
decided) for L8's and L9c's brainstorm, plan-decomposition, AND build — do not stop to ask for either
layer.**
Still-open ask points remain: L9b Plan 3 brainstorm+plan (feature UIs, scope not yet brainstormed),
L9b Plan 4 brainstorm+plan (landing/cinematic + tutorial + Companion Plan 3 — contains the
cinematic-scroll and AI-reflection items from the original hardest-list), and the Character Identity
(Spec 2) brainstorm that precedes Plan 4.

### ⭐ Model-name update (user, 2026-07-29)
Session default switched from Opus 4.8 to **Opus 5** — same price tier, newer model, no policy
change otherwise. Any earlier note in this memory or the SDD ledger that says a decision/build "ran
on Opus 4.8" is a historical record of what actually happened at the time; it does not mean future
work should target 4.8 — the rule above (default = Opus 5) governs going forward.
