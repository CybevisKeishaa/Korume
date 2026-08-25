# Figma frame map — name → node id

> ✅ **Second capture batch DONE 2026-08-23.** The 12 frames the 2026-08-20 note listed as absent are
> now captured (screenshotted + visually reviewed), plus `218:15740 Error state` (already known, now
> also reviewed). **See § Second capture batch (2026-08-23) below — read it before touching billing,
> auth, or error-state UI.** One genuinely new node appeared since 2026-08-20: `346:6275`, also named
> "Homepage", but it is a **hidden `rounded-rectangle`** (not a frame, `hidden="true"`, renders blank)
> — decorative canvas noise, not a screen. Ignore it.
>
> Method used: the user selected the 15 target nodes in the Figma desktop Layers panel; `get_metadata`
> with no `nodeId` read the prepended "Currently selected nodes" block to confirm ids, then each was
> screenshotted individually. Page-wide count as of 2026-08-23: **70 top-level nodes** (69 real frames
> + the 1 hidden rectangle). **Never quote a count from this file — enumerate** (`L-002`).
>
> ✅ **Registered 2026-08-23** (Screen Registry Phase 3 Stage 1): of the 14 node ids in the batch
> section below — the 12 frames the 2026-08-20 note listed as absent, plus **two** that have been in
> this map since 2026-08-11 but had never been screenshotted, `218:15740` and `65:2` — **8 rows were added or
> converted by this batch** — `register`/`332:3` (converted from `repo-only`), plus 5 new `screen`
> rows (`reset-password`/`333:210`, `email-otp`/`335:306`, `error404`/`335:1976`,
> `error-boundary`/`337:2055`, `membership`/`340:3795`) and 2 new `state-variant` rows
> (`unsubscribe-membership`/`340:4586`, `choose-method`/`340:5402`), all stamped
> `figmaCheckedAt: "2026-08-23"`. **3 more were already registered before this batch and are
> untouched by it**: `login`/`65:2` (stamp `2026-08-12`), `data-privacy`/`337:3323` and
> `delete-data`/`339:3612` (both stamped `2026-08-20`) — 8 + 3 = **11 of the 14 registered**. **2 are
> excluded**, both style-guide catalogue sheets named in the registry header: `218:15740` and
> `335:1588` (a font/typography QA pass over the same sheet as `218:15740`, not a distinct screen).
> **1 remains deliberately unregistered**: `347:6277` (the new marketing homepage) — an identity
> ruling against the existing `landing-page` row is still owed, see that row's comment and
> `docs/superpowers/specs/2026-08-23-screen-registry-phase-3-design.md` §9.1. **This is the one
> genuinely open question in this batch.** The GitHub sign-in button on `332:3`/`65:2` is **not** one:
> `decision-register.md` **P14** ("Auth = email + Google + Apple. GitHub: no") already rules it, and
> the user confirmed on 2026-08-25 that P14 still stands. The frame's content loses to P14 at port
> time — register the frame, do not build the button.
>
> ⚠️ **Residual debt this batch did NOT close:** `login`/`65:2`'s row still carries
> `figmaCheckedAt: "2026-08-12"`, but this file records `65:2` as screenshotted for the first time
> on 2026-08-23 — so that stamp still overstates what was actually compared. Left alone
> deliberately: a stamp means a human compared frame against registry on that date, and nobody
> re-compared `login` in Stage 1. Fixing the number by touching the stamp would be exactly the
> dishonesty the `G2` test exists to catch.

**File:** `IwFHZDZdHW7qsSFiNbWrkd` ("Korume"), single page `0:1`.
**Captured:** 2026-08-11, by selecting frames in the Figma desktop app and reading the
`Currently selected nodes` block that `get_metadata` prepends to its response.

**Why this file exists:** `get_metadata` on the page itself returns ~4.4M characters, so every Figma
call has to target a specific frame — and nothing in the repo held a complete name→id map. Scattered
ids lived in three specs; this replaces that. Node ids are stable in Figma unless a frame is
recreated, so this map decays slowly, but it is a snapshot: re-capture if frames are rebuilt.

⚠️ **`get_metadata` prints at most 16 selected nodes**, then `[... N more]`. A full capture therefore
takes several selections of ≤15. **One Ctrl+A selected 57 frames.**

## ✅ Captured — all 57 of 57

