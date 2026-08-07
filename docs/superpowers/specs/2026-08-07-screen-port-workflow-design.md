# Screen-Port Workflow — Primitive Verification & Chrome Architecture — Design

> **Status:** Approved by user (Trần Nguyễn Phi Long) on 2026-08-07, brainstormed in conversation.
> Ready for `superpowers:writing-plans`.
>
> **Trigger:** The token + typography foundation merged (`86328bc`), closing steps 1–2 of the
> sequence the user set. This spec closes steps **3** (verify `components/ui/**` against the new
> tokens) and the **architectural half** of step **4** (layout primitives + shared shell / AppNav).
> Screens cannot be ported until both a porting *rule* and a chrome *contract* exist; without them,
> the same button/card/nav decisions get re-litigated 29 times.
>
> **Amends** `app/globals.css` (one typography step), `tailwind.config.ts`,
> `lib/design-tokens.test.ts`, eight files under `components/ui/**`, two files under
> `components/layout/**` and `components/learning/**` (three sites), the `app/[locale]/` route-group
> structure,
> `lib/data/videos.ts` (moves one function out), and `docs/design/screens/navigation-system.md`.
>
> **Closes** the open category-C ruling left by
> `docs/superpowers/specs/2026-08-06-figma-make-token-typography-adoption-design.md` §3 (the orange
> glow). Resolved upstream in `figma-prompt-style.md` at commit `fc33e90` — see §6.3.
>
> **Does NOT touch** any screen's content or layout, the colour tiers, radius, elevation, the five
> font roles, the Companion Learning Loop Boundary, or `(admin)`.

---

## 1. Scope

The user's sequence, with this spec's position marked:

1. Chốt token dark Korume — ✅ `86328bc`
2. Chốt font có tiếng Việt — ✅ `86328bc`
3. **Verify the `components/ui/**` primitives against the new tokens** ← this spec
4. **Layout primitives + shared shell / AppNav** ← this spec covers the *architecture*; the
   *geometry* is deferred by decision (§8.2)
5. Port screens by group — later
6. Polish — later

The governing principle, in the user's words, is **Token → Component → Layout primitives → Pages,
not screen-by-screen**. Once tokens and shared primitives are right, most of the 29 screens reduce
to layout work.

### 1.1 What this spec deliberately is not

It fixes no screen, freezes no design measurement, and adds no component the design has not already
proven it needs. Two boundaries were held explicitly during the brainstorm and are recorded so a
later reader does not read their absence as an oversight:

- `components/ui/container.tsx` is **shell**, not a primitive. Its `max-w-6xl` and `px-4/6/8` are
  Tailwind defaults that were never compared against the design, but correcting them requires a
  measured content width — deferred to §8.2, not smuggled into step 3.
- The design uses an **Avatar** primitive (`EditProfileScreen.tsx`, `ProfileOverviewScreen.tsx`:
  an initial letter inside a `rounded-full`) that `components/ui/` does not have. It is a new
  primitive, not an audit finding. It belongs to step 4's build or later.

---

## 2. Rule #0 — Semantic tokens are the API

> **Pixel values in Figma are not an API.** Every value must be mapped to a semantic token. Where
> Figma and the token layer disagree, the token layer is the source of truth for implementation.
> Any exception must be justified by **semantic role**, never by copying a pixel.

This is the first rule of the screen-port workflow and it outranks every per-screen decision. It
applies uniformly to typography, spacing, radius, elevation, and shell geometry.

**Corollary — Large Japanese glyphs are content presentation, not interface typography.** The design
renders 縁 and 話 at 104px, 128px and 150px. These are closer to illustration than to type. They are
never tokenised; no `kanji-xl` / `kanji-2xl` / `kanji-display` step may be added. Each screen owns
its own display-glyph sizing.

**Rationale (evidence, not part of the rule).** Measured against the design bundle, the ported px
values could not have been used directly: the design's dominant body size is **10px**. Full
distribution and the mapping onto the shipped scale are in Appendix A.1. The observed ratio between
the design's sizes and the shipped scale is approximately ×1.4, but that ratio is an *observation
about one snapshot*, not an invariant — the design's canvas may change, and the rule must survive it.
The ratio is therefore recorded as supporting evidence only, and no implementation may depend on it.

