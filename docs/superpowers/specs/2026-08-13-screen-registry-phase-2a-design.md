# Screen Registry — Phase 2a: Reconciliation of product truth

**Status:** approved by the user 2026-08-13, in sections, during brainstorming.
**Predecessor:** `2026-08-08-screen-registry-design.md` (R1–R13, T1–T11) · Phase 1a `fff90fa` ·
Phase 1b `6f67dd1`.
**Successor:** Phase 2b — A9 `/jlpt` → `/certification` and its migration. **Deliberately not this
spec.**

---

## 1. Why 2a exists, and the measurement that produced it

The spec's Phase 2 is *Reconciliation*: adjudicate every divergence so exactly one source of truth
survives. Its work list is **generated, not guessed** (§5): every `repoOnlyReason:
'legacy-unreviewed'`, every `impl: 'none'`, every stale `figmaCheckedAt`.

Generating it produced a result that changed the shape of the phase:

| Measured at `c03011f` | |
|---|---|
| entries carrying `legacy-unreviewed` | 23 |
| …of those, **already covered by an existing ruling** | **14** |
| …**sub-routes inheriting a ruled parent** | **7** |
| …**genuinely open — no ruling exists** | **2** (`jlpt-test`, `register`) |
| entries with `impl: 'none'` | 33, all `route: null` |
| entries with a stale `figmaCheckedAt` | **0** — 51 read `2026-08-12`, 28 read `null` |

**Twenty-one of twenty-three were never debt** — the 14 + 7 in the rows above. The registry's own
per-entry comments already cite the ruling that settled them (`vocab` → A10, `challenges` → A5,
`weeklyReport` → A2, `statistics`/`achievements` → A4, `playlists` → A11, `mining` → A7,
`landing-page` → P16). What made them look like debt was the **name of an enum member**, not their
state.

> ⚠️ **Correction, final fix wave (2026-08-14): `register` was counted here as ruled, on frame
> evidence.** The first version of this table read 15 / 7 / 1 and licensed `register` by citing
> `screen-inventory.md` — *"Figma has `Login` but no register frame"*. **That is a has-no-frame
> observation, not a ruling**, and reading it as one is exactly the axis leak §2 forbids. Nothing in
> `decision-register.md` rules on `/register`; `screen-inventory.md` §3's Ruling column reads *"still
> open"*, and `2026-08-08-screen-registry-design.md`'s own 2026-08-13 note already said *"Only
> `jlpt-test` and `register` remain genuinely open"* — so the branch contradicted itself and this
> section was the wrong half. **No ruling is invented for `/register`. Recording that none exists is
> the honest outcome**, and it is now what the registry entry's comment says too.

> ⚠️ **Method note, and the reason this section leads with a measurement.** The phase was very
> nearly scoped from `mem:screen_registry_inputs` (written 2026-08-11), which framed Phase 2 as
> "the A10 hides plus A9". **A10 had already shipped in Phase 1b** — all four routes carry
> `navGroup: null` at HEAD and `navigation-system.md:70` says so in plain text. User ruling,
> 2026-08-13: **the registry at HEAD is the current inventory; an older memory is historical input
> only.** `L-002` applied to scope rather than to counts.

---

## 2. The invariant this phase is built on — user wording, 2026-08-13

> **Has a frame / has no frame** is an **observation axis**, owned by the registry.
> **Has a ruling / has no ruling** is a **decision axis**, owned by the decision register.
> **Neither axis may be inferred from the other, in either direction.**

Concretely:

- a non-null `figmaNodeId` does **not** mean a product ruling exists;
- a null `figmaNodeId` does **not** mean one is missing;
- `figmaCheckedAt` says **when Figma was last surveyed**, and nothing about approval.

This is why 2a adds **no `ruledBy` / `ruledAt` field**. The user rejected it explicitly: 21 of 23
such fields would merely point at a ruling already written down, turning the registry into a second
decision register — `CLAUDE.md` §6. If a "has this been adjudicated" query is ever needed, derive it
from the decision register or build a reporting layer; do not make the registry answer it.

**Second reading, considered and NOT taken.** The invariant could be read as *"an entry with
`kind: 'screen'` must also be able to record that it has no frame"*. That collides with **T3**
(`kind !== 'repo-only'` ⇒ non-null `figmaNodeId`) and is a far larger change. 2a takes the first
reading. Recorded so a later pass does not re-derive the question.

