# Screen Registry Phase 3 — run state

> **This file is the authority for where Phase 3 stands.** `mem:project_status` § NEXT ACTION points
> here and must not restate it.

# ▶▶ RESUME HERE

**Status: SPEC WRITTEN AND APPROVED IN BRAINSTORMING. NOTHING IMPLEMENTED. No code touched.**

Branch **`screen-registry-phase-3`**, cut from `master` (which was at `8865aed`) on 2026-08-23.
The only commit so far is the spec + docs + memories — **no `lib/` file has been modified**.

**Read `docs/superpowers/specs/2026-08-23-screen-registry-phase-3-design.md` first — it is complete
and self-contained.** This memory records the process state and the reasoning that did not fit there.

**The next step is `superpowers:writing-plans`** to turn the spec into an implementation plan. The
brainstorming skill's terminal state was reached: design approved → spec written → user approved the
approach. Do **not** start implementing without a plan.

## What Phase 3 is

Two halves, deliberately separated by a user-ruled gate:

- **Stage 1 (mechanical):** add `spec-only` to `ScreenKind`, add the `specRef` field, register the
  2026-08-23 Figma frame batch, fix the tests that break. **Adds zero `spec-only` rows.**
- **The gate:** a discovery pass over Spec + Decision Register produces a **candidate list**; the user
  rules it.
- **Stage 2:** write the approved `spec-only` rows, add the non-vacuity assertions, full gate, review,
  merge.

## The four rulings the design rests on (user, 2026-08-23) — do not silently revert

1. **Scope = the empty cell only.** `spec-only` means *no Figma frame AND no implementation*. A full
   `spec` axis on every entry was considered and REJECTED (would need re-auditing every existing row
   and does not answer the question being asked). An `api` axis was also REJECTED — one screen consumes
   N endpoints, so a single `api` value is not falsifiable and would violate R1.
2. **Provenance = a 13th field `specRef`**, required iff `spec-only`, null for every other kind,
   format-enforced by test. A closed enum and a comment-only approach were both rejected as leaving the
   claim unfalsifiable — which is exactly what R13 exists to prevent.
3. **Scan sources = `japanese-learning-app-spec.md` + `decision-register.md` ONLY.** `capability-map.md`
   and `screen-inventory.md` are EXCLUDED because they were built *by reading Figma* — asking them what
   Figma is missing is circular. This is the sharpest single idea in the design.
4. **Granularity = destinations only.** No state-variants (T4 needs a real parent), no overlays, no
   cross-cutting systems (Phase 0 §1: a capability seen in 3+ modules is a feature of none of them),
   no capabilities living inside another screen.

## ⭐ The finding that nearly sank `specRef`, and why it survived

Phase 2a's design (§2) established: **has-a-frame is an OBSERVATION axis owned by the registry;
has-a-ruling is a DECISION axis owned by the decision register; neither may be inferred from the
other.** On that basis **the user explicitly rejected a `ruledBy`/`ruledAt` field** (recorded as G3,
enforced by the R12 12-field test whose comment names it).

`specRef` is a cousin of that rejected field, so adding it silently would have been exactly the
"premise nobody approved" failure (`L-012`). The distinction that justified it, and which MUST stay in
any future retelling:

- `ruledBy`/`ruledAt` would attach to **every** row — rows that already have a frame or a route as
  evidence, so the field adds nothing needed to validate them.
- `specRef` attaches **only** to `spec-only` rows, which have **no other evidence whatsoever** — no
  frame, no route, no page. Without it the row is an unfalsifiable assertion.
- It records **where a requirement is written**, not **who approved it** — observation, not decision.

The `iff` is load-bearing: T13 forces `specRef === null` on every non-`spec-only` row, so the registry
is structurally barred from becoming the second decision register G3 was protecting against.

