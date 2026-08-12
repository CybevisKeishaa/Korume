# Korume — Information Architecture · PROPOSAL

> **STATUS: PROPOSED, NOT LOCKED.** This document exists to be argued with. The user's standing
> instruction is that the assistant may *propose* an IA but must **stop for human review before the
> IA and navbar are locked**, and that Screen Registry Phase 1 begins only after the lock.
> **Nothing here has been implemented. No screen has been ported. `app-nav.tsx` is untouched.**

**Derived 2026-08-12** from `docs/product/capability-map.md` (12 capability areas, six cross-cutting
systems, the four rulings in §3) and `docs/product/screen-inventory.md` Part II (§6–§20, every Figma
frame read from a live screenshot).

**Built by the five rules recorded in `capability-map.md` §4**, so this is reproducible rather than
improvised:

1. Destinations come only from frames classified `screen`.
2. Panels, interactions and generated content never earn a nav row.
3. Overlays are presentation; a route only where the URL must be shareable or state-recoverable.
4. Grouping follows capability areas, **not** the current sidebar. ~~Both existing navbars are
   demos.~~ ⚠️ **Half of that rule is wrong and §6 corrects it** — only the reference render is a
   demo. `NAV_GROUPS` implements an **Approved** design doc, so this proposal is an *amendment*.
   The grouping instruction stands; the dismissal of the existing navbar does not.
5. The four `capability-map.md` §3 questions are answered first — ✅ all four ruled 2026-08-12.
   Three further rulings (§3.2, §3.3, §3.4 of this document) followed on the same day.

To re-derive the inputs rather than trust a number in this file (`L-002`):

```bash
# every frame classified as a screen
grep -nE '^### .*`CONFIRMED` screen' docs/product/screen-inventory.md
# everything deliberately excluded from the nav
grep -nE '^### .*(STATE-VARIANT|interaction|MODAL|NOT screens|component)' docs/product/screen-inventory.md
# the nav literal this proposal changes
grep -n 'href:' components/layout/app-nav.tsx
```

---

## 1. The one idea this IA is built on

**A screen is not a destination.** The inventory found many more `screen`-classified frames than a
sidebar can carry, and the naive move — one frame, one nav row — produces a navbar that mirrors the
design file instead of the learner's intent. Two disciplines cut it down:

- **§1 of the capability map**: six capabilities appear in three or more unrelated modules. They are
  *systems*, and a system that gets a nav row has been mistaken for a place.
- **Hubs already exist in the design.** `156:1310` Companion home carries `See all` ×5 plus
  `View diary` and `View full journey`. The design already says those six Companion screens are
  **one destination with depth**, not six peers. The IA only has to read what the frame drew.

So the structure is **destination → surfaces within it**, and the navbar lists destinations only.

### ⭐ The principle that resolves the hardest cases: **Taxonomy ≠ Navigation**

*(User, 2026-08-12, ruling on Pronunciation — named here because it generalises well beyond it.)*

**A thing's position in the data model does not determine its position in the navbar.** The two
answer different questions:

| | Question it answers | Governed by |
|---|---|---|
| **Taxonomy** | *what kind of thing is this, and what does it roll up into?* | the skill model (`capability-map.md` §3.2) |
| **Navigation** | *is this somewhere a learner deliberately goes?* | the size and independence of its surface |

**Worked example, and the reason the principle exists:** Pronunciation is a **tier-2 sub-skill under
Speaking** in the taxonomy — it may never be summed into a score of its own. It is simultaneously a
**top-level destination** in the IA, because `37:4955` draws a library big enough to go to on purpose.
Both are true at once, and neither weakens the other.

**Applied in the other direction it is just as useful:** `Challenges` and `Achievements` are
first-class *concepts* in the gamification model and get **no nav row at all** (§3.4, §3.3), because
neither has an independent surface. A concept's importance is not a claim on the sidebar.

**The shape that results** maps to the learning loop rather than to a feature list:

```
LEARN      encounter material          →  Dashboard · Lessons · Kanji · Grammar
PRACTICE   produce language yourself   →  Speaking · Pronunciation · Certification
REMEMBER   keep what you met           →  Review · Collection · Playlists
JOURNEY    see yourself change         →  Journey · Companion
ACCOUNT    you                         →  Profile · Settings
```

---

## 2. The proposed navigation

`NEW` = no route today · `RENAME` = route or label changes · `KEEP` = unchanged ·
`ABSORB` = today's nav row disappears into a parent · `HIDE` = row removed, code kept.

