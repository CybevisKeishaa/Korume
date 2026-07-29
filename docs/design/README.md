# docs/design/ — How To Read These Documents

> **Status:** Approved

---

## What This Folder Is

This folder captures **product taste, design philosophy, and creative direction** — the feel we
want Nihongo Cinema to gradually evolve toward. These documents are closer to a **shared design
language** than a specification.

## What This Folder Is Not

- Not a source of mandatory implementation requirements, feature specs, or fixed UI copy.
- Not a substitute for `CLAUDE.md`, `japanese-learning-app-spec.md`, `MASCOT.md`, or any
  `docs/superpowers/specs/*` design doc — those govern implementation; these govern taste.
- Not frozen. Every document here is a living document, expected to be revised.

## The Governing Principle

> **Documentation follows reality. Reality does not follow documentation.**

These documents should **inspire decisions, not dictate them**. They are references for tone,
pacing, storytelling, motion, interaction, and emotional direction — and they intentionally leave
room for iteration based on real implementation and user behavior.

Whenever reality and a document disagree, reality wins, in this order:

1. Real user behavior
2. Implementation discoveries
3. Technical constraints
4. Product experiments

Then the document is updated to reflect reality — never the other way around.

## Concrete Examples Are Illustrative, Not Mandatory

Several documents here (`nihongo_page_playbook.md`, `landing-storyboard.md`, and the Learning
Beats / Learning Wrapped / Audio Commute ideas referenced from
`docs/product/2026-07-ai-learning-experience-roadmap.md`) contain concrete example copy and
sequences — "Beat 2/5", "Chapter 1: You already love Japanese", specific Companion lines, exact
hero flows.

**These communicate intent and tone. They are not fixed UI requirements.** When implementation
happens, the real UI, real content, and real user behavior decide the final shape — not the
example written down here.

## The Same Principle Applies to `docs/reference/GRAND_PLAYBOOK.md`

That document reuses **craft** — storytelling, visual rhythm, motion language, composition,
cinematic pacing, transition ideas, interaction patterns — distilled from a different project.
It never carries over that project's product decisions, technology stack, or domain content.
Whenever something there conflicts with Nihongo Cinema's philosophy, architecture, specs, or
actual stack, discard that part.

We reuse experience, not products.

## Where Each Document Fits

- `design-language.md` — how the interface should feel, overall.
- `emotion-design.md` — the emotional trajectory of using the product over time.
- `interaction-principles.md` — how interactions should feel, generally.
- `motion-principles.md` / `motion-system.md` — motion philosophy and timing.
- `ai-behavior-guidelines.md` — how AI/Companion should behave (not how it looks).
- `ai-writing-principles.md` / `microcopy-guidelines.md` — how AI and the product write to the
  user (each file's own Scope section defines the split between them).
- `PLAYBOOK.md` / `landing-storyboard.md` / `nihongo_page_playbook.md` — landing page design
  principles, narrative structure, and execution guide, respectively (each file's own Scope
  section defines the split between them).

If a document's own Scope section and this README ever disagree about its boundaries, the
document's own Scope section wins for that file — this README is the folder-level frame, not a
per-file override.