| Node id | Frame name |
|---|---|
| `28:2041` | Kanji inspect |
| `29:2890` | **Kanji explorer** — the discovery surface (renamed 2026-08-12) |
| `36:4117` | Pronunciation detail |
| `37:4955` | Pronunciation library |
| `44:7289` | Conversation practice |
| `46:2` | Popup create conversation |
| `64:2061` | Roadmap |
| `65:2` | Login |
| `66:166` | Profile |
| `67:595` | Edit profile |
| `74:564` | Pricing |
| `75:1424` | FAQ |
| `90:1985` | Shadowing Hub ⚠️ **superseded — dead frame, build against `149:2`. Still on the page as of 2026-08-12; the delete-plus-rename pair was not carried out** |
| `105:3088` | Shadowing Practice |
| `111:515` | Homepage |
| `111:1556` | QuickStart |
| `111:1877` | Generate sensei |
| `111:1963` | Generate done |
| `120:2027` | Pronunciation (in shadowing) |
| `123:2835` | Dictation (in shadowing) |
| `125:1030` | Summary (in shadowing) |
| `149:2` | **Shadowing hub after changes** — the live hub; the calibration frame the shell tokens were measured from (`app/globals.css:136`) |
| `156:1310` | Companion home |
| `170:9364` | Conversation practice library |
| `180:2` | Roadmap detail |
| `180:1129` | Quick preview panel: Conversation practice — see note below |
| `180:1770` | Learning memory |
| `181:3525` | Gentle suggestion drawer |
| `182:3859` | Today's reflection (panel, fade around) |
| `184:3974` | Conversation memory |
| `187:6556` | Growth Areas |
| `190:7376` | Companion Diary |
| `200:7705` | Explore Lessons |
| `200:10726` | Explore Lessons (with preview) |
| `203:13813` | Footer |
| `209:14032` | Checkout |
| `210:14338` | Loading state |
| `212:14610` | Search lesson |
| `212:14753` | Search lesson (searched) |
| `215:15164` | Companion Knowledge Assistant |
| `216:15648` | Empty state (Companion home) |
| `218:15740` | Error state |
| `220:16032` | Global settings |
| `220:16766` | Welcome Companion page |
| `232:2` | JLPT Practice |
| `234:618` | JLPT Phase test |
| `234:1639` | To phase 2 (ready) — the `Begin Listening` gate |
| `234:1667` | To phase 2 (countdown) — the auto-advancing 3→2→1 |
| `237:1690` | JLPT practice (phase 1) |
| `237:6708` | Finish phase 1 |
| `240:12992` | JLPT practice (phase 2) |
| `242:14234` | Practice result |
| `243:14899` | Review mistake (after JLPT practice) |
| `243:15364` | Review mistake (more detail) |
| `280:3` | **Kanji library** — the curriculum surface (renamed 2026-08-12) |
| `280:1314` | Kanji lesson practice (flashcard) |
| `284:1464` | Grammar analysis |

### ⚠️ Two real duplicate pairs, confirmed by node id

These were suspected from the frame-name list and are now **proven to be distinct frames**, not
typing slips:

1. ✅ **`234:1639` and `234:1667` — RESOLVED 2026-08-12. Two sequential steps, not a duplicate.**
   The user confirmed the pair is *"màn hình chuyển của phần JLPT practice"* (the JLPT practice
   transition), and screenshots separate them cleanly — both 1536×682:

   | | `234:1639` **the gate** | `234:1667` **the countdown** |
   |---|---|---|
   | Eyebrow | `PHASE 2` | `CERTIFICATION PRACTICE` |
   | Headline | **Listening Section** | **Please prepare your headphones.** |
   | Body | "The listening section will begin automatically. Please prepare your headphones. Drink some water if needed." | "The listening audio will begin automatically." |
   | Figure | framed illustration | large orange numeral (captured at **1**) |
   | Action | **`Begin Listening` button** — waits for a click | none — auto-advances |

   Flow: `Finish phase 1` (`237:6708`) → gate → countdown → `JLPT practice (phase 2)` (`240:12992`).
   Both are `state-variant`s of the JLPT practice flow; the countdown frame is one tick of an
   animated 3→2→1, so it is a single frame standing for a sequence.