### Group `learn` — encounter material

| Row | Route | Frame | Change | Note |
|---|---|---|---|---|
| **Dashboard** | `/dashboard` | `111:515` | `KEEP` | Absorbs Statistics; carries an Achievements *summary* — see §3.3 |
| **Lessons** | `/shadowing` | `149:2` | `KEEP` | The hub: resume · import · recommendations |
| **Kanji** | `/kanji` | `280:3` + `29:2890` | `KEEP` | One row, two surfaces — ruling `capability-map.md` §3.4 |
| **Grammar** | `/grammar` | repo + `284:1464` | `KEEP` | Catalogue + Sentence Analysis |

### Group `practice` — produce language yourself

| Row | Route | Frame | Change | Note |
|---|---|---|---|---|
| **Speaking** | `/conversation` | `170:9364` | `KEEP` | Scenario library → live session |
| **Pronunciation** | `/pronunciation` | `37:4955` | `NEW` | Not a leaf of Shadowing — see §3.5 |
| **Certification** | `/certification` | `232:2` | `RENAME` | Was `/jlpt`. Migration ⇒ **Phase 2** |

### Group `remember` — keep what you met

| Row | Route | Frame | Change | Note |
|---|---|---|---|---|
| **Review** | `/review` | — | `KEEP` | SRS across kanji/vocab/mining |
| **Collection** | `/mining` | `28:2041` et al. | `RENAME` | The mining family's home — see §3.6 |
| **Playlists** | `/playlists` | — | `KEEP` | Ordered, shareable lesson collections |

### Group `journey` — see yourself change

| Row | Route | Frame | Change | Note |
|---|---|---|---|---|
| **Journey** | `/roadmap` | `64:2061` | ⭐ `RENAME` | The label moves here from `/journal` — ruling `capability-map.md` §3.3 |
| **Companion** | `/companion` | `156:1310` | `NEW` | Hub over six Companion screens — see §3.1 |

### Group `account`

| Row | Route | Frame | Change | Note |
|---|---|---|---|---|
| **Profile** | `/profile` | `66:166` | `KEEP` | |
| **Settings** | `/settings` | `220:16032` | `KEEP` | |

---

## 3. Every non-obvious call, with its evidence

### 3.1 The Companion is **one** destination, not six

`156:1310` is a hub by construction. Six `screen`-classified Companion frames sit beneath it:

| Surface | Frame | Route under the proposal | Today |
|---|---|---|---|
| Companion home | `156:1310` | `/companion` | ❌ none |
| Diary | `190:7376` | `/companion/diary` | `/journal` `(immersive)` ✅ |
| Knowledge assistant (**Sensei**) | `215:15164` | `/companion/sensei` | `/sensei` ✅ |
| Learning memory | `180:1770` | `/companion/memory` (`Learning`) | ❌ none |
| Conversation memories | `184:3974` | `/companion/memory` (`Conversations`) | ❌ none |
| Growth areas | `187:6556` | `/companion/growth` | `/weekly-report` (placeholder) |

**Why this is not just tidying:** the `capability-map.md` §3.1 ruling settled that Sensei and the Companion are one presence.
An IA that lists `Sensei` beside `Companion` in the sidebar re-creates the two-entity confusion the
ruling just removed — the nav would be asserting a product fact that is false.

**Three nav rows disappear into this one** (`/sensei`, `/journal`, `/weekly-report`). All three routes
survive; §5 covers how without breaking links.

**⚑ Costs, stated rather than hidden:**
- The Diary is `(immersive)` and Companion home is `(app)`. Nesting a route does **not** nest chrome —
  the `(protected)/(app)/(focus)/(immersive)` contracts are route-group-based, so `/companion/diary`
  must still resolve into `(immersive)`. Check this against `route-group-provider-identity.spec.ts`
  before implementing.
- ~~`184:3974` as a query param is a judgment call.~~ ✅ **RULED — see §3.2.**

### ✅ 3.2 Memory is **one surface with two types** — user ruling, 2026-08-12

Conversation Memories does **not** become a route beside Learning Memory. Both are types within
`/companion/memory`:

```
Companion
└── Memory
    ├── Learning        180:1770
    └── Conversations   184:3974
```

**The user's reasoning, and it is the stronger version of my own:** the Companion holds *many* kinds
of memory — Learning Memory, Conversation Memories, the Vocabulary Shelf, `THINGS WE'RE STILL
PRACTICING`. Promote one to a destination and there is no principled reason to refuse the others, and
the sidebar drifts toward:

```
Companion · Conversation Memories · Learning Memory · Growth Areas · …
```

— which flattens into peers exactly what `156:1310` drew as **depth**. The archive being split by
type is a fact about the *content*, not a claim to a route.

**Consequence for the model:** the type is a first-class attribute of a memory, not two tables that
happen to look alike. Whether the switch is a query param, a tab, or client state is an
implementation choice this IA deliberately does not make.

### 3.3 Statistics folds into the Dashboard; Achievements splits **summary vs gallery**

`111:515` already draws `WEEKLY EVOLUTION`, a `LEARNING ACTIVITY` heatmap, `RECENT ACHIEVEMENT`,
`LEARNING JOURNEY` and `WEAKNESS SNAPSHOT` — the whole content of `/statistics`, in the place a
learner already looks first. Both routes are `UpcomingScreen` placeholders today, so nothing built
is lost.

**✅ Achievements — user ruling, 2026-08-12.** I flagged that a *gallery* (all badges, including
unearned) has no home on a dashboard card. The ruling splits it by job rather than duplicating it:

```
Dashboard
└── Achievement summary        "8 / 24 achievements  [View all]"
        ↓
Profile
└── Achievements
    ├── Earned
    └── Locked
```

**Why this is right and not merely tidy:** a summary answers *"am I making progress?"* — a glance,
which belongs on the Dashboard. A gallery answers *"who am I as a learner?"* — browsing, which
belongs on the Profile. `66:166` already draws a **learning-journey milestone timeline**, so the
gallery joins an identity surface that exists rather than inventing one. **No nav row is spent on a
destination whose only job is to open a gallery** — an application of Taxonomy ≠ Navigation (§1).

⚑ **Note for whoever builds it:** the `Locked` half means the achievement *catalogue* must be
readable independently of what the learner has earned. Not a schema claim — I have not measured the
gamification tables — but the shape to check first.

### ✅ 3.4 `/challenges` is a Roadmap surface, not a destination — user ruling, 2026-08-12

**No nav row.** Challenges are a capability of the Journey/Mission system.

**The evidence the ruling rests on:** the inventory established that the Roadmap *is* a mission
system — `Journey → Chapter → Mission → {required lessons · measurable practice gates · skills
built} → Unlocks → next Mission` (`64:2061`, `180:2`). A challenge is a measurable gate with a
reward. That is a mission, described in different words.

**The user's rule, which is the durable part:** *do not create a destination merely because the repo
has a route.* `/challenges` has **no Figma frame** and no prior ruling; it is a C1 placeholder. An
IA derived from the design must not inherit structure from an accident of the codebase.

**Reversible on evidence:** if Figma later designs a standalone challenge hub, reopen this. The
route itself stays (`app-nav.test.tsx` asserts every href resolves to a page file, and the honest
`UpcomingScreen` pattern is already established) — only the nav row goes.

### 3.5 Pronunciation earns its own row; it is not part of Shadowing

The tempting read is "pronunciation is one of the four Learning Modes, so it lives inside a lesson".
The frames say otherwise: `37:4955` **borrows content from two other modules** — `JLPT Speaking` and
`Shadowing Collections` — and adds `Popular Learning Paths`, `Practice by Situation` and
`Practice by Goal` shelves of its own. A surface that composes across modules is a destination.

This is also where **pitch accent** — sighted in four independent surfaces — has a home without
becoming a nav row itself, satisfying §1 of the capability map.

**✅ Confirmed by the user, 2026-08-12, and it is what named the §1 principle.** Pronunciation is a
**tier-2 sub-skill under Speaking** in the taxonomy (`capability-map.md` §3.2) *and* a top-level
destination in the IA. Those two facts do not compete: the taxonomy governs what may be scored and
rolled up, the IA governs where a learner goes. **A thing can be a sub-skill in the data model and a
destination in the UX.** See §1 § *Taxonomy ≠ Navigation*.

### 3.6 `Collection` — one word for a family sighted six times

`/mining` is built and is sentence mining specifically. But the save-and-collect family shows up in
six unrelated places (kanji `Add to Review`/`Favorite`, search `Favorites`, lesson preview bookmark,
summary vocabulary bookmark, conversation `Save Mistake`, sentence analysis `Add to Vocabulary`), and
the user has stated the intent plainly: **a save button everywhere, with the results collected**.
A row labelled `Mining` names one of six entry points.

