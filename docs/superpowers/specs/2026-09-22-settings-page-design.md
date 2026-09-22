# Settings page — design (2026-09-22)

> Branch `settings-page`. Owner of this document: Claude. Implementation: Codex, one task per
> dispatch, Claude reviews and commits.
>
> Ports Figma frame **Global settings `220:16032`** (file `IwFHZDZdHW7qsSFiNbWrkd`, 1167 × 3758)
> onto `/settings`, replacing the `UpcomingScreen` placeholder. First of two Settings branches:
> the five reminder toggles and the reminder time ship in `study-reminders` (§10).

## 1. Rulings that bind this spec (owner, 2026-09-22)

1. **Figma is the frame.** Every control the frame shows must do something real; where the repo
   lacks the backend, this branch builds it. Only a contradiction with the repo goes to the owner.
2. **Chrome:** keep the live `(app)` shell with the sidebar. The frame's own top bar (`← Back ·
   Korume · Settings`, "Your learning space") is **not** ported.
3. **Theme (Dark / System / Light) and Accent Color are deferred** to a later theming branch,
   together, because both change the colour token layer. Neither row renders in this branch.
4. **Microphone / Camera toggles are Korume's own switches**, stored on the account. On: Korume
   may open the device (and the browser asks for permission when it does). Off: Korume never
   opens it, even if the browser would allow it. The browser's grant is not revoked — the web
   platform cannot do that.
5. **Camera toggle ships** although no feature uses the camera yet: every future camera feature
   must go through the same gate (§4.4).
6. **One settings page.** `/settings/privacy` redirects to `/settings#privacy`;
   `/settings/privacy/memory` keeps its confirmation flow and is reached from **Erase Memory**.
7. **About links:** Discord, Facebook and TikTok open the platforms' home pages
   (`https://discord.com`, `https://www.facebook.com`, `https://www.tiktok.com`) in a new tab.
   Privacy Policy, Terms of Service, Send Feedback and Contact Support link to Korume's `/` until
   those pages exist.
8. **Reminders are in-app only** (the notification bell). No email, no web push. That is the
   `study-reminders` branch, not this one.

## 2. The frame, section by section

Widths are the reference at 1280; the content column is centred, `max-w-5xl`, inside the app
shell's main area. The page scrolls — it is a long settings page by design.

| Section | Rows in the frame | This branch |
| --- | --- | --- |
| Header | eyebrow "Personal space", title "Settings", subtitle, small mascot thumbnail | Port. Mascot is a hand-cut `supplied` pose (§6). |
| Learning | Interface Language · Daily Learning Goal · Study Reminder Time · Learning Schedule · Review Frequency · Difficulty Preference | All except Study Reminder Time (→ `study-reminders`). |
| Learning Reminders | Daily · Review · Streak · Weekly Reflection · Sensei Generation Finished | → `study-reminders`. Section absent here. |
| Appearance | Theme · Accent Color · Display Scale · Reduced Motion | Display Scale, Reduced Motion. Theme + Accent deferred (§1.3). |
| Privacy & Data | Microphone · Camera · AI Training · Export Data · Download Learning History | All five. |
| Danger zone | Delete Korume Memory · Delete Account | Both, wired to the existing flows. |
| About | Version · Discord · Facebook · TikTok · Privacy Policy · Terms of Service · Send Feedback | All (§1.7). |
| Support card | "Need a hand?" · Talk with Korume · Contact Support | Talk with Korume → `/sensei`; Contact Support → `/` (§1.7). |
| Footer | "Korume · Version 1.0 · Built quietly in Vietnam…" | Port; the version comes from `package.json`. |

## 3. Storage — `user_preferences`

New table, one row per user, created lazily on first write (reads fall back to defaults).

| Column | Type | Default | Row |
| --- | --- | --- | --- |
| `user_id` | uuid PK → `users(id)` on delete cascade | — | — |
| `learning_schedule` | text check in (`every_day`,`weekdays`,`custom`) | `every_day` | Learning Schedule |
| `schedule_days` | smallint[] (ISO weekday 1–7) | `{1,2,3,4,5,6,7}` | Custom days |
| `review_frequency` | text check in (`normal`,`more`,`relaxed`) | `normal` | Review Frequency |
| `difficulty` | text check in (`adaptive`,`easy`,`challenge`) | `adaptive` | Difficulty Preference |
| `display_scale` | text check in (`normal`,`large`,`extra_large`) | `normal` | Display Scale |
| `reduce_motion` | boolean | `false` | Reduced Motion |
| `microphone_enabled` | boolean | `true` | Microphone |
| `camera_enabled` | boolean | `false` | Camera |
| `updated_at` | timestamptz | `now()` | — |

RLS: a user selects, inserts and updates only their own row; no delete policy (the row goes with
the account through the `users` cascade, which is how account deletion removes every user-owned
table). The GDPR export (§4.6) includes this table. `daily_minutes` stays on `users` where it already lives; Interface Language stays the locale
route segment and is not stored here.

**API:** `GET` and `PATCH /api/user/preferences`. `PATCH` takes a partial object validated by a
zod schema in `lib/validation`, upserts, and returns the full row. Unknown keys are rejected.
The same `PATCH` also accepts `daily_minutes` (one of 5, 10, 15, 20, 30, 45, 60) and writes it to
`users`; `GET` returns it alongside the preferences. There is no separate profile endpoint.

## 4. Every row has a consumer

