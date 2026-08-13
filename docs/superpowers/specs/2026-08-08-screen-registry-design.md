# Screen Registry — design

> **Status:** design approved 2026-08-08. Phase 1 is the only phase specified here.
> **Depends on:** Shadowing Hub Plan C1 merging first. Phase 1 reconciles against master, so it must
> not start while C1's 24 commits sit unmerged on `shadowing-hub-plan-c`.

**One-sentence definition, and the load-bearing constraint of this whole document:**

> **The Screen Registry is a derived, test-enforced reconciliation index between the current Figma
> product inventory and the repository. It is not an independent source of product truth.**

---

## 1. Why now

Two things are true at the same time, and the gap between them is currently invisible:

- The Figma design file `IwFHZDZdHW7qsSFiNbWrkd` holds **59 top-level frames** (3 known dead, several
  are state variants rather than screens).
- The repository holds **44 routes** (`app/[locale]/**/page.tsx`).

The divergence runs in **both directions**. Figma has `Pricing`, `FAQ`, `Checkout`, `Onboarding`,
`Pronunciation library`, `FlashCard` with no repo route. The repo has `community`, `community/peer-review`,
`playlists`, `mining`, `jlpt-test`, `leaderboard`, `reading` that the last survey found no frame for.

Nothing in the system records this. There is no artifact that both Figma and the repo are checked
against, so the divergence is discovered one screen at a time, always late, always as rework.

### 1.1 What this replaces, and what it deliberately keeps

On **2026-08-05** a policy was set: adjudicate Figma-vs-repo divergence **lazily, one screen at a time,
immediately before building that screen**. Its stated reason was that the user was *still designing*, so
a full upfront audit would go stale.

That reason has partly expired. As of 2026-08-08 the user's position is: the frame set is *"khá ổn"* —
stable enough to index — but **not closed**; detail screens will still be added when discovered.

The correct response is not to invert the policy wholesale. It is to split it along the axis of **cost
and volatility**:

| Layer | Cost to inventory | Volatility | Treatment |
|---|---|---|---|
| Screen identity · route · IA placement · chrome · lifecycle | Low — mostly **measurement**, few human rulings | Low — stable once a screen exists | **Inventory now, all screens** (Phase 1) |
| Data · components · states · responsive · copy · behavior | High — a human ruling per screen per layer | High — changes with every design iteration | **Stay lazy** (Phase 3), unchanged from the 2026-08-05 policy |

So the 2026-08-05 policy is **narrowed, not overturned**. It continues to govern exactly the layers it
was written for.

### 1.2 The causal correction that shapes the design

The trigger for this work was the observation that the message catalogs "decide" which screens and routes
exist. **They do not.** A catalog records a decision taken elsewhere — `upcoming.json` did not decide that
nine routes exist; a plan brief did, deriving it from `NAV_GROUPS`, deriving that from an earlier Figma
pass.

The catalog is a *symptom*. Fixing the catalog fixes one instance. The defect is the **missing artifact**,
and that is what this spec adds.

