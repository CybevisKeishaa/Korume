# Screen Registry Phase 3 — `spec-only` surfaces & the second frame batch — Design

> **Status:** approved in brainstorming 2026-08-23. **Stage 1 (§4, §5, §8) is IMPLEMENTED** on branch
> `screen-registry-phase-3` — the seven implementation commits `467b7c1`…`d37027f`, on top of this
> spec (`22da7d9`) and the plan (`6208925`). **Stage 2 (§7) is CLOSED with ZERO rows** — §6's
> discovery pass ran 2026-08-25 and the user ruled the outcome the same day. **Read §6.7 for the
> result and its evidence.** A registry holding zero `spec-only` rows is the CORRECT and now FINAL
> state for Phase 3, not an unfinished one.
> **Predecessors:** `2026-08-08-screen-registry-design.md` (R1–R13, T1–T11) ·
> `2026-08-13-screen-registry-phase-2a-design.md` (the observation/decision axis split, G3) ·
> `2026-08-14-screen-registry-phase-2b-design.md`.
> **Read `mem:screen_registry_phase_3_run_state` for where execution actually stands.**

---

## 1. What Phase 3 is, in one sentence

Phase 3 makes the registry able to record a **product surface the spec requires that has neither a
Figma frame nor an implementation**, and registers the second batch of Figma frames captured on
2026-08-23.

### 1.1 The question it exists to answer

The user's framing, 2026-08-23:

> *"Figma vẫn chưa thật sự gen tất cả màn hình, nó có 69 frame, nhưng nó có thể là vẫn chưa phủ hết"*

Today the registry cannot answer that. It knows two things about any surface — *does Figma have a
frame* (`kind`) and *does the repo have a page* (`impl`) — and it only ever learns about a surface
because one of those two already existed. **A surface the spec requires that neither Figma nor the
repo has ever heard of is, to the registry, not a gap but an absence of data.** Measured:

```
Entries with figmaNodeId === null AND route === null:  0
```

That zero is the whole problem. Phase 3 makes that cell representable.

### 1.2 The ruling that binds the meaning of `spec-only`

> **`spec-only` does NOT mean "a screen Claude thinks the product should have."** It means **"a
> destination that Spec + Decision Register already require, which currently has no Figma frame and
> no implementation."** (User ruling, 2026-08-23.)

The registry **detects** the gap. It **must never design the screen**. When such a surface later
reaches the porting stage, `screen-inventory.md` § Amendment C **case 4** governs: extend the design
in Figma's own design language, **propose it, and wait for the user's ruling** — never improvise.

---

## 2. Two amendments this phase makes, stated before anything is built

Both are deliberate reversals of narrower positions taken by earlier phases. Neither may be applied
silently; each is recorded here because a later reader will otherwise find the earlier rule and
believe it still binds.

### 2.1 Amendment to G3 — the registry's charter is widened

**Phase 2a's rule (`2026-08-13-screen-registry-phase-2a-design.md` §2), which still stands for what it
actually covers:**

> **Has a frame / has no frame** is an **observation axis**, owned by the registry.
> **Has a ruling / has no ruling** is a **decision axis**, owned by the decision register.
> **Neither axis may be inferred from the other, in either direction.**
>
> *"This is why 2a adds no `ruledBy` / `ruledAt` field. The user rejected it explicitly: 21 of 23
> such fields would merely point at a ruling already written down, turning the registry into a second
> decision register — `CLAUDE.md` §6."*

**Phase 3 adds a provenance field anyway (`specRef`), and must justify why that is not the field G3
rejected.** The user's ruling, 2026-08-23:

> *"Registry không phải danh sách 'những gì Figma có'. Nó phải trở thành bản đồ giữa product surface
> ↔ design ↔ implementation."*

That is a **charter change**, and it is the user's to make. G3 was written under the old charter, in
which every registry row was already grounded by either a frame or a route. The distinction that
keeps G3's actual concern intact:

| | `ruledBy` / `ruledAt` — rejected by G3 | `specRef` — added by Phase 3 |
|---|---|---|
| Attaches to | **every** entry | **only** `kind: 'spec-only'` |
| Does the row have other evidence? | Yes — the frame or the route *is* the evidence | **No.** No frame, no route, no page — nothing else grounds it |
| Remove the field and the row becomes | still self-supporting | an **unfalsifiable assertion** |
| What it records | *who approved this, and when* — decision axis | *where the requirement is written* — observation axis |