2. **`29:2890` vs `280:3` — NOT a duplicate. Two different screens.** Checked visually 2026-08-11,
   and the "newer iteration supersedes older" guess was **wrong**:

   | | `29:2890` **Kanji Explorer** (1278px) | `280:3` **Kanji Library** (1536px) |
   |---|---|---|
   | Framing | *"Learn kanji through real-world contexts instead of memorizing isolated characters"* | *"Choose your study material"* |
   | Spine | Featured collection → Curated Paths (SushiMaster, Tokyo Café, Shinkansen Journey, Konbini Life) → Browse by JLPT → **Browse by radical** → Recently viewed | Choose JLPT level → Current path (N3, Continue Learning) → **Choose study material** (Core Kanji / Kanji in Context / Reading Kanji / My Weak Kanji, incl. book sources like Mimikara) → ordered numbered lesson list with Complete/Review status |
   | Right rail | Learning dashboard 74%, heatmap, recommended, quick actions | Learner progress, streak, kanji you're revisiting |
   | Mode | **Discovery / exploratory** | **Structured curriculum** |

   So the question is not "which is newer" but **"does Korume want both a discovery surface and a
   curriculum surface for kanji, or did the curriculum design replace the exploratory one?"**
   That is a product ruling, not an inventory call. **Escalate to the user.**

   Capability side-findings from `29:2890` that no repo route covers: **browse kanji by radical**, and
   **curated thematic collections**. Both are real capabilities, not decoration.

   ⚠️ **Refined 2026-08-12 by the full cluster analysis — read
   `docs/product/screen-inventory.md` §6, which supersedes this box.** Two corrections: the two
   capabilities cost very different amounts (radicals already have a table, an FK and an index;
   curated collections have no schema at all, because `collections` is a *lesson* concept), and the
   framing above is itself too narrow — **`/kanji` implements neither frame**, so the question is not
   which one wins but whether Korume ships both surfaces.

**Method note worth keeping:** name-matching said "duplicate", canvas width said "newer iteration",
and the screenshot said "two different products". Only the picture was right.

### ✅ `Panel` is not a frame — resolved by capture, no ruling needed

The frame-name list read `Panel` and `Quick preview: Conversation practice` as two separate entries,
and `Panel` was logged as an open question ("which screen is it a state of?"). There is **one frame**:
`180:1129`, named **`Panel Quick preview: Conversation practice`**. The list had simply split one name
across two lines. It is a quick-preview panel of Conversation practice — a `state-variant`, parent
confirmed by the name itself.

## Dead / stale ids from earlier sessions

| Node id | Frame name | Note |
|---|---|---|
| `5:1718` | Unuse | dead frame — **and no longer on the page**, see the arithmetic below |
| `71:2` | Pricing-remove | dead frame — same |
| `243:14906` | *(unidentified)* | recorded in a spec, never matched to a name |

`105:3088` and `200:10726` were both unidentified spec ids; this capture resolved them as
`Shadowing Practice` and `Explore Lessons (with preview)`.

## Rename pass — DONE and VERIFIED 2026-08-12

The user applied the rename list, and the result was **read back from Figma**, not assumed: the user
selected the frames and `get_metadata` was called with **no `nodeId`**, whose response prepends a
`Currently selected nodes` block. The name column above now carries those verified strings.

| Node id | Was | Now | |
|---|---|---|---|
| `44:7289` | Conversation **pratice** | Conversation practice | ✅ |
| `184:3974` | Conversation **memorry** | Conversation memory | ✅ |
| `280:1314` | Kanji lesson practice**( flashcard)** | Kanji lesson practice (flashcard) | ✅ |
| `234:1639` | To phase 2 | To phase 2 (ready) | ✅ |
| `234:1667` | To phase 2 | To phase 2 (countdown) | ✅ |
| `29:2890` | Kanji library | Kanji explorer | ✅ |
| `280:3` | Kanji library (choose lesson, choose book mimikara,...) | Kanji library | ✅ |
| `156:1310` | Companion home **after change** | Companion home | ✅ |
| `180:1129` | Panel Quick preview: Conversation practice | Quick preview panel: Conversation practice | ✅ |
| `220:16032` | Global setting | Global settings | ✅ |
| `149:2` | Shadowing hub **after changes** | — | ❌ **not renamed** |

Both duplicate-name collisions are gone: `Kanji explorer` / `Kanji library` are now distinct, and so
are the two `To phase 2` frames.

### ⚠️ Two things the read-back caught that the user did not intend

**1. `149:2` was not renamed, and `90:1985` was not deleted.** The selection contained `90:1985`
(still named `Shadowing Hub`) in `149:2`'s place — 11 frames, but one substitution. So the pair that
had to move together did not move at all: the live hub is still called `Shadowing hub after changes`,
and the dead frame it supersedes is still on the page. **The page therefore still holds 57 frames.**
Nothing downstream is blocked — node ids are what the analysis keys on — but this is the one rename
that also retires a dead frame, so it is worth finishing.