---

## 3. Deliverables

2a has exactly two, and they are different in kind.

### 3a.1 — Schema semantics

```ts
export type RepoOnlyReason = "out-of-design-scope" | "no-frame-at-last-pass";
```

`legacy-unreviewed` → `no-frame-at-last-pass`. The new name states what the registry actually
knows: *at the last Figma comparison, this entry had no corresponding frame.* It asserts nothing
about review or debt. **R6 already defined the field this way** — "records an observation with a
date, not a verdict" — so this aligns the name with semantics the spec has held since day one.

Amendments required, and the phrasing is load-bearing:

| Where | Change |
|---|---|
| **R13** rationale | Delete "…where Phase 2 counts it as debt". A reason member is an observation. |
| **T10** | Unchanged in logic (`out-of-design-scope` ⇒ `chrome === 'admin'`); rename the other member in its prose. |
| **§5** Phase 2 work list | The generator clause must stop naming the enum. |
| **§7** risk 6 | "everything else lands in `legacy-unreviewed`, which is countable and reported by Phase 2" — rename and drop the debt framing. |

**Every sentence anywhere in the repo of the form "`legacy-unreviewed` entries are Phase 2 debt"
must disappear.** A backlog is never generated from the name of an enum member again.

**The backlog predicate becomes evidence-based:** the set still needing a Figma pass is
`figmaCheckedAt === null`, excluding the permanent `out-of-design-scope` cases where applicable —
those carry no stamp by design, not because a pass is outstanding — rather than any value of
`repoOnlyReason` used as the generator. ⚠️ **Correction, fix round 1 on Task 4 (2026-08-13):** the
original wording here omitted the `out-of-design-scope` exclusion; the user's ruling on that fix
round is the semantics recorded above.

### 3a.2 — Evidence and the `figmaCheckedAt` backfill

Today **all 28 `repo-only` entries carry `figmaCheckedAt: null`**, while their own comments cite the
survey that compared them (`vocab`: *"No frame in the 57 covers Vocab (§4)"*). The comparison
happened; the stamp says it never did. Under **R7** that stamp is the only assurance this system
claims, so a null there understates the work and makes the staleness predicate meaningless.

Measured, and the identity matters — it is not a coincidence of size: **the set of `kind:
'repo-only'` entries and the set of `figmaCheckedAt === null` entries are the same 28 entries**,
with zero on either side of the difference. And the registry holds **exactly one** distinct stamp
value, `2026-08-12`.

Backfill is **evidence-driven, never blanket**.

| Case | `figmaCheckedAt` |
|---|---|
| Cited evidence that the Phase 0 pass examined this entry | `2026-08-12` — that pass's own date |
| Known frameless, but nothing ties the finding to a dated pass | `null` |
| Never compared | `null` |

> ⚠️ **`2026-08-12` is a date, not a default, and the difference is the whole rule.** It is the date
> of the pass that stamped the other 51 entries, so an entry the same pass demonstrably examined
> inherits it. **The citation is what licenses the stamp, not the entry's membership in
> `repo-only`.** Stamping all 28 because they happen to be repo-only is the exact failure this
> design exists to prevent, and §5's size assertion is what catches it.

Admissible evidence, each citable to a **section and a quoted row** — never to a line number.
Line citations into `screen-inventory.md` went stale twice inside this phase alone (Task 4 inserted
a line above Task 3's citations; the final fix wave struck two rows from §3's table), so the
convention is now sections, and `screen-registry.ts`'s header records it:

- a registry comment naming an inventory section (`vocab`, `grammar`, `kanji`, `weeklyReport`, …);
- `screen-inventory.md` §3's per-route adjudication table (`register`: *"Figma has `Login` but no
  register frame"*);
- `screen-inventory.md` §4's closing *"Frameless with no such conflict"* list (`/review`,
  `/achievements`, `/challenges`, `/statistics`, `/register`).

Every remaining `null` afterwards means one of **two** true things — nobody has compared this entry
yet, or it is `out-of-design-scope` and therefore never comparable (§3a.1). It never means "we
forgot", which is the property that makes the null set readable as a survey backlog at all. The G2
test's comment carries the same two-reason wording.

