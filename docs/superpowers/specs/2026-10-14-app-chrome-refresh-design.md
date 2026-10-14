# App chrome refresh — the learner sidebar (AppNav)

- Branch `app-chrome-refresh`, worktree `.worktrees/app-chrome-refresh`, base master `a3df0220`.
- Figma: file `IwFHZDZdHW7qsSFiNbWrkd`, page `655:2` "App Navigation · Proposal" — frames `656:2` (Expanded /
  Free), `656:84` (Collapsed / Free), `656:147` (Expanded / Plus / user menu, menu `656:213`), `656:242` (Collapsed
  / Plus / focused). All four are drawn at 1280×529.
- Status: brainstormed with the owner 2026-10-14; this spec awaits the owner's review. No product code before it
  is approved and a plan exists.

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
| item row height (34) | 34px | 38.25px | 47.8px |
| share of viewport (expanded) | 18.75% | 18.75% | 17.6% |

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

**Zero due (owner point 1).** `reviewDestination()` today sends a learner with 0 due to the most recently reviewed
deck — for mining that is an empty session. Fix it in the shared function (one place, all callers): when the summed
due is 0 the destination is `/kanji/review`, whose queue also serves new kanji, so it is a real session; when every
kanji is learned it shows its own honest empty state. This changes the Dashboard Review tile at 0 due the same way;
the plan pins the new branch with a test.

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
- **401 (owner point 2)** → clear every personal field at once (name, avatar, plan, badge show nothing) and call
  `router.refresh()`, which re-runs the protected layout's auth guard and lands on sign-in. Switching accounts goes
  through sign-out (a full POST navigation), so a new account always mounts with its own server summary.

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
- **Header buttons.** Bell and toggle as 32 ghost icon buttons; toggle uses `PanelLeftClose` / `PanelLeftOpen`
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
replace on 2xx, keep on network error/5xx, clear + refresh on 401, abort of the stale request, refetch on the event.
`getNavSummary` fallbacks; API 401 and `no-store`; review sessions dispatch the event only on `res.ok`;
`reviewDestination` zero-due branch. One mutation per non-trivial branch (lesson: Codex tests need mutation).
`app-nav.test.tsx` expected counts updated (no `account` group in the list).

**E2E (Playwright).**
- E1 collapse in `(app)` → reload → still rail; expand → reload → expanded.
- E2 expanded → client-navigate into `(focus)` (rail) → toggle there → client-navigate back to `(app)` → expanded,
  cookie unchanged; reload → expanded. Same path with full navigations.
- E3 review one kanji card on `/kanji/review` → badge decrements without a route change.
- E4 account menu and rail tooltip: topmost at their centre (`elementFromPoint`) and fully inside 1280×529.
- E5 `typography.spec.ts` and `route-group-provider-identity.spec.ts` green.

**Chrome measure (A1).** 1280×529 and 1440×900, expanded and rail, plus a width wider than the screen
(same-origin iframe): widths and row height per §2, header/footer fixed while the list scrolls, no horizontal
scroll. Then the owner's look; merge only on the owner's approval.

## 6. Out of scope

Building FAQ/Quickstart or a unified `/review` hub; mobile (web is desktop-only); the site header used by
marketing/auth pages; the `contentinfo` landmark and `staleTimes` owner calls from app-footer; motion beyond the
width/hover transitions (UX/motion pass stays deferred).
