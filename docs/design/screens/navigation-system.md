# Navigation System

> **Status:** Approved
> **Related:** `docs/design/screens/screen-architecture.md`, `docs/design/patterns/companion-patterns.md`,
> `docs/design/patterns/settings-patterns.md`, `docs/design/patterns/overlays-and-drawers.md`,
> `docs/design/screens/adaptive-layouts.md`, `docs/design/design-reconciliation.md`

> Navigation exists to help learners arrive. It should disappear once learning begins.
> — `screen-architecture.md` § Navigation Philosophy

This document defines the navigation chrome itself: what's in it, where it lives, how it degrades
under focus, and the boundary between navigation and Companion — a layer that must never bleed into
it. Gamification is normally held to the same boundary, with one narrow, deliberate exception
(§ Gamification & Navigation).

---

# Purpose

Navigation is a single, low-noise surface for arriving somewhere. It is not a dashboard and not a
place where Companion speaks. Its only job is: get the learner from "I want to do X" to the screen
for X, with the least visual weight possible. Gamification is a narrow, deliberate exception to this
neutrality — see § Gamification & Navigation — not a general invitation for status displays.

---

# Naming Principle

> **Product-facing destinations are named after learner intent, never implementation.**

This is an architectural invariant, not a one-off naming preference
(`docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` §1) — the rule that makes
`videos` → `shadowing` more than a cosmetic rename, and the rule any future nav item or screen name
must pass before it ships. Applied retroactively, it disqualifies an entire class of names without
needing a fresh argument each time: "Videos," "Clips," "Media," "Assets" — anything named for the
content type backing a feature rather than the learner's reason for being there. It already governs
why `/mining` is not called `/clips` or `/flashcard-export`, even though no one wrote that rule down
until now.

---

# Navigation Inventory

⚠️ **This document no longer carries the nav table.** It held the canonical 22-row inventory until
**2026-08-13**, when Phase 1b applied the LOCKED IA. Keeping a second copy here is precisely the
"two silently-disagreeing sources" defect that `CLAUDE.md` §6 now forbids, and this document has the
higher authority (`decision-register.md` §5) — so a stale table here would not merely be wrong, it
would outrank the truth.

**The inventory has one home, and it is derived:**

| Question | Where it is answered |
|---|---|
| Which rows exist, in which group, in what order | `lib/product/screen-registry.ts` — `navGroup` / `navOrder` per entry |
| *Why* those rows | `docs/product/ia-proposal.md` §2, indexed in `docs/product/decision-register.md` **§2** (cite the section, never a range — `A1–A14` went stale the day A15 landed) |
| What actually ships | `NAV_GROUPS`, derived by `lib/product/nav-derivation.ts`. `app-nav.tsx` renders it and holds no nav data of its own. |

Read the current rows from `lib/product/screen-registry.ts` — the `navGroup` / `navOrder` fields
ARE the data — never from a table in a document (`docs/lessons.md` L-002). To *verify* that what
ships still matches the LOCKED IA (this reports pass/fail, it does not print the rows):

```bash
npx vitest run lib/product/nav-derivation.test.ts   # T6 pins the derivation to the LOCKED IA
```

`lib/product/nav-baseline.fixture.ts` is the hand-written statement of that IA and is the closest
thing to a readable table — but it is a **test oracle**, not documentation. Never edit it to agree
with the code; that is how T6 becomes self-referential.

**If you remember the old table**, this is what Phase 1b changed: five groups
(`learn · practice · remember · journey · account`) replaced LEARN/STUDY/INSIGHTS/PROGRESS/ACCOUNT;
`/vocab`, `/reading`, `/community` and `/leaderboard` lost their rows but kept all their code (A10);
`/challenges`, `/sensei`, `/journal`, `/weekly-report`, `/statistics` and `/achievements` were
absorbed into other destinations (A2/A4/A5); `/companion` and `/pronunciation` gained rows (A2/A6);
and the `Journey` label moved off `/journal` onto `/roadmap` (A8). `/jlpt` → `/certification` (A9)
is **not** done — it carries a schema migration and belongs to Phase 2. The two rows this document
had explicitly left undecided (`korume`, `roadmap`) are both answered there.

