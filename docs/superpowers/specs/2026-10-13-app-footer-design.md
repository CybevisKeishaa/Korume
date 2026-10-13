# App Footer — design

- **Status:** design approved in conversation by the owner on 2026-10-13 (rulings F1–F6 below). Written-spec review
  round 1 (2026-10-13) folded in: Home → `/dashboard`, back-to-top target, three sections, legibility-first scale with
  a measured compact mode (L2a/L2b), newsletter honesty + session/sync + SQL hardening (N2–N3b), copy, T2/T3/T6.
  O1 resolved by the owner (§8). Round 2 (owner): L2/L3 replaced by the single-row adaptive footer — compact mode
  simplifies content instead of adding a row (L2a–L2e), T1/T6 amended. Awaiting the owner's approval before
  `writing-plans`.
- **Branch:** `app-footer`, worktree `.worktrees/app-footer`, base `master` at **`44fc84f0`**.
- **Frame:** Footer `203:13813` — file `IwFHZDZdHW7qsSFiNbWrkd`
  (`figma.com/design/IwFHZDZdHW7qsSFiNbWrkd/Korume?node-id=203-13813`), 1536x733.
- **Not in this branch:** the app navbar. The owner is having Figma draw it from the content list agreed on
  2026-10-13; it gets its own branch (`app-chrome-refresh`) once the frame exists.

Decision IDs (F, N, L, T) are stable. Plans, reviews and commits cite them.

---

## 0. Authority

Figma decides composition, hierarchy and proportion; the repo decides source of truth (`docs/lessons.md` L-051,
`figma-is-the-frame`). A port is complete: every control has a real effect, nothing is mocked. A label whose
destination does not exist ships as text, never as `#`, a placeholder route or a 404 (the landing footer's rule,
`components/marketing/site-footer.tsx`). Web is desktop-only (owner 2026-10-08).

## 1. Rulings

**F1 — Where the footer renders (owner, 2026-10-13).** The landing page keeps its existing footer
(`components/marketing/site-footer.tsx`, frame `347:7087`) unchanged. The new frame renders as `AppFooter` on the
"outer" app pages only — library, browse and overview pages — never on practice workspaces or functional pages.

| With `AppFooter` | Route |
|---|---|
| Lessons hub | `/shadowing` |
| Explore lessons | `/shadowing/explore` |
| Pronunciation library | `/pronunciation`, `/pronunciation/collections/[slug]`, `/pronunciation/paths` |
| Kanji library | `/kanji` |
| Grammar | `/grammar` |
| Conversation library | `/conversation` |
| Certification list | `/certification` (the list only) |
| Playlists | `/playlists`, `/playlists/[id]` |
| Collection | `/mining` |
| Profile | `/profile` |

Everything else has no footer, explicitly including: `/dashboard`, `/kanji/[id]`, every `(focus)` route (Shadowing,
Dictation, Summary), `/certification/[id]`, `/kanji/review`, `/mining/review`, `/korume/chat`, `/settings/**`,
`/profile/edit`, `/vocab/print`, `/journal`, auth screens, and every `UpcomingScreen` placeholder.

**F2 — Placement.** Each listed page renders `<AppFooter />` as the last element of its returned tree, outside the
page's own width/padding container, so the footer spans the full main column beside `AppNav`. No layout reads the
pathname; no new route group. A test pins the exact set of page files that render it (T2).

**F3 — Links.** Same rule as the landing footer: only a label with a real destination is interactive.

