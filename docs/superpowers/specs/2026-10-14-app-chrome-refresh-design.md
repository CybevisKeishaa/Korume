# App chrome refresh — the learner sidebar (AppNav)

- Branch `app-chrome-refresh`, worktree `.worktrees/app-chrome-refresh`, base master `a3df0220`.
- Figma: file `IwFHZDZdHW7qsSFiNbWrkd`, page `655:2` "App Navigation · Proposal" — frames `656:2` (Expanded /
  Free), `656:84` (Collapsed / Free), `656:147` (Expanded / Plus / user menu, menu `656:213`), `656:242` (Collapsed
  / Plus / focused). All four are drawn at 1280×529.
- Status: **approved by the owner 2026-10-14** after two review rounds (zero-due destination, 401 path, 1920 measure
  and hit-target deviation folded in). No product code before the plan is approved.

## 0. Intent

The owner wants the learner sidebar to read as one finished piece of Korume chrome on every `(app)` and `(focus)`
screen: the Figma proposal's structure, with a visual finish that is **more modern than the frame and still
recognisably Korume** (owner, 2026-10-14: "nắn nót lại cho đẹp… hiện đại nhưng vẫn mang ADN của Korume hiện tại,
figma có phần hơi thô"). So Figma decides **structure** here; the visual finish (§4) is Claude's, built only from the
app's existing tokens, and judged by the owner in Chrome before merge.

Success = at 1280×529 and 1440×900 the sidebar has the frame's structure and proportions, every item is real (no
dead ends, no fake numbers), it is fully usable by keyboard, and the owner approves the look.

## 1. Locked decisions (owner, 2026-10-14)

| # | Decision |
|---|---|
| D1 | Structure from Figma: 12 destinations in 4 groups (Học · Luyện tập · Ghi nhớ · Tiến trình), fixed header, independently scrolling list, fixed footer (Help + account). This is exactly today's `NAV_GROUPS` minus the `account` group — **no IA change**. |
| D2 | Two modes: **expanded** (240 at 1280) and **rail** (72 at 1280). The 24px edge strip and the hidden mode are removed. |
| D3 | Icons: add `lucide-react`. Logo: `public/korume.png` (the existing favicon art). |
| D4 | Rail header: logo, then bell, then expand toggle, stacked; header grows as needed; both buttons keep a full hit target and never overlap (the frame overlaps them at `y=62` — not copied). |
| D5 | `(focus)` routes always open in rail mode. |
| D6 | `(app)` remembers expanded/rail in a cookie. `(focus)` never reads or writes that cookie. |
| D7 | Data = approach C: server layouts pass the initial nav summary; the client refreshes it on route change and after a successful review save, through `GET /api/nav/summary`. |
| D8 | The `account` group (Hồ sơ, Cài đặt) moves into an account menu with Giảm chuyển động and Đăng xuất. |
| D9 | "Trợ giúp" links to a new `/help` route rendered with the existing `UpcomingScreen` (FAQ & Quickstart are not built). Supersedes the "/" placeholder rule for this one entry. |
| D10 | "Ôn tập" links to a dynamic review destination (§3.3), not to `/review` (an `UpcomingScreen` today). |
| D11 | Type stays on the shared `--text-*` tokens (L-052); no navbar-local type scale. |
| D12 | Rail tooltips show the full label on hover and on keyboard focus, outside the scroll region. |

## 2. Size: Figma 240/72 at 1280 against the density scale

The app's layout unit is `--density-unit` (`app/globals.css`): **0.889px at 1280**, 1px at 1440, 1.25px at 1920
(uniform zoom, type-normalization S1). The current sidebar is `--layout-sidebar-width: 224u` (199px at 1280).

Multiplying the frame's 240/72 by the unit would give 213/64 at 1280 — **not** what the owner sees in the frame on
their 1280 screen. Unlike the app's other frames (drawn on the 1536 canvas, where 1 Figma px = 1u), this page is
drawn **at 1280**, so 1 Figma px = 1 rendered px at 1280 = 1/0.889 = **1.125u**.

