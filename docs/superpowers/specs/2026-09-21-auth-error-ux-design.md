# Auth + Error UX — design (2026-09-21)

> Branch `auth-error-ux`. Owner of this document: Claude. Implementation: Codex.
>
> Ports six Figma frames (file `IwFHZDZdHW7qsSFiNbWrkd`) and adds the two auth flows the product
> lacks: email verification by 6-digit code, and password reset. It is the first branch after
> `desktop-density-scale`, and its one hard constraint towards that work is §6.3: the route-error
> surface lives inside the live app shell and must not reset that shell's density.

## 1. Frames and what they are

| Frame | Node | Canvas | Role in this branch |
| --- | --- | --- | --- |
| Login | `65:2` | 1278 wide | Restyle. An **older** frame: different left scene, card padding, radius and type from the three below. Harmonised to them, not ported as its own style (§5.1). |
| Register | `332:3` | 1280 | Restyle, and the family reference for auth. |
| Forgot password | `333:210` | 1280 | New route `/forgot-password`. It is the *request a reset link* screen only. |
| Email OTP | `335:306` | 1280 | New route `/verify-email`. |
| Error404 | `335:1976` | 1280 | New `not-found` surface. Standalone, no app chrome. |
| Error boundary | `337:2055` | 1280 | New route-error surface. Drawn **inside** the app chrome; only its content area is in scope. |

**Derived screen, no frame:** `/reset-password` (*set a new password*, reached from the reset
email). It reuses `AuthSplitShell`, `AuthStory`, `AuthCard` and the existing form primitives
unchanged; only its copy, its two password fields and its action differ. It introduces no new
composition and no visual variant.

**Reference is the 1280 width, not the frame height.** The frames are 537, 566, 821 and 905 tall
because their content is. Layout uses `min-h-dvh`; long content scrolls. No page is sized to a frame
height.

## 2. Rulings that bind this spec (owner, 2026-09-21)

1. **Apple sign-in is not in this branch.** `decision-register.md` P14 allows it, but it needs an
   Apple Developer account and Supabase configuration that do not exist yet. It returns with the
   iOS work. GitHub stays out per P14.
2. **Email verification is a 6-digit code, replacing the confirmation link** — as drawn.
3. **`/reset-password` is built as the derived screen of §1**, not waited for as a frame.
4. **Each screen shows one mascot pose** (§5.4), with the mapping in §5.4 approved as written.
5. **Local `enable_confirmations` stays `false`.** The five existing e2e specs register and land on
   the dashboard; they are not changed. The real code round trip is verified once by hand before
   merge (§8.3).
6. **Legal and help affordances are omitted** (§3).

## 3. Deliberate omissions — present in Figma, not ported

An implementer reading the frames will see each of these. None of them is to be added.

| In Figma | Why it is not ported |
| --- | --- |
| "Continue with Apple", "Continue with GitHub" (Login, Register) | §2.1 and P14. Only "Continue with Google" is rendered. |
| The mascot **sticker strip** with Vietnamese labels (SUY NGHĨ, TẬP TRUNG, MỆT MỎI, NGỦ GỤC…) cropped into Register, Forgot, OTP and both error frames | A source-asset artifact: a large reference sheet cropped in place, not UI. Replaced by one clean pose per screen (§5.4). |
| "Code expires in 09:36" live countdown (OTP) | No trustworthy send timestamp exists on the client, and the configured OTP expiry is not verified (`supabase/config.toml` sets no `otp_expiry`; production is not visible from the repo). **No expiry line is shown at all.** If one is added later, its copy must derive from the configured expiry. |
| ToS consent checkbox, Terms / Privacy links, legal footer line with links (Login, Register) | Figma contains legal-consent UI and a "Need help?" affordance whose destination and content do not yet exist in the product. They are intentionally omitted from this port. Terms, Privacy and support/help destinations are separate backlog work and must be implemented before these affordances are introduced. This is **not** a ruling that consent is never needed: if product or legal requires explicit consent later, it returns with real behaviour. |
| "Need help?" (Forgot, OTP) | As above. |
| The app sidebar and top bar drawn in `337:2055` | The live `(app)` shell is authoritative (§6.3). |

## 4. Auth flows — server contract