| Element | Behaviour |
|---|---|
| Home | link `/dashboard` — the learner's home inside the app, same target as `AppNav`'s logo. `/` is the marketing page, which does not redirect a signed-in learner (spec review 2026-10-13) |
| Roadmap | link `/roadmap` |
| Contact | `mailto:` `SUPPORT_EMAIL` (`lib/contact.ts`) |
| Support address (`admin@almostgone.vn` in the frame) | `mailto:` `SUPPORT_EMAIL` — the repo constant wins over the frame's literal |
| Mascot card ("Say hello to Korume", `203:13856`) | link `/companion` |
| App Store / Google Play badges | external links `APP_STORE_URL` / `PLAY_STORE_URL` (`lib/app-stores.ts`): the stores' front pages, Korume not being published — the owner's 2026-08-28 landing ruling, **re-confirmed for the app footer on 2026-10-13 (O1)** with that fact stated. Frame copy kept as is |
| "Back to the beginning" | a real button: `window.scrollTo({ top: 0 })` — the `(app)` layout has no scroll container, the window scrolls — smooth unless reduce-motion is on; then focus moves to the `(app)` layout's `<main>`, which gains `id="main-content"` and `tabIndex={-1}`, so it works on a page with no `h1` |
| Pricing, FAQ, Blog, About, Careers, Privacy Policy, Terms of Service, Discord, Facebook, TikTok | text, no link. Adding the page later is one `href` |

**F4 — Newsletter = real per-account opt-in (owner, 2026-10-13).** See §3.

**F5 — Copy.** The new frame's copy is the app footer's copy; the landing footer keeps its own wording. Labels that
are identical in both frames are read from the existing `marketing.footer.*` keys (column headings and labels,
wordmarks, `mascot.cta`, store badge text, `copyright`, `backToTop`) — one fact, one home. Copy that differs in the
new frame, and the new opt-in states, get new keys under `marketing.appFooter.*` in both `vi` and `en` (§4).