---

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| **R1** | Figma is authority for **experience and IA** (screen identity, navigation, visual structure, responsive intent, the states it actually depicts, visible component patterns). The repo is authority for **implementation** (actual route strings, RLS, data model, ranking, service/client boundaries, API behaviour). The registry is a **derived index** and asserts nothing new. | Figma showing a "Trending" rail does not dictate the query behind it. Plan C1 Task 10 is the worked example: a cross-user ranking read through the RLS-governed client was deterministically wrong in production while every test stayed green. Design intent cannot reach into that decision. |
| **R2** | `kind` (Figma-side classification) and `impl` (repo-side implementation state) are **two independent fields**, never one `status` enum. | Figma existence and implementation existence are independent events. `Pricing` is `kind: screen` + `impl: none`; `playlists` is `kind: repo-only` + `impl: built`. A single-axis enum has to lie about one of them. `planned` disappears as redundant: it is exactly `kind: 'screen'` + `impl: 'none'`. |
| **R3** | `screenId` is **stable product identity** — not a display name, not a route. Renaming a Figma frame does not create a new screen. Changing a route does not create a new screen. `screenId` changes only when the screen's product identity genuinely changes. | If `screenId` is unstable, the registry inherits exactly the fragility of the catalog it is meant to stabilise. |
| **R4** | `NAV_GROUPS` becomes a **derived view** of the registry. The registry owns nav **membership and order**; `app-nav.tsx` keeps **presentation** (icon, label key). | Registry holding `navGroup` while `NAV_GROUPS` holds its own list would manufacture the second source of truth this spec exists to eliminate. Precedent exists in the same file: `NAV_ITEMS` is already re-derived as the flat view of `NAV_GROUPS`. This adds one tier to a pattern already in place. |
| **R5** | **Asymmetric completeness.** Every in-scope route MUST have a registry entry. An entry need NOT have a route. | This asymmetry is what lets `Pricing`/`FAQ`/`Checkout` be recorded as designed-but-unbuilt without being errors, while a route that exists outside the registry is always an error. |
| **R6** | `kind: 'repo-only'` means *"no corresponding Figma node **at this inventory pass**"* — not a permanent classification. | A screen can be designed later. The field records an observation with a date, not a verdict. |
| **R7** | Figma↔registry is **human-reconciled**, stamped with `figmaCheckedAt`. No automated verification of that pair is claimed anywhere. | No CI can reach Figma, and the account is student-tier with Code Connect unavailable (probed, `mem:figma_make_design_source`). `figmaCheckedAt` proves only *"this entry was compared against Figma at time X"* — which is the actual assurance available, and the spec must not imply more. |
| **R8** | Phase 1 ships with **zero visual diff**. The derived `NAV_GROUPS` must be **byte-for-byte identical** to the literal running today. | Phase 1 is a re-index of what exists, not a redesign. If navigation changes during it, that is a Phase 1 defect — not a "cleanup". Every genuine IA change belongs to Phase 2, where it is a deliberate ruling. ⚠️ **Scoped to Phase 1a — see §5's 2026-08-13 amendment.** |
| **R9** | Phase 1 **does not touch any message catalog**. `screenId` adopts the existing nav key wherever one exists (`dashboard`, `lessons`, `speaking`, `journey`, …). | Catalog churn inside a re-indexing task would violate R8 and make the diff unreviewable. ⚠️ **Scoped to Phase 1a — see §5's 2026-08-13 amendment.** The `screenId`-adopts-the-nav-key rule itself still holds, and is now load-bearing in the other direction: new destinations put their `screenId` INTO the catalog. |
| **R10** | The pipeline is **Figma → Screen Registry → IA/route reconciliation → product catalog → UI implementation**. Catalog sits *downstream* of the registry. | Today it runs the other way: a plan brief writes a catalog, and the catalog becomes the de-facto screen list. R10 inverts that. |
| **R11** | State-variant frames are **not screens**. They are `kind: 'state-variant'` with `variantOf` pointing at the screen they are a state of. | `Loading state`, `Error state`, `Empty state (Companion home)`, `Explore Lessons (with preview)` are states of screens. Promoting them to screens because they have node ids would inflate the inventory and corrupt every count derived from it. |
| **R12** | The registry holds **no field describing appearance or behaviour** — no copy, no colours, no layout, no data requirements. | This is the concrete guard on R1. The moment the registry describes how a screen looks, it is a second Figma. |
| **R13** | `kind: 'repo-only'` requires a **`repoOnlyReason` from a closed enum** — never free text, never absent. `'out-of-design-scope'` is machine-restricted to `chrome: 'admin'`; everything else must be `'no-frame-at-last-pass'`. | Without this, `repo-only` becomes the dumping ground for "not inventoried yet" and silently hides an un-surveyed Figma screen — the exact failure this spec exists to prevent. A closed enum forces a classification a reviewer can check; free text degrades into "TODO" that nobody reads. `'no-frame-at-last-pass'` makes the observation **named and countable** rather than absorbed, so Phase 2 can survey it — a reason member records what R6 says (no frame at this pass), not a verdict that the entry is owed review. Widening the `'out-of-design-scope'` allowlist beyond `admin` requires an explicit amendment to this spec — it is not a judgement call at implementation time. |

---

## 3. The registry

### 3.1 Shape