All actions live in `app/[locale]/(auth)/actions.ts` and follow its existing pattern: a zod schema in
`lib/validation/auth.ts` emitting `auth.validation.*` catalog keys, `translateValidationKey`
extended with a `case` per new key, errors translated at the point of return, locale-aware
`redirect`.

| Flow | Route | Action | Supabase call | Result |
| --- | --- | --- | --- | --- |
| Register | `/register` | `register` (changed) | `signUp` | See §4.1. |
| Verify code | `/verify-email?email=` | `verifyEmail` | `verifyOtp({ email, token, type: "email" })` | Success → `/dashboard`. Failure → one generic "code is wrong or expired" error. |
| Resend code | `/verify-email` | `resendCode` | `resend({ type: "signup", email })` | Always the same neutral confirmation; a Supabase rate-limit error maps to a "wait before resending" message. |
| Request reset | `/forgot-password` | `requestPasswordReset` | `resetPasswordForEmail(email, { redirectTo: <origin>/auth/callback?next=/<locale>/reset-password })` | **Always** the same "if an account exists, we sent a link" state, whatever Supabase returns. No account enumeration. |
| Set new password | `/reset-password` | `updatePassword` | `updateUser({ password })` | Success → `/dashboard`. |
| Login | `/login` | `login` (changed) | `signInWithPassword` | Supabase's *email not confirmed* error → redirect `/verify-email?email=<email>&resend=1` (§5.3). Every other error keeps the existing single `errors.invalidCredentials` message. |

### 4.1 `register` must work in both confirmation modes

After `signUp`:

- **`data.session` present** — confirmation is off in this environment (local, CI). Continue to
  `/dashboard` exactly as today.
- **`data.user` present, `data.session` absent** — confirmation is required. Redirect to
  `/verify-email?email=<email>`.

The existing `/login?checkEmail=1` branch is removed, and with it the `login.checkEmail` banner and
its catalog key. **Acceptance for the task that changes `register`: it is tested against both
response shapes, session present and session absent.** Hard-coding `register → /verify-email` would
send local users to a code screen for a code Supabase never sent.

### 4.2 Routes and middleware

- `AUTH_ROUTES` (`lib/supabase/route-protection.ts`) gains `/forgot-password` and `/verify-email`.
  A signed-in user is bounced from them, which is correct: neither is meaningful with a session.
- **`/reset-password` must NOT be added to `AUTH_ROUTES`.** The recovery link signs the user in
  through `/auth/callback`; the middleware then bounces signed-in users off auth routes, so adding
  it would send the user to the dashboard before they can set a password. It is also not a
  protected route. The page itself checks for a session and, with none, shows an "this link has
  expired" state linking to `/forgot-password` instead of the form.
- `/auth/callback` forwards a locale-carrying `next`. One change (whole-branch review, 2026-09-22):
  a failed exchange whose `next` is `/reset-password` goes there, not to login, so a link opened in
  another browser (no PKCE verifier) or expired reaches the page's expired state.
- `/verify-email?email=` carries the address in the query string. **This is a deliberate
  trade-off**: the page needs the address to verify and resend, and there is no session to hold it.
  Rules: it is always URL-encoded when built (`register`, `login`); the page validates it with the
  same email schema, and a missing or invalid value redirects to `/register`; it is rendered as text
  only (React escaping); it is **not propagated** into any other link (e.g. "Change email" links to
  a bare `/register`); and the actions receive it from the form body via a hidden field, never by
  reading the URL.
- `resend=1` is an **untrusted UI hint** and nothing more. It does not trigger a resend, does not
  bypass Supabase's rate limit, and does not start a cooldown; it only sets the initial state of
  the resend control to enabled (§5.3).

### 4.3 Validation additions

- `registerSchema` gains `confirmPassword` with a refinement that it equals `password`
  (`validation.passwordMismatch`, reported on `confirmPassword`).
- `resetPasswordSchema`: `password` with `registerSchema`'s exact min/max rule (derive it; do not
  restate 8/72 — AGENTS.md §6 *one fact, one home*) plus `confirmPassword`.
- `verifyEmailSchema`: `email`, and `token` matching exactly six ASCII digits.
- `forgotPasswordSchema`: `email`.

### 4.4 Email template

`supabase/templates/confirmation.html` renders `{{ .Token }}` as the code, and `supabase/config.toml`
points `[auth.email.template.confirmation]` at it (with a subject). It takes effect only where
confirmations are on. **Production is configured by the owner by hand** in the Supabase dashboard;
the run state's final checklist must say so, because no commit can do it.