**The rule is already being violated.** Three sites predate this spec:

| File | Violation |
|---|---|
| `components/layout/notification-bell.tsx:201` | `text-[10px]` on the unread-count badge |
| `components/learning/badges-grid.tsx:95` | `text-[11px]` |
| `components/learning/badges-grid.tsx:97` | `text-[11px]` |

All three are below the `caption` step (12px) and all three are fixed in this spec's work. Note that
`notification-bell.tsx` is the same file that escaped a single-pattern grep during the token
foundation branch; this is its second escape, and it is why enforcement here is a test, not a sweep.

---

## 3. Typography — exactly one addition

### 3.1 What is added

| Token | Value | Rationale |
|---|---|---|
| `--text-hero` | `4rem` (64px) | Largest editorial headline. See §3.2. |
| `--leading-hero` | `4.25rem` (68px) | ≈1.06. The design's heroes use `leading-[0.98]`–`leading-[1.04]`; a hero line must not breathe like body copy. |

Registered in `tailwind.config.ts` `fontSize` as `hero` and added to the `TYPOGRAPHY_TOKENS`
assertions in `lib/design-tokens.test.ts`.

The resulting scale is seven steps:

```
caption  12   body  14   body-lg  16   heading  20   title  28   display  40   hero  64
```

### 3.2 Why `hero` earns a token, and why nothing else does

Frequency does not create a primitive; **shared semantic role** does. Sixteen sites in the design use
a size at or above 36px. Classified by role, they are not one group but four:

| Group | Count | Sites | Verdict |
|---|---|---|---|
| **Editorial hero headline** | 4 | `FaqScreen` 48px `<h1>`; `AuthScreen` 44px `<h1>`; `AboutPhilosophyScreen` 54px `<h1>` and 36px pull-quote | **Same role.** All are page-opening statements, all set in the display face (`font-['Outfit']` → `--font-display`), all preceded by an eyebrow, all with strong negative tracking. → `hero` |
| **Japanese content display** | 9 | 縁 ×3 (`KanjiStudyScreen`, `KanjiInspectorModal`, `KanjiExplorerScreen`), the target sentence 今日はいい天気ですね。 ×2 (`PronunciationStudio*`), 話 as a 10 %-opacity watermark (`HomeDashboardContent`), and 104/128/150px glyphs | Content presentation. Per §2's corollary, never tokenised. |
| **Not typography** | 2 | `EditProfileScreen`, `ProfileOverviewScreen` — an avatar initial inside a `rounded-full` | Belongs to the Avatar primitive (§1.1), not to the type scale. |
| **Oversized section heading** | 1 | `KanjiStudyScreen` 38px `<h2>` "affinity" — the kanji's meaning, set in Latin inside a study card | A single site, and a card heading rather than a page opener. It maps onto `title` / `display`; a lone occurrence does not earn a step. |

Only the first group survives the role test — and it survives it on role, not on being the largest:
the 62px watermark and the 128/150px glyphs are bigger and still do not qualify. Its three true
`<h1>`s measure 44/48/54px in design
space; `4rem` sits inside that cluster once mapped, and gives a 1.6× step over `display`, which is a
legible jump rather than a near-duplicate.

Note that all four hero sites live in **marketing / auth / about / faq** surfaces. `hero` is an
editorial token. Nothing in `(app)` uses it today.

### 3.3 What is explicitly rejected

- **No `eyebrow` step.** The design's 9px eyebrow maps onto the existing `caption` (12px) once the
  scale is normalised. Eyebrow is a *usage* of `caption`, not a primitive.
- **No `label` step, no renames, no reordering, no migration.** The six shipped names stay exactly as
  they are. `hero` is added on top and nothing else moves.
- **No second display tier.** `display-lg` / `display-xl` / `display-2xl` would turn the type scale
  into a copy of Figma. The scale stays at seven steps.