**Locked:** the nav's own layout unit is `--nav-u: calc(1.125 * var(--density-unit))`, and every nav LAYOUT
dimension is `calc(<figma px> * var(--nav-u))`. Type is NOT on `--nav-u` (D11).

| | 1280 | 1440 | 1920 |
|---|---|---|---|
| `--nav-u` | 1.000px | 1.125px | 1.406px |
| expanded width (240) | **240px** | 270px | 337.5px |
| rail width (72) | **72px** | 81px | 101.25px |
| item row height (Figma 34 → `max(44px, 34u)`, see below) | **44px** | 44px | 47.8px |
| share of viewport (expanded) | 18.75% | 18.75% | 17.6% |

**Hit target vs the frame's 34px rows (owner review).** The repo's floor `--hit-target-min` is a fixed 44px
(`2.75rem`, deliberately unscaled — `app/globals.css`), and the current nav rows already sit on it. The frame's 34px
row with a 4px gap cannot hold a 44px non-overlapping target, so **interaction wins**: every nav row, Help row,
account trigger, header button and menu item is at least 44px tall; the visual pill fills the row. Deviation from the
frame at 1280, stated for the owner's look: row pitch 38 → 48px; the 12-row list grows from 544 to about 664px (it
scrolls inside its region either way, ~6–7 rows visible at 529 tall); the footer grows from 86 to about 100px; the
rail header (logo + bell + toggle stacked, D4) is about 150px instead of 96. Widths are unaffected.

`--layout-sidebar-width` / `--layout-sidebar-collapsed` are redefined as `calc(240 * var(--nav-u))` /
`calc(72 * var(--nav-u))`. Consumers today (grepped 2026-10-14): `app-nav.tsx` (`w-sidebar`), the two declarations
in `app/globals.css` (lines 230 and 469 — both change), the `w` class group in `lib/utils.ts`, and a prose comment in
`components/marketing/marketing-container.tsx` that quotes "224px" (updated). Interactive targets keep `min-h-hit-target`. Acceptance A1 measures these exact numbers in Chrome; if
the owner finds 270 at 1440 too wide, the knob is the one `--nav-u` line.

## 3. Behaviour and data

### 3.1 Components

- **`AppNav`** (`components/layout/app-nav.tsx`, client, rewritten in place). Props: `groups`, `initialSummary`,
  `mode: "app" | "focus"`, `initialCollapsed: boolean`. Renders the single `<nav>` landmark (header, scroll list,
  footer). Holds no nav data of its own (registry rule unchanged).
- **`AccountMenu`** (new, client). Trigger + menu, §3.5.
- **`NavTooltip`** (new, client). One tooltip element per `AppNav`, §3.6.
- **`useNavSummary(initial)`** (new hook), §3.4.
- **`getNavSummary()`** (`lib/data/nav-summary.ts`, server) and **`GET /api/nav/summary`**
  (`app/api/nav/summary/route.ts`), §3.3.
- **`/help`** page (`app/[locale]/(protected)/(app)/help/page.tsx`) with `UpcomingScreen`; registry row `help`
  (route `/help`, `navGroup: null`, upcoming), so the registry and upcoming-route tests cover it.
- Both route-group layouts (`(app)`, `(focus)`) call `getNavSummary()` and pass plain JSON props (RSC client props
  carry data only — never a function).

### 3.2 Expanded / rail state

- `(app)` layout reads cookie `korume_nav` (`expanded` | `collapsed`; path `/`, SameSite=Lax, max-age 1 year, not
  HttpOnly) and passes `initialCollapsed`; absent or invalid → expanded.
- `(focus)` layout passes `mode="focus"`, `initialCollapsed: true`, and ignores the cookie. Toggling inside `(focus)`
  changes the session state only and **never writes the cookie**.