**This is a deliberate charter widening** ("registry = Figma map" → "registry = product surface ↔
design ↔ implementation map", the user's own words) and the spec records it as an explicit amendment
to G3 rather than slipping it in. Same for R12's 12→13 field pin.

⚠️ 2a also recorded a "Second reading, considered and NOT taken" that it rejected partly because it
*"collides with T3"*. Phase 3 **does** touch T3 — knowingly. Not a rediscovery.

## Exactly which tests break (measured by reading each one, not predicted)

| Test | Breaks? | Why |
|---|---|---|
| **T3** | YES | asserts `figmaNodeId` non-null iff not `repo-only`; `spec-only` is also null → widen |
| **R12** | YES | pins exactly 12 allowed fields → 13 |
| **G2** | YES | pins `stamped` length + per-date map; the new frames stamp `2026-08-23` |
| T4, T5, T7, T9, T10 | NO | `spec-only` has variantOf/route/navGroup/repoOnlyReason all null |
| `nav-derivation.ts` | NO | only throws when `navGroup !== null && route === null`; spec-only has navGroup null |
| `route-resolver.ts` | NO | reads page files, never the registry |

**Measured convention worth knowing:** every `route: null` entry also has `chrome: null`, no exception
(2026-08-23). New route-less rows follow it. That correlation is NOT currently tested — a candidate
invariant for a later phase, deliberately out of Phase 3 scope.

## ⚠️ The vacuity trap, and how the spec handles it

After Stage 1 there are **zero** `spec-only` rows, so T12/T13 written as loops over the registry are
**unconditionally green** — a defect under `CLAUDE.md` §7. Handling, which must not be "simplified"
away by an implementer:

- **Stage 1:** ship T12/T13 WITHOUT a non-vacuity assertion (zero is the correct count then), and prove
  them by **mutation-check** — five specific mutations are enumerated in the spec §8.2; run each, watch
  red, restore, **report both outputs**.
- **Stage 2:** add `expect(specOnly.length).toBeGreaterThan(0)` once real rows exist.
- T3's widening is also a guard over existing code → cannot fail first → mutation-check it too.

## The frame batch — 9 frames, and it is NOT purely mechanical

Full per-frame detail: the spec §5, and `docs/product/figma-frame-map.md` § "Second capture batch".
Summary:

- **2 CONVERSIONS** (R6 firing for the first time — `repo-only` is an observation with a date, not a
  permanent verdict): `register` gains frame `332:3` ✅ approved; `landing-page` ⛔ **BLOCKED, see
  below**.
- **5 new `screen` rows**, all `impl: 'none'`: Reset password `333:210` · Email OTP `335:306` ·
  Error404 `335:1976` · Error boundary `337:2055` · Membership `340:3795`.
- **2 new `state-variant` rows**, `variantOf: 'membership'`: Unsubcribe membership `340:4586` ·
  Choose method `340:5402`.
- **1 EXCLUSION**: `335:1588` Error state (right font) — style-guide catalogue, same classification
  that already excludes its twin `218:15740`. Must be typed into the registry header's exclusion list,
  because no test can catch a frame nobody ever entered.

## ⛔ TWO OPEN DECISIONS — the implementer must NOT resolve either

1. **`landing-page` vs frame `347:6277`** — an IDENTITY question reserved to the user. Is `347:6277`
   the design for the existing `/` route (→ convert the row like `register`), or a *different*
   marketing destination (→ its own row, `landing-page` stays `repo-only`)? Three frames are now named
   "Homepage": `111:515` (registered as `dashboard`), `347:6277`, and `346:6275` — the last is a
   **hidden `rounded-rectangle`, decorative noise, NEVER to be registered**. Useful evidence to gather
   before the ruling (gathering ≠ resolving): render `/` and compare section by section.
2. **The GitHub sign-in button** — `capability-map.md` §3 ruled **"Apple yes, GitHub no"**, yet frames
   `332:3` and `65:2` both show "Continue with GitHub". Amendment C **case 3** ("a section for a
   capability a ruling has removed") → STOP and ask. Does NOT block Stage 1 (registering a frame is not
   authorising its content), but MUST be settled before the auth screens are ported.

Related but already ruled: `choose-method` shows PayOS + SePay + MoMo while the user ruled PayOS-only
on 2026-08-23. The frame's *identity* is valid so it IS registered; its *content* loses to the ruling
at port time. The row carries a comment saying so.

## Corrections this session made to earlier claims

- ⚠️ **The Kanji explorer-vs-library question is NOT open.** An earlier estimate in this session said
  it was "open since Phase 0 and blocking a plan" — **false**. `capability-map.md` §3.4 ruled it on
  2026-08-12: both surfaces ship under ONE nav row, `/kanji` defaults to curriculum, explorer is a
  browse mode inside it. Already corrected in `mem:figma_backlog_estimate_2026_08_23`.
- A proposed "4-tier Figma-vs-spec audit process" was **dropped**: it is already law as
  `screen-inventory.md` § **Amendment C** (cases 1–4), which is sharper — Amendment C lets you fix
  wrong *content* silently inside the frame's template (case 2) and only stops for *identity/semantics*
  contradictions (case 3), whereas the proposal would have stalled on every content mismatch.

## Related

`docs/superpowers/specs/2026-08-23-screen-registry-phase-3-design.md` (the spec — authoritative) ·
`docs/superpowers/specs/2026-08-13-screen-registry-phase-2a-design.md` §2 (the axis split / G3) ·
`docs/superpowers/specs/2026-08-08-screen-registry-design.md` (R1–R13, T1–T11) ·
`docs/product/screen-inventory.md` § Amendment C · `docs/product/figma-frame-map.md` §"Second capture
batch (2026-08-23)" · `mem:figma_recapture_2026_08_23_run_state` ·
`mem:figma_backlog_estimate_2026_08_23` · `mem:screen_registry_phase_2b_run_state` (1a/1b/2a/2b) ·
`docs/lessons.md` L-002, L-003, L-004, L-005, L-011, L-012.