```ts
type ScreenKind =
  | 'screen'         // a real product screen
  | 'state-variant'  // a state of another screen, not a screen itself (R11)
  | 'deprecated'     // frame exists but is superseded or dead — recorded so it is not rediscovered
  | 'repo-only'      // no corresponding Figma node at this inventory pass (R6)

type ScreenImpl =
  | 'built'        // page.tsx exists and renders the real screen
  | 'placeholder'  // page.tsx exists but renders an honest empty/upcoming state, not the screen
  | 'none'         // no page.tsx

type ScreenChrome = 'app' | 'focus' | 'immersive' | 'admin' | 'auth' | 'marketing'

type RepoOnlyReason =
  | 'out-of-design-scope'   // tooling Figma will never cover. Restricted to chrome: 'admin' (R13)
  | 'no-frame-at-last-pass' // no corresponding Figma node at this inventory pass (R6) —
                            // an observation, not a verdict; Phase 2 surveys it

interface ScreenEntry {
  /** Stable product identity (R3). kebab-case. The join key for every other artifact. */
  screenId: string
  /** The Figma frame name, for humans. Display only — never a key (R3). */
  name: string
  kind: ScreenKind
  /** Required when kind === 'state-variant', null otherwise (R11). */
  variantOf: string | null
  /** Null only when kind === 'repo-only' (R6). */
  figmaNodeId: string | null
  /** Required when kind === 'repo-only', null otherwise (R13). */
  repoOnlyReason: RepoOnlyReason | null
  /** ISO date of the last human Figma↔registry comparison (R7). */
  figmaCheckedAt: string | null
  /**
   * Next.js route incl. dynamic segments, e.g. '/kanji/[id]'. Null = designed, no route yet (R5).
   * A non-null route with impl: 'none' is legal and meaningful: the route is decided, not yet built.
   */
  route: string | null
  chrome: ScreenChrome | null
  impl: ScreenImpl
  navGroup: NavGroupId | null
  navOrder: number | null
}
```

### 3.2 Location

`lib/product/screen-registry.ts` — one file, one responsibility. At ~56 entries it will run 300–400
lines. CLAUDE.md §6's ~300-line guidance is about a file taking on a *second responsibility*; a registry
has exactly one, and splitting it would defeat single-lookup, which is its entire purpose. Types and
derivation helpers live beside it in `lib/product/`.

### 3.3 Scope of "in-scope route"

Every `app/[locale]/**/page.tsx` — all 44 today, including dynamic segments and every route group
(`(marketing)`, `(auth)`, `(admin)`, `(protected)/(app)`, `(protected)/(focus)`, `(protected)/(immersive)`).

API routes, layouts, and non-page files are **out of scope**.

### 3.4 Route resolution

**The registry stores the route *pattern*, never a concrete instance.** `/kanji/[id]` is an entry;
`/kanji/123` is not a route and must never appear. A test that treated those as two independent literals
would be wrong on both.

**Do not build file paths from `route` + `chrome`.** That direction encodes an assumption about how route
groups nest and breaks the moment one moves. Go the other way:

> Glob every `app/[locale]/**/page.tsx`, and derive each file's URL route by dropping `app/[locale]`,
> dropping every `(group)` segment, and dropping the trailing `/page.tsx`.

Dropping `(group)` segments *is* the Next.js rule, so the resolver has no rules of its own to get wrong,
and dynamic segments need no special handling — `[id]` survives the transformation untouched because it
is an ordinary path segment. `chrome` is then **read from** the groups that were dropped rather than used
to reconstruct them, which is what makes T8 a real check instead of a tautology.

T1 and T2 become the two directions of one set comparison between derived routes and registry routes.

**An entry is `built` only if its route resolves to a real `page.tsx`.** T2 enforces this;
`impl: 'built'` is never a claim taken on trust.

Route shapes the resolver must handle, all measured present today except where noted:

| Shape | Example | Present |
|---|---|---|
| static, one segment | `/dashboard` | ✅ |
| static, nested | `/community/peer-review` | ✅ |
| one dynamic segment | `/kanji/[id]` | ✅ |
| static segment **after** a dynamic one | `/shadowing/[id]/dictation` | ✅ — the real edge case today |
| two or more dynamic segments | `/a/[x]/b/[y]` | ❌ none exist. The resolver handles it for free; the test asserts it against a fixture so a future route cannot surprise it |
| nested route groups | `(protected)/(focus)/…` | ✅ — two groups deep, must collapse to nothing |
| group at the root | `(marketing)` → `/` | ✅ — must collapse to the index route, not to an empty string |

---

## 4. Enforcement

| Pair | Mechanism | Automated? |
|---|---|---|
| registry ↔ repo routes | test | ✅ yes |
| registry ↔ `NAV_GROUPS` | derivation — cannot diverge | ✅ structurally |
| registry ↔ catalog | test | ✅ yes |
| **registry ↔ Figma** | **human reconciliation, stamped `figmaCheckedAt`** | ❌ **no** (R7) |

The registry does **not** make Figma self-verifying. It guarantees only that *once a human has
reconciled, the repo cannot silently drift away from that result.*