**`specRef` does not record adjudication.** It records **where a requirement is written down**, which
is an observation, checkable by opening the cited file. The `iff` is what enforces this: **T13 asserts
`specRef === null` for every entry whose `kind` is not `spec-only`**, so the registry is structurally
prevented from becoming a provenance index for the pre-existing rows G3 was protecting.

**⚠️ Also noted, because 2a explicitly deferred it.** 2a recorded a "Second reading, considered and
NOT taken", rejecting an alternative because it *"collides with T3 and is a far larger change."*
Phase 3 **does** touch T3 (§4.2). Phase 3 is therefore doing a bounded part of what 2a deferred, and
does so knowingly — this is not a rediscovery.

### 2.2 Amendment to R12 — twelve fields become thirteen

**R12:** *"The registry holds **no field describing appearance or behaviour** — no copy, no colours,
no layout, no data requirements. This is the concrete guard on R1. The moment the registry describes
how a screen looks, it is a second Figma."*

**R12's stated concern is untouched.** `specRef` describes neither appearance nor behaviour; it is a
citation. The 12-field pin in the R12 test is **friction by design** — its own comment says such a
field *"cannot be added without failing here"*, which is an instruction to make the addition
deliberate, not a prohibition. Phase 3 pays that friction by writing this section.

The pin moves 12 → 13. **The guard itself does not weaken**: it still asserts in both directions that
every entry carries exactly the allowed set, so a stray `copy` or `layout` field still fails.

---

## 3. Scope

### 3.1 In scope

1. `ScreenKind` gains `'spec-only'`; `ScreenEntry` gains `specRef`.
2. The 2026-08-23 frame batch is registered (§5).
3. A **discovery pass** over Spec + Decision Register produces a **candidate list** (§6).
4. After the user rules that list, the approved `spec-only` rows are written (§7).

### 3.2 Explicitly out of scope

- **A `spec` axis for every entry.** Considered and rejected 2026-08-23: it would answer *"is this
  built screen spec-backed?"*, require re-auditing all 81 rows, and is not needed to answer §1.1.
  `spec-only` is deliberately **only the empty cell**, not a general spec axis.
- **An `api` axis.** The user's sketch included `API ?` as a third dimension. Rejected for this phase:
  a screen consumes N endpoints (Shadowing Practice alone reads `shadowing/session`,
  `videos/[id]/transcript`, `pronunciation/score`, `srs/review`), so a single `api: 'partial'` value
  is not falsifiable, and asserting it would violate **R1** (*"the registry is a derived index and
  asserts nothing new"*).
- **Designing any missing screen.** §1.2.
- **Re-auditing the 69 frames.** Phase 0 read them; this phase adds only the new batch.
- **`capability-map.md` and `screen-inventory.md` as scan sources.** Both are *derived from reading
  Figma*, so they structurally cannot reveal what Figma is missing. See §6.1.

---

## 4. The type change

### 4.1 Shape

```ts
export type ScreenKind =
  | "screen"
  | "state-variant"
  | "deprecated"
  | "repo-only"
  | "spec-only";   // NEW — required by Spec/Register; no frame, no implementation

export interface ScreenEntry {
  // ...the twelve existing fields, unchanged...
  /** Required when kind === 'spec-only', null otherwise (T13). A citation, never a ruling. */
  specRef: string | null;
}
```

**`spec-only` is defined narrowly as the empty cell.** Every one of these holds; **T12 enforces the
nine null/`'none'` clauses, T13 enforces the `specRef` clause**:

```
kind: 'spec-only'  ⇒  figmaNodeId    === null
                      route          === null
                      chrome         === null
                      impl           === 'none'
                      variantOf      === null
                      repoOnlyReason === null
                      figmaCheckedAt === null
                      navGroup       === null
                      navOrder       === null
                      specRef        !== null
```

`figmaCheckedAt: null` is consistent with **G2**'s existing reading — a null stamp means *never
compared* or *never comparable*, and never *"we forgot"*.

`chrome: null` follows the repo's existing convention, which was **measured, not assumed** (2026-08-23):
every entry with `route: null` also has `chrome: null`, with no exception. Re-measure rather than
trusting this sentence:

```
grep -c 'route: null' lib/product/screen-registry.ts   # then compare against chrome: null
```

(Side observation, deliberately not acted on: `route === null ⇒ chrome === null` held perfectly at
that measurement and is **not currently tested**. Turning it into an invariant is a candidate for a
later phase, not Phase 3 scope.)

### 4.2 `specRef` format

Only the two scan sources of §6.1 are valid, and they use different id schemes:

```
japanese-learning-app-spec.md §3.6     ← spec: § plus a dotted section number
decision-register.md A12               ← register: A followed by digits
```

T13 accepts exactly these two shapes. A loose `/\.md §/` was **rejected**: it would admit
`capability-map.md §3` — a Figma-derived source this phase explicitly excludes (§3.2) — and it would
admit near-miss junk. Anything else, `"TODO"` included, fails.

---

## 5. Stage 1 — the 2026-08-23 frame batch

Source of the ids and the visual evidence: `docs/product/figma-frame-map.md` § "Second capture batch
(2026-08-23)". Thirteen frames were captured; three were already registered (`65:2` Login,
`337:3323` Data privacy, `339:3612` Delete data) and need no action.