## 5. Components

Figma is a **composition reference**, not a value source. Values come from the existing tokens and
primitives (`components/ui/*`, the Tailwind theme). There is **one** auth visual language: where
Login and the Register family disagree, Register's family wins, mapped onto existing tokens. Fonts:
Figma's Inter maps to `font-sans` (Plus Jakarta Sans); Outfit is `font-display`. No new font loads.

### 5.1 Auth primitives (`components/auth/`)

- **`AuthSplitShell`** — a centred pair, story beside a fixed `w-96` card column inside `max-w-6xl` (at 1280: story 128-704, card 768-1152; owner ruling 2026-09-22 replaced the full-bleed 60/40 split, whose columns sat too far apart around a too-wide card), background, a left slot and a right
  slot. It has **no per-screen variants**; a screen differs only by what it puts in the slots.
- **Minimum responsive contract for `AuthSplitShell` — corrected 2026-09-21 during Task 2 review.**
  The first version of this bullet set a 320 px floor with a single-column fallback. That rested on
  a false premise: below 1024 px (`@media (max-width: 1023px)` in `app/globals.css`) the root
  layout hides the whole web app — auth included — behind `MobileAppHandoff`, an existing product
  decision. A narrow auth layout would never render, so it would be dead code (AGENTS.md §6).
  The floor is therefore **1024 px, the narrowest width at which the web app renders**: from 1024
  up there is no horizontal overflow, the split holds, the card and every control are fully
  visible and reachable by keyboard, and the pose may shrink but not overlap text. No layout exists
  below it.
- **`AuthStory`** — left-slot content: eyebrow, display heading, body, quote with its attribution
  line, and a `pose` (§5.4).
- **`AuthCard`** — right-slot card: eyebrow, heading, subtitle, children.
- **Forms** — the current `AuthForm` (`mode="login" | "register"`) is split into one form per flow
  (login, register, forgot, reset, verify), each composing the existing `Input`/`Button` primitives.
  A password field gets a show/hide toggle: a real `<button type="button">` with an accessible name
  that reflects state.
- `app/[locale]/(auth)/layout.tsx` keeps only what is shared by every auth route:
  `data-density="reference"` and the page background. The logo moves into `AuthStory`, where the
  frames draw it.

### 5.2 `OtpInput` — interaction contract

Figma fixes the form (six separate boxes, ≈50×50, above "Verify email"). This section fixes the
behaviour, which Figma does not show.

- One logical value of six ASCII digits, submitted as a single `token` field.
- Each box accepts one digit; any non-digit input is discarded.
- Typing a digit moves focus to the next box.
- Backspace in an empty box moves focus to the previous box and clears it.
- **Any multi-character insertion into a box is distributed** — a paste event, and equally a
  platform `one-time-code` autofill that delivers the whole string through `input`/`change` without
  any paste event. Non-digits are stripped, digits fill from that box onward, truncated at six.
- After a distribution or a typed digit, focus moves to the next empty box; when the sixth box is
  filled, focus moves to the "Verify email" button. Focus never moves to a box that does not exist.
- `inputMode="numeric"`; the **first** box carries `autocomplete="one-time-code"` so platform
  autofill delivers the whole code.
- The group has one accessible label ("Verification code"); each box has a positional name
  ("Digit 1 of 6"). The submit button stays enabled; an incomplete code is a validation error, not a
  disabled control.

### 5.3 Verify-email page

- Email pill above the code (Figma), "Verify email" submit.
- **Resend cooldown 60 s** — real, because the client knows when a code was just sent. The text is
  "Resend code in Ns", then an enabled "Resend code"; every successful resend restarts it.
- Arriving from `register`, `signUp` has just sent a code, so the cooldown starts on page load.
- Arriving from `login` (unconfirmed email), nothing was sent now, so `login` redirects with
  `?resend=1` and the page starts with "Resend code" enabled and no cooldown. Nothing is sent until
  the user presses it; the 60 s cooldown starts only after a resend **succeeds**.
- "Wrong email? Change email" links to `/register`.

### 5.4 Mascot poses — one mapping, one home

`components/mascot/mascot-poses.ts` is the **only** place a semantic screen state maps to an asset
file, and `components/mascot/mascot-pose.tsx` renders it. The home is neutral on purpose: auth and
error surfaces both import it, so neither depends on the other. Pages pass the semantic name; they
never name a file and never set an offset.

