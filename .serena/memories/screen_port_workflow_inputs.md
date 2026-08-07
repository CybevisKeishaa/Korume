# Screen-port workflow — inputs (captured 2026-08-07)

> ✅ **SPEC WRITTEN AND EXECUTED.** Spec
> `docs/superpowers/specs/2026-08-07-screen-port-workflow-design.md`, plan
> `docs/superpowers/plans/2026-08-07-screen-port-workflow.md`, merged `--no-ff` at **`7277ac1`**
> (2026-08-07). **`mem:project_status` is the authority for what shipped and for the rules it
> established** — read that, not this file, before porting anything.
>
> What this file still adds: the user's own reasoning, which the spec compressed. Steps 3 and 4 of
> the sequence below are DONE (primitive verification + chrome architecture); steps 5 and 6 (port
> screens by group, polish) are not. The four screen types and the five-step per-screen checklist
> below are still the working method. The `AppShell` idea was resolved: it became App Router route
> groups — `(protected)` for session lifetime, `(app)`/`(focus)`/`(immersive)` for chrome — so there
> is no parallel layout API, exactly as the user required. The orange-glow ruling is also closed:
> fixed upstream in `figma-prompt-style.md` at `fc33e90`, since the glow never reached the repo.

**Status:** the spec this file fed is written, executed and merged.

The user proposed this workflow in conversation on 2026-08-06. The token spec
(`docs/superpowers/specs/2026-08-06-figma-make-token-typography-adoption-design.md` §1.1) recorded
only the four governing *principles* and deliberately deferred the mechanism. **The detail below
exists nowhere else** — do not make the user re-derive it.

## Sequence the user set (their own ordering, and their reasoning)

1. Chốt token dark Korume ← ✅ done, `86328bc`
2. Chốt font có tiếng Việt ← ✅ done, `86328bc`
3. **Verify the 8 `components/ui/**` primitives against the new tokens** ← next
4. **Layout primitives + shared shell / AppNav** ← next
5. Port screens by group
6. Polish

**Rationale, in their words: Token → Component → Layout primitives → Pages, NOT screen-by-screen.**
Once tokens and shared primitives are right, most of the 29 screens reduce to layout work. Porting
screen-first would re-litigate the same button/card/badge decisions 29 times.

## Four screen types (their classification — every Figma frame lands in exactly one)

| Type | Korume examples | Treatment |
|---|---|---|
| **App page** | Kanji Library, Pronunciation Library, FAQ | Standard shell + nav |
| **Immersive page** | Companion Diary, onboarding, lesson focus | No navbar, or minimal chrome |
| **Workspace** | Dictation, Shadowing Practice, Pronunciation Studio | Own layout, panels, complex state |
| **Overlay / component** | Kanji Inspector, Create Conversation | Dialog/drawer/component — NOT a route unless it must be |

Their worked examples: Companion Diary is immersive → no navbar is *correct*, not an omission. The
Figma sidebar should be ported ONCE into the real AppNav, never re-imported per screen. A Figma modal
must not become a standalone page.

## Their 5-step per-screen checklist

- **A. Screen contract** — before coding, know five things: route · type (of the four above) ·
  navigation · data · interactions. No long spec needed if Figma is already clear.
- **B. Read the Figma frame** as visual truth (see the ⚠️ below about NOT committing exports).
- **C. Reuse check** — only three questions: does it need AppNav? does a component already exist
  (button/card/dialog/section heading)? is a genuinely new token needed? If no → create no abstraction.
- **D. Write the production screen** using tokens + shared components + real state.
- **E. Four checks before done** — desktop fidelity vs Figma · mobile doesn't break · interactions
  really work · no hardcoded colour/font where a token exists.

## Their `AppShell` idea, and the constraint on it

Proposed: `<AppShell navigation="app" | "none" | "focus">` so Diary stays quiet, workspaces get
minimal chrome, and the sidebar isn't copied into every screen.

⚠️ **The user themself ruled that this must NOT become a parallel layout API.** It has to be
reconciled with, or implemented as an upgrade to, what already exists:
- `docs/design/screens/navigation-system.md` (the governance doc)
- the Nav Column visibility toggle shipped in `44521bc`
- App Router's own route/layout hierarchy

## Three corrections the user accepted as binding constraints

These came from checking their proposal against the actual repo, and they endorsed all three:

1. **Do not import the Vite/`src/` structure.** This repo is Next.js App Router — `app/[locale]/(app)/…/page.tsx`, `components/`, `lib/` at the root. There is **no `src/`**, and **App Router already treats a route as a screen**, so a parallel `src/app/screens/` layer would duplicate a concept the framework provides and fight 35 live routes.
2. **Never commit Figma exports/snapshots as source.** They are read, compared against, and ported — never canonical code, never in the runtime, never dead weight in the repo (CLAUDE.md §6). Canonical pair = *live Figma file* ↔ *running route*. (Tier C of the bundle is 4000+-line import junk; see `mem:figma_make_design_source`.)
3. **No parallel `AppShell` contract** — see the constraint above.

## Related open item

The **orange glow** `shadow-[0_0_12px_#FF8A3D]` (3 uses in the design) contradicts the Design DNA's
own "No neon" rule. It was deliberately not adopted into the token layer. Per the one-directional
rule (Figma → tokens → UI), the fix belongs in Figma. **This is an open category-C ruling the
porting spec must make.**

## Also recorded, no action here

Once ~30 screens settle, the user wants Figma promoted from a pile of mockups to a **design-system
file** — colours, typography, spacing, elevation, radius, plus a component library (buttons, cards,
inputs, sidebar, dialogs, drawers, empty states, loading, charts, Companion/Lesson/Study components).
New screens then get assembled from components instead of re-prompted. Work inside Figma, not this
repo; noted so the sequencing isn't lost.