### 5.1 One frame is deliberately NOT registered

| Node id | Frame | Why excluded |
|---|---|---|
| `335:1588` | Error state (right font) | A style-guide catalogue, not a screen — the same classification that already excludes its near-identical twin `218:15740` in the registry's header comment (`screen-inventory.md` §19.6). Registering it would contradict a standing exclusion. |

Per the header comment's own rule, this exclusion must be **added to the registry header's exclusion
list**, because *"no test can catch a frame that was simply never typed in here."*

### 5.2 Two rows are CONVERSIONS, not additions — R6 working as designed

**R6:** *"`kind: 'repo-only'` means 'no corresponding Figma node **at this inventory pass**' — not a
permanent classification. A screen can be designed later."* Phase 3 is the first time R6 actually
fires.

| Existing row | Today | After Stage 1 |
|---|---|---|
| `register` (`/register`) | `repo-only` · `impl: built` · `repoOnlyReason: 'no-frame-at-last-pass'` | `kind: 'screen'` · `figmaNodeId: '332:3'` · `repoOnlyReason: null` · `figmaCheckedAt: '2026-08-23'` |
| `landing-page` (`/`) | `repo-only` · `impl: built` | ⛔ **OPEN — see §8.1. Do not resolve while implementing.** |

### 5.3 Five new `screen` rows

All `impl: 'none'`, `route: null`, `chrome: null`, `figmaCheckedAt: '2026-08-23'`.

| Node id | Frame | Note |
|---|---|---|
| `333:210` | Reset password | No page, no server action exists. Supabase Auth supplies the primitive. |
| `335:306` | Email OTP | Same. |
| `335:1976` | Error404 | Repo has no `not-found.tsx` anywhere — Next's default is serving today. |
| `337:2055` | Error boundary | Repo has no `error.tsx` anywhere. Frame renders inside real app chrome. |
| `340:3795` | Membership | No route, and **zero PayOS integration code** exists. |

### 5.4 Two new `state-variant` rows

Both `variantOf: 'membership'`, following the `delete-data` → `data-privacy` precedent for a modal
that is a state of its parent screen rather than a standalone interaction.

| Node id | Frame |
|---|---|
| `340:4586` | Unsubcribe membership |
| `340:5402` | Choose method |

**T4 requires `variantOf` to name a `kind: 'screen'` entry.** §5.3 registers `membership` as exactly
that, so the constraint is satisfied without widening T4.

**⚠️ `choose-method` carries a content conflict that must NOT be resolved by this phase.** The frame
offers PayOS + SePay + MoMo; the user ruled 2026-08-23 that **PayOS-only stands** (`CLAUDE.md` §3
unchanged; SePay/MoMo deferred for merchant-registration reasons). Per Amendment C this is a
**content** conflict inside a frame whose **identity** ("choose a payment method") is valid — so the
frame is registered as-is, and the row carries a comment pointing at the ruling. Registering a frame
records *what Figma designed*; it does not authorise building it. **Whoever ports this screen must
apply the PayOS-only ruling, not the frame's provider list.**

### 5.5 Test pins Stage 1 will move

**G2** pins today's state deliberately so a change is conscious rather than silent: `stamped` length,
and the per-date map `{ "2026-08-12": 72, "2026-08-20": 3 }`. Stage 1 adds entries stamped
`2026-08-23`, so both move. **Measure the new values from the registry; never compute them here and
copy them in** (`L-002`) — this spec deliberately states no post-change count.