### 4.1 Interface Language
A select of the supported locales. Changing it navigates to the same path under the new locale
(`/vi/settings` ↔ `/en/settings`) through the existing next-intl navigation helpers.

### 4.2 Daily Learning Goal
Writes `users.daily_minutes`. Consumer: the Shadowing hub rail's "Today's goal", which today always
renders `noGoal`, shows the chosen goal. **Open question for the owner (§9):** the repo records no
study time, so "minutes done today" cannot be shown yet.

### 4.3 Learning Schedule
Every Day / Weekdays / Custom; Custom reveals seven day chips. Consumer: `advanceStreak`
(`lib/gamification/streak.ts`) — a gap made only of unscheduled days does not break the streak.
Every read that decays a streak takes the same schedule. `study-reminders` is its second consumer.

### 4.4 Review Frequency, Difficulty, Microphone, Camera
- **Review Frequency** multiplies the interval `reviewItem` (`lib/srs/sm2.ts`) returns on a passed
  review: `more` × 0.7, `normal` × 1, `relaxed` × 1.4, rounded to whole days, minimum 1. Failed
  reviews are unaffected. The multiplier is a parameter of `reviewItem`; `lib/data/srs.ts` and
  `lib/data/mining.ts` read it from preferences.
- **Difficulty** moves the i+1 ideal band in `lib/difficulty/score.ts`: `adaptive` keeps
  [0.80, 0.95]; `easy` uses [0.88, 0.98]; `challenge` uses [0.70, 0.90]. `scoreComprehension`
  takes the band as a parameter; `lib/data/recommendations.ts` and `lib/data/difficulty.ts` pass
  the user's.
- **Microphone** gates `components/video-player/recorder.tsx` (and any other `getUserMedia`
  audio caller): off → the recorder shows a short message linking to `/settings#privacy` and never
  calls `getUserMedia`.
- **Camera** is read through the same helper (`lib/media/device-gate.ts`, one function per
  device) so a future camera feature has one place to ask.

### 4.5 Display Scale and Reduced Motion
- **Display Scale** multiplies `--density-unit` by 1, 1.125 or 1.25. It is rendered server-side
  as `data-display-scale` on the `(protected)` layout's wrapper so there is no flash. Because a
  derived token resolves where it is declared, the scope re-declares the derived token layer the
  way `[data-density]` already does (see `app/globals.css`), and `lib/design-tokens.test.ts`
  asserts the lists stay equal. Only a browser measurement proves this works (§8).
- **Reduced Motion** moves from `localStorage` to the account. The server renders
  `data-reduce-motion` from preferences; the theme provider keeps writing the attribute live and
  now also `PATCH`es. The `localStorage` key remains the logged-out fallback.

### 4.6 Export Data and Download Learning History
- **Export Data** → `GET /api/user/export`: a JSON download of every row the user owns, read under
  the RLS client, one key per table. Rate limited. Account deletion relies on the `users` cascade
  and keeps no table list, so the export carries its own explicit `USER_EXPORT_TABLES`; a guard
  test reads the migrations and fails when a table with a user-referencing foreign key is neither
  in that list nor in a named exclusion (with its reason).
- **Download Learning History** → `GET /api/user/history.csv`: lessons studied, SRS reviews and
  earned badges, one CSV (via `lib/csv`), newest first.

### 4.7 AI Training, Danger zone
Existing behaviour moved onto this page unchanged: the model-training consent toggle, the pending
deletion notice and the Delete Account flow from `components/settings/privacy-screen.tsx`, and
Erase Memory linking to `/settings/privacy/memory`.

## 5. Components

`components/settings/`: `SettingsSection` (title, subtitle, rows), `SettingsRow` (icon, label,
description, control slot). Controls: the existing `components/ui/select.tsx`, plus two new
primitives in `components/ui` — `Switch` (`role="switch"`, `aria-checked`) and `SegmentedControl`
(a radio group, arrow keys move the selection) — tokens only, covered by the existing
`token-scale-adoption` guard. Saving is per control, optimistic, with a
toast and rollback on failure. Every control has an accessible name equal to its visible label.

## 6. Copy and assets

Every string in `messages/en/settings.json` and `messages/vi/settings.json` in the same commit.
Mascot images use hand-cut `supplied` poses only (owner ruling from the auth review: extractor-cut
poses look broken).

## 7. Registry

`global-settings` becomes `impl: "built"`. `/settings/privacy` stays registered as a redirect.

## 8. Verification

- Unit: preferences schema and route (401, 400 on unknown key, upsert), `reviewItem` multiplier,
  `scoreComprehension` bands, `advanceStreak` with schedules, device gate, export and CSV.
- RLS: a second user cannot read or write another user's preferences row.
- e2e: change each control, reload, value persists; `/settings/privacy` redirects.
- Browser measurement at 1280 × 800 **and** 1280 × 529 (the owner's viewport): display scale
  changes the rendered size of a `--space-*` padding by the ratio; no horizontal overflow.

## 9. Open question for the owner

**Daily goal progress.** The repo does not record study time, so the rail can show the goal but
not progress towards it. Measuring minutes studied is a new tracking feature (session timing
across shadowing, dictation, reading, review). Proposed: out of this branch; ask whether it
belongs to `study-reminders` or its own branch.

## 10. Out of scope

Reminder rows, reminder time and every reminder delivery (`study-reminders`); Theme and Accent
Color (theming branch); real Privacy Policy, Terms, Feedback and Support pages; Register and the
forgot-password heading from `auth-error-ux` (owner deferred).