- Toggling in `(app)` writes the cookie.
- `AppNav` mounts once per route group (each group's layout owns it), so `(app)` → `(focus)` → `(app)` remounts it.
  Next 14.2's client router cache can replay an `(app)` layout payload rendered before the last toggle (the
  app-footer T7 mechanism), so on mount in `(app)` the component re-reads `document.cookie` (layout effect, before
  paint) and adopts it when it differs from the prop.
- Width change animates (~200ms ease-out); no animation under reduced motion (existing kill switch).

### 3.3 Nav summary

`getNavSummary()` returns `{ name, avatarUrl, plan: "free" | "plus" | null, reviewDue: number | null, reviewHref }`.
Three reads in parallel, each with its own fallback:

- **name / avatar** — the profile (`name`, `avatar_url`); missing name → local part of the email; missing avatar →
  the name's initial on a tile.
- **plan** — `subscriptions`: `plan <> 'free'` and `status = 'active'` → `plus`, else `free`. Read error → `null`
  and the plan chip is hidden (never guess FREE for a paying learner). "PLUS" matches business-model.md's tier name.
- **review** — reuse `lib/data/dashboard/review.ts` (RPC `review_deck_summary` + `reviewDestination`), so the
  badge and the Dashboard Review tile always show the same number. Read error → `reviewDue: null` (badge hidden),
  `reviewHref` = the zero-due destination below.

**Zero due (owner review, round 2).** `reviewDestination()` today sends a learner with 0 due to the most recently
reviewed deck — for mining that is an empty session. Fixed in the shared function (one place, all callers), with no
new query — it already holds `due` and `lastReviewedAt` per deck:

| Case | Destination |
|---|---|
| summed due > 0 | the deck with most due (then recency, then registry order) — unchanged |
| due = 0 and nothing ever reviewed (new learner) | `/kanji/review` — every kanji is new, so its queue is a real session (unchanged branch) |
| due = 0 and something reviewed before | **`/kanji`**, the real library — never a review session that may be empty |

This changes the Dashboard Review tile in the third case the same way (it went to the last-reviewed deck); the plan
pins all three branches with tests.

**Active state of "Ôn tập"** is matched against the fixed set `/review`, `/kanji/review`, `/mining/review` — not
against the current `reviewHref`. Active matching across all items is **longest prefix wins**, so
`/mining/review` lights Ôn tập, not Bộ sưu tập (`/mining`).

**API.** `GET /api/nav/summary`: `getUser()` → 401 when signed out; `export const dynamic = "force-dynamic"`;
response header `Cache-Control: private, no-store`; all reads go through RLS / `security invoker` RPCs as the user.
Returns only the summary fields.

### 3.4 Refresh (client)

`useNavSummary(initial)` refetches on every pathname change and on the window event `korume:review-submitted`,
which `components/learning/review-session.tsx` and `components/video-player/mining-review-session.tsx` dispatch
after a review save returns `res.ok` (not before, not on failure).

- Each fetch aborts the previous one (`AbortController`) so a late response cannot overwrite a newer one.
- 2xx → replace the whole summary (never merge).
- Network error / 5xx → keep the last good summary, no flicker.
- **401 (owner review, rounds 1–2)** → first, synchronously clear every personal field (name, avatar, plan, badge
  render nothing; the account trigger shows a neutral placeholder). Then a **full-page** `window.location.reload()`
  — not `router.refresh()`, which a concurrent client navigation can discard (app-footer T7). The full load passes
  the middleware, which already redirects a signed-out request on a protected path to
  `/<locale>/login?redirectTo=<locale-prefixed path>` (`lib/supabase/middleware.ts`), so the learner lands on
  sign-in and returns to the same page afterwards; no locale or URL logic in the nav. Loop guard: if a reload for
  401 already happened in this tab within the last 10s (`sessionStorage` timestamp, read/write in try/catch), do not
  reload again — stay cleared. Switching accounts goes through sign-out (a full POST navigation), so a new account
  always mounts with its own server summary.

