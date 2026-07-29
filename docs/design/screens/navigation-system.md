# Navigation System

> **Status:** Approved
> **Related:** `docs/design/screens/screen-architecture.md`, `docs/design/patterns/companion-patterns.md`,
> `docs/design/patterns/settings-patterns.md`, `docs/design/patterns/overlays-and-drawers.md`,
> `docs/design/screens/adaptive-layouts.md`, `docs/design/design-reconciliation.md`

> Navigation exists to help learners arrive. It should disappear once learning begins.
> — `screen-architecture.md` § Navigation Philosophy

This document defines the navigation chrome itself: what's in it, where it lives, how it degrades
under focus, and the boundary between navigation and the two layers that must never bleed into it —
Companion and Gamification.

---

# Purpose

Navigation is a single, low-noise surface for arriving somewhere. It is not a dashboard, not a status
display, and not a place where Companion or Gamification speak. Its only job is: get the learner from
"I want to do X" to the screen for X, with the least visual weight possible.

---

# Navigation Inventory

The shipped navigation (`components/layout/app-nav.tsx`, `NAV_ITEMS`) is a single ordered list, no
grouping, no nesting:

| Order | Label key | Route |
|---|---|---|
| 1 | `dashboard` | `/dashboard` |
| 2 | `kanji` | `/kanji` |
| 3 | `vocab` | `/vocab` |
| 4 | `grammar` | `/grammar` |
| 5 | `videos` | `/videos` |
| 6 | `mining` | `/mining` |
| 7 | `reading` | `/reading` |
| 8 | `conversation` | `/conversation` |
| 9 | `jlpt` | `/jlpt` |
| 10 | `community` | `/community` |
| 11 | `playlists` | `/playlists` |
| 12 | `leaderboard` | `/leaderboard` |
| 13 | `journal` | `/journal` |
| 14 | `profile` | `/profile` |

All 14 are shipped today — none are Planned or aspirational. Active acquisition-loop sub-routes
(Shadowing, Dictation, JLPT test-taking, SRS review, Mining review session) are reached by drilling
into their parent item (e.g. `/videos/[id]/shadowing`), never listed as their own top-level nav entry
— this keeps the acquisition loops off the persistent chrome, consistent with the Learning Loop
Boundary (`docs/design/design-reconciliation.md` §4). There is no dedicated Search entry in this list
— Search is a persistent affordance inside the Nav Column chrome itself, not a separate destination
(see `docs/design/screens/screen-search.md` § Entry Points).

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

---

# Navigation States

Two states exist today; a third is a documented direction, not yet shipped:

| State | Status | Description |
|---|---|---|
| Expanded (desktop) | Available | Fixed left column, full labels, always visible. |
| Wrapped (mobile) | Available | Top bar, items wrap to fill width, full labels. |
| Collapsed / Icon rail | Planned | `adaptive-layouts.md` § Navigation Adaptation describes a future Expanded → Collapsed → Icon rail → Hidden progression during deep focus. Not implemented in `app-nav.tsx` today — treat any icon-rail or auto-hide description elsewhere as target design, not current behavior. |

Per `screen-architecture.md` § Navigation Philosophy, navigation is expected to recede during focused
study. Today that reduction happens by leaving the nav screen entirely (drilling into Shadowing/
Dictation/Review, which render outside the persistent nav chrome context for that flow) rather than
by the nav column collapsing in place. The Collapsed/Icon-rail state in `adaptive-layouts.md` is the
planned refinement of this same philosophy, not a contradiction of it.

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
  and — in their empty states specifically — `/videos` and `/mining`; all other nav destinations
  are Planned or Not Supported for Companion. The nav item itself looks identical either way —
  availability is a property of the destination screen, not of the nav link.

---

# Gamification & Navigation

`/leaderboard` is a real, shipped nav item. It belongs entirely to the Gamification Layer
(`design-reconciliation.md` §3, Layer Responsibility Rule: Gamification owns XP, Streak, Progress,
Goal completion). The Nav Column itself stays neutral chrome — it does not display a live XP counter,
streak flame, or rank badge next to any nav item. Any such indicator, if added later, would be a
Gamification-owned addition to the Nav Column, and Companion must never narrate it from within
navigation, per the same Layer Responsibility Rule.

---

# Settings Entry Point

There is no `/settings` route today (confirmed absent from `NAV_ITEMS` and from the app route tree).
Two different things currently live where "settings" might be expected, and they must not be
conflated:

1. **Nav footer controls** (shipped): `ThemeToggle`, `ReduceMotionToggle`, and sign-out, rendered
   below the nav list in `app-nav.tsx`. These are global, low-frequency toggles — not a settings
   screen.
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
