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

The canonical navigation structure (target for `components/layout/app-nav.tsx`, `NAV_ITEMS`) is
**5 named groups**, each an ordered list (`docs/superpowers/specs/2026-08-05-korume-rebrand-shadowing-figma-reconciliation-design.md`
§2 — supersedes the earlier "single ordered list, no grouping" model):

| Group | Order | Label key | Route |
|---|---|---|---|
| LEARN | 1 | `dashboard` | `/dashboard` |
| LEARN | 2 | `lessons` | `/shadowing` |
| LEARN | 3 | `kanji` | `/kanji` |
| LEARN | 4 | `vocab` | `/vocab` |
| LEARN | 5 | `grammar` | `/grammar` |
| LEARN | 6 | `reading` | `/reading` |
| LEARN | 7 | `speaking` | `/conversation` |
| LEARN | 8 | `jlpt` | `/jlpt` |
| STUDY | 9 | `review` | `/review` |
| STUDY | 10 | `mining` | `/mining` |
| STUDY | 11 | `playlists` | `/playlists` |
| STUDY | 12 | `challenges` | `/challenges` |
| STUDY | 13 | `community` | `/community` |
| STUDY | 14 | `leaderboard` | `/leaderboard` |
| INSIGHTS | 15 | `korume` | *(Companion surface, e.g. `/journal` or a future chat route — not decided by this plan)* |
| INSIGHTS | 16 | `roadmap` | *(existing Roadmap screen; route not yet mapped to `NAV_ITEMS` — decided by whichever plan implements this group)* |
| INSIGHTS | 17 | `weeklyReport` | *(Planned — `business-model.md` §8 "sample weekly report," not yet built)* |
| PROGRESS | 18 | `journey` | `/journal` |
| PROGRESS | 19 | `statistics` | *(not yet built — spec §7 leaves its source data undecided)* |
| PROGRESS | 20 | `achievements` | *(not yet built — spec §7 leaves its source data undecided)* |
| ACCOUNT | 21 | `profile` | `/profile` |
| ACCOUNT | 22 | `settings` | `/settings` *(Planned — L9b Plan 1, `mem:l9b_plan1_launch_blocker_debt_status`)* |

14 of these 22 rows are shipped today (`dashboard`, `lessons`/was `shadowing`, `kanji`, `vocab`,
`grammar`, `reading`, `speaking`/was `conversation`, `jlpt`, `mining`, `playlists`, `community`,
`leaderboard`, `journey`/was `journal`, `profile`) — the remaining 8 (`review`, `challenges`,
`korume`, `roadmap`, `weeklyReport`, `statistics`, `achievements`, `settings`) are new nav-level
entries this restructure surfaces; each is Planned/not-yet-wired except where noted, and none of
this plan's tasks build them. Active acquisition-loop sub-routes (Shadowing Practice, Pronunciation,
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
product. **The default visibility state outside the Lesson Workspace is RESOLVED (2026-08-05): the
column is visible by default, product-wide.** It is session-scoped React state
(`useState(true)` in `app-nav.tsx`), deliberately not persisted across reloads. The toggle shipped in
Korume rebrand Plan B (Code) Task 4; the source spec's §7 recorded this as undecided and is superseded
on this point. Making the Lesson Workspace hidden-by-default — the behavior
`screen-shadowing-practice.md` § Sidebar mandates — is still unbuilt and belongs to whichever plan
builds that route group. Toggling only adds a show/hide affordance on top of the column described
elsewhere in this document: when shown, it is still the same fixed 240px, full-label, persistent-chrome
column described in § Layout Regions, § Navigation States (Expanded), and § Nav vs. Drawer Boundary —
those sections describe the column's shape and semantics while visible and are unaffected by this
paragraph; toggling its visibility does not turn it into a drawer or overlay.

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

Both regions exist only under a chrome contract that mounts the Nav Column. In `(immersive)` there is
no Nav Column and therefore no Nav Column region; the whole viewport is Content Region, and Companion
anchors are positioned within it exactly as elsewhere.

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
| `(app)` | Nav Column mounted and visible. The default for every destination in § Navigation Inventory. |
| `(focus)` | Nav Column mounted, **hidden by default**, recoverable by the learner. Lesson workspaces — Shadowing Practice, Dictation, Pronunciation Studio. |
| `(immersive)` | Nav Column **not mounted**. No toggle. Companion Diary, onboarding. |

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
- Anchor availability today (`design-reconciliation.md` §6) is Available at Dashboard, `/journal`,
  and — in their empty states specifically — `/shadowing` and `/mining`; all other nav destinations
  are Planned or Not Supported for Companion. The nav item itself looks identical either way —
  availability is a property of the destination screen, not of the nav link.

---

# Gamification & Navigation

`/leaderboard` is a real, shipped nav item. It belongs entirely to the Gamification Layer
(`design-reconciliation.md` §3, Layer Responsibility Rule: Gamification owns XP, Streak, Progress,
Goal completion). The Nav Column carries one deliberate Gamification exception
(`docs/superpowers/specs/2026-08-01-shadowing-practice-figma-reconciliation-design.md` §5): a compact
streak indicator (e.g. flame + day count) in the Nav footer, reusing the same streak data the
Gamification Layer already tracks — no new schema. It is a glance-level indicator only; the fuller
session/goal/hours detail stays where it already lives (Shadowing Hub's Current Session rail,
Dashboard) and is not duplicated here. Beyond this one indicator, the Nav Column stays neutral — no
live XP counter, no rank badge next to any nav item — and Companion must never narrate the streak
indicator from within navigation, per the same Layer Responsibility Rule. Because the Nav Column is
persistent chrome (§ Layout Regions), this streak indicator is visible from all 14 `NAV_ITEMS`
destinations, not just Shadowing.

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
available from all 14 nav destinations. It defaults to off and never autoplays.

---

# Settings Entry Point

There is no `/settings` route today. It is not implemented in the shipped `app-nav.tsx`/`NAV_ITEMS`
code or in the app route tree — it appears in § Navigation Inventory's table only as row 22 of the
canonical/target structure, not as a shipped entry (same shipped-vs-canonical distinction as that
section's lead sentence).
Two different things currently live where "settings" might be expected, and they must not be
conflated:

1. **Nav footer controls.** *Shipped today* in `app-nav.tsx`: `ReduceMotionToggle`, the signed-in
   email, and sign-out. `ThemeToggle` is NOT in the nav footer — Korume ships dark-only (2026-08-06
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