### 3.5 Account menu

- Trigger: `<button aria-haspopup="menu" aria-expanded>` showing avatar, name, plan chip, chevron (rail: avatar
  only, with an accessible name).
- Menu: rendered with the native Popover API (`popover="manual"`) so it sits in the top layer — never clipped by
  the nav's overflow, never under page content (the frame-03 export shows the dashboard layer covering it).
  Positioned from the trigger's rect on open, opening upward; flipped / shifted to stay inside the viewport at
  1280×529 and in rail mode.
- Items (`role="menu"`): Hồ sơ, Cài đặt (from the registry `account` group, not hard-coded), Giảm chuyển động
  (`menuitemcheckbox`, `aria-checked` bound to the real reduce-motion state, toggles it), divider, Đăng xuất (submit
  of the existing `/auth/signout` POST form). A small header row shows name + email.
- Keyboard: Enter/Space/↓ opens and focuses the first item, ↑ opens on the last; ↑/↓ move, Home/End; Esc closes and
  returns focus to the trigger; Tab closes; click outside closes.

### 3.6 Tooltip (rail)

One `role="tooltip"` element per `AppNav`, rendered in the top layer (popover) or `position: fixed` outside the
scroll region, positioned beside the hovered/focused rail item. Shows on hover and on `:focus-visible` focus, hides
on blur, pointer leave, Esc and scroll. Linked with `aria-describedby`. Content: the item label (Ôn tập adds
"· 32"). Rail links also carry `aria-label`.

### 3.7 Unchanged

The notification bell component (its panel must stay inside the viewport in rail mode — measured; if clipped it
moves to the same popover technique), one `<nav>` landmark (`route-group-provider-identity.spec.ts`), registry-
derived groups, the server-only `NAV_GROUPS` import boundary.

## 4. Visual finish (Claude's refinement, owner to judge)

Built only from existing tokens: surfaces `void-*`, the one accent `ember-500` (and `ember-300` for text on dark),
`sand-400` for status, `paper-50` text, `slate-*` hairlines/metadata, `--radius-*`, `--text-*`, Plus Jakarta for
the wordmark. The DNA it borrows from approved screens: the footer's tracked uppercase caption labels and display
wordmark (`-0.04em`), hairline borders that warm to ember on hover, rounded tiles, quiet dark surfaces with a single
warm accent.

- **Surface.** Sidebar on the recessed surface (`--muted`, void-900) with a hairline right border, so content cards
  (void-850) sit forward. A faint ember wash at the top-left of the header (≤6% opacity radial) gives the brand
  corner warmth without a new colour.
- **Brand.** `korume.png` 36 on a rounded tile with a 1px ember/25% ring; wordmark "Korume" in the display face,
  700, `-0.04em`, `--text-heading`.
- **Group labels.** `--text-caption`, 600, uppercase, `0.16em` tracking, `muted-foreground`; extra space above each
  group instead of the frame's cramped 9px.
- **Items.** Lucide icon 18 (stroke 1.75) + label `--text-body` 500, radius `--radius-sm`. Hover: void-800 fill,
  text to foreground, 150ms. **Active:** ember 12% fill, `ember-300` text and icon, and a 3px ember indicator bar on
  the item's inner left edge with a soft ember glow — the one modern accent; replaces the frame's flat brown block.
  Focus-visible: 2px ember ring with offset (frame 04).
- **Due badge.** Pill, `tabular-nums`, ember 16% fill + `ember-300` text, "99+" cap, hidden at 0. Rail: a 6px ember
  dot on the Ôn tập icon when due > 0 (the count lives in the tooltip and the accessible name).
- **Header buttons.** Bell and toggle as ghost icon buttons — 32 visual circle inside a 44px hit area (§2); toggle uses `PanelLeftClose` / `PanelLeftOpen`
  instead of ‹ ›.
