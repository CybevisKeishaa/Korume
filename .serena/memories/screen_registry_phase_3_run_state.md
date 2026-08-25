# Screen Registry Phase 3 — run state

> **This file is the authority for where Phase 3 stands.** `mem:project_status` § NEXT ACTION points
> here and carries at most a one-line gist; it must not duplicate this file's evidence or its reasoning.

# ▶▶ RESUME HERE

**Status: ✅ STAGE 1 IMPLEMENTED. ✅ STAGE 2 CLOSED WITH ZERO ROWS (user ruling, 2026-08-25).
⛔ NOT MERGED — the only work left on this branch is a final review pass and the merge itself.**

Branch **`screen-registry-phase-3`**, cut from `master` (which was at `8865aed`) on 2026-08-23.
**Commit range `8865aed..HEAD`** (count with `git rev-list --count 8865aed..HEAD` — never write the
total, L-002): the spec (`22da7d9`), the plan (`6208925`), the seven implementation commits
`467b7c1`…`d37027f`, the prose fix wave (`4043a74`) that followed the final whole-branch review, and
the Stage 2 close-out.
`lib/product/screen-registry.ts`, `lib/product/screen-registry.test.ts`,
`lib/product/screen-registry-types.ts` and `lib/product/nav-derivation.test.ts` are all modified.

⚠️ **Do NOT re-run the Stage 2 discovery pass, and do NOT go looking for `spec-only` rows to add.**
The pass ran 2026-08-25 and the user ruled the result. **The authority for the outcome and its
evidence is the spec's new §6.7** (`docs/superpowers/specs/2026-08-23-screen-registry-phase-3-design.md`)
— read that for the method and the evidence, which are not duplicated here. The one-line gist that
follows is a pointer to it, not a substitute for it: one candidate (Onboarding, spec §3.1) reached the
user and was **rejected by looking at Figma** — `111:1556` QuickStart already carries level, learning
purpose and daily pace, so the surface is covered, not missing. **Zero `spec-only` rows is the final
Phase 3 state, not an unfinished one.**

Of the two items §6.7 pushed OUT of Phase 3, one is now CLOSED and one is still owed. ✅ CLOSED:
`figma-frame-map.md` filed frame `111:515` under the "onboarding cluster" when it is the returning-user
Dashboard — a characterisation **this branch introduced** (`22da7d9`) that regressed a standing ruling
(`screen-inventory.md` §19.0/§19.1, 2026-08-12), fixed in the review wave rather than deferred as a TODO
inside merged work (`CLAUDE.md` §6). ⛔ STILL OWED: spec §3.1's "placement quiz 10 câu" versus QuickStart's single
self-assessment is a **port-time** question about whether `users.level` means self-declared or
measured — `/lib/difficulty` consumes it, so the two concepts must not be silently merged.

⚠️ **Do NOT re-do Stage 1.** Everything the spec's §4, §5 and §8 asks for is done: `spec-only` is a
`ScreenKind`, `specRef` is the 13th field, T3 is widened, T12 and T13 exist, R12's pin is 13 and G2's
pins are re-measured, and the 2026-08-23 frame batch is registered. This memory previously said
"NOTHING IMPLEMENTED" and pointed at `superpowers:writing-plans`; that was written before any of it
and was left stale for eight commits. It is the exact failure a resuming session would act on.

**Gate measured on `d37027f`** (re-run to verify — `.superpowers/sdd/` is gitignored and does not
travel with the repo, so re-run rather than chase a log file: `npm run typecheck` ·
`npx vitest run --reporter=dot` · `npm run lint` · `npm run build`):
`tsc --noEmit` 0 errors · `next lint` 0 errors (warning baseline unchanged) · `vitest run`
**262 files / 2368 tests passed**, exit 0 · `next build` exit 0. **Playwright was deliberately NOT
run** — the branch touches no `app/` route and no rendered component.

