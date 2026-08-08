# Plan C (Shadowing Hub UI) — everything it needs, gathered 2026-08-07

> ⚠️ **SUPERSEDED AS A STATUS FILE (2026-08-08). Plan C now HAS its own locked spec and is IN
> EXECUTION — read `mem:shadowing_hub_plan_c_run_state` for where the run stands.** This file is kept
> for the *inputs* it gathered (design source, chrome contract, token rules, open questions), all of
> which the spec consumed. The three "open decisions" at the bottom are all now ruled: the
> `/videos`→`/shadowing` rename was TAKEN and has shipped; INSIGHTS was populated and the nav went to
> its full 22 rows; per-screen divergence was adjudicated for the Hub (Figma wins all four conflicts).

**Status (historical): NOT started. Every gate it was waiting on is now cleared.** This was the next
build. Read this file, then `mem:project_status` § NEXT ACTION.

## Why it was blocked, and why it is not any more

| Gate | State |
|---|---|
| Figma Make token + typography foundation | ✅ merged `86328bc` |
| Screen-port workflow (primitives + chrome architecture) | ✅ merged `7277ac1` |
| Plan B (Hub backend + API surface) | ✅ merged `b36c455`, pushed |
| Plan A (Docs/IA) | ✅ merged `a6a7617` + alignment `b9873ab` |

Parent spec: `docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md`
(**LOCKED**, `249c442`), which split delivery into 4 plans: **A Docs / B Backend / C Hub UI /
D Lesson UI**. C is next, D after it.

## What Plan C sits inside now — read before designing anything

**Chrome contract.** The Hub is an **App page** → it lives in `app/[locale]/(protected)/(app)/`,
which mounts `AppNav` visible by default. It is NOT `(focus)` and NOT `(immersive)`. The Lesson
Workspace it links into IS `(focus)` (nav mounted, hidden by default) — that already exists for
`videos/[id]/shadowing` and `videos/[id]/dictation`.

**Route.** The Hub is `/videos` today. The nav *label* already reads `lessons` / "Bài học" but the
`href` is still `/videos`. **The `/videos` → `/shadowing` route rename is explicitly Plan C's call** —
the Shadowing Hub Consolidation spec deferred it and nothing has claimed it since. Decide it in
Plan C's spec, and if you take it, sweep `tests/e2e/` by hand: `vitest.config.ts` excludes that
directory, so `npm test` cannot catch a broken Playwright selector. That exact gap produced the
rebrand branch's only Critical finding.

**Token rules that bind the port** (full text in `mem:project_status`): Rule #0 — never port a pixel
from Figma, map to a semantic token. Type scale is `caption 12 · body 14 · body-lg 16 · heading 20 ·
title 28 · display 40 · hero 64`. Spacing is `--space-2xs 4 · xs 8 · sm 12 · md 16 · lg 24 · xl 32 ·
2xl 48 · 3xl 64`. Radius `sm 8 · md 14 · lg 20 · xl 28`. Elevation `raised/overlay/floating`, black,
almost invisible by design — depth comes from the surface ladder `--background #0b0d11 → --card
#171a20 → --secondary #20242c`, never from a heavier shadow. Two tests enforce this in
`components/ui/**`; feature code is not yet scanned, so the discipline there is yours.

**Primitives available:** button, card, input, label, badge, dialog, toast, tooltip, popover, select,
tabs, skeleton, container — all on the token scales as of `7277ac1`. **Avatar does not exist** and the
design uses one; if the Hub needs it, that is a new primitive and should be built deliberately, not
inlined.

## The design source

**Frame `Shadowing hub after changes` (node `149:2`) is the one to build against.** It is 1536px wide
while every other frame is 1278px — it is the newest iteration. Do not build against the older hub
frame.

Tier B React source in the bundle: `src/app/components/ShadowingPage.tsx`. Tier A design prompts
(prose, the highest-value layer): `shadowing-practice.md` (19KB), `shadowing-detail-design.md`,
`nihongo-cinema-spec.md`. **Read the tier A prompt before the tier B code** — intent first.

⚠️ **Take geometry from the LIVE Figma Make project, not the local bundle.** The bundle at
`C:\Users\tplon\Downloads\Design Shadowing Page UI` is a snapshot proven to decay within one day.
Measured values from it (sidebar 220, collapsed 68, content 1180, canvas 1440) are recorded in the
spec's Appendix A.2 as evidence only — **nothing may depend on them.** Ask the user for a fresh
download at the moment Plan C starts.

## Backend already live (Plan B) — build against this, do not re-invent

Lesson access levels, the library/quota ledger, collections, the Create Lesson pipeline, and the
Promotion Queue backend with 7 admin routes are all shipped. **Plan C must be written against Plan B's
actual API surface** — read the routes, do not assume shapes from the spec's prose.

## Open decisions Plan C must make

1. **The `/videos` → `/shadowing` route rename** — take it or defer it again, explicitly.
2. **`INSIGHTS` nav group renders nothing today** (all 3 rows unbuilt) while several Figma screens
   show it populated. Decide whether the Hub work touches it.
3. **Per-screen divergence adjudication (category C).** The 29 screens were designed from
   `docs/product/business-model.md` alone, without cross-checking the other design docs, with
   deliberate personal modifications. Divergences are adjudicated **lazily, one screen at a time,
   immediately before building that screen** — that is a decided policy, not an oversight. For the
   Hub specifically, check it against `docs/design/screens/screen-shadowing-hub.md` and
   `docs/product/domain-model.md`. A ruling of "Figma Make is right, amend the docs" is perfectly
   valid; what is not valid is leaving two sources of truth.

## Method

The per-screen method the user set is in `mem:screen_port_workflow_inputs`: four screen types, and a
five-step checklist (screen contract → read the Figma frame → reuse check → write the production
screen → four checks before done). That file is still the working method even though its spec is
executed.