The rest of this section is design rule rather than inventory, and still binds. Active acquisition-loop sub-routes (Shadowing Practice, Pronunciation,
Listening Practice, JLPT test-taking, SRS review, Mining review session) are still reached by
drilling into their parent item (e.g. `/shadowing/[id]`), never listed as their own top-level nav
entry — this still keeps the acquisition loops off the persistent chrome, consistent with the
Learning Loop Boundary (`docs/design/design-reconciliation.md` §4). "Lessons" (was "Shadowing") as a
top-level nav entry names the **Shadowing Hub** (`screen-shadowing-hub.md`) — the learner's home for
browsing and resuming lessons, itself not an acquisition loop; **Shadowing Practice**
(`screen-shadowing-practice.md`), reached by drilling into a specific lesson, is the acquisition loop
this paragraph's ban is about. The two are not the same destination and must not be conflated when
reading "Lessons"/"Shadowing" elsewhere in this document. There is no dedicated Search entry in this
list — Search is a persistent affordance inside the Nav Column chrome itself, not a separate
destination (see `docs/design/screens/screen-search.md` § Entry Points).

The Nav Column is **toggleable** (show/hide via a small edge affordance) rather than an
always-fixed 240px column — generalizing the hidden-by-default behavior
`screen-shadowing-practice.md` § Sidebar already mandates inside the Lesson Workspace to the whole
product. **The default visibility state is RESOLVED (2026-08-05, refined 2026-08-07): it is a
per-route-group chrome contract, not one product-wide default.** `(app)` defaults to visible, with
two exceptions: the Lesson Workspace routes — Shadowing Practice, Dictation, Pronunciation Studio
(Planned); not themselves § Navigation Inventory rows, per that section's own note that
acquisition-loop sub-routes are reached by drilling into a parent item, never listed as their own
top-level entry — default to hidden under `(focus)` instead, which is exactly the Lesson Workspace
behavior this paragraph originally deferred (that mandate is now built, not still unbuilt); and
`/journal` mounts no Nav Column at all under `(immersive)` instead — a harder exception than
`(focus)`'s: there is no toggle to restore it, only
the per-screen back affordance (see § Navigation States' contract table below — the same exception
F3 recorded there). The `(app)`/`(focus)` default is session-scoped React
state (`useState(defaultVisible)` in `app-nav.tsx`, with `defaultVisible` supplied per chrome
contract by each route group's `layout.tsx`), deliberately not persisted across reloads. The
toggle itself shipped in Korume rebrand Plan B (Code) Task 4; the per-group default it now reads
shipped in the screen-port-workflow plan (Task 2) — the source spec's §7 recorded the default as
undecided and both are superseded on this point. Toggling only adds a show/hide affordance on top
of the column described elsewhere in this document: when shown, it is still the same fixed 240px,
full-label, persistent-chrome column described in § Layout Regions, § Navigation States (Expanded),
and § Nav vs. Drawer Boundary — those sections describe the column's shape and semantics while
visible and are unaffected by this paragraph; toggling its visibility does not turn it into a
drawer or overlay. The reduce-motion control that lives in the same edge-chrome rail as the toggle
button is NOT gated by `visible` — it renders unconditionally so it survives in `(focus)` even
while the column itself is hidden (CLAUDE.md §2 rule 4; final whole-branch review F1, 2026-08-07).

---

# Layout Regions

Two named regions the rest of this document — and Companion's declared anchors — are relative to:

- **Nav Column** — the persistent navigation itself. Desktop: a fixed left column (240px). Mobile: a
  top bar that wraps its items.
- **Content Region** — everything to the right of (desktop) or below (mobile) the Nav Column. This is
  the region every screen spec's layout describes, and the region Companion anchors (`Top Right`,
  `Bottom Left`, `Center`, `No Anchor` — `companion-patterns.md` § Declare Anchor) are positioned
  within. An anchor position is always relative to the Content Region, never to the Nav Column —
  Companion never anchors inside navigation chrome itself.