**✅ THE §6 DISCOVERY-PASS GATE HAS ALREADY RUN — do not run it again.** It was never an engineering
task: a scan of `japanese-learning-app-spec.md` + `decision-register.md` produced a candidate list and
**the user ruled it** (§6.6) on 2026-08-25. The ruling was **zero `spec-only` rows**, so Stage 2 (§7)
wrote no rows, and the non-vacuity assertions §7 step 2 describes were **correctly not added** — they
are meaningful only in a future phase that actually writes rows. **The outcome and its evidence are the
spec's §6.7**; read that rather than anything here. A registry holding zero `spec-only` rows is the
final Phase 3 state, not an incomplete one.

**Read `docs/superpowers/specs/2026-08-23-screen-registry-phase-3-design.md` first — it is complete
and self-contained.** This memory records the process state and the reasoning that did not fit there.

## What Phase 3 is

Two halves, deliberately separated by a user-ruled gate:

- **Stage 1 (mechanical):** add `spec-only` to `ScreenKind`, add the `specRef` field, register the
  2026-08-23 Figma frame batch, fix the tests that break. **Adds zero `spec-only` rows.**
- **The gate:** a discovery pass over Spec + Decision Register produces a **candidate list**; the user
  rules it. ✅ Ran and was ruled 2026-08-25.
- **Stage 2:** write the approved `spec-only` rows, add the non-vacuity assertions, full gate, review,
  merge. ✅ Closed 2026-08-25 with **zero approved rows**, so it wrote none and added no non-vacuity
  assertion — spec §6.7. What is left is the review and the merge.

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
- **Stage 2:** add `expect(specOnly.length).toBeGreaterThan(0)` once real rows exist. ⚠️ Stage 2 closed
  at **zero** rows (spec §6.7), so this assertion was correctly NOT added and must not be added now —
  it belongs to a future phase that actually writes rows.
- T3's widening is also a guard over existing code → cannot fail first → mutation-check it too.

## The frame batch — NOT purely mechanical (✅ all of this is DONE, at `dc917dc`)

Full per-frame detail: the spec §5, and `docs/product/figma-frame-map.md` § "Second capture batch"
— which is also the **single home for the batch accounting** (added / already-registered / excluded
/ deferred). Do not restate those figures here or in the registry header; they disagreed once
already. Summary of what Stage 1 did:

- **CONVERSION** (R6 firing for the first time — `repo-only` is an observation with a date, not a
  permanent verdict): ✅ `register` gained frame `332:3`. The second candidate conversion,
  `landing-page` ← `347:6277`, was ⛔ **NOT made** — see the open decision below. That row's `kind`,
  `figmaNodeId` and `figmaCheckedAt` are byte-identical to what they were before the capture.
- **New `screen` rows**, all `impl: 'none'`, all stamped `2026-08-23`: Reset password `333:210` ·
  Email OTP `335:306` · Error404 `335:1976` · Error boundary `337:2055` · Membership `340:3795`.
- **New `state-variant` rows**, `variantOf: 'membership'`: Unsubcribe membership `340:4586` ·
  Choose method `340:5402`.
- **EXCLUSION**: `335:1588` Error state (right font) — style-guide catalogue, same classification
  that already excludes its twin `218:15740`. ✅ Typed into the registry header's exclusion list,
  because no test can catch a frame nobody ever entered.

## ⛔ ONE OPEN DECISION — still unresolved after Stage 1, and reserved to the user

⚠️ **This section listed TWO. The second (the GitHub sign-in button) was never actually open** — see
the correction below it. Only the `landing-page` identity question remains.

1. **`landing-page` vs frame `347:6277`** — an IDENTITY question reserved to the user. Is `347:6277`
   the design for the existing `/` route (→ convert the row like `register`), or a *different*
   marketing destination (→ its own row, `landing-page` stays `repo-only`)? Three frames are now named
   "Homepage": `111:515` (registered as `dashboard`), `347:6277`, and `346:6275` — the last is a
   **hidden `rounded-rectangle`, decorative noise, NEVER to be registered**. Useful evidence to gather
   before the ruling (gathering ≠ resolving): render `/` and compare section by section.
