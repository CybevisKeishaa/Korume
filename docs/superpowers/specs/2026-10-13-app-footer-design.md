# App Footer — design

- **Status:** design approved in conversation by the owner on 2026-10-13 (rulings F1–F6 below). Written spec awaiting
  the owner's review before `writing-plans`.
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
| Home | link `/` |
| Roadmap | link `/roadmap` |
| Contact | `mailto:` `SUPPORT_EMAIL` (`lib/contact.ts`) |
| Support address (`admin@almostgone.vn` in the frame) | `mailto:` `SUPPORT_EMAIL` — the repo constant wins over the frame's literal |
| Mascot card ("Say hello to Korume", `203:13856`) | link `/companion` |
| App Store / Google Play badges | external links `APP_STORE_URL` / `PLAY_STORE_URL` (`lib/app-stores.ts`, 2026-08-28 ruling) |
| "Back to the beginning" | a real button: scrolls the page to the top (smooth unless reduce-motion is on), then moves focus to the main content's first heading |
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

1. Top row, four sections at the frame's x-offsets: brand (`374.7`) · links (`456.1`, three sub-columns of `125.4`
   with `40` gaps: Explore | Community + Support | Legal + A small note) · app block (`293.2`). Gaps `80`.
   - Brand: orange `K` tile 36x36 + "Korume" wordmark; tagline; mascot card (§1 F6) with the `ことば · KORUME` tile,
     the decorative `▣` chip and the sparkle icon (both `aria-hidden`).
   - Community and Support rows carry their 13x13 icons (Discord, Facebook, TikTok, mail).
   - App block: eyebrow, heading, body, the two store badges (164x57.6, round icon chip), a rule, then the newsletter
     form (§3).
2. Divider, then the centred closing line, copyright, and "Back to the beginning ↗".

The frame centre-aligns some list items (Pricing, FAQ, Blog, Roadmap, About, Careers, Contact, Terms of Service)
inside their column while Home and Privacy Policy sit left: an export artefact. Every list item is left-aligned.