### 4.1 Phase 1 tests

Every one MUST be mutation-checked — break the thing, watch the test go red, restore. An assertion nobody
has seen fail is not yet a test; three separate rounds of Plan C1 shipped assertions that could not fail
while the suite stayed green.

| # | Assertion |
|---|---|
| **T1** | Every derived route (§3.4) matches exactly one entry. A `page.tsx` with no entry **fails** (R5). |
| **T2** | Every entry with `route !== null` and `impl !== 'none'` appears in the derived set — i.e. `built`/`placeholder` is never taken on trust (§3.4). |
| **T2b** | The resolver itself is unit-tested against every shape in §3.4's table, including the two-dynamic-segment fixture that has no counterpart in the repo yet. |
| **T3** | Every entry with `kind !== 'repo-only'` has a non-null `figmaNodeId`; every `kind === 'repo-only'` has `figmaNodeId === null` (R6). |
| **T4** | Every `kind === 'state-variant'` has a `variantOf` naming an existing entry whose `kind === 'screen'`; every other kind has `variantOf === null` (R11). |
| **T5** | `screenId` is unique. `route` is unique among non-null routes. |
| **T6** | The derived `NAV_GROUPS` deep-equals the frozen baseline fixture (R8). In **1a** that baseline was a snapshot of the literal then shipping; in **1b** it is the LOCKED IA, hand-written from `ia-proposal.md` §2. Either way it must be an **independent** oracle — regenerating it from `deriveNavGroups()` makes this test self-referential and silently vacuous. |
| **T7** | Every entry with `navGroup !== null` has a non-null `navOrder`, and `navOrder` is unique within its group. |
| **T8** | For every entry with a `page.tsx`, `chrome` equals the groups actually dropped from that file's path (§3.4) — `chrome: 'focus'` ⇒ the file sat under `(focus)`. Catches a screen moved between chrome contracts. Entries without a page are exempt. |
| **T9** | Every `kind === 'repo-only'` has a non-null `repoOnlyReason`; every other kind has `repoOnlyReason === null` (R13). |
| **T10** | `repoOnlyReason === 'out-of-design-scope'` implies `chrome === 'admin'`. Any other route claiming it **fails**, forcing it into `'no-frame-at-last-pass'` (R13). |
| **T11** | Every entry with `navGroup !== null` has a `route` that resolves to a real `page.tsx` — the reverse direction of T1. See the correction below. *(Id assigned 2026-08-13; the assertion shipped in Phase 1a, mutation-checked, under a name that collided with T2b.)* |

⚠️ **Correction (final whole-branch review, 2026-08-12).** This paragraph used to read "T1 subsumes and
generalises the existing href-resolves guard in `app-nav.test.tsx` … that guard should be folded in, not
duplicated." **That was wrong, and acting on it deleted a live invariant.** T1 and the href-resolves
guard run in *opposite directions*:

- **T1**: every `page.tsx` in the repo has a registry entry — catches a route nobody recorded.
- **href-resolves**: every nav destination reaches a real `page.tsx` — catches a sidebar row pointing
  nowhere.

Neither implies the other. Deleting the second on the strength of the first left a nav entry free to
point at a routeless screen with the whole suite green: repointing a nav entry at a routeless
`/companion` with `impl: 'none'` and moving its page directory away kept T1, T2 and T8 **passing**
while the sidebar rendered a dead link.

**Two-directional completeness is two separate invariants, not one invariant written two ways.** Both
are therefore kept: T1 as specified above, and the reverse direction as **T11**, the nav-destination
assertion in `lib/product/screen-registry.routes.test.ts`. (That assertion originally shipped titled
`T2b`, colliding with the resolver test already holding that id in the table above. Renamed to `T11`
on 2026-08-13 — a rename only; its logic is unchanged.) `deriveNavGroups` additionally *throws* on
`navGroup !== null && route === null` rather than silently filtering the row out, so the same root cause
cannot instead manifest as a nav row that quietly disappears.

### 4.2 Assertions deliberately NOT written

Recorded so a later contributor does not add them "helpfully" — each would contradict a decision above.

- ❌ **"Every Figma frame must have a route."** Directly contradicts R5. A designed-but-unbuilt screen is
  valid data, not an error, and this is the single most likely well-intentioned mistake here.
- ❌ **"Every registry entry must have a `figmaNodeId`."** Contradicts R6/R13 — `repo-only` exists.
- ❌ **"Every route must appear in the nav."** Detail and dynamic routes are reached from their parent;
  `navGroup: null` is normal, not missing data.