✅ **CORRECTION (user, 2026-08-25) — the GitHub sign-in button was NEVER an open decision, and this
memory was wrong to list it as one.** Frames `332:3` and `65:2` both show "Continue with GitHub", and
`decision-register.md` **P14** already reads *"Auth = email + Google + Apple. GitHub: no"*. The user
confirmed P14 still stands. So this is not an Amendment C case 3 escalation awaiting a ruling — the
ruling pre-dates the frame. It is an ordinary **frame-content-loses-to-ruling** case: register the
frame, do NOT build the button when the auth screens are ported. Cite **P14**, not "spec §9.2".

Same shape, same 2026-08-25 confirmation: `choose-method` (`340:5402`) shows PayOS + SePay + MoMo,
and **P13** (*"Payment is PayOS"*) rules it. SePay/MoMo are design exploration, deferred for
merchant-registration reasons — now recorded as a note against P13 in the decision register, not
only in a code comment. The frames' *identity* is valid so both ARE registered; their *content*
loses to P13/P14 at port time, and each row carries a comment saying so.

⚠️ **Neither of the above makes the `landing-page` question settled.** That one has no ruling and
stays open everywhere.

## Corrections this session made to earlier claims

- ⚠️ **The Kanji explorer-vs-library question is NOT open.** An earlier estimate in this session said
  it was "open since Phase 0 and blocking a plan" — **false**. `capability-map.md` §3.4 ruled it on
  2026-08-12: both surfaces ship under ONE nav row, `/kanji` defaults to curriculum, explorer is a
  browse mode inside it. Already corrected in `mem:figma_backlog_estimate_2026_08_23`.
- A proposed "4-tier Figma-vs-spec audit process" was **dropped**: it is already law as
  `screen-inventory.md` § **Amendment C** (cases 1–4), which is sharper — Amendment C lets you fix
  wrong *content* silently inside the frame's template (case 2) and only stops for *identity/semantics*
  contradictions (case 3), whereas the proposal would have stalled on every content mismatch.

## ⭐ Stage 1 execution ledger — rulings, corrections, deferrals

⚠️ **Why this section exists.** The SDD ledger for Stage 1 lives in
`.superpowers/sdd/2026-08-25-screen-registry-phase-3-stage-1/`, and **`.superpowers/` is gitignored**
(`.gitignore:61`). Every ruling below would have evaporated at merge. The user ruled on 2026-08-25
that they belong in this memory, which travels with the repo. Same failure mode A16 already paid for
("the only record of a dead route lived in a gitignored progress file and nobody could find it").