The comment on that test already licenses this: *"Updating a pin to match a measured registry is
normal. Stamping an entry to make a pin green is the failure this whole test exists to catch."*

### 5.6 Stage 1 adds no `spec-only` row

**User ruling, 2026-08-23.** Stage 1 ships the type, the tests and the frame batch, and stops. This
keeps the mechanical work reviewable as mechanical work, and keeps every judgment call behind the
gate in §6.

---

## 6. The gate — the discovery pass

### 6.1 Sources, and why these two only

| Source | Included? | Why |
|---|---|---|
| `japanese-learning-app-spec.md` §3 (module feature list) | ✅ | `CLAUDE.md`: *"Source of truth for the product"* |
| `docs/product/decision-register.md` (A1–A17) | ✅ | Amendment C: spec + register decide **WHAT** |
| `docs/product/capability-map.md` | ❌ | derived from reading Figma |
| `docs/product/screen-inventory.md` | ❌ | derived from reading Figma |
| `docs/product/ia-proposal.md` | ❌ | derived downstream of both |

**The exclusion is about circularity, not size.** Phase 0 built `capability-map.md` and
`screen-inventory.md` *by reading the frames*. Asking them what Figma is missing can only return what
Figma already showed. (Both included sources are small enough to read end to end — measure with `wc -l`
rather than trusting a number written here, `L-002`.)

### 6.2 A candidate must pass all three, each independently checkable

| # | Test | Evidence |
|---|---|---|
| 1 | Spec/Register requires it **as a destination** — it would be `kind: 'screen'` | the `specRef` citation |
| 2 | No Figma frame covers it | the enumerated node list in `figma-frame-map.md` |
| 3 | No `page.tsx` implements it | `listPageRoutes(process.cwd())` |

### 6.3 What must NOT become a candidate

Per the granularity ruling (user, 2026-08-23) and Phase 0 §1/§4:

- **state-variants** — T4 needs a real parent, and a spec rarely enumerates states;
- **overlays, modals, drawers, interactions**;
- **cross-cutting systems** — Phase 0's headline finding is that a capability sighted in 3+ modules
  *"is not a feature of any of them"* and **none may take a nav row**. Learning Intelligence,
  Companion presence, mining, pitch accent, provenance-attached claims, progress narrative are
  therefore never candidates;
- **capabilities that live inside another screen** — pitch accent visualisation, adaptive furigana.

### 6.4 The identity trap, stated because it will fire

Matching a spec requirement against existing rows must be done by **product identity, never by
string**. Spec §3.6 is titled *"Speaking & Conversation Practice"*; the repo ships `/conversation`. A
string match reports a gap that does not exist. **Every candidate row must therefore carry a column
justifying why no existing registry row already covers it.**

### 6.5 Output — a proposal, not registry truth

| Candidate | `specRef` | Why it is a destination | Why no existing row covers it | Recommendation |
|---|---|---|---|---|

**Rejected candidates are recorded with their reason too**, so that a later session does not re-derive
the same question and reach a different answer.

**If the pass yields zero candidates, that is a result and must be reported with its evidence** — not
silence. This spec deliberately predicts **no count** for the outcome (`L-002`); anyone who writes one
before the pass runs is guessing.

### 6.6 The gate itself

The user rules the candidate list. **No `spec-only` row is written before that ruling.** If the list
is short and uncontentious, the ruling can happen in chat; a long or contentious list gets a written
proposal. The gate is the approval, never the artifact.

### 6.7 ✅ OUTCOME — the pass ran 2026-08-25 and yielded **zero** `spec-only` rows

**User ruling, 2026-08-25: Stage 2 closes with no rows written.** §6.5 anticipated this outcome and
required it be reported with its evidence rather than as silence — this section is that report.

**Method actually used**, matching §6.1–§6.4: both allowed sources read end to end (`wc -l` first —
they are small, as §6.1 predicted); the three Figma-derived sources never opened; the result
cross-referenced against the registry at HEAD, the `page.tsx` set on disk, and the node list in
`figma-frame-map.md`.