- ❌ **Anything comparing registry content against Figma automatically.** Not possible (R7), and a test
  that appears to do it would be lying about the assurance the system has.

---

## 5. Phase 1 scope and acceptance

**In scope:** build the registry; populate it from a measured Figma frame survey plus the 44 repo routes;
derive `NAV_GROUPS` from it; ship T1–T10 plus T2b and T11.

**Out of scope for Phase 1** — every one of these is a Phase 2 or Phase 3 decision:

- Adding, removing, or renaming any screen or route.
- Changing any navigation label, order, or grouping.
- Any message-catalog edit (R9).
- Any data, component, state, responsive, token, or copy work (R12, and the 2026-08-05 lazy policy).
- Closing the 44↔56 gap. Phase 1's job is to make that gap **structured, named, and tested** — not equal.

> ### ⚠️ Amendment, 2026-08-13 — the above is Phase **1a**, not all of Phase 1
>
> This spec was written before Phase 1 was split into **1a (the engine)** and **1b (the IA)**. Read
> as written, R8, R9, T6 and the out-of-scope list above describe **1a**, which shipped exactly that
> way: zero visual diff, no catalog edit, and T6 pinned to the literal then running.
>
> **Phase 1b deliberately does the opposite of three of those lines**, under
> `docs/product/decision-register.md` A1–A14 (LOCKED, user-approved):
>
> | Line above | Phase 1b |
> |---|---|
> | "zero visual diff" (R8) | Navigation changes on purpose. T6 now pins the **hand-written LOCKED IA**, not today's literal. |
> | "does not touch any message catalog" (R9) | Two labels change (A7, A8) and two destinations are added; both are unimplementable without a catalog edit. |
> | "changing any navigation label, order, or grouping" | Is the entire content of 1b. |
>
> Unchanged and still binding in 1b: **R12** (no appearance/behaviour fields), **R1/R3** (the registry
> is an identity index, `screenId` is the join key and is never renamed for cosmetics), **R5**, **R7**,
> and the requirement that every test be mutation-checked.
>
> The record is amended rather than rewritten, per this file's existing 2026-08-12 precedent: what §4.1
> and §5 said at lock time is what 1a was accepted against.

**Acceptance criteria:**

1. T1–T10, T2b and T11 pass, each mutation-checked.
2. **Zero visual diff.** No component's rendered output changes. T6 is the machine-checkable form of this.
3. `tsc` 0 errors; lint error count unchanged from the pre-branch baseline.
4. Every registry entry sourced from Figma carries a `figmaCheckedAt` date from this pass.

---

## 6. Phases 2 and 3 — recorded, not specified here

Each gets its own spec after the phase before it merges. Recorded so the sequence is not lost.

**Phase 2 — Reconciliation.** With the gap now structured and visible, adjudicate it: Figma↔repo,
Figma↔`NAV_GROUPS`, Figma↔catalog, Figma↔routes. Find screens missing, surplus, or renamed. Every
divergence gets exactly **one recorded ruling** so only one source of truth survives — a ruling of
"Figma is right, amend the docs" is entirely valid; leaving two disagreeing sources is not. This is where
C1's provisional outputs (the nine empty-state screens, `NAV_GROUPS`' 22 rows, the six seeded collections,
the `upcoming` catalog) are confirmed or corrected.

Phase 2's work list has two axes, and the registry can generate only one of them:

- **Registry-generated backlog = survey backlog only:** entries with `figmaCheckedAt === null`,
  excluding the permanent `out-of-design-scope` cases where applicable — those carry no stamp by
  design (R13), not because a Figma pass is outstanding.
- **Decision backlog is not derivable from the registry.** Whether an already-surveyed entry still
  needs a product ruling is a decision, not an observation, and the registry has no field for a
  decision (R12). That backlog is owned by the decision register and must be enumerated there.

Phase 1's output *is* the registry-generated half of Phase 2's backlog.