The Nav Column region exists only under a chrome contract that mounts the Nav Column. Content Region
exists regardless: in `(immersive)`, where no Nav Column is mounted, Content Region simply occupies the
whole viewport, and Companion anchors are positioned within it exactly as elsewhere.

---

# Navigation States

Two states exist today; a third is a documented direction, not yet shipped:

| State | Status | Description |
|---|---|---|
| Expanded (desktop) | Available | Fixed left column, full labels, always visible. |
| Wrapped (mobile) | Available | Top bar, items wrap to fill width, full labels. |
| Collapsed / Icon rail | Planned | `adaptive-layouts.md` § Navigation Adaptation describes a future Expanded → Collapsed → Icon rail → Hidden progression during deep focus. Not implemented in `app-nav.tsx` today — treat any icon-rail or auto-hide description elsewhere as target design, not current behavior. Distinct from `(focus)`'s hidden-by-default contract, which ships in the same plan — hidden is a visibility default, collapsed is a different rendering of the column. |

What happens to the Nav footer's streak indicator and Rain Sound toggle (§ Gamification & Navigation,
§ Settings Entry Point) in the Collapsed/Icon-rail state is unspecified — to be defined when that
state ships, not silently assumed to carry over unchanged.

Per `screen-architecture.md` § Navigation Philosophy, navigation is expected to recede during focused
study. That reduction is expressed by the **chrome contract of the route group a screen lives in**
(`docs/superpowers/specs/2026-08-07-screen-port-workflow-design.md` §5):

| Group | Contract |
|---|---|
| `(app)` | Nav Column mounted and visible. The default for **every** nav destination — post-1b there is no exception, because `/journal` is no longer one (see the `(immersive)` row below). |
| `(focus)` | Nav Column mounted, **hidden by default**, recoverable by the learner. Lesson workspaces — Shadowing Practice, Dictation, Pronunciation Studio (Planned). The reduce-motion control in the same edge-chrome rail as the show/hide button is NOT part of the hidden column — it renders unconditionally (`app-nav.tsx`, outside the `visible` check), so CLAUDE.md §2 rule 4's globally-reachable requirement holds even while the column itself is hidden (final whole-branch review F1, 2026-08-07). |
| `(immersive)` | Nav Column **not mounted**. No navigation landmark. Companion Diary, onboarding, and `/journal`. ⚠️ **Phase 1b removed `/journal`'s nav row entirely** (A2/A8 — `journey` is now a group *id*, and the `Journey` label moved onto `/roadmap`), so the old "reachable from the `(app)` Nav Column" claim here is dead. Its door is the **companion sprite** — `ambient-provider.tsx:154` wires `openJournal`, and `CompanionAnchor` mounts on `/dashboard` and `/shadowing`; both e2e specs navigate that way. (Supersedes final whole-branch review F3, 2026-08-07.) |