**One candidate survived the three tests of §6.2 far enough to reach the user: Onboarding**
(`japanese-learning-app-spec.md §3.1`). It passed test 1 — §2's directory tree names `onboarding`
alongside `login` and `register`, and §4's schema carries `users.level`, `target_goal` and
`daily_minutes`, three columns only an onboarding surface fills. It passed test 3, and the measurement
is worth keeping: **`target_goal` and `daily_minutes` appear only in migrations — nowhere in `app/`,
`components/` or `lib/`** (positive control fired on `avatar_url`, per `L-019`). The columns exist and
nothing writes them.

**It failed test 2, and Figma settled it — by picture, not by name.** `M7` forbids inferring a frame's
identity from its name, so the four frames of the so-called onboarding cluster were screenshotted and
read. **`111:1556` QuickStart carries all three requirements in one frame**, marked "Step 2 of 5":
*"What best describes you today?"* (5 level options) → `users.level`; *"What brings you here?"*
(11 purpose tags) → `target_goal`; *"How would you like learning to fit into your day?"* (Casual
5-10 / Steady 15-20 / Intensive 30-60 min) → `daily_minutes`. `111:1877` ("Building your Study
Sanctuary…", with a *"Understanding your current level"* checklist) and `111:1963` ("Everything is
ready. → Enter Korume") confirm a complete flow. **Onboarding is a capability already covered by an
existing Figma destination, not a missing one.**

**Two findings from that verification, both deliberately kept OUT of Phase 3:**

1. **`figma-frame-map.md` mischaracterises `111:515`.** It calls that frame part of the
   "QuickStart/Generate-sensei onboarding cluster". Looked at, `111:515` is the **returning-user
   Dashboard** — "Welcome back", Continue Learning, a 12-day streak, Today's Mission, Weakness
   Snapshot. The registry is right (it registers `111:515` as `dashboard`); only the frame map's prose
   is wrong, and it is wrong for the exact reason `M7` exists — the frame was grouped by **canvas
   proximity** rather than by being read. Fix it in whatever pass next edits that file.
2. **Spec §3.1 says "placement quiz ngắn 10 câu"; QuickStart asks one self-assessment question.**
   Per `M13` the presentation is Figma's to choose, so this is not a Phase 3 question. It is flagged
   for **port time** because the two are not the same datum: a self-declared level and a measured
   level differ, and `/lib/difficulty` (the i+1 engine, `CLAUDE.md` §5 priority 2) consumes
   `users.level`. **Do not silently collapse the two concepts** when this screen is ported.

**What this result does and does not license.** It answers the question that opened Phase 3 —
*"Figma vẫn chưa thật sự gen tất cả màn hình… nó có thể là vẫn chưa phủ hết"* — with: **within the
discovery method fixed in §6.1–§6.4, no required destination was found lacking both a frame and an
implementation.** It is **not** a claim that Figma covers everything. The method sees only what the
spec states in words, and §6.1 deliberately bars the three documents that could compensate, because
they are derived from Figma and would make the question circular. That blind spot is the known price
of non-circularity, not an oversight — and it is the reason this outcome is stated as a scoped
measurement rather than as reassurance.

**`landing-page` vs `347:6277` is NOT settled by this.** It is a separate identity question (§9.1),
still open, and the zero result above must never be cited as having resolved it.

---

## 7. Stage 2 — writing the approved rows

1. Write the approved `spec-only` rows, each with its `specRef`.
2. **Add the non-vacuity assertion** to T12/T13 (§8.2) — it is only meaningful once rows exist.
3. Full gate: `tsc`, `vitest`, `lint`, `next build`, Playwright.
4. Whole-branch review (`L-011`), then merge.

---

## 8. Testing

### 8.1 The five changes

| Test | Change |
|---|---|
| **T3** | widen: `figmaNodeId === null` iff `kind` is `repo-only` **or** `spec-only` |
| **R12** | field pin 12 → 13 (§2.2); both-direction check retained |
| **G2** | update the `stamped` pin and the per-date map to measured values (§5.5) |
| **T12** *(new)* | `spec-only` is the empty cell — every field listed in §4.1 |
| **T13** *(new)* | `specRef` present **iff** `spec-only`, and matches exactly one of §4.2's two shapes |

### 8.2 ⚠️ T12 and T13 are vacuous by construction in Stage 1 — and that is handled, not ignored

After Stage 1 the registry holds **zero** `spec-only` rows (§5.6). A loop over the registry is
therefore **unconditionally green**, which `CLAUDE.md` §7 names as a defect.

Both clauses of §7 apply, and the handling differs by stage:

- **Stage 1** — T12/T13 ship **without** a non-vacuity assertion, because zero is the *correct* count
  then. They are proven by **mutation-check**: add a deliberately malformed `spec-only` row, watch the
  suite go red, restore it, and **report both outputs**. Required mutations:
  1. a `spec-only` row carrying a `route` → T12 must fail;
  2. a `spec-only` row with `specRef: null` → T13 must fail;
  3. `specRef: "TODO"` → T13 must fail;
  4. `specRef: "capability-map.md §3"` (a real file, an excluded source) → T13 must fail;
  5. `specRef` set on a `kind: 'screen'` row → T13 must fail.
- **Stage 2** — once real rows exist, **add** `expect(specOnly.length).toBeGreaterThan(0)`.

**T3's widening is also a guard over code that already exists**, so it cannot fail first either and
gets the same treatment: mutate an existing `repo-only` row to carry a `figmaNodeId`, confirm red,
restore.

---

## 9. Open decision points — do NOT resolve while implementing

### 9.1 ⛔ `landing-page` vs `347:6277` — an identity question, reserved to the user

The repo has `landing-page` → route `/`, `kind: 'repo-only'`, `impl: 'built'`. The new frame
`347:6277` is a full marketing landing page (1280×4028). **Three frames now carry the name
"Homepage"**: `111:515` (the onboarding-cluster frame already registered as `dashboard`),
`347:6277`, and `346:6275` — the last being a hidden `rounded-rectangle`, decorative canvas noise,
**not a screen, never to be registered**.

The question is **identity, not content**:

- If `347:6277` **is** the design for the existing `/` → convert the `landing-page` row exactly as
  `register` is converted in §5.2.
- If it is a **different marketing destination** → it must get its own row with its own identity, and
  `landing-page` stays `repo-only`. Forcing it into the existing row because the names are similar
  would be exactly the error `figma-frame-map.md` records from the first capture: *"name-matching said
  'duplicate', canvas width said 'newer iteration', and the screenshot said 'two different products'.
  Only the picture was right."*

**Useful evidence to gather before the ruling** (gathering it is not resolving it): render the current
`/` and compare it against `347:6277` section by section.

### 9.2 The GitHub sign-in button — an Amendment C case 3

`capability-map.md` §3 records the ruling **"Apple yes, GitHub no"** — auth is email + Google + Apple.
Frames `332:3` (Register) and `65:2` (Login) both show a **"Continue with GitHub"** button.

Amendment C names this class explicitly as case 3 — *"a section for a capability a ruling has
removed"* — which is ⛔ **STOP and ask**, never a silent resolution.

**This does not block Stage 1.** Registering a frame records what Figma designed; it does not
authorise building the button. The conflict must be settled **before the auth screens are ported**,
and is recorded here so the porting session does not rediscover it.

---

## 10. Deliverables

| File | Change |
|---|---|
| `lib/product/screen-registry-types.ts` | `ScreenKind` gains `spec-only`; `ScreenEntry` gains `specRef` |
| `lib/product/screen-registry.ts` | 2 conversions (one gated), 7 new rows, header exclusion list gains `335:1588`, charter note |
| `lib/product/screen-registry.test.ts` | T3 widened · R12 12→13 · G2 pins · T12 new · T13 new |
| `docs/product/figma-frame-map.md` | note that the batch is now registered |
| `docs/superpowers/specs/2026-08-23-screen-registry-phase-3-design.md` | this file |
| `docs/lessons.md` | end-of-branch lessons, per `CLAUDE.md` §9 |

---

## 11. Related

`docs/superpowers/specs/2026-08-08-screen-registry-design.md` (R1–R13, T1–T11) ·
`docs/superpowers/specs/2026-08-13-screen-registry-phase-2a-design.md` (§2 — the axis split and G3) ·
`docs/product/screen-inventory.md` § Amendment C (cases 1–4) ·
`docs/product/figma-frame-map.md` § "Second capture batch (2026-08-23)" ·
`docs/product/capability-map.md` §3 (the Apple/GitHub ruling; §3.4 the Kanji dual-surface ruling) ·
`mem:figma_recapture_2026_08_23_run_state` · `mem:figma_backlog_estimate_2026_08_23` ·
`docs/lessons.md` L-002, L-003, L-004, L-005, L-011, L-012.