> **2026-08-13 note.** The clause above used to name the `repoOnlyReason` enum member directly as
> the generator (the one renamed in Phase 2a — see that phase's design spec for the old name).
> Phase 2a measured that clause against the registry and found 21 of its 23 entries already carried
> a governing product ruling in their own comment (A2, A4, A5, A7, A10, A11, P16, or an explicit
> judgement call); they were never debt, just unlabeled as resolved. Only `jlpt-test` and `register`
> remain genuinely open. The generator above is corrected to what the registry can actually
> observe — whether an entry has been surveyed at all — rather than the enum, which records an
> observation (R6), not a work-list membership test. ⚠️ **Correction, same-day fix round:** an
> earlier version of this generator read "`figmaCheckedAt` is null **or stale**." That could not be
> evaluated — every `no-frame-at-last-pass` entry carries the identical `2026-08-12` stamp after
> Task 2, and staleness is defined nowhere (R7, §7 risk 2: staleness is *reported*, never
> automated). The two-axis split above is the fix: the registry answers *"has this been compared,
> and when,"* never *"does this still need a ruling."*

**Phase 3 — Per-screen adjudication, lazily.** Data, components, states, responsive, copy, behaviour —
decided immediately before a screen becomes implementation, never weeks ahead. Unchanged from the
2026-08-05 policy, and now anchored: each screen has a registry row to hang its ruling on.

**When Figma gains screen 60:** add a registry entry → reconcile that one entry → update catalog/docs/route
if needed → implement. **Never re-audit all 59.** This is the property that makes the registry worth
building rather than writing a snapshot document.

---

## 7. Risks

1. **The registry drifts into becoming a third source of truth.** This project's most expensive recorded
   failure mode is two silently-disagreeing sources — Plan A spent an entire plan cleaning one up.
   *Mitigation:* R1 + R12, and R12 is a reviewable rule: any proposed field describing appearance or
   behaviour is rejected on sight.
2. **`figmaCheckedAt` rots silently.** Dates go stale and nobody notices. *Mitigation:* none automated,
   and the spec says so (R7). Phase 2 reports staleness; it is not enforced.
3. **The `NAV_GROUPS` derivation changes navigation.** *Mitigation:* T6, against a snapshot frozen
   **before** the refactor begins. Capture the snapshot first, not after.
4. **Someone "fixes" the 44↔56 gap during Phase 1.** It is the most visible thing the inventory produces
   and the most tempting to act on. *Mitigation:* §5 out-of-scope, and acceptance criterion 2.
5. **The Figma survey is treated as permanent.** It is dated evidence, exactly as Plan C spec §7 is.
   *Mitigation:* `figmaCheckedAt` per entry rather than one date for the file — staleness is per-screen,
   because that is how it actually occurs.
6. **`repo-only` becomes the dumping ground for "not inventoried yet."** Raised by the user, and it is
   the most likely way this registry quietly stops being true: a surveyor who cannot find a frame reaches
   for `repo-only` and the screen disappears from the gap analysis. *Mitigation:* R13 — the reason enum
   has no "unknown" member, `'out-of-design-scope'` is machine-restricted to `admin` (T10), and everything
   else lands in `'no-frame-at-last-pass'`, which is countable and reported by Phase 2 — named, not
   absorbed.
7. **`screenId` chosen from display names.** The most likely way R3 gets violated in practice, because
   frame names are what the surveyor is reading at the time. *Mitigation:* R9 — adopt existing nav keys
   where they exist, which forces identity to come from the repo's stable vocabulary rather than from
   Figma's current labels.

---

## 8. Evidence

Measured 2026-08-08 unless noted.

- **44 routes**, `find "app/[locale]" -name "page.tsx" | wc -l`. Distribution: 5 `(admin)`, 2 `(auth)`,
  1 `(marketing)`, 33 `(protected)/(app)`, 2 `(protected)/(focus)`, 1 `(protected)/(immersive)`.
- **59 Figma top-level frames** — `docs/superpowers/specs/2026-08-07-shadowing-hub-plan-c-design.md` §7.4,
  measured 2026-08-07. Dead frames: `Unuse` (`5:1718`), `Pricing-remove` (`71:2`), and the superseded
  `Shadowing Hub` (`90:1985`, replaced by `149:2`).
- Known state-variant frames: `Loading state`, `Error state`, `Empty state (Companion home)`,
  `Explore Lessons (with preview)` (`200:10726`, same screen as `200:7705`).
- **Code Connect unavailable** — Figma returns a Dev/Full-seat requirement; the account is student-tier.
  The design file has 0 components, 0 instances, 0 variables (`mem:figma_make_design_source`). This is
  the evidence behind R7.
- `get_metadata` on the whole page returns ~4.4M characters. The frame survey must query per-frame or
  parse a saved dump with a script — never read the page dump into context.
- `NAV_ITEMS` is already derived from `NAV_GROUPS` in `components/layout/app-nav.tsx` — the precedent
  cited in R4.