**Chrome in `(immersive)` routes:** While the Nav Column is not mounted, `(immersive)` is not chrome-less.
Every immersive screen carries its own labelled back affordance (see `components/companion/journal-view.tsx`,
the Diary's journaling surface). Additionally, all immersive routes mount a global `ReduceMotionToggle`
(CLAUDE.md §2 rules 4 and 5 require a globally reachable reduced-motion control and keyboard reach at all times,
and immersive surfaces are where motion is heaviest). This toggle is rendered directly by `ImmersiveChromeLayout`, independent of both the Nav Column and
Companion state, and is visible regardless of route.

Route groups express chrome contracts, not feature categories: features churn, chrome contracts do
not. All three sit beneath `(protected)`, which owns the authenticated session's lifetime and mounts
the Ambient Layer — so moving between contracts changes the chrome without resetting Companion state.

The Collapsed / Icon-rail state in `adaptive-layouts.md` is a further refinement of this same
philosophy and remains planned. **`(focus)`'s "hidden" is not "collapsed"** — hidden removes the
column and leaves a way back; collapsed keeps a narrow rail. Do not conflate them.

> **Reconciliation note (2026-08-07).** This paragraph previously stated that Shadowing / Listening
> Practice / Review "render outside the persistent nav chrome context for that flow." That was not
> what the code did: those routes were inside `(app)`, which mounts the Nav Column, and no nested
> layout removed it. The mechanism above is what makes the original intent true.

---

# Nav vs. Drawer Boundary

Navigation is never implemented as a drawer or overlay. `overlays-and-drawers.md` states this as an
explicit anti-pattern ("Do not use drawers as navigation"). The Nav Column is persistent chrome, not a
temporary layer — it does not open, close, or slide over content the way a drawer does.

---

# Companion & Navigation

- The Nav Column never renders Companion. No anchor may be declared inside the Nav Column region —
  only within the Content Region (§ Layout Regions above).
- Companion presence is controlled by the Ambient Layer per screen
  (`docs/design/design-reconciliation.md` §2), never by the navigation component. The nav does not
  gain or lose a "Companion tab" or indicator based on which screen is active.
- Anchor availability today (`design-reconciliation.md` §6) is Available at Dashboard, `/journal`
  (a screen, not a nav row — see the `(immersive)` contract), and — in their empty states
  specifically — `/shadowing` and `/mining`; all other screens are Planned or Not Supported for
  Companion. The nav item itself looks identical either way —
  availability is a property of the destination screen, not of the nav link.

---

# Gamification & Navigation

⚠️ **Amended 2026-08-13.** This section was built on "`/leaderboard` is a real, shipped nav item",
which Phase 1b made false: A10 removed its row (the code and the route remain — hiding is not
deleting). The Layer Responsibility point below is unaffected and is the part that matters; only
its worked example changed. `/leaderboard` still belongs entirely to the Gamification Layer
(`design-reconciliation.md` §3, Layer Responsibility Rule: Gamification owns XP, Streak, Progress,
Goal completion). The Nav Column carries one deliberate Gamification exception
(`docs/superpowers/specs/2026-08-01-shadowing-practice-figma-reconciliation-design.md` §5): a compact
streak indicator (e.g. flame + day count) in the Nav footer, reusing the same streak data the
Gamification Layer already tracks — no new schema. It is a glance-level indicator only; the fuller
session/goal/hours detail stays where it already lives (Shadowing Hub's Current Session rail,
Dashboard) and is not duplicated here. Beyond this one indicator, the Nav Column stays neutral — no
live XP counter, no rank badge next to any nav item — and Companion must never narrate the streak
indicator from within navigation, per the same Layer Responsibility Rule. Because the Nav Column is
persistent chrome (§ Layout Regions), this streak indicator is visible from every `(app)` nav
destination, not just Shadowing. It is **not** visible on `(immersive)` surfaces, which mount no Nav
Column at all (§ Navigation States' contract table) — `/journal` is the standing example, and it has
its own Companion-driven presentation instead (`design-reconciliation.md` §2), not a gap this
document leaves unaddressed. Stated as a chrome rule rather than a count on purpose: the previous
wording ("13 of the 14 shipped destinations") was arithmetic over a nav table that no longer lives
here, and went stale the moment the IA changed.

The Nav footer also carries a "Rain Sound" ambient-audio toggle (§ Settings Entry Point). This is
**not** part of the Gamification exception above: ambient audio is not XP, Streak, Progress, or Goal
completion, so it falls outside Gamification scope entirely (`design-reconciliation.md` §3) — it
simply happens to render in the same footer region as the streak indicator. Rain Sound is a
lightweight, always-on-demand global control, independent from Study Atmosphere's "🌧 Rainy Day"
preset (`screen-shadowing-practice.md` § Study Atmosphere): Rainy Day is a fuller visual + mood
preset (glow, color temperature, glass tint, shadow softness, ambient particles) scoped to the
Shadowing Practice workspace, while Rain Sound is only an ambient audio layer, reachable from
anywhere in the app. The two do not stack or conflict by design — a learner can enable Rain Sound
under any Study Atmosphere selection, or none at all. Like the streak indicator, Rain Sound is
available from every `(app)` nav destination, and absent from `(immersive)` surfaces for the same
reason — stated as the chrome rule described just above, deliberately without a count. It defaults
to off and never autoplays.

---

# Settings Entry Point

⚠️ **Corrected 2026-08-13.** This paragraph said "there is no `/settings` route today" and pointed at
row 22 of § Navigation Inventory's table. Both halves are now wrong: Plan C1 shipped
`app/[locale]/(protected)/(app)/settings/page.tsx` as an honest `UpcomingScreen`, and that table no
longer lives in this document. `/settings` is a real, protected, nav-listed route rendering a
placeholder — the *feature* is what is unbuilt, not the route.
Two different things currently live where "settings" might be expected, and they must not be
conflated:

1. **Nav footer controls.** *Shipped today* in `app-nav.tsx`: the signed-in email and sign-out.
   `ReduceMotionToggle` is NOT a nav footer control — since F1 (final whole-branch review,
   2026-08-07) it renders `compact` in the edge-chrome rail outside the `<nav>` element itself, so
   it stays mounted and reachable even while `(focus)` hides the column (see § Navigation States).
   `ThemeToggle` is NOT in the nav footer either — Korume ships dark-only (2026-08-06
   token adoption), and the toggle is retained only in the admin style guide
   (`components/style-guide/style-guide.tsx`) as the future light-mode preview point.
   *Planned, NOT built* (verified against the code 2026-08-05 —
   neither exists, and `grep -i "rain ?sound"` over `app/`, `components/`, `lib/`, `messages/`
   returns zero hits): a streak indicator, and a single "Rain Sound" ambient-audio toggle. The
   streak indicator would be the Gamification exception documented in § Gamification & Navigation
   above; Rain Sound would be a separate, non-Gamification global ambient-audio control (also
   described there, alongside its relationship to Study Atmosphere's Rainy Day preset). Whether
   shipped or planned, all of these are global, low-frequency toggles — not a settings screen.
2. **`settings-patterns.md`'s dedicated Settings screen** (Draft/roadmap per
   `design-reconciliation.md` §7 — see that file's Status header): a future `/settings` route with
   the categories that file describes. When built, its nav entry point is a new top-level `NAV_ITEMS`
   entry, most naturally placed near `profile` — this document will need updating at that time. Any
   other design doc's mention of "Settings" as if it were a normal, already-shipped screen (e.g. in a
   list of example screens) describes this same target design, not current behavior.

---

# Responsive / Mobile Behavior

Below the `md` breakpoint, the Nav Column becomes a top bar; its items wrap (`flex-wrap`) rather than
scrolling or collapsing into a menu. There is no hamburger-menu pattern today — every item stays
visible and reachable at every viewport width. If a future redesign introduces a collapsed mobile
menu, it must still satisfy the Accessibility section below (keyboard reachability and landmark
semantics do not get to regress for the sake of a denser mobile layout).

---

# Accessibility

Shipped today:

- The Nav Column is a single `<nav>` landmark with an explicit `aria-label` (translated via the
  `nav.ariaLabel` key), so screen-reader users can jump straight to it.
- The active item carries `aria-current="page"`, kept in sync via pathname matching (exact match or
  prefix match for nested routes).
- Every item is a real `<Link>` — full keyboard reachability (Tab/Shift+Tab, Enter to activate) with
  no custom keyboard handling required, since it's native anchor semantics rather than a custom
  widget.

Any future Collapsed/Icon-rail state (§ Navigation States) must preserve all three of the above:
landmark + label, `aria-current`, and native link semantics — collapsing to icons only is a *visual*
change and must not silently drop the accessible name for each item
(`docs/design/design-reconciliation.md` §10, Visual vs. Interaction Changes).