**⚠️ This is a label change only in this document.** The underlying "save everywhere → one surface"
feature is blocked, and the block is **at the API layer, not in the schema** — worth stating
precisely, because the two have very different costs:

- `sentence_mining_cards.transcript_line_id` is **nullable** (`references transcript_lines (id) on
  delete set null`, `20260712000008_sentence_mining_cards.sql:11`). The table would accept a card
  with no transcript line.
- `createMiningCardSchema` requires `lineId: z.string().uuid()` (`lib/validation/mining.ts:10`), and
  `createMiningCard` **derives the sentence text, translation and timestamps server-side from that
  row** rather than trusting the client. That derivation, not a `NOT NULL`, is why a reading passage
  has no legal way to mint a card.

So unblocking needs a source discriminator and an alternate derivation path — carried as F-010/F-014
— **not a column migration**. **The IA reserves the place; it does not authorise the build.**

### 3.7 The four rulings, applied

| Ruling | Where it lands in this IA |
|---|---|
| Sensei = a Companion mode | one `Companion` row; `/sensei` becomes `/companion/sensei` (§3.1) |
| Two-tier skill taxonomy | tier 1 is what `/dashboard` and `/companion/growth` may score and compare; tier 2 diagnoses inside them. **No skill gets a nav row** |
| `Journey` = the Roadmap | the label moves to `/roadmap`; `/journal` becomes the Diary under Companion |
| Both kanji surfaces, one row | `/kanji` defaults to curriculum; explorer is a browse mode inside it |

---

## 4. What deliberately gets NO nav row

This section is the discipline, and it is the part most worth attacking in review.

**The six cross-cutting systems** (`capability-map.md` §1) — Learning Intelligence · Companion
presence · save-and-collect · pitch accent · provenance-attached claims · progress narrative. Each
surfaces *inside* destinations. `Companion` in §2 is the row for the Companion's **own screens**, not
for its presence layer, which is by definition everywhere and therefore nowhere in the sidebar.

**Modals and overlays** — rule 3 grants a route only where the URL must be shareable or
state-recoverable:

| Surface | Frame | Verdict |
|---|---|---|
| Kanji inspect | `28:2041` | Modal in Figma; the repo already has `/kanji/[id]`. ⚑ **Keep the route** — a kanji is exactly the thing a learner links to — and render it as a modal over the list on client navigation |
| Lesson search / ⌘K palette | `212:14610`, `212:14753` | **Component, no route.** Ruled already: search is a global panel |
| Create conversation wizard | `46:2` | **Component, no route.** Eight dimensions of transient input |
| Lesson preview | `200:10726`, `180:1129` | **Component, no route** |
| Today's Reflection · Gentle Suggestion | `182:3859`, `181:3525` | **Interactions.** Presence events, never navigation |

**Catalogues, not screens** — `210:14338` loading states and `218:15740` error states are vocabulary
for `/admin/style-guide`. This settles the open question in `screen-inventory.md` §5: *a state of one
named screen goes to the registry; a state any screen can enter goes to the style guide.* Both of
these are the latter.

**In-flow screens that are reached, never navigated to** — the lesson workspace `105:3088`, the
summary `125:1030`, the exam runner `237:1690`, the live conversation `44:7289`, the per-sentence
pronunciation practice `36:4117`, the roadmap mission detail `180:2`, edit profile `67:595`,
checkout `209:14032`, and the whole onboarding flow (`220:16766`, `111:1877`). They are real
destinations with real routes; none is a sidebar row.

---

## 5. The diff against `app-nav.tsx`, and what each change costs

Today's literal is five groups: `learn · study · insights · progress · account`.