| Screen | Pose file (`public/mascot/poses/`) |
| --- | --- |
| login | `bye.png` |
| register | `excited.png` |
| forgot-password | `thinking.png` |
| verify-email | `quill-writing.png` |
| reset-password | `proud.png` |
| 404 | `curious-question-mark.png` |
| route error | `worry.png` |

Owner ruling 2026-09-22: the three extractor-cut poses (`greeting`, `noting`, `looking-ahead`) show
background-removal artefacts, so every auth screen now uses a hand-cut `supplied` pose.

`MascotPose` owns sizing and placement of the image. A test proves every mapped file exists **and**
is recorded in `scripts/mascot/poses.json` (whose own test already pins manifest ↔ disk). The pose
images are decorative: empty `alt`. The existing marketing pose constants are out of scope.

## 6. Error surfaces — not auth, no shared shell

404 and route error do not use `AuthSplitShell`. They may share `MascotPose` and background
primitives; they share no shell.

### 6.1 404

- `app/[locale]/not-found.tsx` renders the standalone surface, with `data-density="reference"` on
  its own root (it renders under `[locale]/layout.tsx`, not under the auth layout).
- `app/[locale]/[...rest]/page.tsx` calls `notFound()` — the next-intl pattern for localized paths
  that match no route. It does **not** try to pass `params.rest` through `notFound()`.
- "You were looking for `/…`" is a **client leaf** that reads the path with the pathname hook. It is
  rendered as text.
- Composition: logo, "Back" top-right, centred eyebrow ("404 · Wrong turn"), heading, body,
  "Go Home" (primary) and "Go Back" (text), the path line, the pose beside it.
- "Go Back" uses `history.back()` when there is history, else links home.

### 6.2 Route error — adapter and panel

- `app/[locale]/(protected)/(app)/error.tsx` is a **client boundary adapter** (`"use client"`). It
  receives `error` and `reset` and renders `RouteErrorPanel`, passing callbacks. It holds no layout.
- `RouteErrorPanel` (`components/errors/`) takes `onRetry`, `onBack` and a dashboard href, and a
  `mode: "in-shell" | "standalone"`. It contains no framework boundary logic.
- Content: eyebrow ("Route error"), "Something interrupted this page.", body, a scene with the pose,
  "Try again" (primary, `reset()`), "Go to Dashboard", "Go Back", and the "Your progress is still
  saved" reassurance block.
- **Never render `error.message`, `error.digest` or a stack.** Log to the console in development
  only.
- The path line under the panel ("We had trouble opening /…") uses the same client pathname leaf as
  §6.1.

### 6.3 The live shell stays authoritative

`(app)/error.tsx` renders inside `AppChromeLayout`'s `<main>`, so `AppNav` and the density of the
shell are untouched. The route-error surface:

- **does not** set `data-density` on anything;
- **does not** recreate, import or restyle the sidebar or top bar;
- is verified by measurement inside the live shell at 1280 (§8.2).

The Figma frame's 224 px sidebar is not a target. Wrapping the panel in `data-density="reference"`
would undo `desktop-density-scale` for that screen and is a defect.

### 6.4 Fallback boundaries