- **Radius, elevation, colour, and the five font roles are unchanged.** The design's radii are not a
  scale at all (22px ×39, 20px ×19, 18px ×15, 24px ×14, 16px ×4, 28px ×3 — six values inside a 12px
  band). Collapsing them onto `sm/md/lg/xl` = 8/14/20/28 was the correct normalisation and the
  rationale already recorded at `app/globals.css:92-101` stands.

---

## 4. Step 3 — Primitive verification

### 4.1 The finding

`components/ui/**` contains 15 non-test files, of which 13 are primitives (`reduce-motion-toggle.tsx`
and `theme-toggle.tsx` are feature components that happen to live there and are out of scope).

The good news first, because it bounds the work: **there is not a single arbitrary radius or shadow
value anywhere in `components/**`.** Every one is already on `rounded-sm/md/lg/xl/full` and
`shadow-raised/overlay/floating`. Colour is equally clean — two hardcoded sites exist and both are
legitimate (`shadowing-view.tsx:193-196`, white text on a `bg-black/90` player-error overlay).

The problem is the **spacing and typography scales**, which exist but are only half-adopted:

| State | Primitives |
|---|---|
| ✅ Fully on the token scale | `select` · `tabs` · `tooltip` · `popover` · `skeleton` |
| ⚠️ Mixed | `badge` (`py-0.5`) · `dialog` (`px-1`) · `toast` (`px-1`) |
| ❌ Entirely raw Tailwind | `button` (`gap-2 px-3 px-4 px-6 text-sm text-base`) · `card` (`p-6 space-y-1.5 text-lg`) · `input` (`px-3 py-2 h-10 text-sm`) · `label` (`text-sm`) · `container` (`px-4 sm:px-6 lg:px-8`, `max-w-6xl`) |

So step 3 is not the audit it was originally scoped as. Its real content is: **bring the most-used
primitives back onto the token system.** `button`, `card` and `input` appear on nearly every screen.
If they still read `px-4 py-2 text-sm gap-2` when porting begins, every ported screen will copy those
values by imitation. Fixing eight primitives is cheaper than fixing 29 screens.

### 4.2 The work

1. Move `button`, `card`, `input`, `label`, `badge`, `dialog`, `toast` onto `--space-*` and the
   typography steps. **Behaviour and public API do not change** — this is a class-level substitution,
   and the existing per-primitive tests are the regression net. Where a raw value has no exact token
   (`py-0.5`, `space-y-1.5`), round to the nearest step and record the delta in the plan rather than
   inventing a token for it.
2. Fix the three Rule #0 violations listed in §2.
3. Add `--text-hero` / `--leading-hero` per §3.
4. Rename `bg-inputBackground` → `bg-input-background` (2 sites: `input.tsx:12`, `select.tsx:46`).
   This is the camelCase outlier parked by the token foundation; the repo is kebab-case everywhere
   else and this is the cheapest moment to close it.
5. `container.tsx` is **not** touched — see §1.1 and §8.2.

---

## 5. Step 4 — Chrome architecture

### 5.1 The constraint that determines the shape

`app/[locale]/(app)/layout.tsx:28-32` states, in a comment that is load-bearing:

> *"Mounted ONCE, above every (app) surface, so the Companion's state — pending contexts, cooldown,
> machine — survives client-side navigation (spec 1 §5.11)."*

`AmbientProvider` owns Companion state. The obvious implementation of "workspaces have no nav" —
moving those routes into a **sibling** route group of `(app)` — would give the two groups different
layouts, unmounting the provider on every entry into a workspace and silently discarding Companion's
pending contexts, cooldown and machine state. No existing test covers this.

The architecture therefore has to separate two lifetimes that are currently fused:

> **Principle — Provider lifetime > layout lifetime.** The owner of application state must outlive
> every change of chrome. Where a provider sits is a question about session lifetime, not about UI.

`(protected)` is that lifetime boundary. It does not represent a UI; it represents the authenticated
**application session**. Every future session-scoped owner — AI conversation, study queue, draft
journal, mining selection — belongs at this level for the same reason.

### 5.2 The structure