| Today | Proposed | Why |
|---|---|---|
| `/dashboard` `learn` | `learn` | — |
| `/shadowing` `learn` | `learn` | — |
| `/kanji` `learn` | `learn` | — |
| `/vocab` `learn` | **`HIDE`** | ✅ ruled 2026-08-11, reversible. §4's conflict is now **resolved**: `156:1310` puts the vocabulary shelf inside Companion home, so it is companion-owned and hiding `/vocab` costs the flagship panel nothing |
| `/grammar` `learn` | `learn` | — |
| `/reading` `learn` | **`HIDE`** | ✅ ruled 2026-08-11 — code stays, row goes |
| `/conversation` `learn` | → `practice`, label **Speaking** | It is production, not consumption |
| `/jlpt` `learn` | → `practice`, `/certification` | ✅ ruled: the module is Certification Practice; JLPT is one of three exam families |
| `/review` `study` | → `remember` | — |
| `/mining` `study` | → `remember`, label **Collection** | §3.6 |
| `/playlists` `study` | → `remember` | Answers the open question in `mem:screen_registry_inputs`: **keep it as its own screen.** It is user-curated and shareable; Explore is the catalogue. Different jobs |
| `/challenges` `study` | **`ABSORB`** → Roadmap / Mission | ✅ ruled 2026-08-12. A challenge is a mission's measurable gate. No frame ⇒ no destination invented from a repo route (§3.4) |
| `/community` `study` | **`HIDE`** | ✅ ruled 2026-08-11 |
| `/leaderboard` `study` | **`HIDE`** | ✅ ruled 2026-08-11 |
| `/sensei` `insights` | **`ABSORB`** → `/companion/sensei` | §3.1 |
| `/roadmap` `insights` | → `journey`, label **Journey** | ⭐ ruling `capability-map.md` §3.3 |
| `/weekly-report` `insights` | **`ABSORB`** → `/companion/growth` | `187:6556` is a persistent per-skill map, not a weekly digest |
| `/journal` `progress` | **`ABSORB`** → `/companion/diary` | Loses the `journey` label to `/roadmap` |
| `/statistics` `progress` | **`ABSORB`** → `/dashboard` | §3.3 |
| `/achievements` `progress` | **`ABSORB`** → summary on `/dashboard`, gallery on `/profile` | ✅ ruled 2026-08-12. Split by job: glance vs browse (§3.3) |
| `/profile` `account` | `account` | — |
| `/settings` `account` | `account` | — |
| — | **`/companion`** `NEW` | §3.1 |
| — | **`/pronunciation`** `NEW` | §3.5 |

### What this costs to implement — measured, so the review can price it

- **⚠️ `L-025` applies twice over.** `vitest.config.ts:13` excludes `tests/e2e`, so **no unit run can
  catch a stale label in a Playwright spec**. The `Journey` rename already broke
  `tests/e2e/journal.spec.ts` once. Grep `tests/e2e/` by hand for `Journey`, `Journal`, `Sensei`,
  `Mining` and `JLPT` when any of this lands.
- **`app-nav.test.tsx` holds a hardcoded per-group `expectedCounts` record.** It moves with the
  literal or it goes red — every row change above touches it.
- **`app-nav.test.tsx` also asserts every `href` resolves to a page file.** `/companion` and
  `/pronunciation` must exist as routes (an honest `UpcomingScreen` is fine, and is the established
  pattern from C1) **before** their nav rows can ship.
- **`/certification` carries a migration** — `jlpt_section`'s enum cannot be the shared abstraction
  across three exam families with different section structures. ⇒ **Phase 2, not Phase 1.**

### ⚠️ Phase 1 is unaffected by all of this, and that is deliberate

Screen Registry Phase 1's acceptance is **zero visual diff**, machine-checked as *derived
`NAV_GROUPS` deep-equals a snapshot of today's literal*. Every row change on this page therefore
**fails Phase 1 by construction** and belongs to Phase 2. Phase 1 inventories these routes with their
nav rows **unchanged**, using `kind:'repo-only'` + `repoOnlyReason:'legacy-unreviewed'` to make the
debt named and countable. **This IA is the content of that Phase 2 ruling, decided ahead of time.**

---

## 6. ⚠️ This proposal supersedes an **Approved** design doc — read this before locking

**Found by applying the inventory's method rule 3** (*read `docs/design/` before treating any Figma
detail as product intent*), and it corrects a premise carried in `mem:phase0_figma_inventory_run_state`:

> "Both navbars in play are demos — the repo's `NAV_GROUPS` (provisional since C1) and the one in the
> user's reference render."

**That is only half right.** The reference render is garbage (✅ user ruling). But `NAV_GROUPS` is
**not** provisional: it implements `docs/design/screens/navigation-system.md` § Navigation Inventory,
a doc marked **`Status: Approved`**, which in turn cites two approved specs
(`2026-08-05-korume-rebrand-shadowing-figma-reconciliation-design.md` §2 and the shadowing-hub
consolidation design). Its 22 rows in 5 groups are exactly today's literal.