### 3a.3 — Reconciliation of comments and stale lists

No new product decisions. Three kinds of edit:

1. **14 group-A entries** — add or correct the comment so it cites the ruling that already governs
   them. Several entries carry **no comment at all** today (`register`, `community-detail`,
   `vocab-review`, …). Enumerated here so the plan cannot quietly cover thirteen of them (`L-023`):

   | Entry | What already governs it |
   |---|---|
   | `vocab` · `reading` · `community` · `leaderboard` | **A10** — hidden, code kept, explicitly not `deprecated` |
   | `challenges` | **A5** — absorbed into Roadmap |
   | `weeklyReport` | **A2** — absorbed into Companion; `screen-inventory.md` §12.4 rules OUT `Growth Areas` as its frame |
   | `statistics` · `achievements` | **A4** — Dashboard summary, Profile gallery |
   | `playlists` | **A11** — stays its own screen |
   | `mining` | **A7** — relabelled `Collection`; `screenId` deliberately unchanged |
   | `landing-page` | **P16** — no landing page exists yet, known and accepted |
   | `kanji` · `grammar` · `review` | Nav rows under the LOCKED IA (**A1**); `repo-only` because no frame matches, each with a judgement call already recorded in the registry comment |

   ⚠️ **`register` used to be a fifteenth row here and is not one.** Its entry gets a comment like
   the rest, but that comment records **frame evidence only** — `screen-inventory.md` §3's table,
   row `/register` (*"Figma has `Login` but no register frame"*) and §4's *"Frameless with no such
   conflict"* list. **No product ruling governs `/register`**, so nothing goes in the "what already
   governs it" column; see §1's correction. The comment must say so in as many words, or the next
   reader repeats the inference.
2. **7 group-B sub-routes** — state that they inherit their parent's ruling
   (`community-detail`/`community-peer-review` ← A10 · `reading-detail` ← A10 ·
   `vocab-detail`/`vocab-review` ← A10 · `playlists-detail` ← A11 · `mining-review` ← A7).
3. **Stale lists, which are a false backlog for this very phase:**
   - `screen-inventory.md` §5's "### Still open" list — item 1 (the vocab-shelf conflict) is
     **resolved in §11.1** of the same file, under *"⭐ This frame resolves an open question carried
     since 2026-08-11"*: the shelf sits inside Companion home, so it is companion-owned and hiding
     `/vocab` costs it nothing. Item 3 is settled by **A12**, item 7 by **A11**, and **item 4 by
     this file's own §11.5 and §12.4** (`Companion Knowledge Assistant` → `/sensei`; `Growth Areas`
     → **not** `/weekly-report`) — struck in the final fix wave, 2026-08-14. Items 2, 5, 6 stay
     open.
   - `screen-inventory.md` §3's "Not yet adjudicated" table — most rows now have rulings. ⚠️ Two of
     its rows, `/dashboard` and `/sensei`, asserted framelessness the registry contradicts
     (`figmaNodeId` `111:515` and `215:15164`, both `kind: "screen"`) and were struck in the final
     fix wave; §3 carries a note saying where each frame mapping lives.
   - any surviving "debt" phrasing from 3a.1.

### 3a.4 — Adjudicate `jlpt-test` (ruling only)

**Ruling, user 2026-08-13:**

> **`/jlpt-test` is deprecated dead route code. Remove it: it has no callers, and its redirect
> target is itself superseded by A9.**

Measured basis:

- the route is eight lines, a bare `redirect()` to `/jlpt`, commented *"Old placeholder route — the
  JLPT test engine now lives at `/jlpt` (Layer 5)"*;
- **no app code references the route.** Every `jlpt-test` hit in code is a component filename
  (`jlpt-test-runner` / `-list` / `-card`);
- `lib/supabase/route-protection.ts:14` still lists `/jlpt-test` — that is **evidence of the debt,
  not evidence the route is alive**;
- `japanese-learning-app-spec.md:76` still lists `/jlpt-test`, so three names exist for one thing:
  the spec says `/jlpt-test`, the repo runs `/jlpt`, A9 locks `/certification`.

