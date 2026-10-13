# App Footer — design

- **Status:** design approved in conversation by the owner on 2026-10-13 (rulings F1–F6 below). Written-spec review
  round 1 (2026-10-13) folded in: Home → `/dashboard`, back-to-top target, three sections, legibility-first scale with
  a measured compact mode (L2a/L2b), newsletter honesty + session/sync + SQL hardening (N2–N3b), copy, T2/T3/T6.
  O1 resolved by the owner (§8). Round 2 (owner): always one row. Round 3 (owner): no wide/compact variants —
  one composition with the frame's sections and space reallocated (L1: 24 · 230 · 24 · 330 · 24 · 361 · 24 at
  1017), Links in two sub-columns, functionless labels cut except Legal (kept as text), reduction only if measured
  (L2b), empty `search_path`, email-ellipsis exemption in T6. Awaiting the owner's approval before `writing-plans`.
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
| Mascot card ("Say hello to Korume", `203:13856`) | link `/companion` |
| App Store / Google Play badges | external links `APP_STORE_URL` / `PLAY_STORE_URL` (`lib/app-stores.ts`): the stores' front pages, Korume not being published — the owner's 2026-08-28 landing ruling, **re-confirmed for the app footer on 2026-10-13 (O1)** with that fact stated. Frame copy kept as is |
| "Back to the beginning" | a real button: `window.scrollTo({ top: 0 })` — the `(app)` layout has no scroll container, the window scrolls — smooth unless reduce-motion is on; then focus moves to the `(app)` layout's `<main>`, which gains `id="main-content"` and `tabIndex={-1}`, so it works on a page with no `h1` |
| Privacy Policy, Terms of Service | text, no link (owner kept the Legal group as text, round 3). Adding the page later is one `href` |
| Pricing, FAQ, Blog, About, Careers, Discord, Facebook, TikTok, the support address, "A small note" | **not rendered** in the app footer (owner, spec review round 3: functionless labels are cut to make room). Contact already opens mail to `SUPPORT_EMAIL`. Each returns as one entry when its page or URL exists |

**F4 — Newsletter = real per-account opt-in (owner, 2026-10-13).** See §3.

**F5 — Copy.** The new frame's copy is the app footer's copy; the landing footer keeps its own wording. Labels that
are identical in both frames are read from the existing `marketing.footer.*` keys (column headings and labels,
wordmarks, `mascot.cta`, store badge text, `copyright`, `backToTop`) — one fact, one home. Copy that differs in the
new frame, and the new opt-in states, get new keys under `marketing.appFooter.*` in both `vi` and `en` (§4).