```
app/[locale]/
├── (marketing)/            public                    → App page (public). `hero` lives here.
├── (auth)/                 public, no nav            → already the working precedent
├── (protected)/            auth + AmbientProvider + shared frame
│   ├── (app)/              AppNav mounted, visible   → App page
│   ├── (focus)/            AppNav mounted, hidden    → Workspace
│   └── (immersive)/        AppNav not mounted        → Immersive page
└── (admin)/                own shell                 → out of scope
```

`(protected)` is a shared segment for all three children, so its layout instance — and the provider
inside it — persists across navigation between them. Only the child layout swaps, which is exactly
what should swap: the nav. **No URL changes**, because route groups do not appear in the path —
moving `videos/[id]/shadowing/` out of `(app)` and into `(focus)` leaves it serving
`/videos/[id]/shadowing` exactly as before. Nav `href`s therefore need no edit.

> **Principle — Route groups express chrome contracts, not feature categories.** `(learning)` and
> `(study)` would be wrong: features change constantly, chrome contracts almost never. This is why
> the group structure can be expected to hold for years.

### 5.3 Why three children and not two

`(focus)` and `(immersive)` are different contracts, each with its own mandate in the design docs:

- **`(focus)` — nav exists, hidden by default, the learner can reopen it.**
  `docs/design/screens/screen-shadowing-practice.md` § Sidebar mandates hidden-by-default inside the
  Lesson Workspace, and `docs/design/screens/navigation-system.md:98-99` records that this behaviour
  *"is still unbuilt and belongs to whichever plan builds that route group"*. "Hidden by default"
  presupposes it can be shown, so `AppNav` stays mounted; only its initial visibility state differs.
  Members: Shadowing Practice, Dictation, Pronunciation Studio.
- **`(immersive)` — no nav at all.** No mount, no toggle, no chrome. The user's worked example:
  Companion Diary having no navbar is *correct*, not an omission. Members: Companion Diary,
  onboarding.

Collapsing them would forfeit the hidden-but-recoverable mandate. They stay separate.

### 5.4 The fourth screen type: overlays are not routes

> **Overlay is presentation, not navigation.**

A modal frame in Figma (Kanji Inspector, Create Conversation) is ported as a `dialog` / `drawer`
component rendered by its parent screen — never as a `page.tsx`. A route is justified only when the
URL carries meaning: shareability, or state that must be recoverable on reload. In that case App
Router's intercepting routes are the mechanism, and the justification is written down for that
screen. The default is a component.

### 5.5 Extraction work

`(app)/layout.tsx` currently does four jobs: env check, user fetch, redirect, frame construction. The
first three move up to `(protected)/layout.tsx`; the frame becomes a shared component consumed by all
three child layouts, parameterised only by its nav slot.

`requireUser` already exists but lives in `lib/data/videos.ts:31`, which is the wrong home for an
auth helper used by every protected layout. It moves to `lib/auth/`.

### 5.6 Accessibility consequence

`docs/design/screens/navigation-system.md` § Accessibility requires the Nav Column to be a single
`<nav>` landmark. `(immersive)` has no such landmark by construction, so every immersive screen must
provide its own labelled back affordance and a `<main>` landmark. This is a per-screen requirement
the porting checklist enforces, not something the group layout can supply.

---

## 6. Governance amendments

### 6.1 A claim in `navigation-system.md` is currently false

`docs/design/screens/navigation-system.md:136-140` states that navigation recedes during focused
study because those flows *"render outside the persistent nav chrome context for that flow"*.

Verified against code, this is not true today:

- `app/[locale]/(app)/videos/[id]/shadowing/page.tsx` and `.../dictation/page.tsx` are both inside
  `(app)`, which mounts `AppNav`.
- The app has exactly five `layout.tsx` files; **none** of them removes the nav for a nested route.
- `components/video-player/shadowing-view.tsx:179` renders inline (`aspect-video rounded-lg`), not as
  a full-screen surface.

The paragraph is amended to describe the route-group mechanism, and the amendment is labelled in the
plan as **correcting a false claim**, not as documenting existing behaviour. This is the same defect
class the token foundation's whole-branch review caught twice, and it is why the correction is
recorded rather than quietly rewritten.

