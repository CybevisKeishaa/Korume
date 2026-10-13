# App Footer — design

- **Status:** design approved in conversation by the owner on 2026-10-13 (rulings F1–F6 below). Written-spec review
  round 1 (2026-10-13) folded in: Home → `/dashboard`, back-to-top target, three sections, legibility-first scale with
  a measured compact mode (L2a/L2b), newsletter honesty + session/sync + SQL hardening (N2–N3b), copy, T2/T3/T6.
  O1 resolved by the owner (§8). Awaiting the owner's approval before `writing-plans`.
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

**L2 — Scale.** The footer is its own inline-size container and fills the main column (no max-width). One unit
`--f = clamp(<floor>, 100cqi / 1536, <ceiling>)` (1536 = the frame, margins included), every size written as
`calc(N * var(--f))`; text keeps a **12px legibility floor**. The same pattern as `.dashboard-page` / `--d` in
`app/globals.css`. Colours, fonts and radii come from existing tokens; a new token only if the frame needs a value
none provides.

**Priority when they conflict: legibility, then no overflow, then the frame's ratios.** The frame's text is 10–13px
at 1536; scaled to the main column at 1280 with the nav open (≈1017px: sidebar `224 × density` + 24px rail) most
of it hits the floor, while the columns shrink with `--f`. Pre-spec arithmetic: a Community/Support sub-column is
≈83px there, the support address at 12px ≈125px, the eyebrow ≈200px against a ≈194px app column — one row does not
fit. Hence two modes:

**L2a — Wide mode** (container ≥ `--footer-wide`): the frame's single row, L1 ratios.

**L2b — Compact mode** (container < `--footer-wide`): two rows, same content, same order. Row 1 = brand | links
(three sub-columns, ratio `374.7 : 456.1` kept). Row 2 = the app block across the full width, split in two:
eyebrow + heading + body | store badges + newsletter. Outer margins scale with `--f` as in wide mode.

`--footer-wide` is **measured, not guessed**: the smallest container width at which every element of the single
row fits at its floor size without wrapping a label mid-word or overflowing. Once measured it is pinned in the run
state and in a test (expected between the nav-open and nav-collapsed main column at 1280, i.e. ≈1017–1256).

**L3 — No overflow.** In both modes: no horizontal scroll, and no element overflows its box — every column, heading,
link label, badge and the newsletter field (T6). The support address is the only text allowed to break
(`overflow-wrap: anywhere`), and only in compact mode if measurement shows it must.

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
`set_newsletter_opt_in(false)`.

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

- **T1 — Component.** `AppFooter` renders every frame label; exactly the F3 elements are interactive, with their
  hrefs; the rest are text. Mutation: turn one text label into a link → red.
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
- **T6 — Chrome measure (gate).** First measure `--footer-wide` (L2) and pin it. Then at 1280x529 nav open, nav
  collapsed, 1440x900, and a 1920-wide same-origin iframe: record which mode each width lands in; in wide mode the
  three sections are within ±5% of the frame ratios (374.7 : 456.1 : 293.2, gaps 80 on 1284), in compact mode row 1
  keeps `374.7 : 456.1` within ±5%; no horizontal scroll; for **every** element in the footer (columns, headings,
  link labels, badges, newsletter pill and button) `scrollWidth <= clientWidth` and its box stays inside its column;
  smallest rendered text ≥ 12px. Recorded in the run state.
- Full vitest after the last edit (L-044), `npm run verify:protocol`, code-reviewer on the whole branch.

## 7. Out of scope

App navbar (separate branch); any new page for Pricing/FAQ/Blog/About/Careers/legal; social URLs; sending
newsletter mail; changes to the landing footer.

## 8. Resolved questions

**O1 — App promotion block while no app is published (owner, 2026-10-13).** Asked with the fact stated (no App
Store / Google Play listing) and three options (keep with "coming soon", same as landing, hide). Ruling: **same as
the landing** — badges link to the stores' front pages, frame copy unchanged. When Korume ships, the two constants
in `lib/app-stores.ts` become listing URLs and both footers follow.