**F6 — Mascot art.** The frame's image fill (`203:13857`) is a crop of a pose reference sheet with its captions
("NGỦ GỤC", "YÊN BÌNH") and cream background baked in — the extractor-cut kind of art the owner rejected on
2026-10-08 (`mascot-cleanup`). The slot renders the crisp `public/mascot/actions/sleeping.png` (already the landing
footer's art) at the frame's box (`215x185` button inside the `310x190` card), transparent, no captions.
**Visible trade-off for the owner's review (L-051):** the two captioned poses are not reproduced.

## 2. Layout (L-051)

**L1 — Structure** (frame `203:13832`, content `203:13833` 1284 wide):

1. Top row, **three** sections (`203:13834`, `203:13866`, `203:13960`): brand (`374.7`) · links (`456.1`, three
   sub-columns of `125.4` with `40` gaps: Explore | Community + Support | Legal + A small note) · app block (`293.2`).
   Gaps `80`.
   - Brand: orange `K` tile 36x36 + "Korume" wordmark; tagline; mascot card (§1 F6) with the `ことば · KORUME` tile,
     the decorative `▣` chip and the sparkle icon (both `aria-hidden`).
   - Community and Support rows carry their 13x13 icons (Discord, Facebook, TikTok, mail).
   - App block: eyebrow, heading, body, the two store badges (164x57.6, round icon chip), a rule, then the newsletter
     form (§3).
2. Divider, then the centred closing line, copyright, and "Back to the beginning ↗".

The frame centre-aligns some list items (Pricing, FAQ, Blog, Roadmap, About, Careers, Contact, Terms of Service)
inside their column while Home and Privacy Policy sit left: an export artefact. Every list item is left-aligned.

**L2 — Single-row adaptive footer (owner, spec review round 2, 2026-10-13; supersedes round 1's two-row compact
mode).** The three top-row sections stay on **one row** at every supported desktop width, nav expanded or collapsed.
Priority when they conflict:

1. One row for the three sections.
2. Essential content legible and operable.
3. No horizontal overflow, no unintended wrapping.
4. The frame's ratios, when there is room.

Text is never shrunk below 12px to make content fit. The footer is its own inline-size container
(`container-type: inline-size`); both modes are chosen by **container queries on the footer's own width**, never by
viewport breakpoints.

**L2a — Wide mode: full composition** (container ≥ `--footer-wide`).

- Three sections Brand · Links · App, with the frame's structure, content, hierarchy and ratios (L1).
- Mascot card, every navigation label, store badges (F3, O1) and newsletter (§3).
- Sized with one unit `--f = clamp(<floor>, 100cqi / 1536, <ceiling>)` (1536 = the frame, margins included), every
  size written as `calc(N * var(--f))`, text floored at 12px — the `.dashboard-page` / `--d` pattern in
  `app/globals.css`. Existing semantic tokens for colour, font and radius.
- Long descriptions may wrap naturally as in the frame; nothing is clipped or overflows.

**L2b — Compact mode: single-row simplified composition** (container < `--footer-wide`).

Three columns on one row: **Brand · Essential links · Newsletter**. No section moves to a new row.

| Column | Shows | Hidden |
|---|---|---|
| Brand | `K` tile + "Korume" wordmark | tagline, mascot card |
| Essential links | Home → `/dashboard`, Roadmap → `/roadmap`, Contact → `mailto:SUPPORT_EMAIL` | every label without a destination, the Community/Support/Legal groups, "A small note" |
| Newsletter | `newsletter.headingCompact` + `newsletter.purposeCompact` (still states purpose and how to leave), account-email pill, submit button; every N3a state | — |
| App promotion | — | eyebrow, heading, body, both store badges (F3/O1 apply to wide mode only) |

- **Email pill:** the full address is in the DOM (so assistive technology reads all of it) and truncated visually
  with `text-overflow: ellipsis`; `title` carries it for pointer users; keyboard users see it in full in the Settings
  newsletter row (N4), which shows the account address unclipped and wrapping. That is the only ellipsis allowed in
  the footer.
- **Sizing is independent of the frame's scale:** fixed design targets, not Figma × `--f`. Starting targets for a
  ≈1017px container (1280 viewport, nav open: sidebar `224 × density` + 24px rail): Brand 192px · Links 288px ·
  Newsletter the rest; 24px column gap; 24px outer padding each side. These are targets to verify, not locked values.
- Pending, subscribed, session-expired and error states must not overflow horizontally; the footer may grow in
  height with its state, never by adding a row for a main section.

**L2c — Further reduction, in a fixed order** (only if measurement shows a supported width still does not fit
compact mode): (1) the Roadmap link, (2) the compact heading (purpose line stays), (3) the wordmark text (the `K`
tile stays, with "Korume" as its accessible name). Never a second row. The **supported floor** is the footer's width
at a 1280 viewport with the nav open (≈1017px, measured and pinned); narrower is outside the desktop contract.

**L2d — Measured, then locked.** `--footer-wide` is the smallest container width at which the full L2a composition
fits at its floor sizes without overflow or unintended wraps, measured from rendered content. It, the compact
column targets and any L2c step taken are pinned in the run state and a test only after that measurement.

**L2e — Bottom row.** The divider, closing line, copyright and "Back to the beginning" sit below the three sections
in both modes (the frame's own second band, not a main section). In compact mode the closing line may wrap; the
copyright and the button stay on one line each.

**L3 — Overflow and text integrity.**

- No horizontal scrolling.
- No clipping except the email ellipsis (L2b).
- The wordmark, navigation labels, control labels and compact headings stay on one line.
- Text ≥ 12px; primary functional labels (links, buttons, the email pill) ≥ 14px where the mode allows.
- Hidden content is `display: none` (container query), so it leaves both the accessibility tree and the focus order.
- The footer may change height with content and state; it never adds a row for a main section.

## 3. Newsletter opt-in

**N1 — Storage.** `users.newsletter_opt_in_at timestamptz null` (null = not subscribed). Beside the existing
`users.model_training_consent`; `users` is already in the user export (`lib/user-export/tables.ts`) and is removed
by account erasure, so both include the new column with no extra code — T4 proves it.

**N2 — Write path.** One function `set_newsletter_opt_in(p_opt_in boolean) returns timestamptz`, `language plpgsql
security definer set search_path = public` (empty-search-path hijack closed; every reference schema-qualified or
resolved in `public`). It raises `insufficient_privilege` when `auth.uid()` is null, and only ever updates
`where id = auth.uid()`: `true` sets `now()` only if currently null (idempotent, keeps the first consent instant),
`false` sets null. It returns the stored value. `revoke execute ... from public, anon`; `grant execute ... to
authenticated` (`supabase-anon-execute-default`). **No** column update grant: the client can never write an
arbitrary consent timestamp.

**N3 — What the learner is told.** Saving a consent and sending mail are different facts, and the copy states only
the first (N5). Under the heading, one line says what the list is for and how to leave it (`newsletter.purpose`,
§4). The success state says the sign-up is saved, never that mail will arrive.

**N3a — Footer form states** (server component reads the state, client island submits via a server action):

| State | Renders |
|---|---|
| Not subscribed | heading, purpose line, the frame's pill showing the account email **as text, not an `<input>`**, prefixed by a visible "Account email" label so it does not read as editable, and the orange send button |
| Pending | button disabled with `aria-busy`; no layout shift |
| Subscribed | the pill and button are replaced by `newsletter.subscribed` and a link `newsletter.manage` → `/settings#newsletter` |
| Session expired | the action finds no user → inline message `newsletter.signedOut` with a sign-in link back to the current page; nothing saved |
| Error | the form stays, an inline `role="alert"` message `newsletter.error`; nothing is claimed as saved |

The email is never sent from the client: the action takes no email argument and uses the session user.

**N3b — One state, two surfaces.** Footer and Settings both read `users.newsletter_opt_in_at` on render; neither
caches it client-side beyond the island's optimistic step. The footer action and the Settings toggle each call
`revalidatePath` for `/settings` and the footer pages after a successful write, so a change on one surface shows
on the other at the next navigation.

**N4 — Settings.** A newsletter toggle row in the Privacy & data section (`components/settings/privacy-data-section.tsx`),
beside the AI-training consent toggle, anchored `#newsletter`. On → `set_newsletter_opt_in(true)`, off →
`set_newsletter_opt_in(false)`. The row shows the account email in full (wrapping, never clipped) — the place where
the footer's compact ellipsis (L2b) can be read whole.

**N5 — Sending is out of scope.** No mail is sent; `EMAIL_PROVIDER=none` stays. The column is the list a future
sender reads; when sending starts, that branch revisits the copy.

## 4. Copy (new keys, `marketing.appFooter.*`)

| Key | en (frame) | vi |
|---|---|---|
| `tagline` | Your quiet place to grow with Japanese. | Góc yên tĩnh để bạn lớn lên cùng tiếng Nhật. |
| `note.heading` | A small note | Đôi lời nhỏ |
| `note.body` | We make space for steady, curious learning. | Một không gian để bạn học đều đặn và luôn tò mò khám phá. |
| `app.eyebrow` | Continue learning anywhere | Học tiếp ở bất cứ đâu |
| `app.heading` | Take your next small step with you. | Bước học tiếp theo, ở bất cứ đâu. |
| `app.body` | Sync your learning across every device, and come back whenever the day leaves a little room. | Đồng bộ việc học trên mọi thiết bị, và quay lại bất cứ khi nào ngày còn chút khoảng trống. |
| `newsletter.heading` | A gentle note, once in a while. | Thỉnh thoảng, một lá thư nhẹ nhàng. |
| `newsletter.purpose` | Sign up for occasional notes on new lessons and study tips, once Korume starts sending them. Unsubscribe anytime in Settings. | Đăng ký để nhận thư về bài học mới và mẹo học khi Korume bắt đầu gửi. Hủy bất cứ lúc nào trong Cài đặt. |
| `newsletter.headingCompact` | A gentle note | Thư nhẹ nhàng |
| `newsletter.purposeCompact` | Occasional notes once we start sending. Unsubscribe in Settings. | Thư thỉnh thoảng khi Korume bắt đầu gửi. Hủy trong Cài đặt. |
| `newsletter.emailLabel` | Account email | Email tài khoản |
| `newsletter.submit` | Subscribe | Đăng ký nhận thư |
| `newsletter.subscribed` | Your newsletter sign-up is saved. | Đã lưu đăng ký nhận thư của bạn. |
| `newsletter.manage` | Manage in Settings | Quản lý trong Cài đặt |
| `newsletter.signedOut` | Your session has ended. Sign in again to save this. | Phiên đăng nhập đã hết. Đăng nhập lại để lưu nhé. |
| `newsletter.error` | Couldn't save that. Please try again. | Chưa lưu được. Bạn thử lại nhé. |
| `closing` | Wherever you are, we'll keep learning together. | Dù bạn ở đâu, chúng ta vẫn tiếp tục học cùng nhau. |
| `ariaLabel` | Site footer | Chân trang |

The `app.*` rows ship as written (O1, §8).

Settings row copy (`settings.newsletter.title` / `.body`): "Newsletter" / "Save your sign-up for Korume's occasional
note at your account email. Nothing is sent yet." — "Thư từ Korume" / "Lưu đăng ký nhận thư thỉnh thoảng từ Korume
qua email tài khoản. Hiện chưa gửi thư nào."

## 5. Accessibility

`<footer>` with its own label (one `contentinfo` per page). Each link column is a `<nav>` labelled by its heading;
headings are `h2`. Icons and the `▣` chip are `aria-hidden`. The account email is text with a visible label (no
read-only input); the send button's name is `newsletter.submit`; status messages use `role="status"`, errors
`role="alert"`. Every control meets `min-h-hit-target` and has a visible
focus ring. Back-to-top respects reduce-motion.

## 6. Tests and gates

- **T1 — Component.** Two content sets, checked separately. Wide set: every frame label; exactly the F3 elements
  are interactive, with their hrefs; the rest are text. Compact set: exactly the L2b "Shows" column, nothing else
  marked compact-visible; compact never requires a frame label it hides. jsdom cannot evaluate container queries, so
  T1 asserts each element's mode membership (its wide-only / compact-only / both marker); what is actually visible is
  T6's job. Mutation: turn one text label into a link → red; mark a hidden label compact-visible → red.
- **T2 — Placement pin.** A test scans every `page.tsx` under `app/[locale]` and compares the set rendering
  `AppFooter` to F1's table exactly (extra or missing → red), and asserts each listed file renders it **exactly once**
  (two footers → red). The `(app)` layout must not render it.
- **T3 — Opt-in.** Unit: action states (idle, pending, subscribed, session expired, error); the action takes no
  email argument; both surfaces revalidate. SQL (`verify:db` style, live local DB): `set_newsletter_opt_in` idempotent
  on `true` (first instant kept), clears on `false`, raises with no `auth.uid()`, `anon` has no EXECUTE, cannot
  touch another user; `authenticated` has no column update grant; the function's `search_path` is pinned
  (`pg_proc.proconfig`).
- **T4 — Data rights.** Export includes `newsletter_opt_in_at`; erasure leaves no row.
- **T5 — E2E.** Signed-in learner on `/shadowing`: subscribe in the footer → confirmation; Settings toggle shows on
  → switch off → footer shows the form again.
- **T6 — Chrome measure (gate).** First measure `--footer-wide`, the compact column widths and the supported floor
  (L2d) and pin them. Then, **nav expanded and nav collapsed** at each of 1280x529, 1440x900 and a 1920-wide
  same-origin iframe, record the mode and verify:
  - the three main sections share one row (equal top edge, ±2px);
  - the visible content set is exactly that mode's set (T1), and hidden elements are out of the focus order;
  - wide mode: sections within ±5% of the frame ratios (374.7 : 456.1 : 293.2, gaps 80 on 1284);
  - no horizontal scroll; for **every** footer element (columns, headings, link labels, badges, newsletter pill and
    button, each N3a state) `scrollWidth <= clientWidth` and its box stays inside its column; no clipping except
    the email ellipsis; one-line elements (L3) render one line;
  - smallest rendered text ≥ 12px; every control keeps its accessible name and a hit target ≥ `min-h-hit-target`.
  Recorded in the run state.
- Full vitest after the last edit (L-044), `npm run verify:protocol`, code-reviewer on the whole branch.

## 7. Out of scope

App navbar (separate branch); any new page for Pricing/FAQ/Blog/About/Careers/legal; social URLs; sending
newsletter mail; changes to the landing footer.

## 8. Resolved questions

**O1 — App promotion block while no app is published (owner, 2026-10-13).** Asked with the fact stated (no App
Store / Google Play listing) and three options (keep with "coming soon", same as landing, hide). Ruling: **same as
the landing** — badges link to the stores' front pages, frame copy unchanged. When Korume ships, the two constants
in `lib/app-stores.ts` become listing URLs and both footers follow.