### 6.2 `navigation-system.md` § Navigation States

The table's third row (Collapsed / Icon rail, "Planned") is unaffected. `(focus)` implements
*hidden*, not *collapsed* — they are different states and must not be conflated. The doc gains the
route-group vocabulary; the planned icon rail remains planned.

### 6.3 The orange glow — closed

`shadow-[0_0_12px_#FF8A3D]` (×3 in the design) contradicted the Design DNA's own "No neon" rule and
was deliberately not adopted into the token layer, leaving an open category-C ruling. The user ruled
it a design mistake, to be brought back to the standard treatment.

Resolved at commit **`fc33e90`**, upstream in `figma-prompt-style.md` — the prompt source, not the
repo, because the glow never reached the repo (verified: zero occurrences of `shadow-[0_0` in
`components/**` and `app/**`). "No neon" had read as a rule about *colours*, which is how a coloured
*shadow* slipped past it; it is now explicit in all four places the constitution is enforced, and the
three black elevation values the document was missing were added, since their absence is why a glow
was invented to express lift. The two inset uses — a focus ring and an active-tab underline — remain
allowed: they are state indicators, not elevation.

### 6.4 `figma-prompt-style.md` is not a measurement source

The user's ruling, recorded verbatim because it changes how the document must be read:

> *"docs đó chỉ là docs tạm bợ, không phải docs chuẩn thực sự … nó chỉ là áng chừng và mơ hồ"*

Confirmed by measurement. The document's **colour (9 tokens) and font (5 roles) sections match the
shipped code exactly** — they were written after `86328bc`. Its **geometry is approximate throughout**:

| | Document | Measured from the design |
|---|---|---|
| Sidebar | 224px | **220px** |
| Collapsed sidebar | 62px | **68px** |
| Content max width | 1500px | **1180px** (×9), 1010px (×4) |
| Radius | 22 / 16 / 12 / 24 | six values 16–28; **12px never appears** |

The document is authoritative for **intent** — DNA, screen types, motion philosophy, negative
prompts. It is authoritative for **nothing numeric**. Any future reader taking a measurement from it
is making an error this section exists to prevent.

---

## 7. Enforcement

Rule #0 is worthless as prose. It ships as a test, in the same family as the existing
`components/ui/logical-properties.test.ts`:

- **Scope:** `components/ui/**`, plus the three sites named in §2.
- **Forbids:** arbitrary Tailwind values carrying an absolute `px`/`rem` literal for typography or
  spacing — `text-[12px]`, `p-[10px]`, `gap-[6px]`, `rounded-[22px]`, `leading-[18px]`.
- **Allows:** arbitrary values that are not absolute literals — CSS custom properties
  (`min-w-[--radix-select-trigger-width]`), viewport units (`h-[80vh]`, `max-w-[90vw]`), `calc()`,
  and percentages. These express relationships, not copied pixels, and the distinction is the point
  of the rule.
- **Widening the scope to all of `components/**`** is deliberately not done here. The tree currently
  holds a handful of `h-[8rem]`-style values that each need a judgement call, and mixing that into
  this spec would blur its boundary. It is a step-5 decision.

The existing suites remain the regression net for §4.2: the per-primitive tests, the token contract
in `lib/design-tokens.test.ts`, the contrast assertions, and the logical-properties scan.

**Verification baseline** (master @ `fc33e90`; docs-only since `dab8983`, so the figures are
unchanged): unit **1966 / 218 files**, `tsc` 0, lint 0 errors +
**77** pre-existing warnings (`54 no-non-null-assertion + 23 no-unused-vars` — compare the rule mix,
not the count), Playwright 6/6.

⚠️ Label or route changes must be swept by hand through `tests/e2e/`: `vitest.config.ts` excludes it,
so `npm test` cannot catch a broken Playwright selector. This gap produced the rebrand branch's only
Critical finding.

---

## 8. Deferred by decision

Two items are left open on purpose. Each has a defined closing condition; neither is an unfinished
thought.