- **Scroll list.** Thin styled scrollbar; soft fade masks at the top/bottom edges only while there is more to scroll
  (signals the scroll at 529px tall).
- **Footer.** Help as a ghost row (`CircleHelp`). Account trigger as a small card (void-800, hairline, radius-md):
  28 round avatar, name (truncate + `title`), plan chip — FREE: slate outline; PLUS: sand-400 fill, ink text — and
  `ChevronsUpDown`.
- **Account menu.** `--surface-overlay`, hairline, radius-md, large soft shadow, 8 padding; icons `User`,
  `Settings`, `Wind` (+ a small switch showing the state), `LogOut` in `coral-300` after a divider.
- **Rail.** Same items as 44-wide centred icon buttons, groups separated by short hairlines (frame 02); active keeps
  the indicator bar.

Every number above is a default the owner can overrule at the Chrome look; none changes structure.

## 5. Tests and acceptance

**Unit (Vitest/RTL).** AppNav: both modes; groups from props; longest-prefix active; Ôn tập active on all three
review routes; badge hidden at 0 / "99+" / accessible name with count; cookie written only when `mode="app"`;
mount-time cookie re-read. AccountMenu: open keys, ↑/↓/Home/End, Esc returns focus, Tab and outside click close,
`aria-checked` follows and toggles the real reduce-motion state. Tooltip: hover, focus-visible, Esc. useNavSummary:
replace on 2xx, keep on network error/5xx, on 401 clear before reload + exactly one reload + no second reload within
10s, abort of the stale request, refetch on the event. `getNavSummary` fallbacks; API 401 and `no-store`; review
sessions dispatch the event only on `res.ok`; `reviewDestination` — all three zero-due/due branches. Every nav row,
header button, menu item ≥ 44px tall (asserted on the rendered class/token, measured in E2E). One mutation per non-trivial branch (lesson: Codex tests need mutation).
`app-nav.test.tsx` expected counts updated (no `account` group in the list).

**E2E (Playwright).**
- E1 collapse in `(app)` → reload → still rail; expand → reload → expanded.
- E2 expanded → client-navigate into `(focus)` (rail) → toggle there → client-navigate back to `(app)` → expanded,
  cookie unchanged; reload → expanded. Same path with full navigations.
- E3 review one kanji card on `/kanji/review` → badge decrements without a route change.
- E4 account menu and rail tooltip: topmost at their centre (`elementFromPoint`) and fully inside 1280×529.
- E5 `typography.spec.ts` and `route-group-provider-identity.spec.ts` green.
- E6 expired session: signed in on `/dashboard` with the account name visible → clear the context's auth cookies →
  trigger a refetch (client navigation) → the old name, avatar initial, plan chip and badge are gone from the DOM,
  and the page ends on `/<locale>/login?redirectTo=…/dashboard`.
- E7 every nav row, header button, Help row, account trigger and menu item measures ≥ 44px tall at 1280×529.

**Chrome measure (A1).** At exactly **1280×529, 1440×900 and 1920×1080** (Playwright Chromium viewports; 1920
cannot be shown on the owner's screen, so it is measured there, not eyeballed), in expanded and rail mode, assert
the §2 table: expanded width 240 / 270 / 337.5px, rail 72 / 81 / 101.25px (±0.5px), row height 44 / 44 / 47.8px;
header and footer stay fixed while the list scrolls; no horizontal scroll. Results go in the run state. Then the
owner's look in their Chrome at 1280×529; merge only on the owner's approval.

## 6. Out of scope

Building FAQ/Quickstart or a unified `/review` hub; mobile (web is desktop-only); the site header used by
marketing/auth pages; the `contentinfo` landmark and `staleTimes` owner calls from app-footer; motion beyond the
width/hover transitions (UX/motion pass stays deferred).