**2. Five of the new names carry invisible leading or trailing whitespace**, exactly as Figma
returned them: `To phase 2 (ready)·`, `·Global settings`, `·Kanji library`,
`·Quick preview panel: Conversation practice`, `Shadowing Hub·` (`·` marks the space).

**Do not send the user back into Figma to hunt invisible spaces.** The correct fix is downstream:
**`screenId` derivation MUST trim before it slugifies**, or `·Kanji library` yields a leading-dash id.
This is a note for Phase 1's `R3` — the derivation is the right place to be tolerant, because a
whitespace-only difference is not a naming decision. The name column above is recorded **trimmed**.

### Not requested, mentioned once: casing is still mixed

Roughly half the names are Title Case (`Shadowing Practice`, `Explore Lessons`), half sentence case
(`Kanji explorer`, `Pronunciation detail`). This does **not** break `screenId` — derivation
kebab-cases anyway — so it stays optional.

## The arithmetic closes, and it tells us something

52 + the final 5 = **57**, exactly what Ctrl+A selected. Every frame on the page is accounted for by
the user's own list, once `Panel`/`Quick preview` collapses into one frame and the two duplicate pairs
are counted twice.

**Consequence: `Unuse` and `Pricing-remove` are no longer on the page** — the user's Figma cleanup
already removed them. An earlier note in this file predicted they would surface in a later batch;
that prediction was wrong and the count disproves it. Of the three frames flagged as safe to delete,
only `90:1985 Shadowing Hub` is still present.

## How to capture the rest

In Figma's **Layers panel**, click a frame, then `Shift`+click the fifteenth below it — that selects a
contiguous run of 15. Say the word, and `get_metadata` is called with **no `nodeId`** (which stays
cheap — it only lists pages) to read the prepended selection block. Repeat until every frame has an id.

## Second capture batch (2026-08-23)

All screenshotted at `maxDimension: 900` and visually reviewed. Node ids, sizes, and a content summary
per frame. These sit in a new canvas region (x ≈ -11126..3789, y ≈ 8318..9581), well away from the
original 57-frame cluster — the user has clearly been designing a new batch, not editing old frames.

### Auth flow — coherent, four-step, matches nothing built yet
| Node id | Frame | Size | Summary |
|---|---|---|---|
| `332:3` | Register | 1280×905 | "Welcome to Korume" — OAuth (Google/Apple/GitHub) + email/password form, name/email/password/confirm, ToS+Privacy checkbox. |
| `65:2` | Login | 1278×821 | "Welcome Back" — same OAuth row + email/password, "Forgot password?", "Create one" link. (Already in the original 57; now screenshotted for the first time.) |
| `333:210` | Reset password | 1280×537 | "Forgot your password?" — single email field, "Send reset link". |
| `335:306` | Email OTP | 1280×566 | "Check your inbox" — 6-digit code entry, expiry countdown, resend-code link. |

All four share the same split layout (left: brand copy + Eevee-line mascot art + quote; right: dark
card form) — one consistent design language, ready to port as a set.

### Payment / billing (Layer 8 territory) — the frame's provider list is overruled by P13, see below
| Node id | Frame | Size | Summary |
|---|---|---|---|
| `340:3795` | Membership | 1280×1176 | Full `/settings/membership` page: active plan card ("Travel Together for a Year", 490.000đ/year, started/renews dates, Change/Cancel), "What's included" (8 items: AI Sensei, Unlimited Lesson Creation, Learning Memory, Personalized Roadmap, Intelligent Review Planning, Native Pronunciation Analysis, AI Conversation Partner, Weakness Coaching), payment-method row, transaction history, contact/help block. |
| `340:4586` | Unsubcribe membership | 1280×1176 | Same page with a "Leave Korume for now?" cancellation dialog open — states the plan stays active until the paid-through date, "Cancellation stops renewal. It does not remove your access today." |
| `340:5402` | Choose method | 1280×1176 | Same page with a **"Choose how you'd like to pay"** dialog open, listing three providers: **PayOS** ("Simple QR / payment gateway", pre-selected), **SePay** ("Bank payment"), **MoMo** ("Mobile payment"). |