**2a records this ruling and changes no route.** Execution belongs to 2b, and **the edit list is
deliberately not restated here.** It has exactly one home: **A16 in `docs/product/decision-register.md`
§2.** Read it there.

> ⚠️ **Why this paragraph is a pointer and not a list.** It used to carry its own copy of the edit
> list, and that copy was wrong in two ways the moment A16 was corrected: it gave a smaller edit
> count (the registry entry deletion was missing), and it named
> `lib/supabase/route-protection.test.ts`'s **filesystem-driven coverage test** as the guard for this
> class. That test walks the `page.tsx` files that *exist*; deleting a page only shrinks its walk, so
> it structurally cannot detect a prefix that outlived its route. A16 names the **pin test** at
> `lib/supabase/route-protection.test.ts:19-53` instead. Two copies of an edit list is `CLAUDE.md`
> §6's "one fact, one home" — and §6 of this spec routes 2b straight back here, so a stale copy at
> this exact spot sends an implementer to do the wrong work and then to reproduce a failure that
> cannot happen.

**No `kind: 'redirect'` is added in 2a.** Adding one now would model a *hypothetical* 2b redirect.
If 2b genuinely needs `/jlpt` → `/certification` to survive as a redirect, that is a real artifact
with a real shape, and the schema decision can be made against it then.

---

## 4. Consequences deliberately left open

- **The T3 gap stays open.** `kind: 'deprecated'` requires a non-null `figmaNodeId`, so a frameless
  dead route cannot be marked dead. 3a.4 removes the only entry that needed it, so the gap has no
  live instance. **Do not solve it speculatively** — revisit only if 2b produces a real redirect.
- **The 33 `impl: 'none'` entries are confirmed as designed-but-not-built.** That is a statement of
  fact, **explicitly not a commitment to build them**. Per-screen adjudication is Phase 3, lazily,
  immediately before implementation.

---

## 5. Verification

Ordinary gate: `tsc --noEmit` · `vitest run` · `next lint` · `next build`.

Specific to this phase:

1. **The rename is compile-time complete.** `RepoOnlyReason` is a union, so `tsc` names every site.
   As with the `T2b` → `T11` rename, `git diff` must show **zero logic change** in the rename commit.
2. **T9 and T10 keep their assertions**, with only the member's name changed in prose. T10's logic
   (`out-of-design-scope` ⇒ `chrome === 'admin'`) is untouched.
3. **A size assertion guards the backfill.** Assert the exact number of entries with
   `figmaCheckedAt !== null` after 3a.2, so a later blanket-stamp — the failure mode this design
   exists to prevent — turns the suite red instead of passing quietly.
4. **Every assertion here is written over code that already exists and therefore cannot fail
   first.** `CLAUDE.md` §7: mutation-check each one — break the thing it guards, watch it go red,
   restore, and report both outputs.
5. **A repo-wide sweep, run to exhaustion** (`L-024`, whose newest evidence is a sweep on this very
   branch family that stopped at its first hit): grep for `legacy-unreviewed` and for "debt"
   phrasing across `docs/`, `lib/`, `.serena/memories/` — not only the files this spec names.

---

## 6. Order of work

**2a.1 schema semantics → 2a.2 evidence/backfill → 2a.3 triage + stale lists → 2a.4 `jlpt-test`
ruling → whole-branch review of 2a.**

Then, and only then, **2b**: A9 `/jlpt` → `/certification` with its migration, plus execution of
3a.4. A9 is kept out of 2a on purpose — it is a real migration touching two DB tables, four API
route groups, three page routes, `lib/jlpt`, `lib/data/jlpt`, `lib/validation/jlpt`,
`components/jlpt` and the i18n namespace. Mixing 23 reconciliation edits with a schema migration
would make a red diff impossible to attribute, which is the same reasoning that split 1a from 1b.

---

## 7. Out of scope for 2a — each is a defect if it appears in the diff

- Any change to app code, API routes, DB schema, or route implementation. **Including deleting
  `/jlpt-test`**, which 2a only rules on.
- A9, in whole or in part.
- A `ruledBy` / `ruledAt` field, or any other field recording adjudication.
- A `kind: 'redirect'`, or any schema support for redirects.
- Solving the T3 frameless-`deprecated` gap.
- Re-opening any LOCKED ruling in `decision-register.md` §1 or §2.