- `app/[locale]/error.tsx` — client adapter rendering `RouteErrorPanel mode="standalone"`. It
  catches errors in **descendant segments** below the locale layout (marketing, auth, `(focus)`,
  `(immersive)`, and `(protected)`'s own layout). It does **not** catch an error thrown by
  `app/[locale]/layout.tsx` itself.
- `app/global-error.tsx` — the last resort. It supplies its own `<html>` and `<body>` (the root
  layout may be what failed), depends on no i18n, provider or app component, and shows one fixed
  bilingual line and a reload button with inline-safe styling.

## 7. Copy

Every new string lives in `messages/{vi,en}/auth.json` or a new `errors` namespace, both locales in
the same commit. The English copy follows the frames; the Vietnamese copy is written, not
machine-translated. The frames' error-language rule applies: never blaming, never alarming.

## 8. Verification

### 8.1 Test matrix

| Layer | Tool | What it proves |
| --- | --- | --- |
| Component | Vitest + RTL | `OtpInput` every rule in §5.2 (digit filter, advance, backspace, paste full/partial/with non-digits, a six-digit `input` event with **no** paste event distributed the same way, focus on the Verify button after the sixth digit, the two accessible names). Resend cooldown with fake timers, including `?resend=1`. `mascot-poses` ↔ `poses.json`. `RouteErrorPanel` fires its callbacks and never renders the error message (mutation-check: render it, see red). The path leaf. A guard that no auth screen renders an Apple or GitHub control. |
| Route / integration | Vitest, Supabase mocked as in `actions.test.ts` | Each action: validation errors, success redirect, error mapping. `register` in **both** response shapes (§4.1). `requestPasswordReset` returns the identical state for success and for a Supabase error. `login` maps *email not confirmed* to the verify redirect and nothing else. `updatePassword` with no session. `route-protection`: `/forgot-password` and `/verify-email` are auth routes, `/reset-password` is not. `/verify-email` with a missing or invalid `email`. |
| E2E / visual, 1280 | Playwright, local Supabase | Login, register, forgot-password round trips. `/verify-email?email=…` renders, accepts typed and pasted digits, shows the error for a wrong code, shows the cooldown. 404 at `/en/<unmatched>` shows the path. A thrown route error renders **inside** the shell: the sidebar's measured width is identical before and after the error. No Apple/GitHub control in the DOM. At 1024 px, each auth route has no horizontal overflow (`scrollWidth <= clientWidth`), keeps the split, and its submit button is visible (§5.1, corrected). The five existing auth-dependent specs stay green. |

Guard tests written over code that already exists are mutation-checked (AGENTS.md §7). Any
assertion over a pattern-gathered collection also asserts its size.

### 8.2 Measurement

Claude measures at the whole-branch review, in a browser, at viewport 1280, from a server built in
the worktree (never the main checkout): each auth screen's columns against the centred pair of §5.1 (equal side margins, 384 px card) and no vertical scroll at 1280x529 for login, and the
route-error case against the live shell's own widths on master.

### 8.3 Pre-merge code round trip (by hand, once)

In the review environment only, without committing the change: set `enable_confirmations = true`,
restart local Supabase, register a new user, read the code from Mailpit, verify it, and confirm the
final redirect lands on `/<locale>/dashboard` signed in. This round trip is also what confirms
`verifyOtp`'s `type: "email"` against the real server (the installed `auth-js` 2.110.2 types accept
both `"email"` and `"signup"`; the mock cannot tell them apart). Also run the reset round trip: request,
open the Mailpit link, set a new password, sign in with it. Record both outcomes in the review. The
repo's default config is not changed for this.

## 9. Tasks

Each task is one commit, and **every commit leaves the app correct on its own**: no redirect,
link or form field lands before the route, action or schema it depends on. Each task adds its own
catalog keys in both locales.

1. `components/mascot/`: `mascot-poses` + `MascotPose`.
2. `AuthSplitShell`, `AuthStory`, `AuthCard`; move Login and Register onto them, Google only. This
   task **also** lands confirm-password end to end (field, `registerSchema` refinement, `register`
   reading it, tests) and the show/hide toggle. It does **not** add the "Forgot password?" link.
3. `OtpInput` (UI only; nothing routes to it yet).
4. **OTP vertical slice**, one commit: template + config, the `/verify-email` page, `verifyEmail`,
   `resendCode`, their schemas, `/verify-email` in `AUTH_ROUTES`, and only then the redirects into
   it — `register` in both modes (§4.1) and `login`'s unconfirmed redirect.
5. **Password reset slice**, one commit: `requestPasswordReset`, `updatePassword`, their schemas,
   the `/forgot-password` and `/reset-password` pages, `/forgot-password` in `AUTH_ROUTES`, and the
   "Forgot password?" link on Login.
6. 404: `not-found`, catch-all, path leaf.
7. Errors: `RouteErrorPanel`, `(app)/error.tsx`, `[locale]/error.tsx`, `global-error.tsx`.

Then: whole-branch review by Claude (§8.2, §8.3), owner review in their own Chrome, merge.

## 10. Out of scope

Apple and GitHub sign-in · Terms, Privacy and help pages · a live OTP expiry display · changing the
local confirmation default · `toast` density scoping · the design-system error sheet `218:15740` /
`335:1588` beyond the two real screens · migrating the marketing mascot constants to the new map ·
any layout below 1024 px, where `MobileAppHandoff` replaces the web app (§5.1).