**F6 — Mascot art.** The frame's image fill (`203:13857`) is a crop of a pose reference sheet with its captions
("NGỦ GỤC", "YÊN BÌNH") and cream background baked in — the extractor-cut kind of art the owner rejected on
2026-10-08 (`mascot-cleanup`). The slot renders the crisp `public/mascot/actions/sleeping.png` (already the landing
footer's art) in the frame's card composition (`215x185` image button inside a `310x190` card), scaled to the 230-wide Brand column (L1), transparent, no captions.
**Visible trade-off for the owner's review (L-051):** the two captioned poses are not reproduced.

## 2. Layout (L-051)

**L1 — Structure: the frame's sections, space reallocated (owner, spec review round 3).** The frame spends ≈412 of
its 1536px on outer padding (≈126 per side) and three 80px gaps, and splits Links into three 125px sub-columns.
The owner ruled to keep the frame's three sections and their content hierarchy, but reallocate that space instead
of keeping the frame's widths or switching to a second layout. Design width = the footer at a 1280 viewport with
the nav open, **1017px**:

| Part | Target at 1017 |
|---|---|
| Outer padding, left / right | 24 |
| Gap between sections | 24 |
| Brand | 230 |
| Links (two sub-columns) | 330 |
| App + Newsletter | 361 |

(24 + 230 + 24 + 330 + 24 + 361 + 24 = 1017.) These are targets to verify against rendered text and mascot sizes,
not locked values (L2d).

1. Top row, three sections:
   - **Brand:** orange `K` tile + "Korume" wordmark; tagline; the mascot card (F6) scaled to the column, with the
     `ことば · KORUME` tile, the decorative `▣` chip and the sparkle icon (both `aria-hidden`).
   - **Links**, two sub-columns, every item left-aligned (the frame's centred items are an export artefact):
     sub-column 1 = Explore (Home, Roadmap); sub-column 2 = Support (Contact, with the frame's mail icon) then Legal
     (Privacy Policy, Terms of Service as text).
   - **App + Newsletter:** eyebrow, heading, body, the two store badges side by side (round icon chip as in the
     frame), a rule, then the newsletter form (§3).
2. Divider, then the centred closing line, copyright, and "Back to the beginning ↗".

**L2 — One composition, one row, scaled (owner, rounds 2–3, 2026-10-13).** The three sections stay on **one row**
at every supported desktop width, nav expanded or collapsed, and there is **one** composition and one content set
(L1) — no wide/compact variants. Priority when they conflict:

1. One row for the three sections.
2. Essential content legible and operable.
3. No horizontal overflow, no unintended wrapping.
4. The L1 proportions.

The footer is its own inline-size container (`container-type: inline-size`). One unit
`--f = clamp(<floor>, 100cqi / 1017, <ceiling>)` (1017 = the L1 design width); every L1 size — padding, gaps, the
section widths as a `230fr 330fr 361fr` grid, type, the mascot card, badges — is written as `calc(N * var(--f))`, the
`.dashboard-page` / `--d` pattern in `app/globals.css`. Text is never below 12px; primary functional labels (links,
buttons, the email pill) are ≥ 14px. Existing semantic tokens for colour, font and radius. Long descriptions (tagline,
app body, newsletter purpose) may wrap naturally; nothing is clipped except the email (L3).

**L2a — Above the ceiling.** Where `--f` reaches its ceiling (very wide main columns), the grid's `fr` tracks share
the extra width in the same `230 : 330 : 361` ratio and type stops growing; nothing is centred inside a max-width.

**L2b — Reduction, only if measured necessary.** If L2d shows the L1 content does not fit at the supported floor,
content is removed below a measured breakpoint `--footer-reduced`, in this fixed order and only as far as needed:
(1) the app block's body, (2) the tagline, (3) the mascot card. Never a second row, never a smaller text floor. If
L1 fits at the floor, `--footer-reduced` does not exist and this clause is recorded as unused.

**L2c — Supported floor.** The footer's width at a 1280 viewport with the nav open (≈1017px: sidebar
`224 × density` + 24px rail), measured and pinned. Narrower is outside the desktop contract.

**L2d — Measured, then locked.** The L1 targets, `--f`'s floor and ceiling, and `--footer-reduced` (if any) are
measured from rendered content at the floor and at 1440/1920, then pinned in the run state and in T1/T6.

**L2e — Bottom row.** The divider, closing line, copyright and "Back to the beginning" sit below the three
sections (the frame's own second band, not a main section). Each stays on one line: the closing line is ≈322px at
1536, well inside a ≈1017px footer (T6 verifies).

**L3 — Overflow and text integrity.**

- No horizontal scrolling.
- **Email pill:** the full address is in the DOM (assistive technology reads all of it), truncated visually with
  `text-overflow: ellipsis`, `title` carrying it for pointer users; keyboard users see it in full in the Settings
  newsletter row (N4). That is the only ellipsis and the only clipping allowed in the footer.
- The wordmark, navigation labels, control labels and headings stay on one line.
- Content removed by L2b is `display: none` (container query), so it leaves the accessibility tree and focus order.
- The footer may change height with content and newsletter state; it never adds a row for a main section.

## 3. Newsletter opt-in

**N1 — Storage.** `users.newsletter_opt_in_at timestamptz null` (null = not subscribed). Beside the existing
`users.model_training_consent`; `users` is already in the user export (`lib/user-export/tables.ts`) and is removed
by account erasure, so both include the new column with no extra code — T4 proves it.

**N2 — Write path.** One function `set_newsletter_opt_in(p_opt_in boolean) returns timestamptz`, `language plpgsql
security definer set search_path = ''`, every reference schema-qualified (`public.users`, `auth.uid()`,
`pg_catalog.now()`) — the stricter of the repo's two conventions, as in `20260820000029_account_deletion.sql`, which
also writes `users`. It raises `insufficient_privilege` when `auth.uid()` is null, and only ever updates
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
the footer's email ellipsis (L3) can be read whole.

**N5 — Sending is out of scope.** No mail is sent; `EMAIL_PROVIDER=none` stays. The column is the list a future
sender reads; when sending starts, that branch revisits the copy.

## 4. Copy (new keys, `marketing.appFooter.*`)

| Key | en (frame) | vi |
|---|---|---|
| `tagline` | Your quiet place to grow with Japanese. | Góc yên tĩnh để bạn lớn lên cùng tiếng Nhật. |
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

- **T1 — Component.** The rendered set is exactly the L1 content: every F3 element present is interactive with its
  href; Privacy Policy and Terms of Service are text; none of F3's "not rendered" labels appear. If L2b is used,
  the elements it may remove carry a marker and nothing else does (jsdom cannot evaluate container queries; T6
  checks actual visibility). Mutation: turn a text label into a link → red; render a cut label → red.
- **T2 — Placement pin.** A test scans every `page.tsx` under `app/[locale]` and compares the set rendering
  `AppFooter` to F1's table exactly (extra or missing → red), and asserts each listed file renders it **exactly once**
  (two footers → red). The `(app)` layout must not render it.
- **T3 — Opt-in.** Unit: action states (idle, pending, subscribed, session expired, error); the action takes no
  email argument; both surfaces revalidate. SQL (`verify:db` style, live local DB): `set_newsletter_opt_in` idempotent
  on `true` (first instant kept), clears on `false`, raises with no `auth.uid()`, `anon` has no EXECUTE, cannot
  touch another user; `authenticated` has no column update grant; the function's `search_path` is pinned to empty
  (`pg_proc.proconfig`).
- **T4 — Data rights.** Export includes `newsletter_opt_in_at`; erasure leaves no row.
- **T5 — E2E.** Signed-in learner on `/shadowing`: subscribe in the footer → confirmation; Settings toggle shows on
  → switch off → footer shows the form again.
- **T6 — Chrome measure (gate).** First measure and pin the L2d values. Then, **nav expanded and nav collapsed**
  at each of 1280x529, 1440x900 and a 1920-wide same-origin iframe, verify:
  - the three main sections share one row (equal top edge, ±2px);
  - sections, gaps and padding within ±5% of the L1 proportions (`230 : 330 : 361`, gaps and padding 24 per 1017);
  - the visible content set is exactly L1's (minus any pinned L2b step below `--footer-reduced`), and removed
    elements are out of the focus order;
  - no horizontal scroll; for **every** footer element (columns, headings, link labels, badges, newsletter pill and
    button, each N3a state) `scrollWidth <= clientWidth` and its box stays inside its column; one-line elements
    (L3) render one line;
  - **the one exemption:** the email text element (`data-footer-email`) may have `scrollWidth > clientWidth` when
    ellipsized. For it instead: its computed `text-overflow` is `ellipsis`, its pill and column do satisfy
    `scrollWidth <= clientWidth`, its `textContent` and `title` equal the full account address, and no other
    element uses ellipsis;
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