⚠️ **`340:5402` shows three payment providers where `CLAUDE.md` §3 says one** ("Payments: PayOS
subscriptions, no trial"). It was escalated per `CLAUDE.md` §2, and **it is settled — it was already
settled before the frame existed.** `decision-register.md` **P13** reads *"Payment is PayOS. No
Stripe, no Visa, no Apple Pay."* The user re-affirmed it when this frame surfaced (2026-08-23) and
again on **2026-08-25**:

- **PayOS-only stands. `CLAUDE.md` §3 is unchanged.**
- **SePay and MoMo are design exploration and are not to be built** — deferred for
  merchant-registration reasons (the cost is registering as a merchant with each, not writing an
  adapter). Recorded as a note against P13 in `decision-register.md`.
- Layer 8 consequence: shape the payment integration as a provider-agnostic port from day one
  (mirroring `lib/ai` and `lib/email`), but ship the **PayOS adapter alone**.

Registering `340:5402` in the screen registry records what Figma *designed*; its provider list loses
to P13 at port time. **This is not an open question and must not be re-escalated as one.**

### Error-state system — one design-system reference sheet, one real 404, one real in-app boundary, one likely-duplicate
| Node id | Frame | Size | Summary |
|---|---|---|---|
| `218:15740` | Error state | 1167×1720 | A **design-system spec sheet** ("Error states, gently handled"), not a real screen: 8 card variants (connection lost, AI/Sensei down, lesson gone, video load failure, gated content, 404, dashboard-partial, library-partial) plus an "Error language" tone-guideline footer ("Never blaming. Never alarming. Always Korume-led."). |
| `335:1588` | Error state (right font) | 1167×1719 | **Pixel-identical to `218:15740`** except one card's CTA label differs ("View Korume" vs blank) — reads as a font/typography QA pass over the same sheet, not a distinct screen. Likely mergeable/one supersedes the other; not adjudicated here. |
| `335:1976` | Error404 ` | 1280×537 | Real 404 page: "404 · Wrong Turn" / "We couldn't find this place.", Go Home + Go Back, shows the attempted path (`/kanji/lesson/green`). |
| `337:2055` | Error boundary | 1280×729 | Real in-app route-error screen, rendered **inside the actual app chrome** (sidebar + topbar visible) — "Something interrupted this page.", Try Again / Go to Dashboard, "Your progress is still saved." reassurance banner. |

⚠️ **Side finding, not this task's call:** the sidebar visible in `337:2055` lists LEARN (Dashboard,
Lessons, Kanji, Vocabulary, Grammar, Reading, Speaking, JLPT) and STUDY (Review, Mining) — worth
diffing against `components/layout/app-nav.tsx`'s current `NAV_GROUPS` (LEARN 8 / STUDY 4 / PROGRESS 1
/ ACCOUNT 1) next time nav is touched, since the counts don't obviously match. Not investigated further
here per the standing instruction not to settle navbar/routes without user review.

### Data privacy / deletion — NOT new content, corroborates what already shipped
| Node id | Frame | Size | Summary |
|---|---|---|---|
| `337:3323` | Data privacy (for delete) | 911×652 | `/settings/privacy` — Learning reminders toggle, Danger Zone (Delete Korume Memory / Delete Account / Delete all my data). |
| `339:3612` | Delete data | 1280×973 | The "Delete all my data" modal — itemized what's-deleted list, permanence warning, type-DELETE confirmation, checkbox. |

These are the two frames L9b Plan 1 (merged `4b1fef7`) already built against — confirmed here to match
the shipped `/settings/privacy` implementation. No new information, just closes the loop on why these
two were flagged load-bearing in the 2026-08-20 note.

### New marketing homepage — distinct from the existing `Homepage` frames
| Node id | Frame | Size | Summary |
|---|---|---|---|
| `347:6277` | Homepage | 1280×4028 | A full public marketing/landing page, unrelated to the other frame named "Homepage", `111:515` — which is the **authenticated Dashboard** ("Welcome back", Continue Learning, Today's Mission, Weakness Snapshot), ruled 2026-08-12 in `screen-inventory.md` §19.0/§19.1 and registered as `dashboard`. Long-scroll sections: hero ("Learn Japanese from the Japanese you actually want to understand"), a listening-comprehension score widget (87), an i+1 "recommends what's just beyond what you already know" section, a "Private. Secure. Built on trust." trust block, and a closing CTA ("A quieter way to keep going."). |

**Three frames are now named "Homepage"**: `111:515` (1278×1332, the **authenticated Dashboard** —
`screen-inventory.md` §19.0/§19.1; the name is the frame's, the identity is the picture's), `347:6277`
(1280×4028, marketing landing page — this one), and the hidden `346:6275` rectangle (not a screen).
Same collision pattern as the `29:2890`/`280:3` "Kanji" pair from the first capture — worth a rename
pass eventually, not urgent since node ids disambiguate.