### 8.1 Next.js route-group navigation behaviour — closed by a spike

Route groups are the intended implementation. A prototype must verify that navigation between
sibling groups under `(protected)` preserves client-side transitions and **provider identity** — that
`AmbientProvider` is not remounted when the learner moves from `(app)` into `(focus)`. If Next.js
14.2.35 cannot satisfy this in practice, the **implementation strategy** is revisited, not the
architectural model: the lifetime boundary of §5.1 holds regardless of the mechanism that expresses
it, and the fallback is a single layout receiving a chrome mode.

**Closing condition:** the first task of the implementation plan is this spike, with a test asserting
provider identity across the boundary. No further route moves happen until it passes.

### 8.2 Shell geometry — closed at port time, by measurement

Sidebar width, collapsed width, top toolbar height, right information column width, content max
width, and page gutters are **not fixed by this spec**. Measurements exist (Appendix A.2) but they
come from a local snapshot that is known to decay — it was proven stale within one day — and the
user is still actively designing; the newest Shadowing Hub frame is 1536px wide where the rest are
1278px, so the canvas itself is still moving.

**Closing condition:** each number is measured against the **live** Figma Make project at the moment
the first screen in its group is ported, and recorded then. Until then `container.tsx` keeps its
current values, which are wrong but honestly so.

---

## 9. Out of scope

Screen content and layout for any of the 29 frames · the Avatar primitive · `(admin)` · the
`/videos` → `/shadowing` route rename (Shadowing Hub Plan C's call — nav labels already read
`lessons` while `href` remains `/videos`) · the INSIGHTS nav group, which renders nothing today
because all three of its rows are unbuilt · light mode · the planned Collapsed / Icon-rail nav state.

---

## Appendix A — Measurements

> **Provenance.** Measured 2026-08-07 from the local bundle snapshot at
> `C:\Users\tplon\Downloads\Design Shadowing Page UI`, tier B only (`src/app/components/`). This
> snapshot is **not authoritative** — the live Figma Make project is
> (https://www.figma.com/make/F4YT6PojqSDf8mYNe1ZuZH/Design-Shadowing-Page-UI). Five screens
> (Pronunciation Library, Kanji Library, Pronunciation Detail, Pricing, Homepage) exist only in
> tier C and are therefore **absent from every figure below**. These numbers support §2 and §3;
> nothing in the implementation may depend on them.

### A.1 Type sizes — 883 arbitrary `text-[Npx]` uses

```
 9px ×184    10px ×324    11px ×113    12px ×49    13px ×22    14px ×15    15px ×19
16px ×11     17px ×8      18px ×13     20px ×8     22px ×10    24px ×4     26px ×9
28px ×9      30px ×5      32px ×6      34px ×8     36–62px ×13     104/128/150px ×3
```

70 % of all sizing sits at 9–11px. Mapped onto the shipped scale:

| Design | ≈ | Shipped token |
|---|---|---|
| 9px (×184) | 12.6 | `caption` 12 |
| 10px (×324) | 14.0 | `body` 14 |
| 11px (×113) | 15.4 | `body-lg` 16 |
| 14px | 19.6 | `heading` 20 |
| 20px | 28.0 | `title` 28 |
| 28px | 39.2 | `display` 40 |

Six steps, one consistent ratio. The shipped scale *is* the design's scale in different units — which
is the finding that makes Rule #0 a mapping rule rather than a prohibition.

### A.2 Geometry — recorded, not adopted (see §8.2)

```
sidebar        220px ×4        collapsed sidebar   68px ×2
content        1180px ×9,  1010px ×4               canvas   1440px ×3
```

Current code, for comparison: sidebar `md:w-60` (240px), collapsed toggle strip `md:w-6` (24px),
`Container` `max-w-6xl` (1152px) with `px-4 sm:px-6 lg:px-8`.

### A.3 Radius — why no change was made

```
22px ×39    20px ×19    18px ×15    24px ×14    16px ×4    28px ×3
```

Six values inside a 12px band, plus 2/3/4px one-offs. Not a scale. `sm/md/lg/xl` = 8/14/20/28 stands.