**L2 — Scale.** The footer is its own inline-size container and fills the main column (no max-width). One unit
`--f = clamp(<floor>, 100cqi / 1380, <ceiling>)` (1380 = the frame's `Container`), every size written as
`calc(N * var(--f))`; small text keeps a 12px legibility floor. The same pattern as `.dashboard-page` / `--d` in
`app/globals.css`. Colours, fonts and radii come from existing tokens; a new token only if the frame needs a value
none provides.

**L3 — No overflow.** At every desktop width the four top-row sections stay on one row; no horizontal scroll; the
email address never leaves its column (`overflow-wrap: anywhere` on the address only).

## 3. Newsletter opt-in

**N1 — Storage.** `users.newsletter_opt_in_at timestamptz null` (null = not subscribed). Beside the existing
`users.model_training_consent`; `users` is already in the user export (`lib/user-export/tables.ts`) and is removed
by account erasure, so both include the new column with no extra code — T4 proves it.

**N2 — Write path.** One `security definer` function `set_newsletter_opt_in(p_opt_in boolean) returns timestamptz`,
scoped to `auth.uid()`: `true` sets `now()` only if currently null (idempotent, keeps the first consent instant),
`false` sets null. It returns the stored value. `revoke execute ... from public, anon`; `grant execute ... to
authenticated`. **No** column update grant: the client can never write an arbitrary consent timestamp.

**N3 — Footer form states** (server component reads the state, client island submits via a server action):

| State | Renders |
|---|---|
| Not subscribed | the frame's heading, a read-only input holding the account email, the orange send button |
| Pending | button disabled with an accessible busy state; no layout shift |
| Subscribed | the form is replaced by a confirmation line (§4) and a link "Manage in Settings" → `/settings#newsletter` |
| Error | the form stays, an inline `role="alert"` message; nothing is claimed as saved |

The email is never sent from the client: the server action ignores the input and uses the session user.

**N4 — Settings.** A newsletter toggle row in the Privacy & data section (`components/settings/privacy-data-section.tsx`),
beside the AI-training consent toggle, anchored `#newsletter`. Off → `set_newsletter_opt_in(false)`.

**N5 — Sending is out of scope.** No mail is sent; `EMAIL_PROVIDER=none` stays. The column is the list a future
sender reads.

## 4. Copy (new keys, `marketing.appFooter.*`)

| Key | en (frame) | vi |
|---|---|---|
| `tagline` | Your quiet place to grow with Japanese. | Góc yên tĩnh để bạn lớn lên cùng tiếng Nhật. |
| `note.heading` | A small note | Đôi lời nhỏ |
| `note.body` | We make space for steady, curious learning. | Korume dành chỗ cho việc học đều đặn và tò mò. |
| `app.eyebrow` | Continue learning anywhere | Học tiếp ở bất cứ đâu |
| `app.heading` | Take your next small step with you. | Mang bước nhỏ tiếp theo theo bên bạn. |
| `app.body` | Sync your learning across every device, and come back whenever the day leaves a little room. | Đồng bộ việc học trên mọi thiết bị, và quay lại bất cứ khi nào ngày còn chút khoảng trống. |
| `newsletter.heading` | A gentle note, once in a while. | Thỉnh thoảng, một lá thư nhẹ nhàng. |
| `newsletter.emailLabel` | Your email | Email của bạn |
| `newsletter.submit` | Subscribe | Đăng ký nhận thư |
| `newsletter.subscribed` | You'll get Korume's occasional note. | Bạn sẽ nhận thư thỉnh thoảng từ Korume. |
| `newsletter.manage` | Manage in Settings | Quản lý trong Cài đặt |
| `newsletter.error` | Couldn't save that. Please try again. | Chưa lưu được. Bạn thử lại nhé. |
| `closing` | Wherever you are, we'll keep learning together. | Dù bạn ở đâu, mình vẫn cùng nhau học tiếp. |
| `ariaLabel` | Site footer | Chân trang |

Settings row copy (`settings.newsletter.title` / `.body`): "Newsletter" / "Receive Korume's occasional note at your
account email." — "Thư từ Korume" / "Nhận thư thỉnh thoảng từ Korume qua email tài khoản."

## 5. Accessibility

`<footer>` with its own label (one `contentinfo` per page). Each link column is a `<nav>` labelled by its heading;
headings are `h2`. Icons and the `▣` chip are `aria-hidden`. The read-only email input has a visible-equivalent
label; the send button's name is `newsletter.submit`. Every control meets `min-h-hit-target` and has a visible
focus ring. Back-to-top respects reduce-motion.

## 6. Tests and gates

- **T1 — Component.** `AppFooter` renders every frame label; exactly the F3 elements are interactive, with their
  hrefs; the rest are text. Mutation: turn one text label into a link → red.
- **T2 — Placement pin.** A test lists the page files rendering `AppFooter` and compares the set to F1's table
  exactly (extra or missing → red).
- **T3 — Opt-in.** Unit: action states (idle, pending, subscribed, error) and that the action ignores client email.
  SQL (`verify:db` style, live local DB): `set_newsletter_opt_in` idempotent on `true` (first instant kept), clears on
  `false`, refuses `anon`, cannot touch another user; `authenticated` has no column update grant.
- **T4 — Data rights.** Export includes `newsletter_opt_in_at`; erasure leaves no row.
- **T5 — E2E.** Signed-in learner on `/shadowing`: subscribe in the footer → confirmation; Settings toggle shows on
  → switch off → footer shows the form again.
- **T6 — Chrome measure (gate).** 1280x529 nav open, nav collapsed, 1440x900, and a 1920-wide same-origin iframe:
  top-row section widths within ±5% of the frame ratios (374.7 : 456.1 : 293.2, gaps 80 on 1284); no horizontal
  overflow; smallest rendered text ≥ 12px. Recorded in the run state.
- Full vitest after the last edit (L-044), `npm run verify:protocol`, code-reviewer on the whole branch.

## 7. Out of scope

App navbar (separate branch); any new page for Pricing/FAQ/Blog/About/Careers/legal; social URLs; sending
newsletter mail; changes to the landing footer.
