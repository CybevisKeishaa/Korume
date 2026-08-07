# Shadowing Hub Consolidation — status: ✅ EXECUTED (corrected 2026-08-06)

**Spec:** `docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md`.
**Status: DECIDED *and* EXECUTED.** Its §6 17-file change list was carried out — not as its own
branch, but folded into **Shadowing Hub Lesson Workspace Plan A (Docs)**, merged `--no-ff`
**`a6a7617` (2026-07-31)**, plus alignment commit `b9873ab`.

> ⚠ This memory previously said "execution not started / parked". That was **wrong** as of
> 2026-07-31 and stayed wrong until 2026-08-06. Quick proof it is done:
> `docs/design/screens/screen-shadowing-hub.md` and `screen-shadowing-practice.md` both exist;
> `screen-video-detail.md` survives only as the deprecated file.
> **`mem:project_status` is the current authority for this whole area — read it, not this file.**

## What it decided (still the live IA authority)

Replaced the video-centric IA (`videos` nav item, `screen-video-library.md`, `screen-video-detail.md`,
`screen-shadowing-detail.md` as three separate stops) with a two-level model:
**Shadowing Hub → Shadowing Lesson**. Shadowing Practice is the primary workspace rendered *within*
the lesson route, not the route's identity — which is what lets Dictation/Vocabulary/Grammar arrive
later as sibling workspaces with no new IA fight. Core ADR: **"The primary product domain is
Shadowing, not Video."** No standalone Lesson Detail page, no Lesson Info Panel inside Practice —
both proposed and explicitly rejected during the brainstorm (spec §2 has the full history).
Companion's Learning Loop Boundary was explicitly **not** touched by this spec; new governance rule
it added: removing a screen must never be read as "Companion now covers this."

## What has changed *since*, that this spec did not anticipate

- **Extended, not just executed.** `docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md`
  (LOCKED, `249c442`) layered a full Lesson domain model, Create Lesson pipeline, monetization model,
  and the Lesson Workspace on top, and split delivery into **4 plans: A Docs / B Backend / C Hub UI /
  D Lesson UI**.
- **Plan B (Backend) DONE**, merged `b36c455` (2026-08-01), pushed. Lesson access levels, library/quota
  ledger, collections, Create Lesson pipeline, Promotion Queue backend + 7 admin routes are live.
- **View Mode was later retired** — Shadowing Practice is now a **Two-Layer Model** (`6ce08f9`,
  branch merged `b56bba1`), superseding the three-layer framing in the 2026-07-31 spec §6.
- **The route rename never happened.** This spec's own "out of scope" list deferred
  `app/[locale]/(app)/videos` → `.../shadowing` and the `app-nav.tsx` change. The nav half landed in
  the Korume rebrand Plan B (`44521bc`): the key/label is now `lessons`, but **`href` is still
  `/videos`**. Anything linking to the Hub must use `/videos`; the route rename is **Plan C's call**.

## Next

**Plan C (Hub UI) — ALL GATES NOW CLEARED (2026-08-07). It is the next build.**
Everything it was sequenced behind has landed: the Figma Make token + typography foundation
(`86328bc`) and the screen-port workflow, which shipped the primitives and the chrome architecture
(`7277ac1`). Plan C still needs its own `superpowers:writing-plans` pass against Plan B's live API
surface.

👉 **`mem:plan_c_hub_ui_inputs` collects everything it needs** — the chrome contract the Hub sits in
(`(app)`, nav visible), the token rules that bind the port, which Figma frame to build against
(`Shadowing hub after changes`, 149:2, the 1536px one), the three open decisions it must make
including the deferred `/videos` → `/shadowing` rename, and the warning that shell geometry must be
measured from the LIVE Figma rather than the local bundle. Read that first.