**Controller rulings (execution, not product — none of them touches the registry's data):**

1. **No worktree.** Work stayed in the main checkout on branch `screen-registry-phase-3`. This repo
   has three recorded worktree hazards: `L-020` (a worktree has no `.env.local`, breaking
   auth-dependent tests), `L-021` (`EnterWorktree` branches from `origin`, wrong for a repo that
   never pushes), `L-016` (worktree runs need controller git re-verification after every dispatch).
   The branch already existed, was clean, and was not `master`.
2. **Implementer model floor raised to `sonnet`**, overriding the cheap-tier guidance, even though
   every task carried complete literal code. `L-016`'s own evidence is a haiku-tier implementer
   committing to **`master` in this repo** with the full prompt pattern already in place. Reviewers
   ran on `sonnet`; the final whole-branch review on `opus`.
3. **`lib/product/nav-derivation.test.ts` was accepted into Task 1 though the plan's file list
   omitted it.** It builds a `ScreenEntry` object literal — the only other one in the repo — so `tsc`
   requires `specRef` there too. The implementer added exactly that one line unprompted; accepted
   because the type change requires it and it asserts nothing new. Recorded as a *plan* defect.
4. **Task 5's one Minor was folded into Task 6's dispatch** rather than opening a fix round or
   deferring it to the final review. (G2's comment said "the split between the two dates" while the
   pinned object had grown to three.) Task 6 was the next dispatch and already a documentation task,
   so it rode along and still passed through Task 6's own review.

**Two claims made during execution that measurement proved FALSE. Do not inherit either.**

- ❌ *"The full test suite exceeds the 600-second subagent Bash cap."* **False.** Measured: the suite
  runs in **~72s wall** (and 63.99s in the final gate). The real cause of both harness kills was
  **output volume under vitest's default reporter**, not duration — `npx vitest run --reporter=dot`
  completes cleanly. Consequence: implementer subagents **can** run the full suite here, with
  `--reporter=dot`. The ruling built on the false premise (controller runs the suite) was harmless,
  but its reason was wrong (`L-012`).
- ❌ The plan's **Task 3, Step 5** says setting `specRef` on a `kind: "screen"` row would *"also"*
  fail `R12` *"because there are now 14 keys"*. **False.** Task 1 had already backfilled
  `specRef: null` onto all **81** then-existing rows, so the mutation changed a **value**, not the
  key set; `R12` correctly stayed green and only `T13` went red — which is exactly what the
  mutation-check was for. The plan file carries this correction inline (it is committed and outlives
  this ledger).

**Deferred to a later pass — NOT this branch's work:**

- **The canvas / parallel-worker flake family.** `components/video-player/waveform.test.tsx` and
  `components/video-player/pitch-contour.test.tsx` both pass standalone (waveform: 6/6 across three
  standalone runs) and both fail only under the parallel full-suite run. `pitch-contour` was already
  recorded in `mem:screen_registry_phase_2b_run_state` as a single-file flake worth its own ticket;
  Stage 1 **widened it to two files**, both canvas-based video-player tests, which narrows the
  hypothesis to **canvas mocking under parallel workers**. Structurally unrelated to anything this
  branch touched. Treat a hit as a known flake: re-run the file alone, record both outputs, move on.
- **`login`/`65:2`'s stale `figmaCheckedAt: "2026-08-12"`** — see `figma-frame-map.md`'s ⚠️ residual
  debt note. Deliberately not "fixed", because moving a stamp nobody re-earned is the dishonesty G2
  exists to catch.

**✅ Lessons ARE written.** They were written at the true end of the branch, in the Stage 2 close-out
commit `cf6ab8e`, per `CLAUDE.md` §9/§10 — three new entries (**`L-035`** vitest output volume,
**`L-036`** scripted writes bypassing CRLF normalisation, **`L-037`** one agent in flight) and four
extended (**`L-011`**, **`L-012`**, **`L-015`**, **`L-019`**), merged into existing entries rather than
appended, per that file's rule 2. **Do not re-add them**, and do not treat the ledger above as an
unwritten backlog — it is the evidence they were drawn from. (The review of `cf6ab8e` then corrected
several claims inside those entries; `docs/lessons.md` at HEAD is the authority, not this list.)

## Related

`docs/superpowers/specs/2026-08-23-screen-registry-phase-3-design.md` (the spec — authoritative) ·
`docs/superpowers/specs/2026-08-13-screen-registry-phase-2a-design.md` §2 (the axis split / G3) ·
`docs/superpowers/specs/2026-08-08-screen-registry-design.md` (R1–R13, T1–T11) ·
`docs/product/screen-inventory.md` § Amendment C · `docs/product/figma-frame-map.md` §"Second capture
batch (2026-08-23)" · `mem:figma_recapture_2026_08_23_run_state` ·
`mem:figma_backlog_estimate_2026_08_23` · `mem:screen_registry_phase_2b_run_state` (1a/1b/2a/2b) ·
`docs/lessons.md` L-002, L-003, L-004, L-005, L-011, L-012.