**Consequence: this is not a greenfield proposal — it is an amendment to approved layer-A authority,
and it must be reviewed as one.** Locking this IA requires updating `navigation-system.md`, not just
`app-nav.tsx`.

### The good news: the doc left the two hardest rows explicitly undecided, and this IA answers them

| Row | What `navigation-system.md` says | What this IA decides |
|---|---|---|
| 15 `korume` | *"(Companion surface, e.g. `/journal` or a future chat route — **not decided by this plan**)"* | ✅ `/companion` — `156:1310` is that surface, and it is a hub over six Companion screens (§3.1) |
| 16 `roadmap` | *"(existing Roadmap screen; **route not yet mapped** to `NAV_ITEMS` — decided by whichever plan implements this group)"* | ✅ `/roadmap`, and it takes the `Journey` label (§3.5 of this doc; ruling `capability-map.md` §3.3) |

So the `/companion` and `/roadmap` rows are **not** overriding a settled decision; they are supplying one the doc asked a
later plan to make. That is the strongest part of this proposal.

### What genuinely conflicts, and must be amended if this IA is locked

| `navigation-system.md` section | Conflict | Severity |
|---|---|---|
| § Navigation Inventory | The whole 22-row table is replaced | **the amendment** |
| § Gamification & Navigation | Built on *"`/leaderboard` is a real, shipped nav item"*. This IA hides it (per the 2026-08-11 ruling), so the section's premise goes — and its *"visible from 13 of the 14 shipped destinations"* arithmetic goes with it | **high** — rewrite, do not patch |
| § Navigation States, `(immersive)` row | Named around `/journal` as a top-level row. Under this IA the Diary is `/companion/diary` — still `(immersive)`, but no longer a top-level destination | medium |
| § Companion & Navigation | ✅ **no conflict.** *"The Nav Column never renders Companion"* governs **presence and anchors**, not destinations — and row 15 already reserved a Companion *destination*. A `Companion` nav row is a link, not an anchor | none |
| § Settings Entry Point | *"There is no `/settings` route today"* — **already stale**, independent of this IA: `/settings` exists (`app/[locale]/(protected)/(app)/settings/page.tsx`) | **pre-existing drift** |

⚠️ **`L-024` applies to the amendment**: reconcile every doc that depends on these same facts, not
just the flagged sections — `screen-architecture.md`, `design-reconciliation.md` §4/§6/§7 and
`adaptive-layouts.md` all reason about the nav inventory. A prior reconciliation pass turned a
9-file task into 22 tasks for exactly this reason.

---

## 7. What this proposal does NOT decide

The three gaps this section originally listed were **all ruled by the user on 2026-08-12** and have
moved into §3.2 (memory), §3.3 (achievements) and §3.4 (challenges). What remains:

1. **`/kanji/[id]` as modal-over-list** — proposed in §4, not verified against the repo's current
   page implementation.
2. **Route naming for the Companion's children** — `/companion/diary` reads well but breaks the
   existing `/journal` URL. A redirect is cheap; whether the user wants the URL churn is not the
   assistant's call. Same question for `/sensei` → `/companion/sensei`.
3. **How the Memory type switch is expressed** — query param, tab, or client state (§3.2). An
   implementation choice, deliberately left open.
4. **Whether the achievement catalogue is readable independently of what a learner earned** — the
   `Locked` half of the gallery needs it (§3.3). Flagged as a shape to check, **not measured**.
5. **Everything in `capability-map.md` §3.5** — scope questions that do not touch structure: Vimeo
   import · `JLPT Speaking` as a cross-module edge · `AI Coach` flag vs tier · Apple/GitHub sign-in ·
   native mobile apps · theme & accent · camera permission · the social graph · the L1 field · the
   Companion's name.
6. **No marketing/landing IA is proposed** — ✅ the user has ruled that gap known and accepted, and
   will design the gateway later. `/pricing`, `/checkout` and `/faq` (`74:564`, `209:14032`,
   `75:1424`) are real screens but sit outside the authenticated shell this document describes.

---

## 8. The checkpoint

**Next action is the user's, not the assistant's.** Per the ruling of 2026-08-11 the order is:

```
Figma → Product Inventory ✅ → Capability Map ✅ → IA/Navigation ◀ YOU ARE HERE (proposed)
      → Screen Registry → Route/API reconciliation → UI implementation → L8 → L9
```

The IA is **locked only after human review**. Until then: **do not port any screen, do not edit
`app-nav.tsx`, and do not begin Screen Registry Phase 1.**
